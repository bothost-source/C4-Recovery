const { getLocale, isOwner } = require('../utils/helpers');
const { quote } = require('../utils/formatters');
const { mainMenuKeyboard, backKeyboard } = require('../utils/keyboards');
const db = require('../database/db');

async function handleMenu(ctx) {
    const userId = ctx.from.id;
    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');
    const premium = await db.isPremium(userId);

    await ctx.editMessageText(
        quote(locale.MENU_TITLE + '\n\n' + locale.MENU_DESC),
        {
            parse_mode: 'HTML',
            reply_markup: mainMenuKeyboard(isOwner(userId), premium).reply_markup
        }
    );
}

async function handleBack(ctx) {
    const userId = ctx.from.id;
    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');
    const premium = await db.isPremium(userId);

    await ctx.editMessageText(
        quote(locale.MENU_TITLE + '\n\n' + locale.MENU_DESC),
        {
            parse_mode: 'HTML',
            reply_markup: mainMenuKeyboard(isOwner(userId), premium).reply_markup
        }
    );
}

module.exports = { handleMenu, handleBack };
