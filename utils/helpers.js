const config = require('../config');

const userStates = new Map();

function setState(userId, state, data = {}) {
    userStates.set(userId, { state, data, timestamp: Date.now() });
}

function getState(userId) {
    const state = userStates.get(userId);
    if (!state) return null;
    if (Date.now() - state.timestamp > 10 * 60 * 1000) {
        userStates.delete(userId);
        return null;
    }
    return state;
}

function clearState(userId) {
    userStates.delete(userId);
}

function isOwner(userId) {
    return String(userId) === String(config.OWNER_ID);
}

function validateNumber(text) {
    const clean = text.replace(/^\?\s*/, '').replace(/\s/g, '');
    const match = clean.match(/^\+?\d{7,15}$/);
    if (!match) return null;
    if (clean.startsWith('+')) return clean;
    return clean;
}

function validateUsername(text) {
    const clean = text.trim().toLowerCase().replace(/^@/, '');
    const match = clean.match(/^[a-z0-9._]{1,30}$/);
    if (!match) return null;
    return clean;
}

function getLocale(lang) {
    try {
        return require(`../locales/${lang}`);
    } catch (e) {
        return require('../locales/en');
    }
}

function formatNumberDisplay(number) {
    const { maskNumber } = require('./formatters');
    return maskNumber(number);
}

module.exports = {
    setState,
    getState,
    clearState,
    isOwner,
    validateNumber,
    validateUsername,
    getLocale,
    formatNumberDisplay
};
