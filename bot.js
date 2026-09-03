const { Telegraf } = require('telegraf');
const config = require('./config');
const db = require('./database/db');
const { getState, clearState, isOwner } = require('./utils/helpers');
const { quote } = require('./utils/formatters');

const { handleStart, handleLanguage } = require('./handlers/start');
const { handleMenu, handleBack } = require('./handlers/menu');
const { handleWhatsAppMenu, handleWhatsAppNumber, handleReviewRequest } = require('./handlers/whatsapp');
const { handleInstagramMenu, handleInstagramUsername } = require('./handlers/instagram');
const { handlePremiumMenu } = require('./handlers/premium');
const { handleOwnerPanel, handleStats, handleGrantStart, handleGrantId, handleRevokeStart, handleRevokeId, handleMaintenance, handleBroadcastStart, handleBroadcastMessage } = require('./handlers/owner');

const bot = new Telegraf(config.BOT_TOKEN);

bot.use(async (ctx, next) => {
    if (ctx.from && isOwner(ctx.from.id)) return next();
    const maintenance = await db.isMaintenance();
    if (maintenance && ctx.message?.text !== '/start') {
        const locale = require('./locales/en');
        return ctx.reply(locale.MAINTENANCE_MSG);
    }
    return next();
});

bot.command('start', handleStart);

bot.action('lang_en', (ctx) => handleLanguage(ctx, 'en'));
bot.action('lang_pt', (ctx) => handleLanguage(ctx, 'pt'));

bot.action('menu_whatsapp', handleWhatsAppMenu);
bot.action('menu_instagram', handleInstagramMenu);
bot.action('menu_premium', handlePremiumMenu);
bot.action('menu_lang', handleStart);
bot.action('menu_owner', handleOwnerPanel);
bot.action('menu_back', handleBack);

bot.action('owner_stats', handleStats);
bot.action('owner_grant', handleGrantStart);
bot.action('owner_revoke', handleRevokeStart);
bot.action('owner_maintenance', handleMaintenance);
bot.action('owner_broadcast', handleBroadcastStart);

bot.action(/review_whatsapp_(.+)/, (ctx) => {
    const number = ctx.match[1];
    return handleReviewRequest(ctx, 'whatsapp', number);
});

bot.action(/review_instagram_(.+)/, (ctx) => {
    const username = ctx.match[1];
    return handleReviewRequest(ctx, 'instagram', username);
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = getState(userId);

    if (state) {
        switch (state.state) {
            case 'waiting_number':
                return handleWhatsAppNumber(ctx);
            case 'waiting_username':
                return handleInstagramUsername(ctx);
            case 'waiting_grant_id':
                return handleGrantId(ctx);
            case 'waiting_revoke_id':
                return handleRevokeId(ctx);
            case 'waiting_broadcast':
                return handleBroadcastMessage(ctx);
            default:
                clearState(userId);
        }
    }

    if (ctx.message.text.startsWith('?')) {
        const premium = await db.isPremium(userId);
        if (!premium) {
            const locale = require('./locales/en');
            return ctx.reply(
                quote(locale.PREMIUM_REQUIRED + '\n\n' + locale.PREMIUM_REQUIRED_DESC.replace('{owner}', config.OWNER_USERNAME)),
                { parse_mode: 'HTML' }
            );
        }
        return handleWhatsAppNumber(ctx);
    }
});

bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('An error occurred. Please try /start').catch(() => {});
});

bot.launch()
    .then(() => console.log('C4 Recovery Bot started'))
    .catch(err => console.error('Failed to start:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
