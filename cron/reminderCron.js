const cron = require('node-cron');

function setupCron(db) {
    // Check every minute
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0];
        const currentTime = now.toTimeString().slice(0, 5);

        try {
            // Find tasks for today that are approaching (reminder_minutes before start_time)
            // AND have not been notified yet today
            const tasks = await db.all(`
                SELECT t.* FROM tasks t
                LEFT JOIN notifications_log nl ON t.id = nl.task_id AND DATE(nl.sent_at) = CURRENT_DATE
                WHERE t.date = ? AND t.status = 'pending' AND nl.id IS NULL
            `, [currentDate]);

            for (const task of tasks) {
                const [startHour, startMin] = task.start_time.split(':').map(Number);
                const taskStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMin);
                const reminderTime = new Date(taskStartTime.getTime() - task.reminder_minutes * 60000);

                if (now >= reminderTime && now < taskStartTime) {
                    console.log(`[CRON] Triggering reminder for task: ${task.title}`);

                    // Log the notification to ensure it only triggers once
                    await db.run('INSERT INTO notifications_log (task_id) VALUES (?)', [task.id]);
                }
            }
        } catch (error) {
            console.error('[CRON] Error checking tasks:', error);
        }
    });

    console.log('Reminder cron job scheduled.');
}

module.exports = setupCron;
