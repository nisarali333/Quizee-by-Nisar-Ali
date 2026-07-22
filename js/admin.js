// Super Admin JS Logic

async function switchAdminSection(sectionId, element = null) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else if (typeof event !== 'undefined' && event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    document.querySelectorAll('.section-view').forEach(el => el.classList.remove('active'));
    document.getElementById(`section-${sectionId}`).classList.add('active');

    if (sectionId === 'dashboard') {
        await loadAdminStats();
        if (!window.adminChartsInitialized) await initAdminCharts();
    } else if (sectionId === 'teachers') {
        await loadAdminTeachers();
    } else if (sectionId === 'students') {
        await loadAdminStudents();
    } else if (sectionId === 'quizzes') {
        await loadAdminQuizzes();
    } else if (sectionId === 'attempts') {
        await loadAdminAttempts();
    } else if (sectionId === 'logs') {
        await loadAdminLogs();
    }
}

async function handleAdminSearch() {
    const activeSection = document.querySelector('.section-view.active');
    if (!activeSection) return;
    
    if (activeSection.id === 'section-teachers') {
        await loadAdminTeachers();
    } else if (activeSection.id === 'section-students') {
        await loadAdminStudents();
    } else if (activeSection.id === 'section-quizzes') {
        renderAdminQuizzes();
    } else if (activeSection.id === 'section-attempts') {
        renderAdminAttempts();
    } else if (activeSection.id === 'section-logs') {
        await loadAdminLogs();
    }
}

// Ensure admin is logged in
document.addEventListener('DOMContentLoaded', async () => {
    const session = db.getSession();
    if (!session || session.role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }
    
    // Set user info
    document.getElementById('adminNameDisplay').innerText = session.name;

    // Load initial views
    await loadAdminStats();
    await initAdminCharts();
});

async function loadAdminStats() {
    const users = await db.get('users');
    const teachers = users.filter(u => u.role === 'teacher').length;
    const students = users.filter(u => u.role === 'student').length;
    const quizzes = (await db.get('quizzes')).length;
    const attempts = (await db.get('attempts')).length;
    
    document.getElementById('statTeachers').innerText = teachers;
    document.getElementById('statStudents').innerText = students;
    document.getElementById('statQuizzes').innerText = quizzes;
    document.getElementById('statAttempts').innerText = attempts;
}

