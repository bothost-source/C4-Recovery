const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../config');

class Database {
    constructor() {
        this.db = new sqlite3.Database(config.DB_PATH);
        this.init();
    }

    init() {
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                language TEXT DEFAULT 'en',
                is_premium INTEGER DEFAULT 0,
                premium_until INTEGER,
                joined_at INTEGER DEFAULT (strftime('%s', 'now')),
                last_active INTEGER DEFAULT (strftime('%s', 'now'))
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS ban_reasons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reason_en TEXT NOT NULL,
                reason_pt TEXT NOT NULL,
                weight INTEGER DEFAULT 1
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS ban_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                platform TEXT NOT NULL,
                target TEXT NOT NULL,
                status TEXT NOT NULL,
                reason_id INTEGER,
                perma INTEGER DEFAULT 0,
                modban INTEGER DEFAULT 0,
                ban_date TEXT,
                review_requested INTEGER DEFAULT 0,
                review_date TEXT,
                checked_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (reason_id) REFERENCES ban_reasons(id),
                UNIQUE(platform, target)
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS owner_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                target_user INTEGER,
                performed_by INTEGER,
                performed_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`);

            this.seedReasons();
        });
    }

    seedReasons() {
        const reasons = [
            ['Spam', 'Spam'],
            ['Age Verification Failure', 'Falha na Verificacao de Idade'],
            ['Violation of Terms of Service', 'Violacao dos Termos de Servico'],
            ['Suspicious Activity', 'Atividade Suspeita'],
            ['Reported by Multiple Users', 'Denunciado por Multiplos Usuarios'],
            ['Automated Behavior Detected', 'Comportamento Automatizado Detectado'],
            ['Impersonation', 'Falsificacao de Identidade'],
            ['Sharing Inappropriate Content', 'Compartilhamento de Conteudo Inapropriado'],
            ['Phishing Attempts', 'Tentativas de Phishing'],
            ['Account Compromised', 'Conta Comprometida'],
            ['Bulk Messaging', 'Mensagens em Massa'],
            ['Using Unauthorized Third-Party Apps', 'Uso de Aplicativos de Terceiros Nao Autorizados'],
            ['Misleading Information', 'Informacoes Enganosas'],
            ['Harassment', 'Assedio'],
            ['Illegal Content Distribution', 'Distribuicao de Conteudo Ilegal']
        ];

        this.db.get("SELECT COUNT(*) as count FROM ban_reasons", (err, row) => {
            if (err) return;
            if (row.count === 0) {
                const stmt = this.db.prepare("INSERT INTO ban_reasons (reason_en, reason_pt) VALUES (?, ?)");
                reasons.forEach(([en, pt]) => stmt.run(en, pt));
                stmt.finalize();
            }
        });
    }

    getUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM users WHERE user_id = ?", [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    addUser(userId, username, firstName, lastName, lang = 'en') {
        return new Promise((resolve, reject) => {
            this.db.run(
                "INSERT OR IGNORE INTO users (user_id, username, first_name, last_name, language) VALUES (?, ?, ?, ?, ?)",
                [userId, username, firstName, lastName, lang],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    updateLanguage(userId, lang) {
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE users SET language = ? WHERE user_id = ?", [lang, userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    isPremium(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT is_premium, premium_until FROM users WHERE user_id = ?",
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else if (!row) resolve(false);
                    else if (row.is_premium && row.premium_until && row.premium_until > Date.now() / 1000) {
                        resolve(true);
                    } else {
                        resolve(row.is_premium === 1);
                    }
                }
            );
        });
    }

    grantPremium(userId, duration = null) {
        const until = duration ? Math.floor(Date.now() / 1000) + duration : null;
        return new Promise((resolve, reject) => {
            this.db.run(
                "UPDATE users SET is_premium = 1, premium_until = ? WHERE user_id = ?",
                [until, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    revokePremium(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                "UPDATE users SET is_premium = 0, premium_until = NULL WHERE user_id = ?",
                [userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    getBanCheck(platform, target) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT bc.*, br.reason_en, br.reason_pt 
                 FROM ban_checks bc 
                 LEFT JOIN ban_reasons br ON bc.reason_id = br.id 
                 WHERE bc.platform = ? AND bc.target = ?
                 ORDER BY bc.checked_at DESC LIMIT 1`,
                [platform, target],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    saveBanCheck(userId, platform, target, status, reasonId = null, perma = 0, modban = 0, banDate = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO ban_checks 
                 (user_id, platform, target, status, reason_id, perma, modban, ban_date, review_requested, review_date, checked_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, strftime('%s', 'now'))`,
                [userId, platform, target, status, reasonId, perma, modban, banDate],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    getRandomReason() {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM ban_reasons ORDER BY RANDOM() LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    requestReview(platform, target) {
        return new Promise((resolve, reject) => {
            this.db.run(
                "UPDATE ban_checks SET review_requested = 1, review_date = datetime('now', 'localtime') WHERE platform = ? AND target = ?",
                [platform, target],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    getStats() {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT COUNT(*) as total_users FROM users", (err, users) => {
                if (err) reject(err);
                else {
                    this.db.get("SELECT COUNT(*) as total_checks FROM ban_checks", (err, checks) => {
                        if (err) reject(err);
                        else {
                            this.db.get("SELECT COUNT(*) as banned_checks FROM ban_checks WHERE status = 'banned'", (err, banned) => {
                                if (err) reject(err);
                                else {
                                    this.db.get("SELECT COUNT(*) as premium_users FROM users WHERE is_premium = 1", (err, premium) => {
                                        if (err) reject(err);
                                        else resolve({
                                            total_users: users.total_users,
                                            total_checks: checks.total_checks,
                                            banned_checks: banned.banned_checks,
                                            premium_users: premium.premium_users
                                        });
                                    });
                                }
                            });
                        }
                    });
                }
            });
        });
    }

    setMaintenance(mode) {
        return new Promise((resolve, reject) => {
            this.db.run(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance', ?)",
                [mode ? '1' : '0'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    isMaintenance() {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT value FROM settings WHERE key = 'maintenance'", (err, row) => {
                if (err) reject(err);
                else resolve(row && row.value === '1');
            });
        });
    }

    getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT user_id FROM users", (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.user_id));
            });
        });
    }

    logAction(action, targetUser, performedBy) {
        return new Promise((resolve, reject) => {
            this.db.run(
                "INSERT INTO owner_actions (action, target_user, performed_by) VALUES (?, ?, ?)",
                [action, targetUser, performedBy],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = new Database();
