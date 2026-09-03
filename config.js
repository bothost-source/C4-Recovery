// C4 Recovery Bot - Configuration
// Fill in your values before deploying

module.exports = {
    // Telegram Bot Token from @BotFather
    BOT_TOKEN: process.env.BOT_TOKEN || '',

    // Your Telegram numeric ID (get it from @userinfobot)
    OWNER_ID: process.env.OWNER_ID || '',

    // Your Telegram username for premium purchases (without @)
    OWNER_USERNAME: process.env.OWNER_USERNAME || 'your_username',

    // Welcome image URL - add your image link here
    WELCOME_IMAGE_URL: process.env.WELCOME_IMAGE_URL || '',

    // Database path
    DB_PATH: process.env.DB_PATH || './database/bot.db',

    // Premium settings
    PREMIUM_PRICE: process.env.PREMIUM_PRICE || '$10',

    // Maintenance mode (owner can toggle)
    MAINTENANCE_MODE: false,

    // Default language
    DEFAULT_LANG: 'en',

    // Supported languages
    LANGUAGES: ['en', 'pt'],

    // Ban check simulation (set to false when you plug in real probes)
    SIMULATION_MODE: true,

    // Simulation settings
    SIMULATION: {
        BAN_CHANCE: 0.4,        // 40% chance a number is banned
        PERMA_CHANCE: 0.6,      // 60% of bans are permanent
        MODBAN_CHANCE: 0.3,     // 30% chance of modban
    }
};