async function loadAdminTeachers() {
    const tbody = document.getElementById('adminTeachersTableBody');
    const users = await db.get('users');
    let teachers = users.filter(u => u.role === 'teacher');
    
    const searchVal = (document.getElementById('adminGlobalSearch')?.value || '').toLowerCase();
    if (searchVal) {
        teachers = teachers.filter(t => t.name.toLowerCase().includes(searchVal) || t.email.toLowerCase().includes(searchVal));
    }
    
    tbody.innerHTML = '';
    if (teachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No teachers registered yet.</td></tr>';
        return;
    }

    teachers.forEach(teacher => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${teacher.name}</strong></td>
            <td>${teacher.institution || 'N/A'}</td>
            <td>${teacher.email}</td>
            <td><span class="badge ${teacher.status === 'active' ? 'active' : 'inactive'}">${teacher.status}</span></td>
            <td class="action-btns">
                <button class="btn-icon" title="Toggle Status" onclick="toggleTeacherStatus('${teacher.id}', '${teacher.status}')">
                    <i class="fa-solid ${teacher.status === 'active' ? 'fa-ban' : 'fa-check'}"></i>
                </button>
                <button class="btn-icon" style="color:var(--danger-color);" title="Delete" onclick="deleteUser('${teacher.id}', 'teacher')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function toggleTeacherStatus(id, currentStatus) {
    await db.update('users', id, { status: currentStatus === 'active' ? 'inactive' : 'active' });
    await loadAdminTeachers();
}

async function deleteUser(id, type) {
    if(confirm(`Are you sure you want to delete this ${type}?`)) {
        await db.delete('users', id);
        if(type === 'teacher') await loadAdminTeachers();
        else await loadAdminStudents();
    }
}

async function loadAdminStudents() {
    const tbody = document.getElementById('adminStudentsTableBody');
    const users = await db.get('users');
    let students = users.filter(u => u.role === 'student');
    
    const searchVal = (document.getElementById('adminGlobalSearch')?.value || '').toLowerCase();
    if (searchVal) {
        students = students.filter(s => 
            s.name.toLowerCase().includes(searchVal) || 
            (s.studentId && s.studentId.toLowerCase().includes(searchVal)) ||
            (s.teacherName && s.teacherName.toLowerCase().includes(searchVal))
        );
    }
    
    tbody.innerHTML = '';
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No students generated yet.</td></tr>';
        return;
    }

    students.forEach(student => {
        // Find teacher who created this student (assuming teacherName is saved)
        const teacherName = student.teacherName || 'Unknown';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${student.studentId}</td>
            <td><strong>${student.name}</strong></td>
            <td>${student.className} - ${student.section}</td>
            <td>${teacherName}</td>
            <td class="action-btns">
                <button class="btn-icon" style="color:var(--danger-color);" onclick="deleteUser('${student.id}', 'student')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadAdminLogs() {
    const tbody = document.getElementById('adminLogsTableBody');
    let logs = await db.get('logs');
    logs.reverse(); // Show latest first
    
    const searchVal = (document.getElementById('adminGlobalSearch')?.value || '').toLowerCase();
    if (searchVal) {
        logs = logs.filter(l => 
            l.user.toLowerCase().includes(searchVal) || 
            l.action.toLowerCase().includes(searchVal) ||
            l.role.toLowerCase().includes(searchVal)
        );
    }
    
    tbody.innerHTML = '';
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No activity logged yet.</td></tr>';
        return;
    }

    logs.forEach(log => {
        const date = new Date(log.createdAt).toLocaleString();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td>${log.user}</td>
            <td>${log.role}</td>
            <td>${log.action}</td>
            <td>${log.ip || 'Local'}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function logoutAdmin() {
    await db.logActivity(db.getSession().name, 'Super Admin', 'Account Logout');
    db.clearSession();
    window.location.href = 'admin-login.html';
}

async function initAdminCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Outfit', sans-serif";

    // Actual Role Distribution Data
    const users = await db.get('users');
    const students = users.filter(u => u.role === 'student').length;
    const teachers = users.filter(u => u.role === 'teacher').length;
    const admins = users.filter(u => u.role === 'admin').length;

    // Actual Traffic Data (Group logs by day of week)
    const logs = await db.get('logs');
    const trafficByDay = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat
    
    logs.forEach(log => {
        if(log.action === 'Account Login') {
            const date = new Date(log.createdAt);
            // JS getDay() returns 0 for Sunday, 1 for Monday... 
            // We want labels: Mon to Sun. So we shift it:
            let dayIndex = date.getDay() - 1;
            if (dayIndex === -1) dayIndex = 6; // Sunday becomes 6
            trafficByDay[dayIndex]++;
        }
    });

    const ctxTraffic = document.getElementById('sysTrafficChart');
    if(ctxTraffic) {
        new Chart(ctxTraffic.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'System Logins',
                    data: trafficByDay,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, grid: { color: gridColor }, ticks: { stepSize: 1 } }, 
                    x: { grid: { color: gridColor } } 
                }
            }
        });
    }

    const ctxRole = document.getElementById('roleDistChart');
    if(ctxRole) {
        new Chart(ctxRole.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Students', 'Teachers', 'Super Admin'],
                datasets: [{
                    data: [students, teachers, admins],
                    backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '70%',
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    window.adminChartsInitialized = true;
}

// -----------------------------------------
// QUIZ MANAGEMENT LOGIC
// -----------------------------------------
let adminQuizzes = [];
let adminSelectedQuizzes = new Set();

async function loadAdminQuizzes() {
    adminQuizzes = await db.get('quizzes');
    
    // Populate filter dropdowns
    const teacherSelect = document.getElementById('filterQuizTeacher');
    const classSelect = document.getElementById('filterQuizClass');
    
    const teachers = new Set(adminQuizzes.map(q => q.teacherName || 'Unknown'));
    const classes = new Set(adminQuizzes.map(q => q.targetClass).filter(c => c));
    
    teacherSelect.innerHTML = '<option value="">All Teachers</option>' + Array.from(teachers).map(t => `<option value="${t}">${t}</option>`).join('');
    classSelect.innerHTML = '<option value="">All Classes</option>' + Array.from(classes).map(c => `<option value="${c}">${c}</option>`).join('');
    
    renderAdminQuizzes();
}

function renderAdminQuizzes() {
    const grid = document.getElementById('adminQuizGrid');
    const countBadge = document.getElementById('adminQuizCountBadge');
    
    const teacherFilter = document.getElementById('filterQuizTeacher').value;
    const classFilter = document.getElementById('filterQuizClass').value;
    const searchFilter = (document.getElementById('filterQuizSearch').value || '').toLowerCase();
    const globalSearch = (document.getElementById('adminGlobalSearch')?.value || '').toLowerCase();
    
    let filtered = adminQuizzes.filter(q => {
        const teacherMatch = !teacherFilter || (q.teacherName || 'Unknown') === teacherFilter;
        const classMatch = !classFilter || q.targetClass === classFilter;
        
        const textToSearch = `${q.title} ${q.subject} ${q.teacherName || ''}`.toLowerCase();
        const searchMatch = !searchFilter || textToSearch.includes(searchFilter);
        const globalMatch = !globalSearch || textToSearch.includes(globalSearch);
        
        return teacherMatch && classMatch && searchMatch && globalMatch;
    });
    
    countBadge.innerText = `${filtered.length} quizzes`;
    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-secondary); padding: 1rem;">No quizzes match the criteria.</p>';
        return;
    }
    
    filtered.forEach(quiz => {
        const isSelected = adminSelectedQuizzes.has(quiz.id);
        const card = document.createElement('div');
        card.className = `quiz-mgmt-card ${isSelected ? 'selected' : ''}`;
        card.innerHTML = `
            <input type="checkbox" class="quiz-cb" ${isSelected ? 'checked' : ''} onchange="toggleAdminQuizSelection('${quiz.id}', this.checked)">
            <h3 style="margin:0 0 0.25rem; font-size:1.1rem; color:var(--text-primary); padding-right:25px;">${quiz.title}</h3>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
                <span class="badge" style="background:rgba(59,130,246,0.1); color:var(--primary-color);">${quiz.subject}</span>
                <span class="badge" style="background:rgba(245,158,11,0.1); color:var(--warning-color);">${quiz.targetClass || 'General'}</span>
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.25rem;">
                <i class="fa-solid fa-chalkboard-user"></i> By: ${quiz.teacherName || 'Unknown'}
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary);">
                <i class="fa-solid fa-list-ol"></i> Questions: ${quiz.questions ? quiz.questions.length : 0}
            </div>
        `;
        grid.appendChild(card);
    });
    
    // Auto-uncheck "Select All" if not everything is selected
    const selectAllCb = document.getElementById('selectAllCb');
    if (selectAllCb) {
        selectAllCb.checked = filtered.length > 0 && Array.from(filtered).every(q => adminSelectedQuizzes.has(q.id));
    }
    updateAdminBulkBar();
}

window.clearQuizFilters = function() {
    document.getElementById('filterQuizTeacher').value = '';
    document.getElementById('filterQuizClass').value = '';
    document.getElementById('filterQuizSearch').value = '';
    renderAdminQuizzes();
}

window.toggleAdminQuizSelection = function(quizId, checked) {
    if (checked) adminSelectedQuizzes.add(quizId);
    else adminSelectedQuizzes.delete(quizId);
    
    renderAdminQuizzes();
}

window.toggleSelectAll = function() {
    const cb = document.getElementById('selectAllCb');
    const teacherFilter = document.getElementById('filterQuizTeacher').value;
    const classFilter = document.getElementById('filterQuizClass').value;
    const searchFilter = (document.getElementById('filterQuizSearch').value || '').toLowerCase();
    const globalSearch = (document.getElementById('adminGlobalSearch')?.value || '').toLowerCase();
    
    const filtered = adminQuizzes.filter(q => {
        const teacherMatch = !teacherFilter || (q.teacherName || 'Unknown') === teacherFilter;
        const classMatch = !classFilter || q.targetClass === classFilter;
        
        const textToSearch = `${q.title} ${q.subject} ${q.teacherName || ''}`.toLowerCase();
        const searchMatch = !searchFilter || textToSearch.includes(searchFilter);
        const globalMatch = !globalSearch || textToSearch.includes(globalSearch);
        
        return teacherMatch && classMatch && searchMatch && globalMatch;
    });
    
    if (cb.checked) {
        filtered.forEach(q => adminSelectedQuizzes.add(q.id));
    } else {
        filtered.forEach(q => adminSelectedQuizzes.delete(q.id));
    }
    
    renderAdminQuizzes();
}

function updateAdminBulkBar() {
    const bar = document.getElementById('bulkBar');
    const count = document.getElementById('selectedCount');
    
    if (adminSelectedQuizzes.size > 0) {
        bar.classList.add('visible');
        count.innerText = adminSelectedQuizzes.size;
    } else {
        bar.classList.remove('visible');
    }
}

window.clearSelection = function() {
    adminSelectedQuizzes.clear();
    const selectAllCb = document.getElementById('selectAllCb');
    if (selectAllCb) selectAllCb.checked = false;
    renderAdminQuizzes();
}

window.bulkDeleteQuizzes = async function() {
    if (adminSelectedQuizzes.size === 0) return;
    
    if (confirm(`Are you sure you want to delete ${adminSelectedQuizzes.size} quizzes globally? This action cannot be undone.`)) {
        for (const quizId of adminSelectedQuizzes) {
            await db.delete('quizzes', quizId);
        }
        await db.logActivity(db.getSession().name, 'Super Admin', `Bulk deleted ${adminSelectedQuizzes.size} quizzes globally.`);
        adminSelectedQuizzes.clear();
        await loadAdminQuizzes();
        await loadAdminStats(); // Update dashboard stat
    }
}


// -----------------------------------------
// QUIZ ATTEMPTS LOGIC
// -----------------------------------------
let adminAttempts = [];

async function loadAdminAttempts() {
    const attempts = await db.get('attempts');
    const users = await db.get('users');
    const quizzes = await db.get('quizzes');
    
    adminAttempts = attempts.map(a => {
        const student = users.find(u => u.id === a.studentId) || {};
        const quiz = quizzes.find(q => q.id === a.quizId) || {};
        const teacher = users.find(u => u.id === a.teacherId) || {};
        
        const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
        const result = pct >= 50 ? 'Pass' : 'Fail';
        
        return {
            ...a,
            studentName: student.name || 'Unknown',
            quizTitle: quiz.title || 'Deleted Quiz',
            teacherName: teacher.name || 'Unknown',
            result: result,
            totalScore: a.total
        };
    });
    renderAdminAttempts();
}

window.renderAdminAttempts = function() {
    const tbody = document.getElementById('adminAttemptsTableBody');
    const countBadge = document.getElementById('adminAttemptsCountBadge');
    
    const searchFilter = (document.getElementById('filterAttemptSearch').value || '').toLowerCase();
    const globalSearch = (document.getElementById('adminGlobalSearch')?.value || '').toLowerCase();
    
    let filtered = adminAttempts.filter(a => {
        const textToSearch = `${a.studentName} ${a.quizTitle} ${a.teacherName || ''} ${a.result}`.toLowerCase();
        const searchMatch = !searchFilter || textToSearch.includes(searchFilter);
        const globalMatch = !globalSearch || textToSearch.includes(globalSearch);
        
        return searchMatch && globalMatch;
    });
    
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    countBadge.innerText = `${filtered.length} attempts`;
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No attempts found.</td></tr>';
        return;
    }
    
    filtered.forEach((attempt, idx) => {
        const isPass = attempt.result === 'Pass';
        const date = new Date(attempt.createdAt).toLocaleDateString();
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${attempt.studentName}</strong></td>
            <td>${attempt.quizTitle}</td>
            <td>${attempt.teacherName || 'Unknown'}</td>
            <td><strong>${attempt.score}</strong> / ${attempt.totalScore}</td>
            <td><span class="badge ${isPass ? 'active' : 'inactive'}">${attempt.result}</span></td>
            <td>${Math.floor(attempt.timeSpent / 60)}m ${attempt.timeSpent % 60}s</td>
            <td>${date}</td>
        `;
        tbody.appendChild(tr);
    });
}
