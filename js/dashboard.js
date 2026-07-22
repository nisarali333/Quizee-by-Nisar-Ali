// Teacher Dashboard JS Logic

let currentTeacher = null;
let allStudents = [];
let allQuizzes = [];
let allAttempts = [];

document.addEventListener('DOMContentLoaded', async () => {
    currentTeacher = db.getSession();
    if (!currentTeacher || currentTeacher.role !== 'teacher') {
        window.location.href = '../index.html';
        return;
    }
    
    // Set Profile Name & School
    const profileSpan = document.getElementById('topbarProfileName');
    if (profileSpan) profileSpan.innerText = currentTeacher.name;

    const schoolSpan = document.getElementById('topbarSchoolName');
    if (schoolSpan) schoolSpan.innerText = currentTeacher.institution || currentTeacher.schoolName || '';

    await loadTeacherData();
    populateClassList(); 
    populateSessionDropdowns();

    await loadTeacherStats();
    if (!window.chartsInitialized) initCharts();
});

async function loadTeacherData() {
    const users = await db.get('users');
    allStudents = users.filter(u => u.role === 'student' && u.teacherId === currentTeacher.id);
    
    const quizzes = await db.get('quizzes');
    allQuizzes = quizzes.filter(q => q.teacherId === currentTeacher.id);

    const attempts = await db.get('attempts');
    allAttempts = attempts.filter(a => a.teacherId === currentTeacher.id);
}

function toggleProfileDropdown() {
    const dd = document.getElementById('profileDropdown');
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

async function logoutTeacher() {
    await db.logActivity(currentTeacher.name, 'Teacher', 'Account Logout');
    db.clearSession();
    window.location.href = '../index.html';
}

function populateSessionDropdowns() {
    const currentYear = new Date().getFullYear();
    const sessions = [];
    for(let i=0; i<5; i++) {
        const year1 = currentYear + i;
        const year2 = (year1 + 1).toString().slice(-2);
        sessions.push(`${year1}-${year2}`);
    }
    
    const dropdowns = ['quizSession', 'filterLibSession', 'filterResSession', 'filterStudSession'];
    dropdowns.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            // Keep "All Sessions" placeholder, then append dynamic years
            const placeholder = el.querySelector('option[value=""]');
            el.innerHTML = '';
            if (placeholder) el.appendChild(placeholder);
            sessions.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s; opt.textContent = s;
                el.appendChild(opt);
            });
        }
    });
}

function populateClassList() {
    const classes = [...new Set(allStudents.map(s => s.className))];
    
    const datalist = document.getElementById('classList');
    if (datalist) {
        datalist.innerHTML = classes.map(c => `<option value="${c}">`).join('');
    }

    // Populate Filters
    const classDropdowns = ['filterLibClass', 'filterResClass'];
    classDropdowns.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.innerHTML = '<option value="">All Classes</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    });
}

async function switchSection(sectionId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.section-view').forEach(el => el.classList.remove('active'));
    document.getElementById(`section-${sectionId}`).classList.add('active');

    // Refresh Data
    await loadTeacherData();

    if (sectionId === 'dashboard') {
        await loadTeacherStats();
        if (!window.chartsInitialized) initCharts();
    } else if (sectionId === 'classes') {
        renderStudentsTable();
    } else if (sectionId === 'library') {
        loadQuizLibrary();
    } else if (sectionId === 'results') {
        loadResults();
    }
}

async function loadTeacherStats() {
    const statCards = document.querySelectorAll('.stat-info h3');
    if (statCards.length >= 4) {
        const classesCount = new Set(allStudents.map(s => s.className)).size;
        statCards[0].innerText = classesCount;
        statCards[1].innerText = allStudents.length;
        statCards[2].innerText = allQuizzes.length;
        statCards[3].innerText = allAttempts.length;
    }
}

