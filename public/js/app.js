// State Management
let tasks = [];
let currentView = 'all';
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// Elements
const currentDateTime = document.getElementById('currentDateTime');
const themeToggle = document.getElementById('themeToggle');
const logoutBtn = document.getElementById('logoutBtn');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskModal = document.getElementById('taskModal');
const closeModal = document.querySelector('.close-modal');
const taskForm = document.getElementById('taskForm');
const listView = document.getElementById('listView');
const scheduleView = document.getElementById('scheduleView');
const weeklyView = document.getElementById('weeklyView');
const monthlyView = document.getElementById('monthlyView');
const tabButtons = document.querySelectorAll('.tab-btn');
const alertSound = document.getElementById('alertSound');

// New Repetition Elements
const repeatTypeSelect = document.getElementById('repeat_type');
const repeatValueGroup = document.getElementById('repeat_value_group');
const repeatValueLabel = document.getElementById('repeat_value_label');
const repeatValueInput = document.getElementById('repeat_value');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    updateClock();
    setInterval(updateClock, 1000);
    fetchTasks();
    requestNotificationPermission();
    setInterval(checkReminders, 30000);
    checkWeeklyRenewal();
});

// Clock Functions
function updateClock() {
    const now = new Date();
    currentDateTime.textContent = now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Theme Handlers
themeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    applyTheme();
});

function applyTheme() {
    document.body.classList.toggle('dark-mode', isDarkMode);
    const icon = themeToggle.querySelector('i');
    icon.className = isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// Modal Handlers
addTaskBtn.addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Add New Task';
    document.getElementById('taskId').value = '';
    taskForm.reset();
    repeatValueGroup.style.display = 'none';
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
    taskModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => taskModal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === taskModal) taskModal.style.display = 'none'; });

// Repetition Field Logic
repeatTypeSelect.addEventListener('change', () => {
    const type = repeatTypeSelect.value;
    if (type === 'days') {
        repeatValueGroup.style.display = 'block';
        repeatValueLabel.textContent = 'Number of Days';
    } else {
        repeatValueGroup.style.display = 'none';
    }
});

// Task CRUD
async function fetchTasks() {
    try {
        const response = await fetch('/api/tasks');
        tasks = await response.json();
        console.log('[DEBUG] Fetched tasks:', tasks);
        renderDashboard();
    } catch (error) {
        console.error('Error fetching tasks:', error);
    }
}

taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(taskForm);
    const data = Object.fromEntries(formData.entries());
    const taskId = document.getElementById('taskId').value;

    const method = taskId ? 'PUT' : 'POST';
    const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';

    try {
        console.log('[DEBUG] Sending task data:', JSON.stringify(data));
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            taskModal.style.display = 'none';
            fetchTasks();
        }
    } catch (error) {
        console.error('Error saving task:', error);
    }
});

