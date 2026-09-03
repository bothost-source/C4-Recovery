const { getLocale, isOwner, setState, clearState } = require('../utils/helpers');
const { quote, formatCount } = require('../utils/formatters');
const { ownerKeyboard, backKeyboard } = require('../utils/keyboards');
const db = require('../database/db');
const config = require('../config');

async function handleOwnerPanel(ctx) {
    const userId = ctx.from.id;
    if (!isOwner(userId)) return ctx.answerCbQuery('Unauthorized');

    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    await ctx.editMessageText(
        quote(locale.OWNER_TITLE + '\n\n' + locale.OWNER_DESC),
        {
            parse_mode: 'HTML',
            reply_markup: ownerKeyboard().reply_markup
        }
    );
}

async function handleStats(ctx) {
    const userId = ctx.from.id;
    if (!isOwner(userId)) return ctx.answerCbQuery('Unauthorized');

    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');
    const stats = await db.getStats();
    const quota = await db.getQuota();

    const text = quote(
        locale.STATS_TITLE + '\n\n' +
        locale.STATS_USERS.replace('{count}', formatCount(stats.total_users)) + '\n' +
        locale.STATS_CHECKS.replace('{count}', formatCount(stats.total_checks)) + '\n' +
        locale.STATS_BANNED.replace('{count}', formatCount(stats.banned_checks)) + '\n' +
        locale.STATS_PREMIUM.replace('{count}', formatCount(stats.premium_users)) + '\n\n' +
        locale.QUOTA_TITLE + '\n' +
        locale.QUOTA_DAILY.replace('{used}', quota.daily).replace('{limit}', quota.dailyLimit) + '\n' +
        locale.QUOTA_MONTHLY.replace('{used}', quota.monthly).replace('{limit}', quota.monthlyLimit)
    );

    await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: ownerKeyboard().reply_markup
    });
}

async function handleGrantStart(ctx) {
    const userId = ctx.from.id;
    if (!isOwner(userId)) return ctx.answerCbQuery('Unauthorized');

    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    setState(userId, 'waiting_grant_id');

    await ctx.editMessageText(
        quote(locale.GRANT_ENTER),
        {
            parse_mode: 'HTML',
            reply_markup: backKeyboard().reply_markup
        }
    );
}

async function handleGrantId(ctx) {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const targetId = parseInt(text);

    if (isNaN(targetId)) {
        return ctx.reply(quote('Invalid user ID'), { parse_mode: 'HTML' });
    }

    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    const target = await db.getUser(targetId);
    if (!target) {
        return ctx.reply(quote(locale.USER_NOT_FOUND), { parse_mode: 'HTML' });
    }

    await db.grantPremium(targetId);
    await db.logAction('grant_premium', targetId, userId);

    await ctx.reply(
        quote(locale.GRANT_SUCCESS.replace('{userId}', targetId)),
        { parse_mode: 'HTML' }
    );

    clearState(userId);
}

async function handleRevokeStart(ctx) {
    const userId = ctx.from.id;
    if (!isOwner(userId)) return ctx.answerCbQuery('Unauthorized');

    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    setState(userId, 'waiting_revoke_id');

    await ctx.editMessageText(
        quote(locale.REVOKE_ENTER),
        {
            parse_mode: 'HTML',
            reply_markup: backKeyboard().reply_markup
        }
    );
}

async function handleRevokeId(ctx) {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const targetId = parseInt(text);

    if (isNaN(targetId)) {
        return ctx.reply(quote('Invalid user ID'), { parse_mode: 'HTML' });
    }

    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    await db.revokePremium(targetId);
    await db.logAction('revoke_premium', targetId, userId);

    await ctx.reply(
        quote(locale.REVOKE_SUCCESS.replace('{userId}', targetId)),
        { parse_mode: 'HTML' }
    );

    clearState(userId);
}

async function handleMaintenance(ctx) {
    const userId = ctx.from.id;
    if (!isOwner(userId)) return ctx.answerCbQuery('Unauthorized');

    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    const current = await db.isMaintenance();
    await db.setMaintenance(!current);

    const text = !current ? locale.MAINTENANCE_ON : locale.MAINTENANCE_OFF;

    await ctx.editMessageText(
        quote(text),
        {
            parse_mode: 'HTML',
            reply_markup: ownerKeyboard().reply_markup
        }
    );
}

async function handleBroadcastStart(ctx) {
    const userId = ctx.from.id;
    if (!isOwner(userId)) return ctx.answerCbQuery('Unauthorized');

    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    setState(userId, 'waiting_broadcast');

    await ctx.editMessageText(
        quote(locale.BROADCAST_ENTER),
        {
            parse_mode: 'HTML',
            reply_markup: backKeyboard().reply_markup
        }
    );
}

async function handleBroadcastMessage(ctx) {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    const allUsers = await db.getAllUsers();
    let success = 0;
    let fail = 0;

    for (const uid of allUsers) {
        try {
            await ctx.telegram.sendMessage(uid, quote(text), { parse_mode: 'HTML' });
            success++;
        } catch (e) {
            fail++;
        }
    }

    await ctx.reply(
        quote(locale.BROADCAST_SENT.replace('{count}', success)),
        { parse_mode: 'HTML' }
    );

    if (fail > 0) {
        await ctx.reply(
            quote(locale.BROADCAST_FAIL.replace('{count}', fail)),
            { parse_mode: 'HTML' }
        );
    }

    clearState(userId);
}

module.exports = {
    handleOwnerPanel,
    handleStats,
    handleGrantStart,
    handleGrantId,
    handleRevokeStart,
    handleRevokeId,
    handleMaintenance,
    handleBroadcastStart,
    handleBroadcastMessage
};