// ============================================================
//  SEARCH LOGIC
// ============================================================
function handleDashboardSearch() {
    const query = document.getElementById('dashboardSearch').value.toLowerCase();
    
    // Check which section is active
    const classesActive = document.getElementById('section-classes').classList.contains('active');
    const libraryActive = document.getElementById('section-library').classList.contains('active');
    const resultsActive = document.getElementById('section-results').classList.contains('active');

    // If searching from the main overview, auto-switch to Classes/Students to show results
    if (query.trim() !== '' && !classesActive && !libraryActive && !resultsActive) {
        switchSection('classes'); // This will re-render without query
        setTimeout(() => renderStudentsTable(query), 50); // Apply query after switch
        return;
    }

    if (classesActive) {
        renderStudentsTable(query);
    } else if (libraryActive) {
        loadQuizLibrary(query);
    } else if (resultsActive) {
        loadResults(query);
    }
}

// ============================================================
//  STUDENT FILTERS
// ============================================================
function applyStudentFilters() {
    const classVal   = (document.getElementById('filterStudClass')   || {}).value || '';
    const sessionVal = (document.getElementById('filterStudSession') || {}).value || '';
    renderStudentsTable('', classVal, sessionVal);
}

function clearStudentFilters() {
    const classEl   = document.getElementById('filterStudClass');
    const sessionEl = document.getElementById('filterStudSession');
    if (classEl)   classEl.value   = '';
    if (sessionEl) sessionEl.value = '';
    renderStudentsTable();
}

