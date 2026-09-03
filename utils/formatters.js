function quote(text) {
    return `<blockquote>${escapeHtml(text)}</blockquote>`;
}

function quoteExpandable(title, text) {
    return `<blockquote expandable>${escapeHtml(title)}\n${escapeHtml(text)}</blockquote>`;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function maskNumber(number) {
    const clean = number.replace(/[^\d]/g, '');
    if (clean.length < 5) return clean;
    const prefix = clean.substring(0, 5);
    const masked = prefix + '*'.repeat(clean.length - 5);
    if (number.startsWith('+')) return '+' + masked;
    return masked;
}

function formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}.${minutes}`;
}

function formatCount(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = {
    quote,
    quoteExpandable,
    escapeHtml,
    maskNumber,
    formatDate,
    formatCount
};
