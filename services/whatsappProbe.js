const db = require('../database/db');
const config = require('../config');

async function probeWhatsApp(userId, number, lang) {
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

    const result = await performProbe(number);

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
            reviewRequested: false,
            reviewDate: null,
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

async function performProbe(number) {
    if (!config.SIMULATION_MODE) {
        throw new Error('Real probe not implemented. Set SIMULATION_MODE to true in config.js');
    }

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
        banDate: banDate.toISOString()
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
