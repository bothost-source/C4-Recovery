const { getLocale } = require('../utils/helpers');
const { quote } = require('../utils/formatters');
const { premiumContactKeyboard, backKeyboard } = require('../utils/keyboards');
const db = require('../database/db');
const config = require('../config');

async function handlePremiumMenu(ctx) {
    const userId = ctx.from.id;
    const user = await db.getUser(userId);
    const locale = getLocale(user?.language || 'en');
    const premium = await db.isPremium(userId);

    if (premium) {
        return ctx.editMessageText(
            quote(locale.PREMIUM_ACTIVE),
            {
                parse_mode: 'HTML',
                reply_markup: backKeyboard().reply_markup
            }
        );
    }

    const text = quote(
        locale.PREMIUM_TITLE + '\n\n' +
        locale.PREMIUM_DESC + '\n\n' +
        locale.PREMIUM_PRICE.replace('{price}', config.PREMIUM_PRICE) + '\n\n' +
        locale.PREMIUM_CONTACT.replace('{owner}', config.OWNER_USERNAME)
    );

    await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: premiumContactKeyboard(config.OWNER_USERNAME).reply_markup
    });
}

module.exports = { handlePremiumMenu };
