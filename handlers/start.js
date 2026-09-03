const { getLocale, isOwner } = require('../utils/helpers');
const { quote } = require('../utils/formatters');
const { langKeyboard, mainMenuKeyboard } = require('../utils/keyboards');
const db = require('../database/db');
const config = require('../config');

async function handleStart(ctx) {
    try {
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
    } catch (err) {
        console.error('handleStart error:', err);
        ctx.reply('An error occurred. Please try /start').catch(() => {});
    }
}

async function handleLanguage(ctx, lang) {
    try {
        const userId = ctx.from.id;
        await db.updateLanguage(userId, lang);

        const locale = getLocale(lang);

        // Check if original message was a photo or text
        const msg = ctx.callbackQuery.message;
        const isPhoto = msg.photo && msg.photo.length > 0;

        if (isPhoto) {
            // Edit caption for photo messages
            await ctx.editMessageCaption(
                quote(locale.LANG_CHANGED),
                { parse_mode: 'HTML' }
            );
        } else {
            // Edit text for text messages
            await ctx.editMessageText(
                quote(locale.LANG_CHANGED),
                { parse_mode: 'HTML' }
            );
        }

        // Send main menu as new message
        const premium = await db.isPremium(userId);
        await ctx.reply(
            quote(locale.MENU_TITLE + '\n\n' + locale.MENU_DESC),
            {
                parse_mode: 'HTML',
                reply_markup: mainMenuKeyboard(isOwner(userId), premium).reply_markup
            }
        );
    } catch (err) {
        console.error('handleLanguage error:', err);
        ctx.reply('An error occurred. Please try /start').catch(() => {});
    }
}

module.exports = {
    handleStart,
    handleLanguage
};
