// C4 Recovery Bot - Configuration

module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN || '',
    OWNER_ID: process.env.OWNER_ID || '',
    OWNER_USERNAME: process.env.OWNER_USERNAME || 'your_username',
    WELCOME_IMAGE_URL: process.env.WELCOME_IMAGE_URL || '',
    DB_PATH: process.env.DB_PATH || './database/bot.db',
    PREMIUM_PRICE: process.env.PREMIUM_PRICE || '$10',
    MAINTENANCE_MODE: false,
    DEFAULT_LANG: 'en',
    LANGUAGES: ['en', 'pt'],

    // WhatsApp API Settings
    WHATSAPP_API_URL: process.env.WHATSAPP_API_URL || '',
    WHATSAPP_API_KEY: process.env.WHATSAPP_API_KEY || '',
    WHATSAPP_API_SECRET: process.env.WHATSAPP_API_SECRET || '',

    // Simulation fallback (used when API is not configured or fails)
    SIMULATION_MODE: process.env.SIMULATION_MODE === 'true' || true,

    SIMULATION: {
        BAN_CHANCE: 0.4,
        PERMA_CHANCE: 0.6,
        MODBAN_CHANCE: 0.3,
    }
};
