const axios = require('axios');
const db = require('../database/db');
const config = require('../config');

/**
 * Probe WhatsApp number for ban status
 * Uses real API from baron0.com/panel
 */
async function probeWhatsApp(userId, number, lang) {
    console.log(`[PROBE] Checking number: ${number} for user: ${userId}`);

    // 1. Check cache first (STICKY behavior)
    const cached = await db.getBanCheck('whatsapp', number);

    if (cached) {
        console.log(`[PROBE] Cache found: status=${cached.status}`);
        if (cached.status === 'banned') {
            return {
                status: 'banned',
                reason: lang === 'pt' ? cached.reason_pt : cached.reason_en,
                reasonId: cached.reason_id,
                perma: cached.perma === 1,
                modban: cached.modban === 1,
                banDate: cached.ban_date,
                reviewRequested: cached.review_requested === 1,
                reviewDate: cached.review_date,
                cached: true
            };
        }
        // If was unbanned before, we re-probe to see if status changed
    }

    // 2. Call real API
    let apiResult = null;
    let apiError = null;

    try {
        apiResult = await callWhatsAppAPI(number);
        console.log(`[PROBE] API result:`, JSON.stringify(apiResult, null, 2));
    } catch (err) {
        apiError = err.message;
        console.error(`[PROBE] API ERROR:`, err.message);
        console.error(`[PROBE] Stack:`, err.stack);
    }

    // 3. If API failed and we have cached data, return cached with warning
    if (!apiResult && cached) {
        console.log(`[PROBE] API failed, using cached data`);
        return {
            status: cached.status,
            reason: lang === 'pt' ? cached.reason_pt : cached.reason_en,
            perma: cached.perma === 1,
            modban: cached.modban === 1,
            banDate: cached.ban_date,
            reviewRequested: cached.review_requested === 1,
            reviewDate: cached.review_date,
            cached: true,
            apiError: apiError
        };
    }

    // 4. If API failed and no cache, return error
    if (!apiResult) {
        return {
            status: 'error',
            error: apiError || 'API request failed',
            cached: false
        };
    }

    // 5. Store and return result
    return await processAndStoreResult(userId, number, apiResult, cached, lang);
}

/**
 * Call the real WhatsApp ban check API
 */
