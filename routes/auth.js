const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

module.exports = (db) => {
    router.post('/login', (req, res) => authController.login(req, res, db));
    router.post('/logout', authController.logout);
    router.get('/check', authController.checkAuth);
    return router;
};
