const taskController = {
    getAllTasks: async (req, res, db) => {
        try {
            const tasks = await db.all('SELECT * FROM tasks ORDER BY date ASC, start_time ASC');
            res.json(tasks);
        } catch (error) {
            console.error('Get tasks error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
        }
    },

    createTask: async (req, res, db) => {
        const { title, category, date, start_time, end_time, reminder_minutes, notes, repeat_type, repeat_value } = req.body;
        console.log('[DEBUG] Create task request:', JSON.stringify(req.body));
        try {
            const results = [];

            if (repeat_type === 'days' && repeat_value > 1) {
                // Special case: create individual records for N days
                const [year, month, day] = date.split('-').map(Number);
                for (let i = 0; i < repeat_value; i++) {
                    const current = new Date(year, month - 1, day + i);
                    const y = current.getFullYear();
                    const m = String(current.getMonth() + 1).padStart(2, '0');
                    const d = String(current.getDate()).padStart(2, '0');
                    const dateStr = `${y}-${m}-${d}`;

                    const result = await db.run(
                        `INSERT INTO tasks (title, category, date, start_time, end_time, reminder_minutes, notes, status, is_recurring, repeat_type, repeat_value) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 'none', 0)`,
                        [title, category, dateStr, start_time, end_time, reminder_minutes || 0, notes]
                    );
                    results.push(result.lastID);
                }
                res.json({ success: true, ids: results });
            } else {
                // Standard create (template for recurring or single task)
                const isRecurring = ['daily', 'weekly', 'monthly'].includes(repeat_type) ? 1 : 0;
                const result = await db.run(
                    `INSERT INTO tasks (title, category, date, start_time, end_time, reminder_minutes, notes, status, is_recurring, repeat_type, repeat_value) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
                    [title, category, date, start_time, end_time, reminder_minutes || 0, notes, isRecurring, repeat_type || 'none', repeat_value || 0]
                );
                res.json({ success: true, id: result.lastID });
            }
        } catch (error) {
            console.error('Create task error:', error);
            res.status(500).json({ success: false, message: 'Failed to create task' });
        }
    },

    updateTask: async (req, res, db) => {
        const { id } = req.params;
        const { title, category, date, start_time, end_time, reminder_minutes, notes, status, repeat_type, repeat_value } = req.body;
        console.log(`[DEBUG] Update task ${id} body:`, JSON.stringify(req.body));
        try {
            const isRecurring = ['daily', 'weekly', 'monthly'].includes(repeat_type) ? 1 : 0;
            console.log(`[DEBUG] Saving: isRecurring=${isRecurring}, repeat_type=${repeat_type}, repeat_value=${repeat_value}`);
            await db.run(
                `UPDATE tasks SET title = ?, category = ?, date = ?, start_time = ?, end_time = ?, reminder_minutes = ?, notes = ?, status = ?, is_recurring = ?, repeat_type = ?, repeat_value = ?
                 WHERE id = ?`,
                [title, category, date, start_time, end_time, reminder_minutes, notes, status, isRecurring, repeat_type || 'none', repeat_value || 0, id]
            );
            res.json({ success: true });
        } catch (error) {
            console.error('Update task error:', error);
            res.status(500).json({ success: false, message: 'Failed to update task' });
        }
    },

    deleteTask: async (req, res, db) => {
        const { id } = req.params;
        try {
            await db.run('DELETE FROM tasks WHERE id = ?', [id]);
            res.json({ success: true });
        } catch (error) {
            console.error('Delete task error:', error);
            res.status(500).json({ success: false, message: 'Failed to delete task' });
        }
    },

    toggleTaskStatus: async (req, res, db) => {
        const { id } = req.params;
        try {
            const task = await db.get('SELECT status FROM tasks WHERE id = ?', [id]);
            const newStatus = task.status === 'pending' ? 'completed' : 'pending';
            await db.run('UPDATE tasks SET status = ? WHERE id = ?', [newStatus, id]);
            res.json({ success: true, status: newStatus });
        } catch (error) {
            console.error('Toggle status error:', error);
            res.status(500).json({ success: false, message: 'Failed to toggle status' });
        }
    },

    renewTasks: async (req, res, db) => {
        try {
            const recurringTasks = await db.all('SELECT * FROM tasks WHERE is_recurring = 1');
            const results = [];

            for (const task of recurringTasks) {
                const [y, m, d] = task.date.split('-').map(Number);
                const oldDate = new Date(y, m - 1, d);
                let newDate = new Date(oldDate);

                if (task.repeat_type === 'weekly') {
                    newDate.setDate(oldDate.getDate() + 7);
                } else if (task.repeat_type === 'daily') {
                    newDate.setDate(oldDate.getDate() + 1);
                } else if (task.repeat_type === 'monthly') {
                    newDate.setMonth(oldDate.getMonth() + 1);
                } else {
                    continue;
                }

                const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;

                const exists = await db.get('SELECT id FROM tasks WHERE title = ? AND date = ? AND start_time = ?', [task.title, dateStr, task.start_time]);

                if (!exists) {
                    const result = await db.run(
                        `INSERT INTO tasks (title, category, date, start_time, end_time, reminder_minutes, notes, status, is_recurring, repeat_type, repeat_value) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)`,
                        [task.title, task.category, dateStr, task.start_time, task.end_time, task.reminder_minutes, task.notes, task.repeat_type, task.repeat_value]
                    );
                    results.push(result.lastID);
                }
            }
            res.json({ success: true, renewed: results.length });
        } catch (error) {
            console.error('Renew tasks error:', error);
            res.status(500).json({ success: false, message: 'Failed to renew tasks' });
        }
    }
};

module.exports = taskController;
