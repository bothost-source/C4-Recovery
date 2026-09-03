const axios = require('axios');
const db = require('../database/db');
const config = require('../config');

console.log('[WHATSAPP PROBE] Module loaded');
console.log('[WHATSAPP PROBE] API URL:', config.WHATSAPP_API_URL);
console.log('[WHATSAPP PROBE] API KEY:', config.WHATSAPP_API_KEY ? 'SET' : 'NOT SET');

async function probeWhatsApp(userId, number, lang) {
    console.log(`[PROBE] ===== START =====`);
    console.log(`[PROBE] Checking number: ${number}`);

    try {
        // Check cache
        const cached = await db.getBanCheck('whatsapp', number);
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

        // Call API
        console.log(`[PROBE] Calling API...`);
        let apiResult;

        try {
            apiResult = await callWhatsAppAPI(number);
            console.log(`[PROBE] API call succeeded`);

            // Increment quota on successful API call
            await db.incrementQuota();
            console.log(`[PROBE] Quota incremented`);
        } catch (apiErr) {
            console.error(`[PROBE] API call failed:`, apiErr.message);

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

            return {
                status: 'error',
                error: `API Error: ${apiErr.message}`,
                cached: false
            };
        }

        // Process result
        const result = await processAndStoreResult(userId, number, apiResult, cached, lang);
        console.log(`[PROBE] ===== END =====`);
        return result;

    } catch (err) {
        console.error(`[PROBE] UNEXPECTED ERROR:`, err.message);
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

    if (!url) throw new Error('WHATSAPP_API_URL not configured');
    if (!apiKey) throw new Error('WHATSAPP_API_KEY not configured');

    console.log(`[API] URL: ${url}`);
    console.log(`[API] Number: ${number}`);

    // Exact format from BanCheck docs
    const response = await axios.post(url, {
        number: number
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    console.log(`[API] Status: ${response.status}`);
    console.log(`[API] Response:`, JSON.stringify(response.data, null, 2));

    if (response.status !== 200) {
        throw new Error(`API returned ${response.status}: ${JSON.stringify(response.data)}`);
    }

    const parsed = parseAPIResponse(response.data);
    console.log(`[API] Parsed:`, JSON.stringify(parsed));
    console.log(`[API] ===== API CALL END =====`);

    return parsed;
}

function parseAPIResponse(data) {
    console.log(`[PARSER] Input:`, JSON.stringify(data));

    // Handle string
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } 
        catch (e) { throw new Error(`String response: ${data.substring(0, 100)}`); }
    }

    // Handle array
    if (Array.isArray(data)) data = data[0] || {};

    // Handle nested
    if (data.data) data = data.data;
    if (data.result) data = data.result;

    // Extract fields per BanCheck API format
    const banned = data.banned;
    const status = banned === true ? 'banned' : (banned === false ? 'unbanned' : 'unknown');

    if (status === 'unknown') {
        throw new Error(`Could not parse status from: ${JSON.stringify(data)}`);
    }

    if (status === 'unbanned') {
        return { status: 'unbanned' };
    }

    return {
        status: 'banned',
        reason: data.reason || data.ban_reason || 'Unknown',
        perma: data.permanent === true || data.perma === true,
        modban: data.modban === true,
        banDate: data.banned_at || data.ban_date || new Date().toISOString(),
        reviewRequested: data.review_requested === true,
        reviewDate: data.review_date || null
    };
}

async function processAndStoreResult(userId, number, apiResult, cached, lang) {
    if (apiResult.status === 'unbanned') {
        await db.saveBanCheck(userId, 'whatsapp', number, 'unbanned', null, 0, 0, null);
        return { status: 'unbanned', reason: null, perma: false, modban: false, banDate: null, reviewRequested: false, reviewDate: null, cached: false };
    }

    // Banned
    let reasonId = null;
    let reasonText = apiResult.reason;

    if (cached && cached.status === 'banned' && cached.reason_id) {
        reasonId = cached.reason_id;
        const cachedReason = lang === 'pt' ? cached.reason_pt : cached.reason_en;
        if (cachedReason && cachedReason !== 'Unknown') reasonText = cachedReason;
    }

    if (!reasonId && (!reasonText || reasonText === 'Unknown')) {
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
