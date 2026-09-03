const axios = require('axios');
const db = require('../database/db');
const config = require('../config');

console.log('[WHATSAPP PROBE] Module loaded');
console.log('[WHATSAPP PROBE] API URL:', config.WHATSAPP_API_URL ? 'SET' : 'NOT SET');
console.log('[WHATSAPP PROBE] API KEY:', config.WHATSAPP_API_KEY ? 'SET (' + config.WHATSAPP_API_KEY.substring(0, 20) + '...)' : 'NOT SET');
console.log('[WHATSAPP PROBE] SIMULATION:', config.SIMULATION_MODE);

async function probeWhatsApp(userId, number, lang) {
    console.log(`[PROBE] ===== START =====`);
    console.log(`[PROBE] Checking number: ${number}`);
    console.log(`[PROBE] User ID: ${userId}`);
    console.log(`[PROBE] Lang: ${lang}`);

    try {
        // 1. Check cache
        console.log(`[PROBE] Checking cache...`);
        const cached = await db.getBanCheck('whatsapp', number);
        console.log(`[PROBE] Cache result:`, cached ? `status=${cached.status}` : 'null');

        if (cached && cached.status === 'banned') {
            console.log(`[PROBE] Returning cached banned result`);
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

        // 2. Call API
        console.log(`[PROBE] Calling API...`);
        let apiResult;

        try {
            apiResult = await callWhatsAppAPI(number);
            console.log(`[PROBE] API call succeeded`);
        } catch (apiErr) {
            console.error(`[PROBE] API call failed:`, apiErr.message);

            // If API fails and we have cached unbanned data, return it
            if (cached) {
                console.log(`[PROBE] Using cached fallback: ${cached.status}`);
                return {
                    status: cached.status,
                    reason: lang === 'pt' ? cached.reason_pt : cached.reason_en,
                    perma: cached.perma === 1,
                    modban: cached.modban === 1,
                    banDate: cached.ban_date,
                    reviewRequested: cached.review_requested === 1,
                    reviewDate: cached.review_date,
                    cached: true,
                    apiError: apiErr.message
                };
            }

            // No cache, return error
            console.log(`[PROBE] Returning error - no cache`);
            return {
                status: 'error',
                error: `API Error: ${apiErr.message}`,
                cached: false
            };
        }

        // 3. Process result
        console.log(`[PROBE] Processing result:`, JSON.stringify(apiResult));
        const result = await processAndStoreResult(userId, number, apiResult, cached, lang);
        console.log(`[PROBE] ===== END =====`);
        return result;

    } catch (err) {
        console.error(`[PROBE] UNEXPECTED ERROR:`, err.message);
        console.error(`[PROBE] Stack:`, err.stack);
        return {
            status: 'error',
            error: `Unexpected error: ${err.message}`,
            cached: false
        };
    }
}

async function callWhatsAppAPI(number) {
    console.log(`[API] ===== API CALL START =====`);

    const url = config.WHATSAPP_API_URL;
    const apiKey = config.WHATSAPP_API_KEY;

    if (!url) {
        console.error(`[API] ERROR: WHATSAPP_API_URL not set`);
        throw new Error('WHATSAPP_API_URL not configured');
    }
    if (!apiKey) {
        console.error(`[API] ERROR: WHATSAPP_API_KEY not set`);
        throw new Error('WHATSAPP_API_KEY not configured');
    }

    console.log(`[API] URL: ${url}`);
    console.log(`[API] Number: ${number}`);

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    if (config.WHATSAPP_API_SECRET) {
        headers['X-API-Secret'] = config.WHATSAPP_API_SECRET;
    }

    console.log(`[API] Headers:`, JSON.stringify(headers));

    // Try POST
    let response;
    try {
        console.log(`[API] Sending POST request...`);
        response = await axios.post(url, {
            phone: number,
            number: number,
            action: 'check_ban',
            type: 'ban_check'
        }, { 
            headers, 
            timeout: 30000
        });
        console.log(`[API] POST success - Status: ${response.status}`);
    } catch (postErr) {
        console.error(`[API] POST failed:`, postErr.message);
        if (postErr.response) {
            console.error(`[API] POST error status:`, postErr.response.status);
            console.error(`[API] POST error data:`, JSON.stringify(postErr.response.data));
        }

        // Try GET
        try {
            console.log(`[API] Sending GET request...`);
            response = await axios.get(url, {
                params: { 
                    phone: number,
                    number: number,
                    key: apiKey,
                    action: 'check_ban'
                },
                headers,
                timeout: 30000
            });
            console.log(`[API] GET success - Status: ${response.status}`);
        } catch (getErr) {
            console.error(`[API] GET failed:`, getErr.message);
            if (getErr.response) {
                console.error(`[API] GET error status:`, getErr.response.status);
                console.error(`[API] GET error data:`, JSON.stringify(getErr.response.data));
            }
            throw new Error(`API unreachable: ${getErr.message}`);
        }
    }

    console.log(`[API] Response status: ${response.status}`);
    console.log(`[API] Response data type:`, typeof response.data);
    console.log(`[API] Response data:`, JSON.stringify(response.data, null, 2));

    const parsed = parseAPIResponse(response.data);
    console.log(`[API] Parsed result:`, JSON.stringify(parsed));
    console.log(`[API] ===== API CALL END =====`);

    return parsed;
}

function parseAPIResponse(data) {
    console.log(`[PARSER] ===== PARSING START =====`);
    console.log(`[PARSER] Input type:`, typeof data);

    // Handle string response
    if (typeof data === 'string') {
        console.log(`[PARSER] Data is string:`, data.substring(0, 200));
        try {
            data = JSON.parse(data);
            console.log(`[PARSER] Parsed JSON successfully`);
        } catch (e) {
            console.log(`[PARSER] Not valid JSON, checking string content...`);
            const lower = data.toLowerCase();
            if (lower.includes('banned')) return { status: 'banned', reason: 'Unknown' };
            if (lower.includes('unbanned') || lower.includes('active')) return { status: 'unbanned' };
            if (lower.includes('not found') || lower.includes('invalid')) return { status: 'not_found' };
            throw new Error(`Unexpected string response: ${data.substring(0, 100)}`);
        }
    }

    // Handle array
    if (Array.isArray(data)) {
        console.log(`[PARSER] Data is array, length:`, data.length);
        data = data[0] || {};
    }

    // Handle nested
    if (data.data) {
        console.log(`[PARSER] Found nested .data`);
        data = data.data;
    }
    if (data.result) {
        console.log(`[PARSER] Found nested .result`);
        data = data.result;
    }
    if (data.response) {
        console.log(`[PARSER] Found nested .response`);
        data = data.response;
    }

    console.log(`[PARSER] Final data keys:`, Object.keys(data));

    // Extract status
    let status = null;
    const statusKeys = ['status', 'state', 'ban_status', 'account_status', 'result', 'code'];
    for (const key of statusKeys) {
        if (data[key] !== undefined && data[key] !== null) {
            status = String(data[key]).toLowerCase();
            console.log(`[PARSER] Found status in .${key}: ${status}`);
            break;
        }
    }

    // Check boolean flags if no status string
    if (!status) {
        console.log(`[PARSER] No status string, checking booleans...`);
        if (data.banned === true || data.is_banned === true) {
            status = 'banned';
            console.log(`[PARSER] Boolean banned=true detected`);
        } else if (data.banned === false || data.is_banned === false) {
            status = 'unbanned';
            console.log(`[PARSER] Boolean banned=false detected`);
        }
    }

    if (!status) {
        console.error(`[PARSER] Could not determine status from:`, JSON.stringify(data));
        throw new Error('Could not parse API response status');
    }

    console.log(`[PARSER] Final status: ${status}`);

    // Map status
    if (['active', 'ok', 'good', 'clean', 'valid', 'unbanned', 'live'].includes(status)) {
        console.log(`[PARSER] Mapped to: unbanned`);
        return { status: 'unbanned' };
    }
    if (['not_found', 'invalid', 'nonexistent', 'no_whatsapp', 'not_registered'].includes(status)) {
        console.log(`[PARSER] Mapped to: not_found`);
        return { status: 'not_found' };
    }

    // Banned - extract details
    console.log(`[PARSER] Extracting ban details...`);
    const result = {
        status: 'banned',
        reason: extractField(data, ['reason', 'ban_reason', 'cause', 'violation', 'description', 'message', 'error']) || 'Unknown',
        perma: isTruthy(extractField(data, ['perma', 'permanent', 'is_permanent', 'permaban'])),
        modban: isTruthy(extractField(data, ['modban', 'mod_ban', 'is_modban', 'moderator_ban'])),
        banDate: extractField(data, ['banned_at', 'ban_date', 'date', 'created_at', 'timestamp']),
        reviewRequested: isTruthy(extractField(data, ['review_requested', 'review', 'appeal_requested', 'appeal'])),
        reviewDate: extractField(data, ['review_date', 'reviewed_at', 'appeal_date'])
    };

    console.log(`[PARSER] Parsed ban details:`, JSON.stringify(result));
    console.log(`[PARSER] ===== PARSING END =====`);
    return result;
}

function extractField(obj, keys) {
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) {
            return obj[key];
        }
        const lowerKey = key.toLowerCase();
        if (obj[lowerKey] !== undefined && obj[lowerKey] !== null) {
            return obj[lowerKey];
        }
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        if (obj[snakeKey] !== undefined && obj[snakeKey] !== null) {
            return obj[snakeKey];
        }
    }
    return null;
}

