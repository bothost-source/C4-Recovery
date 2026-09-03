const { getLocale, isOwner } = require('../utils/helpers');
const { quote } = require('../utils/formatters');
const { langKeyboard } = require('../utils/keyboards');
const db = require('../database/db');
const config = require('../config');

async function handleStart(ctx) {
    const userId = ctx.from.id;
    const username = ctx.from.username || '';
    const firstName = ctx.from.first_name || '';
    const lastName = ctx.from.last_name || '';

    await db.addUser(userId, username, firstName, lastName);

    const locale = getLocale(config.DEFAULT_LANG);

    const caption = quote(
        locale.WELCOME_TITLE + '\n\n' +
        locale.WELCOME_DESC + '\n\n' +
        locale.WELCOME_FOOTER
    );

    if (config.WELCOME_IMAGE_URL) {
        await ctx.replyWithPhoto(config.WELCOME_IMAGE_URL, {
            caption: caption,
            parse_mode: 'HTML',
            reply_markup: langKeyboard().reply_markup
        });
    } else {
        await ctx.reply(caption, {
            parse_mode: 'HTML',
            reply_markup: langKeyboard().reply_markup
        });
    }
}

async function handleLanguage(ctx, lang) {
    const userId = ctx.from.id;
    await db.updateLanguage(userId, lang);

    const locale = getLocale(lang);

    await ctx.editMessageText(
        quote(locale.LANG_CHANGED),
        { parse_mode: 'HTML' }
    );

    setTimeout(() => {
        ctx.reply(
            quote(locale.MENU_TITLE + '\n\n' + locale.MENU_DESC),
            {
                parse_mode: 'HTML',
                reply_markup: require('../utils/keyboards').mainMenuKeyboard(
                    isOwner(userId),
                    false
                ).reply_markup
            }
        );
    }, 500);
}

module.exports = {
    handleStart,
    handleLanguage
};
