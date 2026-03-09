const bcrypt = require('bcryptjs');

const authController = {
    login: async (req, res, db) => {
        const { username, password } = req.body;
        try {
            const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
            if (user && await bcrypt.compare(password, user.password_hash)) {
                req.session.userId = user.id;
                req.session.username = user.username;
                return res.json({ success: true, message: 'Logged in successfully' });
            }
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    logout: (req, res) => {
        req.session.destroy(err => {
            if (err) return res.status(500).json({ success: false, message: 'Logout failed' });
            res.json({ success: true, message: 'Logged out successfully' });
        });
    },

    checkAuth: (req, res) => {
        if (req.session.userId) {
            return res.json({ authenticated: true, username: req.session.username });
        }
        res.json({ authenticated: false });
    },

    ensureAuthenticated: (req, res, next) => {
        if (req.session.userId) {
            return next();
        }
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
};

module.exports = authController;
