const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const { Client } = require('pg');

async function setupDatabase() {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
        console.log('Connecting to PostgreSQL database...');
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        await client.connect();

        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        `);

        // Create tasks table
        await client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT CHECK(category IN ('Study', 'Reading', 'English', 'Personal')) NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                reminder_minutes INTEGER DEFAULT 0,
                notes TEXT,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
                is_recurring INTEGER DEFAULT 0,
                repeat_type TEXT DEFAULT 'none',
                repeat_value INTEGER DEFAULT 0
            )
        `);

        // Create notifications_log table
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications_log (
                id SERIAL PRIMARY KEY,
                task_id INTEGER NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        // Wrapper to make PG client act like SQLite client for common methods
        return {
            get: (sql, params) => client.query(sql.replace(/\?/g, (m, i) => `$${i + 1}`), params).then(r => r.rows[0]),
            all: (sql, params) => client.query(sql.replace(/\?/g, (m, i) => `$${i + 1}`), params).then(r => r.rows),
            run: (sql, params) => client.query(sql.replace(/\?/g, (m, i) => `$${i + 1}`), params),
            exec: (sql) => client.query(sql)
        };
    } else {
        const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'planner.db');
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        console.log('Connected to the SQLite database.');

        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT CHECK(category IN ('Study', 'Reading', 'English', 'Personal')) NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                reminder_minutes INTEGER DEFAULT 0,
                notes TEXT,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
                is_recurring INTEGER DEFAULT 0,
                repeat_type TEXT DEFAULT 'none',
                repeat_value INTEGER DEFAULT 0
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS notifications_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        return db;
    }
}

module.exports = setupDatabase;
