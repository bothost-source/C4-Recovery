const { getLocale, isOwner } = require('../utils/helpers');
const { quote } = require('../utils/formatters');
const { mainMenuKeyboard } = require('../utils/keyboards');
const db = require('../database/db');

async function handleMenu(ctx) {
    try {
        const userId = ctx.from.id;
        const user = await db.getUser(userId);
        const locale = getLocale(user?.language || 'en');
        const premium = await db.isPremium(userId);

        const msg = ctx.callbackQuery.message;
        const isPhoto = msg.photo && msg.photo.length > 0;

        const text = quote(locale.MENU_TITLE + '\n\n' + locale.MENU_DESC);
        const keyboard = mainMenuKeyboard(isOwner(userId), premium).reply_markup;

        if (isPhoto) {
            await ctx.editMessageCaption(text, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } else {
            await ctx.editMessageText(text, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        }
    } catch (err) {
        console.error('handleMenu error:', err);
        ctx.reply('An error occurred. Please try /start').catch(() => {});
    }
}

async function handleBack(ctx) {
    try {
        const userId = ctx.from.id;
        const user = await db.getUser(userId);
        const locale = getLocale(user?.language || 'en');
        const premium = await db.isPremium(userId);

        const msg = ctx.callbackQuery.message;
        const isPhoto = msg.photo && msg.photo.length > 0;

        const text = quote(locale.MENU_TITLE + '\n\n' + locale.MENU_DESC);
        const keyboard = mainMenuKeyboard(isOwner(userId), premium).reply_markup;

        if (isPhoto) {
            await ctx.editMessageCaption(text, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } else {
            await ctx.editMessageText(text, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        }
    } catch (err) {
        console.error('handleBack error:', err);
        ctx.reply('An error occurred. Please try /start').catch(() => {});
    }
}

module.exports = { handleMenu, handleBack };
