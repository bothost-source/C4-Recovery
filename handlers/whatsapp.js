const { getLocale, setState, clearState, validateNumber, formatNumberDisplay } = require('../utils/helpers');
const { quote, formatDate } = require('../utils/formatters');
const { backKeyboard, reviewKeyboard } = require('../utils/keyboards');
const { probeWhatsApp } = require('../services/whatsappProbe');
const db = require('../database/db');

async function handleWhatsAppMenu(ctx) {
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

    setState(userId, 'waiting_number');

    await ctx.editMessageText(
        quote(locale.WA_TITLE + '\n\n' + locale.WA_ENTER_NUMBER),
        {
            parse_mode: 'HTML',
            reply_markup: backKeyboard().reply_markup
        }
    );
}

async function handleWhatsAppNumber(ctx) {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    const number = validateNumber(text);
    if (!number) {
        return ctx.reply(
            quote(locale.ERROR_INVALID_NUMBER),
            { parse_mode: 'HTML' }
        );
    }

    const config = require('../config');
    let messageId;
    let chatId = ctx.chat.id;

    if (config.WELCOME_IMAGE_URL) {
        const msg = await ctx.replyWithPhoto(config.WELCOME_IMAGE_URL, {
            caption: quote(locale.WA_TITLE + '\n\n' + locale.WA_CHECKING),
            parse_mode: 'HTML'
        });
        messageId = msg.message_id;
    } else {
        const msg = await ctx.reply(
            quote(locale.WA_TITLE + '\n\n' + locale.WA_CHECKING),
            { parse_mode: 'HTML' }
        );
        messageId = msg.message_id;
    }

    const result = await probeWhatsApp(userId, number, user?.language || 'en');

    const masked = formatNumberDisplay(number);
    let resultText;
    let keyboard = null;

    if (result.status === 'unbanned') {
        resultText = locale.WA_RESULT_UNBANNED.replace('{number}', masked);
    } else if (result.status === 'banned') {
        const permaStr = result.perma ? locale.PERMA_YES : locale.PERMA_NO;
        const dateStr = formatDate(result.banDate) || 'Unknown';

        if (result.reviewRequested) {
            const reviewDateStr = formatDate(result.reviewDate) || 'Unknown';
            resultText = locale.WA_RESULT_BANNED_REVIEW
                .replace('{number}', masked)
                .replace('{reason}', result.reason)
                .replace('{perma}', permaStr)
                .replace('{date}', dateStr)
                .replace('{review_date}', reviewDateStr);
        } else {
            resultText = locale.WA_RESULT_BANNED
                .replace('{number}', masked)
                .replace('{reason}', result.reason)
                .replace('{perma}', permaStr)
                .replace('{date}', dateStr);
            keyboard = reviewKeyboard('whatsapp', number);
        }
    } else {
        resultText = locale.WA_RESULT_NOT_FOUND.replace('{number}', masked);
    }

    const finalCaption = quote(locale.WA_TITLE + '\n\n' + resultText);

    if (config.WELCOME_IMAGE_URL) {
        await ctx.telegram.editMessageCaption(chatId, messageId, null, finalCaption, {
            parse_mode: 'HTML',
            reply_markup: keyboard ? keyboard.reply_markup : backKeyboard().reply_markup
        });
    } else {
        await ctx.telegram.editMessageText(chatId, messageId, null, finalCaption, {
            parse_mode: 'HTML',
            reply_markup: keyboard ? keyboard.reply_markup : backKeyboard().reply_markup
        });
    }

    clearState(userId);
}

async function handleReviewRequest(ctx, platform, target) {
    const userId = ctx.from.id;
    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');

    const cached = await db.getBanCheck(platform, target);
    if (cached && cached.review_requested === 1) {
        return ctx.answerCbQuery(locale.WA_REVIEW_ALREADY.replace('{date}', formatDate(cached.review_date) || 'Unknown'));
    }

    await db.requestReview(platform, target);

    const masked = formatNumberDisplay(target);
    const permaStr = cached.perma === 1 ? locale.PERMA_YES : locale.PERMA_NO;
    const dateStr = formatDate(cached.ban_date) || 'Unknown';
    const reviewDateStr = formatDate(new Date().toISOString());

    const resultText = locale.WA_RESULT_BANNED_REVIEW
        .replace('{number}', masked)
        .replace('{reason}', user?.language === 'pt' ? cached.reason_pt : cached.reason_en)
        .replace('{perma}', permaStr)
        .replace('{date}', dateStr)
        .replace('{review_date}', reviewDateStr);

    await ctx.editMessageCaption(
        quote(locale.WA_TITLE + '\n\n' + resultText),
        {
            parse_mode: 'HTML',
            reply_markup: backKeyboard().reply_markup
        }
    );

    ctx.answerCbQuery(locale.WA_REVIEW_REQUESTED);
}

module.exports = {
    handleWhatsAppMenu,
    handleWhatsAppNumber,
    handleReviewRequest
};