function isTruthy(value) {
    if (value === true || value === 'true' || value === 'yes' || value === 1 || value === '1') {
        return true;
    }
    return false;
}

async function processAndStoreResult(userId, number, apiResult, cached, lang) {
    console.log(`[STORE] Storing result: ${apiResult.status}`);

    if (apiResult.status === 'unbanned') {
        await db.saveBanCheck(userId, 'whatsapp', number, 'unbanned', null, 0, 0, null);
        return { status: 'unbanned', reason: null, perma: false, modban: false, banDate: null, reviewRequested: false, reviewDate: null, cached: false };
    }

    if (apiResult.status === 'not_found') {
        await db.saveBanCheck(userId, 'whatsapp', number, 'not_found', null, 0, 0, null);
        return { status: 'not_found', reason: null, perma: false, modban: false, banDate: null, reviewRequested: false, reviewDate: null, cached: false };
    }

    // Banned
    let reasonId = null;
    let reasonText = apiResult.reason;

    if (cached && cached.status === 'banned' && cached.reason_id) {
        reasonId = cached.reason_id;
        const cachedReason = lang === 'pt' ? cached.reason_pt : cached.reason_en;
        if (cachedReason && cachedReason !== 'Unknown') {
            reasonText = cachedReason;
        }
    }

    if (!reasonId && (!reasonText || reasonText === 'Unknown')) {
        console.log(`[STORE] No reason from API, using random from pool`);
        const randomReason = await db.getRandomReason();
        if (randomReason) {
            reasonId = randomReason.id;
            reasonText = lang === 'pt' ? randomReason.reason_pt : randomReason.reason_en;
        }
    }

    const banDate = apiResult.banDate || new Date().toISOString();

    await db.saveBanCheck(userId, 'whatsapp', number, 'banned', reasonId, apiResult.perma ? 1 : 0, apiResult.modban ? 1 : 0, banDate);

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

module.exports = { probeWhatsApp };
