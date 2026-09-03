const axios = require('axios');
const db = require('../database/db');
const config = require('../config');

/**
 * Probe WhatsApp number for ban status
 * Tries real API first, falls back to simulation
 */
async function probeWhatsApp(userId, number, lang) {
    // 1. Check cache first (STICKY behavior)
    const cached = await db.getBanCheck('whatsapp', number);

    if (cached) {
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
    }

    // 2. Try real API first
    let apiResult = null;
    if (config.WHATSAPP_API_URL && config.WHATSAPP_API_KEY && !config.SIMULATION_MODE) {
        try {
            apiResult = await callWhatsAppAPI(number);
        } catch (err) {
            console.error('API failed, falling back to simulation:', err.message);
        }
    }

    // 3. Use API result or simulate
    const result = apiResult || await performProbe(number);

    // 4. Store and return
    if (result.status === 'banned') {
        let reasonId = result.reasonId;
        let reasonText = result.reason;

        if (cached && cached.status === 'unbanned' && result.status === 'banned') {
            const newReason = await db.getRandomReason();
            reasonId = newReason.id;
            reasonText = lang === 'pt' ? newReason.reason_pt : newReason.reason_en;
        } else if (cached && cached.status === 'banned') {
            reasonId = cached.reason_id;
            reasonText = lang === 'pt' ? cached.reason_pt : cached.reason_en;
        }

        await db.saveBanCheck(
            userId, 
            'whatsapp', 
            number, 
            'banned', 
            reasonId, 
            result.perma ? 1 : 0, 
            result.modban ? 1 : 0, 
            result.banDate
        );

        return {
            status: 'banned',
            reason: reasonText,
            reasonId: reasonId,
            perma: result.perma,
            modban: result.modban,
            banDate: result.banDate,
            reviewRequested: result.reviewRequested || false,
            reviewDate: result.reviewDate || null,
            cached: false
        };
    } else if (result.status === 'unbanned') {
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
    } else {
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
}

/**
 * Call the real WhatsApp ban check API
 * Adjust endpoint/method based on actual API spec
 */
async function callWhatsAppAPI(number) {
    const url = config.WHATSAPP_API_URL;
    const headers = {
        'Authorization': `Bearer ${config.WHATSAPP_API_KEY}`,
        'Content-Type': 'application/json'
    };

    if (config.WHATSAPP_API_SECRET) {
        headers['X-API-Secret'] = config.WHATSAPP_API_SECRET;
    }

    // Try POST first (most common for ban check APIs)
    let response;
    try {
        response = await axios.post(url, {
            phone: number,
            action: 'check_ban'
        }, { headers, timeout: 15000 });
    } catch (postErr) {
        // Fallback to GET with query params
        response = await axios.get(url, {
            params: { phone: number, key: config.WHATSAPP_API_KEY },
            headers,
            timeout: 15000
        });
    }

    const data = response.data;

    // Parse API response - adjust field names based on actual API response format
    // Expected format from your screenshots:
    // { status: 'banned'|'unbanned'|'not_found', reason: '...', perma: true|false, 
    //   modban: true|false, banned_at: '...', review_requested: true|false, review_date: '...' }

    if (data.status === 'unbanned' || data.status === 'active') {
        return { status: 'unbanned' };
    }

    if (data.status === 'not_found' || data.status === 'invalid') {
        return { status: 'not_found' };
    }

    // Banned
    return {
        status: 'banned',
        reason: data.reason || data.ban_reason || 'Unknown',
        perma: data.perma === true || data.perma === 'yes' || data.permanent === true,
        modban: data.modban === true || data.modban === 'true',
        banDate: data.banned_at || data.ban_date || data.date || new Date().toISOString(),
        reviewRequested: data.review_requested === true || data.review === true,
        reviewDate: data.review_date || null
    };
}

/**
 * Simulation fallback
 */
async function performProbe(number) {
    const hash = hashCode(number);
    const isBanned = (hash % 100) < (config.SIMULATION.BAN_CHANCE * 100);

    if (!isBanned) {
        const notFound = (hash % 1000) < 100;
        if (notFound) {
            return { status: 'not_found' };
        }
        return { status: 'unbanned' };
    }

    const isPerma = (hash % 100) < (config.SIMULATION.PERMA_CHANCE * 100);
    const isModban = (hash % 100) < (config.SIMULATION.MODBAN_CHANCE * 100);

    const daysAgo = (hash % 90) + 1;
    const banDate = new Date();
    banDate.setDate(banDate.getDate() - daysAgo);

    return {
        status: 'banned',
        perma: isPerma,
        modban: isModban,
        banDate: banDate.toISOString(),
        reviewRequested: false,
        reviewDate: null
    };
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

module.exports = {
    probeWhatsApp
};
