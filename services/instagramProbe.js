const db = require('../database/db');
const config = require('../config');

async function probeInstagram(userId, username, lang) {
    const cached = await db.getBanCheck('instagram', username);

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
                profile: null,
                cached: true
            };
        }
    }

    const result = await performProbe(username);

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
            'instagram', 
            username, 
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
            profile: null,
            cached: false
        };
    } else if (result.status === 'unbanned') {
        await db.saveBanCheck(userId, 'instagram', username, 'unbanned', null, 0, 0, null);
        return {
            status: 'unbanned',
            reason: null,
            perma: false,
            modban: false,
            banDate: null,
            reviewRequested: false,
            reviewDate: null,
            profile: result.profile,
            cached: false
        };
    } else {
        await db.saveBanCheck(userId, 'instagram', username, 'not_found', null, 0, 0, null);
        return {
            status: 'not_found',
            reason: null,
            perma: false,
            modban: false,
            banDate: null,
            reviewRequested: false,
            reviewDate: null,
            profile: null,
            cached: false
        };
    }
}

async function performProbe(username) {
    if (!config.SIMULATION_MODE) {
        throw new Error('Real probe not implemented. Set SIMULATION_MODE to true in config.js');
    }

    const hash = hashCode(username);
    const isBanned = (hash % 100) < (config.SIMULATION.BAN_CHANCE * 100);

    if (!isBanned) {
        const notFound = (hash % 1000) < 100;
        if (notFound) {
            return { status: 'not_found' };
        }

        return {
            status: 'unbanned',
            profile: generateProfile(username, hash)
        };
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

function generateProfile(username, hash) {
    const names = [
        'Alex', 'Maria', 'Joao', 'Ana', 'Carlos', 'Beatriz', 'Pedro', 'Julia',
        'Lucas', 'Sofia', 'Gabriel', 'Isabella', 'Mateus', 'Laura', 'Rafael'
    ];
    const bios = [
        'Living life one day at a time',
        'Travel | Photography | Coffee',
        'Just here for the memes',
        'Business inquiries: email@example.com',
        'Fitness enthusiast',
        'Foodie & Traveler',
        'Artist | Creator | Dreamer',
        'Music is life',
        'Dog mom',
        'CEO of my own life'
    ];

    const nameIndex = hash % names.length;
    const bioIndex = (hash >> 4) % bios.length;
    const followers = ((hash % 500) + 10) * 1000;
    const following = ((hash % 300) + 50) * 10;
    const posts = (hash % 200) + 5;

    return {
        name: names[nameIndex],
        bio: bios[bioIndex],
        followers: followers,
        following: following,
        posts: posts,
        profilePic: `https://ui-avatars.com/api/?name=${username}&background=random`
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
    probeInstagram
};