async function toggleTask(id) {
    try {
        const response = await fetch(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
        if (response.ok) fetchTasks();
    } catch (error) {
        console.error('Error toggling task:', error);
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        if (response.ok) fetchTasks();
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}

function editTask(task) {
    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('title').value = task.title;
    document.getElementById('category').value = task.category;
    document.getElementById('date').value = task.date;
    document.getElementById('start_time').value = task.start_time;
    document.getElementById('end_time').value = task.end_time;
    document.getElementById('reminder_minutes').value = task.reminder_minutes;
    document.getElementById('notes').value = task.notes || '';
    document.getElementById('repeat_type').value = task.repeat_type || 'none';
    document.getElementById('repeat_value').value = task.repeat_value || 0;

    // Trigger visibility update
    repeatTypeSelect.dispatchEvent(new Event('change'));

    taskModal.style.display = 'flex';
}

function getTasksForDate(dateStr) {
    const [ty, tm, td] = dateStr.split('-').map(Number);
    const targetDate = new Date(ty, tm - 1, td);
    targetDate.setHours(0, 0, 0, 0);

    return tasks.filter(task => {
        // 1. Exact date match
        if (task.date === dateStr) return true;

        // 2. Handle recurring tasks
        if (task.is_recurring) {
            const [sy, sm, sd] = task.date.split('-').map(Number);
            const startDate = new Date(sy, sm - 1, sd);
            startDate.setHours(0, 0, 0, 0);

            // Cannot start before the original date
            if (targetDate < startDate) return false;

            const diffTime = targetDate.getTime() - startDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (task.repeat_type === 'daily') return true;
            if (task.repeat_type === 'weekly') return diffDays % 7 === 0;
            if (task.repeat_type === 'monthly') {
                return targetDate.getDate() === startDate.getDate();
            }
        }
        return false;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// Rendering
function renderDashboard() {
    renderStats();
    if (currentView === 'all') renderListView();
    else if (currentView === 'schedule') renderScheduleView();
    else if (currentView === 'weekly') renderWeeklyView();
    else if (currentView === 'monthly') renderMonthlyView();
}

function renderStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = getTasksForDate(today);
    const completed = todayTasks.filter(t => t.status === 'completed').length;
    const progress = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0;

    document.getElementById('progressText').textContent = `${progress}%`;
    document.getElementById('progressBar').style.width = `${progress}%`;

    const nowStr = new Date().toTimeString().slice(0, 5);
    const current = todayTasks.find(t => t.start_time <= nowStr && t.end_time >= nowStr);
    const upcoming = todayTasks.filter(t => t.start_time > nowStr)[0];

    document.getElementById('currentTaskDisplay').textContent = current ? current.title : 'No active task';
    document.getElementById('nextTaskDisplay').textContent = upcoming ? `${upcoming.start_time} - ${upcoming.title}` : 'No upcoming tasks';
}

function renderListView() {
    listView.style.display = 'grid';
    scheduleView.style.display = 'none';
    weeklyView.style.display = 'none';
    monthlyView.style.display = 'none';

    const today = new Date().toISOString().split('T')[0];
    const todayTasks = getTasksForDate(today);

    if (todayTasks.length === 0) {
        listView.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">No tasks scheduled for today.</div>';
        return;
    }

    listView.innerHTML = todayTasks.map(task => `
        <div class="task-card ${task.status === 'completed' ? 'completed' : ''}" style="border-left-color: var(--category-${task.category.toLowerCase()})">
            <span class="task-category category-${task.category}">${task.category}</span>
            <h3 class="task-title">${task.title}</h3>
            <div class="task-time">
                <i class="far fa-clock"></i>
                ${task.start_time} - ${task.end_time}
            </div>
            <div class="task-actions">
                <button class="btn-icon" onclick="toggleTask(${task.id})" title="Toggle Status">
                    <i class="fa-solid ${task.status === 'completed' ? 'fa-undo' : 'fa-check'}"></i>
                </button>
                <button class="btn-icon" onclick="event.stopPropagation(); editTask(${JSON.stringify(task).replace(/"/g, '&quot;')})" title="Edit">
                    <i class="fa-solid fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="event.stopPropagation(); deleteTask(${task.id})" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function renderScheduleView() {
    listView.style.display = 'none';
    scheduleView.style.display = 'block';
    weeklyView.style.display = 'none';
    monthlyView.style.display = 'none';

    const today = new Date().toISOString().split('T')[0];
    const todayTasks = getTasksForDate(today);

    let html = `
        <div class="timeline-container" style="background: var(--card-light); border-radius: 1.5rem; padding: 2rem; border: 1px solid var(--border-light); margin-bottom: 2rem;">
            <h2 style="margin-bottom: 2rem;">Today's Timeline</h2>
            <div class="timeline-grid" style="display: grid; grid-template-columns: 80px 1fr; column-gap: 1rem; row-gap: 0;">
    `;

    for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0') + ':00';
        const tasksInHour = todayTasks.filter(t => {
            const startHour = parseInt(t.start_time.split(':')[0]);
            const endHour = parseInt(t.end_time.split(':')[0]);
            const endMin = parseInt(t.end_time.split(':')[1]);

            let lastHour = endHour;
            if (endMin === 0) lastHour--;

            return i >= startHour && i <= lastHour;
        });

        html += `
            <div class="timeline-hour" style="color: #64748b; font-weight: 600; padding: 1.5rem 0; border-top: 1px solid var(--border-light); font-size: 0.85rem;">${hour}</div>
            <div class="timeline-slot" style="padding: 0; border-top: 1px solid var(--border-light); min-height: 80px; position: relative; display: flex; flex-direction: column;">
                ${tasksInHour.map(t => {
            const startHour = parseInt(t.start_time.split(':')[0]);
            const endHour = parseInt(t.end_time.split(':')[0]);
            const endMin = parseInt(t.end_time.split(':')[1]);
            let lastHour = endHour;
            if (endMin === 0) lastHour--;

            const isStart = i === startHour;
            const isEnd = i === lastHour;
            const isMid = i > startHour && i < lastHour;

            let style = `padding: 0.8rem; border-left: 5px solid var(--category-${t.category.toLowerCase()}); background: rgba(255,255,255,0.85); margin: 0 0.5rem; flex: 1; position: relative;`;

            if (isStart && !isEnd) {
                style += `border-radius: 0.8rem 0.8rem 0 0; margin-top: 0.8rem; margin-bottom: 0; border-bottom: none;`;
            } else if (isMid) {
                style += `border-radius: 0; border-top: none; border-bottom: none; margin-top: 0; margin-bottom: 0;`;
            } else if (isEnd && !isStart) {
                style += `border-radius: 0 0 0.8rem 0.8rem; margin-bottom: 0.8rem; margin-top: 0; border-top: none;`;
            } else if (isStart && isEnd) {
                style += `border-radius: 0.8rem; margin: 0.8rem 0.5rem;`;
            }

            return `
                        <div class="timeline-task category-${t.category}" onclick="editTask(${t.id})" style="${style} box-shadow: 2px 0 10px rgba(0,0,0,0.03); cursor: pointer;">
                            ${isStart ? `
                                <div style="font-weight: 700; font-size: 0.85rem; color: var(--category-${t.category.toLowerCase()});">${t.start_time} - ${t.end_time}</div>
                                <div style="font-weight: 600; color: var(--text-light);">${t.title}</div>
                                ${t.notes ? `<div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">${t.notes}</div>` : ''}
                            ` : `
                                <div style="color: var(--category-${t.category.toLowerCase()}); font-size: 0.75rem; opacity: 0.5; font-weight: 600;">(cont...)</div>
                            `}
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    html += `</div></div>`;
    scheduleView.innerHTML = html;

    if (document.body.classList.contains('dark-mode')) {
        const container = scheduleView.querySelector('.timeline-container');
        if (container) {
            container.style.background = 'var(--card-dark)';
            container.style.borderColor = 'var(--border-dark)';
            const tasksDisplay = container.querySelectorAll('.timeline-task');
            tasksDisplay.forEach(t => {
                t.style.background = 'rgba(0,0,0,0.2)';
                const title = t.querySelector('div:nth-child(2)');
                if (title) title.style.color = 'var(--text-dark)';
            });
        }
    }
}

function renderWeeklyView() {
    listView.style.display = 'none';
    scheduleView.style.display = 'none';
    weeklyView.style.display = 'block';
    monthlyView.style.display = 'none';

    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';

    const now = new Date();
    const dayOfWeek = now.getDay();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - dayOfWeek); // Start from Sunday

    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startDate);
        currentDay.setDate(startDate.getDate() + i);
        const dayStr = currentDay.toISOString().split('T')[0];
        const dayName = currentDay.toLocaleDateString('en-US', { weekday: 'short' });
        const dayTasks = getTasksForDate(dayStr);

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `
            <div class="calendar-date">${dayName} ${currentDay.getDate()}</div>
            <div class="calendar-tasks">
                ${dayTasks.map(t => `
                    <div class="day-task category-${t.category}" title="${t.title}" style="background: var(--category-${t.category.toLowerCase()})22; color: var(--category-${t.category.toLowerCase()}); border-left: 3px solid var(--category-${t.category.toLowerCase()}); margin-bottom: 4px; padding: 2px 5px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">
                        ${t.start_time} ${t.title}
                    </div>
                `).join('')}
            </div>
        `;
        calendarGrid.appendChild(dayEl);
    }
}

function renderMonthlyView() {
    listView.style.display = 'none';
    scheduleView.style.display = 'none';
    weeklyView.style.display = 'none';
    monthlyView.style.display = 'block';

    const grid = document.getElementById('monthlyGrid');
    grid.innerHTML = '';

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => {
        const h = document.createElement('div');
        h.style.fontWeight = 'bold';
        h.style.textAlign = 'center';
        h.style.padding = '10px';
        h.textContent = d;
        grid.appendChild(h);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayTasks = getTasksForDate(dateStr);

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.style.minHeight = '100px';
        dayEl.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${d}</div>
            <div class="calendar-tasks">
                ${dayTasks.map(t => `
                    <div style="font-size: 0.6rem; padding: 2px; margin-bottom: 2px; border-left: 2px solid var(--category-${t.category.toLowerCase()}); background: var(--category-${t.category.toLowerCase()})11; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;" title="${t.title}">
                        ${t.title}
                    </div>
                `).join('')}
            </div>
        `;
        grid.appendChild(dayEl);
    }
}

// End of Week Renewal Check
function checkWeeklyRenewal() {
    const now = new Date();
    const day = now.getDay();
    if ([0, 1, 5, 6].includes(day)) {
        const hasRecurring = tasks.some(t => t.is_recurring === 1);
        const lastCheck = localStorage.getItem('lastRenewalCheck');
        const todayStr = now.toISOString().split('T')[0];

        if (hasRecurring && lastCheck !== todayStr) {
            if (confirm('It is the end of the week! Would you like to renew your recurring tasks for the next week?')) {
                renewRecurringTasks();
            }
            localStorage.setItem('lastRenewalCheck', todayStr);
        }
    }
}

async function renewRecurringTasks() {
    try {
        const response = await fetch('/api/tasks/renew', { method: 'POST' });
        if (response.ok) {
            alert('Recurring tasks renewed for the new week!');
            fetchTasks();
        }
    } catch (e) {
        console.error('Renewal error:', e);
    }
}

// Tab Switching
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        renderDashboard();
    });
});

// Notifications
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission();
    }
}

function checkReminders() {
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);

    tasks.forEach(task => {
        // Expand recurring tasks check for reminders
        const todayTasks = getTasksForDate(nowStr);
        todayTasks.forEach(task => {
            if (task.status === 'pending') {
                const [h, m] = task.start_time.split(':').map(Number);
                const taskTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
                const diffMin = Math.round((taskTime - now) / 60000);

                if (diffMin === parseInt(task.reminder_minutes)) {
                    triggerNotification(task);
                }
            }
        });
    });
}

function triggerNotification(task) {
    if (Notification.permission === 'granted') {
        new Notification(`Reminder: ${task.title}`, {
            body: `Starts at ${task.start_time} in ${task.category}`,
            icon: '/favicon.ico'
        });
    }
    alertSound.play().catch(e => console.log('Audio play blocked'));
}

// Logout
logoutBtn.addEventListener('click', async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (response.ok) window.location.href = '/login';
});
