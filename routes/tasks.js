const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authController = require('../controllers/authController');

module.exports = (db) => {
    router.use(authController.ensureAuthenticated);

    router.get('/', (req, res) => taskController.getAllTasks(req, res, db));
    router.post('/', (req, res) => taskController.createTask(req, res, db));
    router.put('/:id', (req, res) => taskController.updateTask(req, res, db));
    router.delete('/:id', (req, res) => taskController.deleteTask(req, res, db));
    router.patch('/:id/toggle', (req, res) => taskController.toggleTaskStatus(req, res, db));
    router.post('/renew', (req, res) => taskController.renewTasks(req, res, db));

    return router;
};
