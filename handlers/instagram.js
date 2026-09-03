const { getLocale, setState, clearState, validateUsername, formatNumberDisplay } = require('../utils/helpers');
const { quote, formatCount } = require('../utils/formatters');
const { backKeyboard } = require('../utils/keyboards');
const { probeInstagram } = require('../services/instagramProbe');
const db = require('../database/db');

async function handleInstagramMenu(ctx) {
    const userId = ctx.from.id;
    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');
    const premium = await db.isPremium(userId);

    if (!premium) {
        return ctx.editMessageText(
            quote(locale.PREMIUM_REQUIRED + '\n\n' + locale.PREMIUM_REQUIRED_DESC.replace('{owner}', require('../config').OWNER_USERNAME)),
            {
                parse_mode: 'HTML',
                reply_markup: require('../utils/keyboards').premiumContactKeyboard(require('../config').OWNER_USERNAME).reply_markup
            }
        );
    }

    setState(userId, 'waiting_username');

    await ctx.editMessageText(
        quote(locale.IG_TITLE + '\n\n' + locale.IG_ENTER_USERNAME),
        {
            parse_mode: 'HTML',
            reply_markup: backKeyboard().reply_markup
        }
    );
}

async function handleInstagramUsername(ctx) {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    const username = validateUsername(text);
    if (!username) {
        return ctx.reply(
            quote(locale.ERROR_INVALID_USERNAME),
            { parse_mode: 'HTML' }
        );
    }

    const config = require('../config');
    let messageId;
    let chatId = ctx.chat.id;

    if (config.WELCOME_IMAGE_URL) {
        const msg = await ctx.replyWithPhoto(config.WELCOME_IMAGE_URL, {
            caption: quote(locale.IG_TITLE + '\n\n' + locale.IG_CHECKING),
            parse_mode: 'HTML'
        });
        messageId = msg.message_id;
    } else {
        const msg = await ctx.reply(
            quote(locale.IG_TITLE + '\n\n' + locale.IG_CHECKING),
            { parse_mode: 'HTML' }
        );
        messageId = msg.message_id;
    }

    const result = await probeInstagram(userId, username, user?.language || 'en');

    let resultText;

    if (result.status === 'unbanned') {
        const profile = locale.IG_PROFILE
            .replace('{name}', result.profile.name)
            .replace('{bio}', result.profile.bio)
            .replace('{followers}', formatCount(result.profile.followers))
            .replace('{following}', formatCount(result.profile.following))
            .replace('{posts}', formatCount(result.profile.posts));

        resultText = locale.IG_RESULT_UNBANNED
            .replace('{username}', username)
            .replace('{profile}', profile);
    } else if (result.status === 'banned') {
        const permaStr = result.perma ? locale.PERMA_YES : locale.PERMA_NO;
        resultText = locale.IG_RESULT_BANNED
            .replace('{username}', username)
            .replace('{reason}', result.reason)
            .replace('{perma}', permaStr);
    } else {
        resultText = locale.IG_RESULT_NOT_FOUND.replace('{username}', username);
    }

    const finalCaption = quote(locale.IG_TITLE + '\n\n' + resultText);

    if (config.WELCOME_IMAGE_URL) {
        await ctx.telegram.editMessageCaption(chatId, messageId, null, finalCaption, {
            parse_mode: 'HTML',
            reply_markup: backKeyboard().reply_markup
        });
    } else {
        await ctx.telegram.editMessageText(chatId, messageId, null, finalCaption, {
            parse_mode: 'HTML',
            reply_markup: backKeyboard().reply_markup
        });
    }

    clearState(userId);
}

module.exports = {
    handleInstagramMenu,
    handleInstagramUsername
};