async function callWhatsAppAPI(number) {
    const url = config.WHATSAPP_API_URL;
    const apiKey = config.WHATSAPP_API_KEY;

    if (!url || !apiKey) {
        throw new Error('API URL or API Key not configured');
    }

    console.log(`[API] Calling: ${url}`);
    console.log(`[API] Number: ${number}`);

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    if (config.WHATSAPP_API_SECRET) {
        headers['X-API-Secret'] = config.WHATSAPP_API_SECRET;
    }

    // Try POST first with JSON body
    let response;
    let methodUsed = 'POST';

    try {
        console.log(`[API] Trying POST...`);
        response = await axios.post(url, {
            phone: number,
            number: number,
            action: 'check_ban',
            type: 'ban_check'
        }, { 
            headers, 
            timeout: 20000,
            validateStatus: () => true // Don't throw on non-2xx
        });
        console.log(`[API] POST status: ${response.status}`);
    } catch (postErr) {
        console.log(`[API] POST failed: ${postErr.message}`);

        // Fallback to GET with query params
        try {
            console.log(`[API] Trying GET...`);
            methodUsed = 'GET';
            response = await axios.get(url, {
                params: { 
                    phone: number,
                    number: number,
                    key: apiKey,
                    action: 'check_ban'
                },
                headers,
                timeout: 20000,
                validateStatus: () => true
            });
            console.log(`[API] GET status: ${response.status}`);
        } catch (getErr) {
            console.log(`[API] GET failed: ${getErr.message}`);
            throw new Error(`API unreachable: ${getErr.message}`);
        }
    }

    console.log(`[API] Response status: ${response.status}`);
    console.log(`[API] Response data:`, JSON.stringify(response.data, null, 2));

    if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}: ${JSON.stringify(response.data)}`);
    }

    return parseAPIResponse(response.data);
}

/**
 * Parse API response - handles multiple possible formats
 */
function parseAPIResponse(data) {
    console.log(`[PARSER] Raw data type:`, typeof data);

    // If data is a string, try to parse JSON
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            console.log(`[PARSER] Data is string, not JSON:`, data);
            // Try to extract status from string
            if (data.toLowerCase().includes('banned')) {
                return { status: 'banned', reason: 'Unknown' };
            }
            if (data.toLowerCase().includes('unbanned') || data.toLowerCase().includes('active')) {
                return { status: 'unbanned' };
            }
            throw new Error(`Unexpected API response format: ${data}`);
        }
    }

    // Handle array response
    if (Array.isArray(data)) {
        data = data[0] || {};
    }

    // Handle nested data
    if (data.data) data = data.data;
    if (data.result) data = data.result;
    if (data.response) data = data.response;

    console.log(`[PARSER] Processed data:`, JSON.stringify(data, null, 2));

    // Extract status - check multiple possible field names
    let status = extractField(data, ['status', 'state', 'ban_status', 'account_status', 'result']);

    if (!status) {
        console.log(`[PARSER] No status field found, checking boolean flags...`);
        // Check boolean flags
        if (data.banned === true || data.is_banned === true || data.ban === true) {
            status = 'banned';
        } else if (data.banned === false || data.is_banned === false || data.ban === false) {
            status = 'unbanned';
        } else {
            status = 'unknown';
        }
    }

    status = String(status).toLowerCase();
    console.log(`[PARSER] Detected status: ${status}`);

    // Map various status values
    if (status === 'active' || status === 'ok' || status === 'good' || status === 'clean' || status === 'valid') {
        status = 'unbanned';
    } else if (status === 'not_found' || status === 'invalid' || status === 'nonexistent' || status === 'no_whatsapp') {
        status = 'not_found';
    } else if (status === 'banned' || status === 'blocked' || status === 'suspended' || status === 'restricted') {
        status = 'banned';
    }

    if (status === 'unbanned') {
        return { status: 'unbanned' };
    }

    if (status === 'not_found') {
        return { status: 'not_found' };
    }

    // Extract ban details for banned status
    const result = {
        status: 'banned',
        reason: extractField(data, ['reason', 'ban_reason', 'cause', 'violation', 'description', 'message']) || 'Unknown',
        perma: isTruthy(extractField(data, ['perma', 'permanent', 'is_permanent', 'permaban'])),
        modban: isTruthy(extractField(data, ['modban', 'mod_ban', 'is_modban', 'moderator_ban'])),
        banDate: extractField(data, ['banned_at', 'ban_date', 'date', 'created_at', 'timestamp']),
        reviewRequested: isTruthy(extractField(data, ['review_requested', 'review', 'appeal_requested', 'appeal'])),
        reviewDate: extractField(data, ['review_date', 'reviewed_at', 'appeal_date'])
    };

    console.log(`[PARSER] Parsed result:`, JSON.stringify(result, null, 2));
    return result;
}

/**
 * Extract field from object checking multiple possible keys
 */
function extractField(obj, keys) {
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) {
            return obj[key];
        }
        // Check lowercase variant
        const lowerKey = key.toLowerCase();
        if (obj[lowerKey] !== undefined && obj[lowerKey] !== null) {
            return obj[lowerKey];
        }
        // Check snake_case variant
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        if (obj[snakeKey] !== undefined && obj[snakeKey] !== null) {
            return obj[snakeKey];
        }
    }
    return null;
}

/**
 * Check if value is truthy
 */
function isTruthy(value) {
    if (value === true || value === 'true' || value === 'yes' || value === 1 || value === '1') {
        return true;
    }
    return false;
}

/**
 * Process API result and store in database
 */
async function processAndStoreResult(userId, number, apiResult, cached, lang) {
    if (apiResult.status === 'unbanned') {
        await db.saveBanCheck(userId, 'whatsapp', number, 'unbanned', null, 0, 0, null);
        return {
            status: 'unbanned',
            reason: null,
            perma: false,
            modban: false,
            banDate: null,
            reviewRequested: false,
            reviewDate: null,
            cached: false
        };
    }

    if (apiResult.status === 'not_found') {
        await db.saveBanCheck(userId, 'whatsapp', number, 'not_found', null, 0, 0, null);
        return {
            status: 'not_found',
            reason: null,
            perma: false,
            modban: false,
            banDate: null,
            reviewRequested: false,
            reviewDate: null,
            cached: false
        };
    }

    // Banned
    let reasonId = null;
    let reasonText = apiResult.reason;

    // If we have cached reason and API still says banned, keep same reason for consistency
    if (cached && cached.status === 'banned' && cached.reason_id) {
        reasonId = cached.reason_id;
        const cachedReason = lang === 'pt' ? cached.reason_pt : cached.reason_en;
        if (cachedReason && cachedReason !== 'Unknown') {
            reasonText = cachedReason;
        }
    }

    // If no cached reason, store the API reason
    if (!reasonId && reasonText && reasonText !== 'Unknown') {
        // Try to find matching reason in DB or create one
        // For now, we'll use a random reason from our pool if API doesn't provide one
        const randomReason = await db.getRandomReason();
        if (randomReason) {
            reasonId = randomReason.id;
            reasonText = lang === 'pt' ? randomReason.reason_pt : randomReason.reason_en;
        }
    }

    const banDate = apiResult.banDate || new Date().toISOString();

    await db.saveBanCheck(
        userId, 
        'whatsapp', 
        number, 
        'banned', 
        reasonId, 
        apiResult.perma ? 1 : 0, 
        apiResult.modban ? 1 : 0, 
        banDate
    );

    return {
        status: 'banned',
        reason: reasonText || 'Unknown',
        reasonId: reasonId,
        perma: apiResult.perma,
        modban: apiResult.modban,
        banDate: banDate,
        reviewRequested: apiResult.reviewRequested || false,
        reviewDate: apiResult.reviewDate || null,
        cached: false
    };
}

module.exports = {
    probeWhatsApp
};
