const { Markup } = require('telegraf');

function langKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('🇺🇸 English', 'lang_en'),
            Markup.button.callback('🇧🇷 Brazil', 'lang_pt')
        ]
    ]);
}

function mainMenuKeyboard(isOwner = false, isPremium = false) {
    const buttons = [
        [
            Markup.button.callback(' WhatsApp Checker', 'menu_whatsapp'),
            Markup.button.callback(' Instagram Checker', 'menu_instagram')
        ],
        [
            Markup.button.callback(' Buy Premium', 'menu_premium'),
            Markup.button.callback(' Change Language', 'menu_lang')
        ]
    ];

    if (isOwner) {
        buttons.push([Markup.button.callback(' Owner Panel', 'menu_owner')]);
    }

    return Markup.inlineKeyboard(buttons);
}

function backKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback(' Back', 'menu_back')]
    ]);
}

function ownerKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback(' Statistics', 'owner_stats'),
            Markup.button.callback('➕ Grant Premium', 'owner_grant')
        ],
        [
            Markup.button.callback(' Revoke Premium', 'owner_revoke'),
            Markup.button.callback(' Maintenance', 'owner_maintenance')
        ],
        [
            Markup.button.callback(' Broadcast', 'owner_broadcast')
        ],
        [
            Markup.button.callback('Back', 'menu_back')
        ]
    ]);
}

function reviewKeyboard(platform, target) {
    return Markup.inlineKeyboard([
        [Markup.button.callback('Request Review', `review_${platform}_${target}`)]
    ]);
}

function premiumContactKeyboard(ownerUsername) {
    return Markup.inlineKeyboard([
        [Markup.button.url('Contact Owner', `https://t.me/${ownerUsername}`)]
    ]);
}

function confirmKeyboard(confirmAction, cancelAction) {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('Confirm', confirmAction),
            Markup.button.callback(' Cancel', cancelAction)
        ]
    ]);
}

module.exports = {
    langKeyboard,
    mainMenuKeyboard,
    backKeyboard,
    ownerKeyboard,
    reviewKeyboard,
    premiumContactKeyboard,
    confirmKeyboard
};
