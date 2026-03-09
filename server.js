require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const setupDatabase = require('./database/connection');
const setupCron = require('./cron/reminderCron');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

async function startServer() {
    try {
        const db = await setupDatabase();

        // Ensure at least one user exists
        const adminUser = await db.get('SELECT * FROM users WHERE username = ?', [process.env.ADMIN_USERNAME || 'admin']);
        if (!adminUser) {
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'password123', 10);
            await db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                [process.env.ADMIN_USERNAME || 'admin', hashedPassword]);
            console.log('Default admin user created.');
        }

        // Setup Cron Job
        setupCron(db);

        // Routes
        app.use('/api/auth', require('./routes/auth')(db));
        app.use('/api/tasks', require('./routes/tasks')(db));

        // Frontend views
        app.get('/', (req, res) => {
            if (req.session.userId) {
                res.render('index');
            } else {
                res.redirect('/login');
            }
        });

        app.get('/login', (req, res) => {
            if (req.session.userId) {
                res.redirect('/');
            } else {
                res.render('login');
            }
        });

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

startServer();