// ============================================================
//  STUDENT MANAGEMENT
// ============================================================
function renderStudentsTable(searchQuery = '', classFilter = '', sessionFilter = '') {
    const tbody = document.getElementById('studentsTableBody');

    // Read filters from the dropdowns if not passed directly
    if (!classFilter) {
        const el = document.getElementById('filterStudClass');
        classFilter = el ? el.value : '';
    }
    if (!sessionFilter) {
        const el = document.getElementById('filterStudSession');
        sessionFilter = el ? el.value : '';
    }
    if (!searchQuery) {
        const el = document.getElementById('dashboardSearch');
        // Only pull from search if the classes section is active
        if (el && document.getElementById('section-classes') &&
            document.getElementById('section-classes').classList.contains('active')) {
            searchQuery = el.value.toLowerCase();
        }
    }

    let filtered = allStudents;

    if (classFilter)   filtered = filtered.filter(s => (s.className || '') === classFilter);
    if (sessionFilter) filtered = filtered.filter(s => (s.session   || '') === sessionFilter);
    if (searchQuery)   filtered = filtered.filter(s =>
        (s.name      || '').toLowerCase().includes(searchQuery) ||
        (s.studentId || '').toLowerCase().includes(searchQuery) ||
        (s.className || '').toLowerCase().includes(searchQuery)
    );

    // Update count badge
    const badge = document.getElementById('studentCountBadge');
    if (badge) badge.innerText = `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        const msg = allStudents.length === 0
            ? `<i class="fa-solid fa-users-slash" style="font-size:2rem; display:block; margin-bottom:0.75rem; opacity:0.4;"></i>No students yet. Import an Excel file to get started.`
            : `<i class="fa-solid fa-magnifying-glass" style="font-size:2rem; display:block; margin-bottom:0.75rem; opacity:0.4;"></i>No students match the selected filters.`;
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:var(--text-secondary);">${msg}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td><strong>${s.name}</strong></td>
            <td style="color:var(--primary-color);font-weight:bold;">${s.studentId}</td>
            <td>${s.studentId}</td>
            <td>${s.className}</td>
            <td>${s.session || '2024-25'}</td>
            <td><span class="badge ${s.status === 'active' ? 'active' : 'inactive'}">${s.status || 'active'}</span></td>
            <td>${new Date(s.createdAt).toLocaleDateString()}</td>
            <td style="text-align: right; display:flex; gap:0.5rem; justify-content:flex-end;">
                <button class="btn-icon" style="color:var(--primary-color);" title="View Credentials" onclick="viewStudentCredentials('${s.id}', '${s.studentId}')">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button class="btn-icon" style="color:var(--warning-color);" title="Reset Password" onclick="resetStudentPassword('${s.id}', '${s.name}')">
                    <i class="fa-solid fa-key"></i>
                </button>
                <button class="btn-icon" style="color:var(--danger-color);" title="Delete" onclick="deleteStudent('${s.id}', '${s.name}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function viewStudentCredentials(dbId, rawId) {
    // Note: Passwords are hashed in Firebase, so we can't show the plain text password.
    // If a teacher needs to see a password, they should reset it.
    // We will show a warning and the ID.
    alert(`Student ID: ${rawId}\n\nNote: For security reasons, passwords are encrypted and cannot be viewed. If the student forgot their password, please use the Reset Password (key) button.`);
}

async function resetStudentPassword(dbId, name) {
    const newPass = prompt(`Enter a new password for ${name}:`);
    if (newPass) {
        if(newPass.length < 6) { alert('Password must be at least 6 characters.'); return; }
        await db.update('users', dbId, { password: newPass });
        await db.logActivity(currentTeacher.name, 'Teacher', `Reset password for ${name}`);
        alert('Password reset successfully!');
    }
}

async function deleteStudent(dbId, name) {
    if (confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) {
        await db.delete('users', dbId);
        await db.logActivity(currentTeacher.name, 'Teacher', `Deleted student ${name}`);
        await loadTeacherData();
        renderStudentsTable();
        loadTeacherStats();
    }
}

// ============================================================
//  EXCEL IMPORT
// ============================================================
let generatedStudents = [];

function handleExcelImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        if(typeof XLSX === 'undefined') {
            alert('XLSX library not loaded. Ensure you have internet connection.');
            return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        generateCredentials(XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]));
    };
    reader.readAsArrayBuffer(file);
}

async function generateCredentials(rows) {
    generatedStudents = [];
    const currentSession = document.getElementById('quizSession') ? document.getElementById('quizSession').value : '2024-25';

    for(let row of rows) {
        const studentId = Math.floor(100 + Math.random() * 900).toString();
        const password = Math.floor(100000 + Math.random() * 900000).toString();
        const name = row['Student Name'] || row.Name || 'Unknown Student';
        const className = row['Class'] || 'Unknown';
        const section = row['Section'] || 'N/A';

        await db.add('users', {
            name, role: 'student', studentId, password,
            className, section, session: currentSession, 
            status: 'active',
            teacherId: currentTeacher.id, teacherName: currentTeacher.name
        });

        generatedStudents.push({ Name: name, Class: className, Section: section, 'Student ID': studentId, Password: password });
    }

    await db.logActivity(currentTeacher.name, 'Teacher', `Imported ${rows.length} Students`);
    alert(`Successfully generated accounts for ${rows.length} students! Click 'Export Credentials' to save their passwords.`);
    
    document.getElementById('exportBtn').style.display = 'inline-flex';
    await loadTeacherData();
    populateClassList();
    renderStudentsTable();
    loadTeacherStats();
}

function exportCredentials() {
    if (generatedStudents.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(generatedStudents);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials');
    XLSX.writeFile(wb, 'Student_Credentials.xlsx');
}

// ============================================================
//  QUIZ CREATION & PARSING
// ============================================================
async function publishParsedQuiz() {
    const title       = document.getElementById('quizTitle').value.trim();
    const targetClass = document.getElementById('quizTargetClass').value.trim();
    const subject     = document.getElementById('quizSubject').value.trim();
    const session     = document.getElementById('quizSession').value;
    const editor      = document.getElementById('quizRawText');
    const btn         = document.getElementById('publishQuizBtn');
    const lines       = extractLinesFromEditable(editor);

    if (!title)       { alert('Please enter a Quiz Title.');    return; }
    if (!targetClass) { alert('Please enter a Target Class.');  return; }
    if (lines.length === 0) { alert('Please paste your quiz text.'); return; }

    let parsed;
    try {
        parsed = parseQuizText(lines);
    } catch (err) {
        alert('Parse Error: ' + err.message);
        return;
    }

    // Set loading state
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';
    }

    try {
        await db.add('quizzes', {
            title, subject, targetClass, session,
            scenario:  parsed.scenario,
            questions: parsed.questions,
            teacherId:   currentTeacher.id,
            teacherName: currentTeacher.name,
            status: 'active'
        });

        await db.logActivity(currentTeacher.name, 'Teacher', `Published Quiz: "${title}"`);
        alert(`✅ "${title}" published for ${targetClass} (${session})!\n${parsed.questions.length} questions saved.`);
        clearQuizInput();
        await loadTeacherData();
        loadTeacherStats();
    } catch (err) {
        console.error("Error publishing quiz:", err);
        alert("Failed to publish quiz: " + err.message);
    } finally {
        // Restore button state
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Parse & Publish';
        }
    }
}

// ============================================================
//  QUIZ LIBRARY
// ============================================================
function loadQuizLibrary(searchQuery = '') {
    const container = document.getElementById('quizLibraryContainer');
    
    // Get filters
    const classFilter = document.getElementById('filterLibClass').value;
    const sessionFilter = document.getElementById('filterLibSession').value;

    let filtered = allQuizzes;

    // Apply filters
    if (classFilter) filtered = filtered.filter(q => q.targetClass === classFilter);
    if (sessionFilter) filtered = filtered.filter(q => q.session === sessionFilter);
    if (searchQuery) {
        filtered = filtered.filter(q => 
            q.title.toLowerCase().includes(searchQuery) || 
            (q.subject || '').toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="card" style="text-align:center; padding:3rem;">
            <i class="fa-solid fa-book-open fa-3x" style="color:var(--text-secondary); margin-bottom:1rem;"></i>
            <h3>No Quizzes Found</h3><p>Try adjusting your filters or search query.</p>
        </div>`;
        return;
    }

    container.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1.5rem;">
        ${filtered.map(q => {
            const attempts = allAttempts.filter(a => a.quizId === q.id).length;
            const avgScore = attempts > 0
                ? Math.round(allAttempts.filter(a => a.quizId === q.id).reduce((sum, a) => sum + (a.score / a.total) * 100, 0) / attempts)
                : null;
            return `<div class="card" style="cursor:default;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h4 style="margin-bottom:0.25rem;">${q.title}</h4>
                        <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">${q.subject || 'No subject'} &bull; ${q.targetClass} &bull; ${q.session || 'All'}</p>
                    </div>
                    <button onclick="deleteQuiz('${q.id}')" class="btn-icon" style="color:var(--danger-color);" title="Delete Quiz"><i class="fa-solid fa-trash"></i></button>
                </div>
                <hr style="border:none; border-top:1px solid var(--border-color); margin:1rem 0;">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span><i class="fa-solid fa-circle-question" style="color:var(--primary-color);"></i> ${q.questions.length} Qs</span>
                    <span><i class="fa-solid fa-users" style="color:var(--success-color);"></i> ${attempts} Attempts</span>
                    <span><i class="fa-solid fa-chart-bar" style="color:var(--warning-color);"></i> ${avgScore !== null ? avgScore + '%' : 'N/A'} Avg</span>
                </div>
            </div>`;
        }).join('')}
    </div>`;
}

async function deleteQuiz(id) {
    if (confirm('Are you sure you want to delete this quiz?')) {
        await db.delete('quizzes', id);
        await db.logActivity(currentTeacher.name, 'Teacher', 'Deleted a quiz');
        await loadTeacherData();
        loadQuizLibrary();
        loadTeacherStats();
    }
}

// ============================================================
//  RESULTS & REPORTS
// ============================================================
function loadResults(searchQuery = '') {
    const container = document.getElementById('resultsContainer');
    
    const classFilter = document.getElementById('filterResClass').value;
    const sessionFilter = document.getElementById('filterResSession').value;

    let filtered = allAttempts;

    if (classFilter || sessionFilter || searchQuery) {
        filtered = filtered.filter(a => {
            const student = allStudents.find(s => s.id === a.studentId) || {};
            const quiz = allQuizzes.find(q => q.id === a.quizId) || {};
            
            if (classFilter && student.className !== classFilter) return false;
            if (sessionFilter && student.session !== sessionFilter) return false;
            
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const sName = (student.name || '').toLowerCase();
                const sId = (student.studentId || '').toLowerCase();
                const qName = (quiz.title || '').toLowerCase();
                if (!sName.includes(query) && !sId.includes(query) && !qName.includes(query)) return false;
            }
            return true;
        });
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="card" style="text-align:center; padding:3rem;">
            <i class="fa-solid fa-chart-bar fa-3x" style="color:var(--text-secondary); margin-bottom:1rem;"></i>
            <h3>No Results Found</h3><p>Adjust your filters or wait for students to complete quizzes.</p>
        </div>`;
        return;
    }

    const rows = filtered.map(a => {
        const student = allStudents.find(s => s.id === a.studentId) || {};
        const quiz = allQuizzes.find(q => q.id === a.quizId) || {};
        const pct = Math.round((a.score / a.total) * 100);
        const passed = pct >= 50;
        const m = Math.floor((a.timeSpent || 0) / 60);
        const s = (a.timeSpent || 0) % 60;
        return `<tr>
            <td>${student.name || 'Unknown'}</td>
            <td>${student.studentId || '—'}</td>
            <td>${quiz.title || 'Unknown Quiz'}</td>
            <td>${quiz.subject || '—'}</td>
            <td>${a.score}/${a.total} &nbsp;<strong style="color:var(--primary-color);">(${pct}%)</strong></td>
            <td>${m}:${s.toString().padStart(2,'0')}</td>
            <td><span class="badge ${passed ? 'active' : 'inactive'}">${passed ? 'Passed' : 'Failed'}</span></td>
        </tr>`;
    }).join('');

    container.innerHTML = `<div class="table-responsive" style="background:var(--surface-color); border-radius:var(--radius-lg); border:1px solid var(--border-color);">
        <table>
            <thead><tr><th>Student</th><th>ID</th><th>Quiz</th><th>Subject</th><th>Score</th><th>Time</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

function exportResultsExcel() {
    // Generate based on CURRENTLY filtered results on screen
    const classFilter = document.getElementById('filterResClass').value;
    const sessionFilter = document.getElementById('filterResSession').value;
    
    let filtered = allAttempts;
    if (classFilter) filtered = filtered.filter(a => (allStudents.find(s => s.id === a.studentId) || {}).className === classFilter);
    if (sessionFilter) filtered = filtered.filter(a => (allStudents.find(s => s.id === a.studentId) || {}).session === sessionFilter);

    if(filtered.length === 0) {
        alert('No results to export with current filters.');
        return;
    }

    const exportData = filtered.map(a => {
        const student = allStudents.find(s => s.id === a.studentId) || {};
        const quiz = allQuizzes.find(q => q.id === a.quizId) || {};
        const pct = Math.round((a.score / a.total) * 100);
        
        return {
            'Student Name': student.name || 'Unknown',
            'Student ID': student.studentId || '—',
            'Class': student.className || '—',
            'Session': student.session || '—',
            'Quiz Name': quiz.title || '—',
            'Subject': quiz.subject || '—',
            'Score': a.score,
            'Total Marks': a.total,
            'Percentage (%)': pct,
            'Pass/Fail': pct >= 50 ? 'Pass' : 'Fail',
            'Attempt Date': new Date(a.createdAt).toLocaleDateString(),
            'Time Taken (s)': a.timeSpent || 0
        };
    });

    if(typeof XLSX === 'undefined') {
        alert('XLSX library not loaded. Ensure you have internet connection.');
        return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `Quizee_Results_${classFilter || 'All'}_${sessionFilter || 'All'}.xlsx`);
}

// Keep Chart logic intact (adapted for async data fetch above)
function initCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Outfit', sans-serif";

    let passed = 0, needsImprovement = 0, failed = 0;
    allAttempts.forEach(a => {
        const pct = (a.score / a.total) * 100;
        if (pct >= 80) passed++;
        else if (pct >= 50) needsImprovement++;
        else failed++;
    });
    const passData = allAttempts.length > 0 ? [passed, needsImprovement, failed] : [0, 0, 0];

    const recentAttempts = allAttempts.slice(-5);
    const perfLabels = recentAttempts.map((_, i) => `Attempt ${i + 1}`);
    const perfData = recentAttempts.map(a => Math.round((a.score / a.total) * 100));

    const ctxPerf = document.getElementById('performanceChart');
    if (ctxPerf) {
        new Chart(ctxPerf.getContext('2d'), {
            type: 'line',
            data: {
                labels: perfLabels.length > 0 ? perfLabels : ['No Data'],
                datasets: [{ label: 'Score (%)', data: perfData.length > 0 ? perfData : [0], borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.1)', borderWidth: 3, fill: true, tension: 0.4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, grid: { color: gridColor } }, x: { grid: { color: gridColor } } } }
        });
    }

    const ctxPass = document.getElementById('passChart');
    if (ctxPass) {
        new Chart(ctxPass.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['Excellent (80%+)', 'Passed (50-79%)', 'Failed (<50%)'], datasets: [{ data: passData, backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
        });
    }
    window.chartsInitialized = true;
}

// ----------------------------------------------------
// Image Paste & Extraction Logic
document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('quizRawText');
    if (editor) {
        editor.addEventListener('paste', function(e) {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            let handledFile = false;

            // Handle images
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file') {
                    handledFile = true;
                    e.preventDefault();
                    const blob = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const img = new Image();
                        img.onload = function() {
                            const MAX_DIM = 800;
                            let w = img.width;
                            let h = img.height;
                            
                            if (w > MAX_DIM || h > MAX_DIM) {
                                if (w > h) {
                                    h = Math.round(h * (MAX_DIM / w));
                                    w = MAX_DIM;
                                } else {
                                    w = Math.round(w * (MAX_DIM / h));
                                    h = MAX_DIM;
                                }
                            }

                            const canvas = document.createElement('canvas');
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, w, h);
                            
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
                            document.execCommand('insertHTML', false, `<img src="${dataUrl}" style="max-width:100%; height:auto; display:block; margin:0.5rem 0; border-radius:8px;">`);
                            liveParseQuiz();
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(blob);
                }
            }

            // If no files were pasted, intercept text to remove extra line breaks
            if (!handledFile) {
                const text = (e.originalEvent || e).clipboardData.getData('text/plain');
                if (text) {
                    e.preventDefault();
                    // Replace 2 or more consecutive newlines/spaces with a single newline
                    const cleanText = text.replace(/\n\s*\n/g, '\n\n').trim();
                    document.execCommand('insertText', false, cleanText);
                    liveParseQuiz();
                }
            }
        });
    }
});

function extractLinesFromEditable(container) {
    const entries = []; // array of: string | '<img ...>' string
    let currentLine = '';

    function flushLine() {
        const trimmed = currentLine.trim();
        if (trimmed) entries.push(trimmed);
        currentLine = '';
    }

    function walk(node) {
        if (node.nodeType === 3) {
            // Text node — accumulate
            currentLine += node.nodeValue;
        } else if (node.nodeType === 1) {
            const tag = node.tagName;
            if (tag === 'BR') {
                flushLine();
            } else if (tag === 'IMG') {
                // Flush any preceding text first
                flushLine();
                // Emit image as its own standalone entry
                node.style.maxWidth = '100%';
                node.style.height   = 'auto';
                entries.push(node.outerHTML);   // ← image is its own line entry
            } else if (tag === 'DIV' || tag === 'P') {
                flushLine();
                Array.from(node.childNodes).forEach(walk);
                flushLine();
            } else {
                Array.from(node.childNodes).forEach(walk);
            }
        }
    }

    Array.from(container.childNodes).forEach(walk);
    flushLine();

    // Filter out empty strings but keep image HTML entries
    return entries.filter(e => e.length > 0);
}

// ─────────────────────────────────────────────────────────
// Parser – supports multiple scenarios, each with N questions
// Each question carries its own .scenario HTML string.
// ─────────────────────────────────────────────────────────
function parseQuizText(lines) {
    const questionStartRgx = /^(?:Q\.?\s*\d+[.):\s]|Question\s+\d+[.):\s]|\d+[.)]\s)/i;
    const optionRgx        = /^[(]?([A-Da-d])[).\s]\s*(.+)/;
    const correctRgx       = /^(?:correct\s*(?:option|answer)?|answer)\s*[:\s]*([A-Da-d])\b/i;
    // Scenario header: "Scenario:", "Passage:", "Assignment 2:", etc.
    const scenarioHdrRgx   = /^(scenario|passage|read the following|context|assignment)\s*\d*\s*[:]/i;

    const isStr = v => typeof v === 'string';

    // ── Phase 1 : split into chunks [ {scenarioLines[], questionLines[]} ] ──
    // A new chunk starts every time a scenario header is detected.
    // Between chunk boundaries we track whether we're in scenario-text mode
    // or question-text mode using a simple flag.

    const chunks = [];
    let chunk = { scenarioLines: [], questionLines: [] };
    let mode  = 'scenario'; // 'scenario' | 'question'

    for (const line of lines) {
        const str = isStr(line) ? line : ''; // images are non-string entries

        if (isStr(line) && scenarioHdrRgx.test(str)) {
            // --- New scenario block ---
            // Save the current chunk if it has anything
            if (chunk.scenarioLines.length || chunk.questionLines.length) {
                chunks.push(chunk);
            }
            chunk = { scenarioLines: [], questionLines: [] };
            mode  = 'scenario';
            // Keep the text AFTER the "Scenario:" header on the same line
            const rest = str.replace(scenarioHdrRgx, '').trim();
            if (rest) chunk.scenarioLines.push(rest);

        } else if (isStr(line) && questionStartRgx.test(str)) {
            // --- Question start ---
            mode = 'question';
            chunk.questionLines.push(line);

        } else {
            // --- Ordinary line or image ---
            if (mode === 'scenario') {
                // Images and non-empty text both belong to the scenario
                if (!isStr(line) || str.trim()) chunk.scenarioLines.push(line);
            } else {
                chunk.questionLines.push(line);
            }
        }
    }
    // Flush last chunk
    if (chunk.scenarioLines.length || chunk.questionLines.length) chunks.push(chunk);

    if (chunks.length === 0) throw new Error('No content found.');

    // ── Phase 2 : parse questions inside each chunk ──
    const allQuestions = [];

    for (const ch of chunks) {
        // Build the scenario HTML for this chunk (text joined with <br>, images inline)
        const scenarioHtml = ch.scenarioLines.map(l =>
            isStr(l) ? l : l   // image entries are already HTML strings
        ).join('<br>');

        const qLines = ch.questionLines;

        // Find question start positions within this chunk's question lines
        const qStarts = [];
        qLines.forEach((l, i) => { if (isStr(l) && questionStartRgx.test(l)) qStarts.push(i); });

        for (let qi = 0; qi < qStarts.length; qi++) {
            const block = qLines.slice(qStarts[qi], qStarts[qi + 1] || qLines.length);

            let qText      = (isStr(block[0]) ? block[0] : '').replace(questionStartRgx, '').trim();
            const options  = [];
            let correctIdx = -1;

            for (let i = 1; i < block.length; i++) {
                const bl    = block[i];
                const blStr = isStr(bl) ? bl : '';

                // Correct-answer line
                const corr = blStr.match(correctRgx);
                if (corr) { correctIdx = 'abcd'.indexOf(corr[1].toLowerCase()); continue; }

                // Option line  (A) / B. / c) …)
                const opt = blStr.match(optionRgx);
                if (opt) {
                    let optText = opt[2].trim();
                    // Absorb any immediately following image entry into this option
                    while (i + 1 < block.length && !isStr(block[i + 1])) {
                        i++;
                        optText += block[i]; // img HTML
                    }
                    options.push(optText);

                } else if (!isStr(bl)) {
                    // Standalone image entry
                    if (options.length > 0) options[options.length - 1] += bl;
                    else qText += bl;

                } else if (blStr.trim()) {
                    // Plain continuation text
                    if (options.length > 0) options[options.length - 1] += '<br>' + blStr;
                    else qText += '<br>' + blStr;
                }
            }

            const qNum = allQuestions.length + 1;
            if (!qText.replace(/<br>/g,'').trim())
                throw new Error(`Question ${qNum} has no text.`);
            if (options.length < 2)
                throw new Error(`Question ${qNum} has fewer than 2 options.`);
            if (correctIdx === -1)
                throw new Error(`Question ${qNum} has no correct answer marked.`);

            allQuestions.push({
                question: qText,
                options,
                correct:  correctIdx,
                scenario: scenarioHtml   // ← per-question scenario
            });
        }
    }

    if (allQuestions.length === 0) throw new Error('No questions detected.');

    // Return top-level scenario for backward compatibility (first chunk)
    return {
        scenario:  (chunks[0] && chunks[0].scenarioLines) ? chunks[0].scenarioLines.join('<br>') : '',
        questions: allQuestions
    };
}

let parseDebounceTimer = null;
function liveParseQuiz() {
    clearTimeout(parseDebounceTimer);
    parseDebounceTimer = setTimeout(() => {
        const editor = document.getElementById('quizRawText');
        const lines = extractLinesFromEditable(editor);
        const previewCard = document.getElementById('previewCard');
        const errorDiv    = document.getElementById('parseError');
        const preview     = document.getElementById('parsedPreview');
        const errorMsg    = document.getElementById('parseErrorMsg');
        
        if (lines.length === 0) { previewCard.style.display = 'none'; errorDiv.style.display = 'none'; return; }
        try {
            const parsed = parseQuizText(lines);
            errorDiv.style.display = 'none'; previewCard.style.display = 'block';
            const letters = ['A','B','C','D','E','F'];
            const firstScenario = (parsed.questions.length > 0 && parsed.questions[0].scenario) ? parsed.questions[0].scenario : '';
            preview.innerHTML = `
                ${firstScenario ? `<div style="background:rgba(79,70,229,0.06); border-left:4px solid var(--primary-color); padding:0.75rem 1rem; border-radius:var(--radius-md); margin-bottom:1rem; font-size:0.9rem;"><strong>📖 Scenario (Q1):</strong><br>${firstScenario}</div>` : ''}
                <p style="font-size:0.85rem; color:var(--text-secondary);"><i class="fa-solid fa-check-circle" style="color:var(--success-color);"></i> <strong>${parsed.questions.length}</strong> questions parsed</p>
                ${parsed.questions.map((q, i) => `<div style="margin-bottom:1rem; padding:0.75rem; border:1px solid var(--border-color); border-radius:var(--radius-md);">${i > 0 && q.scenario && q.scenario !== parsed.questions[i-1].scenario ? `<div style="font-size:0.8rem; color:var(--primary-color); margin-bottom:0.4rem;"><i class="fa-solid fa-book-open"></i> New scenario attached</div>` : ''}<p style="font-weight:600; margin-bottom:0.4rem;">Q${i+1}. ${q.question}</p>${q.options.map((o, oi) => `<p style="margin:0.2rem 0; color:${oi === q.correct ? 'var(--success-color)' : 'var(--text-secondary)'};"> ${oi === q.correct ? '✓' : '○'} ${letters[oi]}) ${o}</p>`).join('')}</div>`).join('')}
            `;
        } catch (err) { previewCard.style.display = 'none'; errorDiv.style.display = 'block'; errorMsg.innerHTML = err.message; }
    }, 300);
}

function clearQuizInput() {
    document.getElementById('quizTitle').value = '';
    document.getElementById('quizTargetClass').value = '';
    document.getElementById('quizSubject').value = '';
    document.getElementById('quizRawText').innerHTML = '';
    document.getElementById('previewCard').style.display = 'none';
    document.getElementById('parseError').style.display = 'none';
}
