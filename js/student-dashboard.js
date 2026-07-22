// Student Dashboard JS Logic

let currentStudent = null;
let allQuizzes = [];
let allAttempts = [];

document.addEventListener('DOMContentLoaded', async () => {
    currentStudent = db.getSession();
    if (!currentStudent || currentStudent.role !== 'student') {
        window.location.href = '../index.html';
        return;
    }

    // Set UI Details
    const name = currentStudent.name;
    document.getElementById('topbarProfileName').innerText = name;
    document.getElementById('topbarProfileImg').src =
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff`;

    if (document.getElementById('dropdownName'))
        document.getElementById('dropdownName').innerText = name;

    document.getElementById('welcomeName').innerText  = name;
    document.getElementById('welcomeId').innerText    = currentStudent.studentId;
    document.getElementById('welcomeClass').innerText = currentStudent.className;
    document.getElementById('welcomeSession').innerText = currentStudent.session || 'All';

    await loadStudentData();
    renderDashboard();
});

async function logoutStudent() {
    if (currentStudent)
        await db.logActivity(currentStudent.name, 'Student', 'Account Logout');
    db.clearSession();
    window.location.href = '../index.html';
}

async function loadStudentData() {
    const quizzes = await db.get('quizzes');
    allQuizzes = quizzes.filter(q =>
        q.targetClass === currentStudent.className &&
        (q.session === currentStudent.session || !q.session ||
         q.session === 'All Sessions' || currentStudent.session === 'All Sessions')
    );

    const attempts = await db.get('attempts');
    allAttempts = attempts.filter(a => a.studentId === currentStudent.id);
}

function renderDashboard() {
    const completedQuizIds = allAttempts.map(a => a.quizId);
    const activeQuizzes = allQuizzes
        .filter(q => !completedQuizIds.includes(q.id) && q.status !== 'inactive')
        .reverse();

    // Avg Score
    let avgScore = 0;
    if (allAttempts.length > 0) {
        const totalPct = allAttempts.reduce((sum, a) => sum + (a.score / a.total) * 100, 0);
        avgScore = Math.round(totalPct / allAttempts.length);
    }

    // ── Stat Cards ──────────────────────────────────────
    document.getElementById('statActive').innerText    = activeQuizzes.length;
    document.getElementById('statCompleted').innerText = allAttempts.length;
    document.getElementById('statAvg').innerText       = `${avgScore}%`;

    // Update section badges
    const activeCountBadge = document.getElementById('activeCountBadge');
    if (activeCountBadge) activeCountBadge.innerText = `${activeQuizzes.length} available`;

    const completedCountBadge = document.getElementById('completedCountBadge');
    if (completedCountBadge) completedCountBadge.innerText = `${allAttempts.length} done`;

    // ── Active Quizzes ───────────────────────────────────
    const activeContainer = document.getElementById('activeQuizzesContainer');
    if (activeQuizzes.length === 0) {
        activeContainer.innerHTML = `
            <div class="sd-empty">
                <i class="fa-solid fa-circle-check" style="color:var(--success-color);"></i>
                <strong>All Caught Up!</strong>
                <p>You have no pending quizzes for your class right now.</p>
            </div>
        `;
    } else {
        activeContainer.innerHTML = activeQuizzes.map(q => `
            <div class="sd-quiz-card">
                <div class="sd-quiz-icon">
                    <i class="fa-solid fa-file-signature"></i>
                </div>
                <div class="sd-quiz-info">
                    <h4>${q.title}</h4>
                    <p>
                        <i class="fa-solid fa-book"></i> ${q.subject || 'General'}
                        &bull; <i class="fa-solid fa-circle-question"></i> ${(q.questions || []).length} Qs
                        &bull; <i class="fa-solid fa-user-tie"></i> ${q.teacherName || 'Teacher'}
                    </p>
                </div>
                <button class="btn btn-primary" style="flex-shrink:0;" onclick="startQuiz('${q.id}')">
                    Start <i class="fa-solid fa-arrow-right" style="margin-left:4px;"></i>
                </button>
            </div>
        `).join('');
    }

    // ── Recent Results ───────────────────────────────────
    renderRecentResults();
}

let currentResultsPage = 1;
const RESULTS_PER_PAGE = 5;

function renderRecentResults() {
    const recentContainer = document.getElementById('recentResultsContainer');
    if (allAttempts.length === 0) {
        recentContainer.innerHTML = `
            <div class="sd-empty" style="padding:2rem 1rem;">
                <i class="fa-solid fa-trophy"></i>
                <p>No results yet. Start a quiz!</p>
            </div>
        `;
        return;
    }

    const sortedAttempts = [...allAttempts].reverse();
    const totalPages = Math.ceil(sortedAttempts.length / RESULTS_PER_PAGE);

    if (currentResultsPage > totalPages) currentResultsPage = totalPages;
    if (currentResultsPage < 1) currentResultsPage = 1;

    const startIndex = (currentResultsPage - 1) * RESULTS_PER_PAGE;
    const pageAttempts = sortedAttempts.slice(startIndex, startIndex + RESULTS_PER_PAGE);

    let html = pageAttempts.map(a => {
        const quiz = allQuizzes.find(q => q.id === a.quizId) || { title: 'Unknown Quiz', subject: '' };
        const pct = Math.round((a.score / a.total) * 100);
        const scoreClass = pct >= 70 ? 'good' : pct >= 40 ? 'okay' : 'poor';

        return `
        <div class="sd-result-item" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="flex:1;">
                <strong style="font-size:0.9rem; color:var(--text-primary);">${quiz.title}</strong>
                <p style="font-size:0.78rem; margin:0;">${quiz.subject || ''}</p>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="sd-result-score ${scoreClass}" style="margin:0;">${pct}%</span>
                <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="reviewQuiz('${a.id}')" title="Review Attempt">
                    Review
                </button>
                <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; color:var(--danger-color);" onclick="deleteAttempt('${a.id}')" title="Delete Result">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    if (totalPages > 1) {
        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding:0 0.5rem;">
            <button class="btn btn-secondary" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="changeResultsPage(-1)" ${currentResultsPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                <i class="fa-solid fa-chevron-left"></i> Prev
            </button>
            <span style="font-size:0.8rem; color:var(--text-secondary);">Page ${currentResultsPage} of ${totalPages}</span>
            <button class="btn btn-secondary" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="changeResultsPage(1)" ${currentResultsPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                Next <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>`;
    }

    recentContainer.innerHTML = html;
}

function changeResultsPage(delta) {
    currentResultsPage += delta;
    renderRecentResults();
}

async function deleteAttempt(id) {
    if (confirm('Are you sure you want to delete this result? This action cannot be undone.')) {
        try {
            await db.delete('attempts', id);
            allAttempts = allAttempts.filter(a => a.id !== id);
            renderRecentResults();
            loadStudentStats(); // Refresh charts if needed
        } catch(e) {
            console.error(e);
            alert("Failed to delete result.");
        }
    }
}

function reviewQuiz(attemptId) {
    const attempt = allAttempts.find(a => a.id === attemptId);
    const quiz = allQuizzes.find(q => q.id === attempt.quizId);
    
    if (!attempt || !quiz) {
        alert("Could not load review data.");
        return;
    }
    
    const content = document.getElementById('reviewModalContent');
    document.getElementById('reviewModalTitle').innerText = `Review: ${quiz.title}`;
    
    if (!attempt.userAnswers) {
        content.innerHTML = `<div style="text-align:center; padding: 2rem;">
            <i class="fa-solid fa-circle-exclamation fa-2x" style="color:var(--text-secondary); margin-bottom:1rem;"></i>
            <p>Detailed review is not available for this older quiz attempt.</p>
        </div>`;
    } else {
        const letters = ['A','B','C','D','E','F'];
        content.innerHTML = quiz.questions.map((q, i) => {
            const userAns = attempt.userAnswers[i];
            const isCorrect = userAns === q.correct;
            
            return `
            <div style="margin-bottom:1.5rem; padding:1rem; border:1px solid var(--border-color); border-radius:var(--radius-md); background:var(--card-bg);">
                <p style="font-weight:600; margin-bottom:0.8rem; color:var(--text-primary);">Q${i+1}. ${q.question}</p>
                ${q.options.map((opt, oi) => {
                    let optStyle = "color:var(--text-secondary);";
                    let icon = "○";
                    if (oi === q.correct) {
                        optStyle = "color:var(--success-color); font-weight:600; background:rgba(16, 185, 129, 0.1); border-radius:4px; padding:2px 6px;";
                        icon = "✓";
                    } else if (oi === userAns) {
                        optStyle = "color:var(--danger-color); font-weight:600; background:rgba(239, 68, 68, 0.1); border-radius:4px; padding:2px 6px;";
                        icon = "✗";
                    }
                    return `<div style="margin-bottom:0.4rem; ${optStyle}">${icon} ${letters[oi]}) ${opt}</div>`;
                }).join('')}
                <div style="margin-top:0.8rem; font-size:0.85rem; font-weight:600; color:${isCorrect ? 'var(--success-color)' : 'var(--danger-color)'};">
                    ${isCorrect ? 'You answered correctly!' : (userAns === null ? 'You skipped this question.' : 'You answered incorrectly.')}
                </div>
            </div>`;
        }).join('');
    }
    
    document.getElementById('reviewModal').style.display = 'flex';
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
}

function toggleSidebar() {
    // Note: student dashboard doesn't have a left sidebar in the same way, but it has sd-sidebar if we added it, 
    // actually let's see if student-dashboard has a sidebar. It has a topbar and a main container.
    // Wait, I should check student-dashboard layout.
}

function startQuiz(quizId) {
    if (confirm('Are you ready to start this quiz? The timer will begin immediately.')) {
        sessionStorage.setItem('targetQuizId', quizId);
        window.location.href = 'student-quiz.html';
    }
}
