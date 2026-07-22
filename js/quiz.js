// Quiz State & Data
let currentStudent = null;
let currentQuiz = null;

let currentQuestion = 0;
let userAnswers = [];
let timeLeft = 15 * 60; // 15 minutes
let timerInterval;

document.addEventListener('DOMContentLoaded', async () => {
    currentStudent = db.getSession();
    if (!currentStudent || currentStudent.role !== 'student') {
        window.location.href = '../index.html';
        return;
    }

    const targetQuizId = sessionStorage.getItem('targetQuizId');
    if (!targetQuizId) {
        // If they bypass the dashboard, redirect back to it
        window.location.href = 'student-dashboard.html';
        return;
    }

    const allQuizzes = await db.get('quizzes');
    currentQuiz = allQuizzes.find(q => q.id === targetQuizId);
    
    if (currentQuiz) {
        userAnswers = new Array(currentQuiz.questions.length).fill(null);
        document.querySelector('.quiz-header h2').innerText = currentQuiz.title;
        document.querySelector('.quiz-header p').innerText = `${currentStudent.className} - ${currentStudent.section || ''}`;

        // Scenario panel is now handled per-question inside loadQuestion()

        loadQuestion(currentQuestion);
        startTimer();
        updateProgress();
    } else {
        document.getElementById('quizBody').innerHTML = `
            <div style="text-align: center; padding: 4rem;">
                <i class="fa-solid fa-triangle-exclamation fa-4x" style="color: var(--danger-color); margin-bottom: 1rem;"></i>
                <h2>Quiz Not Found</h2>
                <p>The quiz you requested could not be found or has been deleted.</p>
                <button class="btn btn-primary" style="margin-top:2rem;" onclick="window.location.href='student-dashboard.html'">Return to Dashboard</button>
            </div>
        `;
        document.querySelector('.quiz-footer').style.display = 'none';
        document.querySelector('.progress-bar-container').style.display = 'none';
        document.getElementById('quizTimer').style.display = 'none';
    }
});

function logout() {
    db.clearSession();
    window.location.href = '../index.html';
}

let scenarioCollapsed = false;
function toggleScenario() {
    scenarioCollapsed = !scenarioCollapsed;
    const textEl   = document.getElementById('scenarioText');
    const chevron  = document.getElementById('scenarioChevron');
    textEl.style.display  = scenarioCollapsed ? 'none' : '';
    chevron.className     = scenarioCollapsed ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
}

// ── Update scenario panel for the current question ──
function updateScenarioPanel(q) {
    const panel       = document.getElementById('scenarioPanel');
    const textEl      = document.getElementById('scenarioText');
    const questionCol = document.getElementById('questionColumn');

    // Use per-question scenario if set, fall back to quiz-level scenario
    // (quiz-level scenario is populated for older quizzes that were published
    //  before the multi-scenario parser was introduced)
    const scenarioHtml = (q.scenario || currentQuiz.scenario || '').trim();

    if (scenarioHtml) {
        textEl.innerHTML = scenarioHtml;
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        if (questionCol) questionCol.classList.remove('full-width');
    } else {
        panel.style.display = 'none';
        if (questionCol) questionCol.classList.add('full-width');
    }
}

function loadQuestion(index) {
    if(!currentQuiz) return;
    const q = currentQuiz.questions[index];
    const body = document.getElementById('quizBody');

    // Swap scenario for this question
    updateScenarioPanel(q);

    body.classList.remove('fade-in');
    void body.offsetWidth; // trigger reflow
    body.classList.add('fade-in');

    const letters = ['A', 'B', 'C', 'D'];
    
    let optionsHtml = '';
    q.options.forEach((opt, i) => {
        const isSelected = userAnswers[index] === i ? 'selected' : '';
        optionsHtml += `
            <div class="option-card ${isSelected}" onclick="selectOption(${i})">
                <div class="option-letter">${letters[i]}</div>
                <div>${opt}</div>
            </div>
        `;
    });

    body.innerHTML = `
        <div class="question-meta">Question ${index + 1} of ${currentQuiz.questions.length}</div>
        <div class="question-text">${q.question}</div>
        <div class="options-grid">
            ${optionsHtml}
        </div>
    `;

    document.getElementById('btnPrev').disabled = index === 0;
    
    if (index === currentQuiz.questions.length - 1) {
        document.getElementById('btnNext').style.display = 'none';
        document.getElementById('btnSubmit').style.display = 'inline-flex';
    } else {
        document.getElementById('btnNext').style.display = 'inline-flex';
        document.getElementById('btnSubmit').style.display = 'none';
    }
}

function selectOption(optIndex) {
    userAnswers[currentQuestion] = optIndex;
    loadQuestion(currentQuestion);
    triggerAutosave();
}

function nextQuestion() {
    if (currentQuestion < currentQuiz.questions.length - 1) {
        currentQuestion++;
        loadQuestion(currentQuestion);
        updateProgress();
    }
}

function prevQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        loadQuestion(currentQuestion);
        updateProgress();
    }
}

function updateProgress() {
    const progress = ((currentQuestion) / (currentQuiz.questions.length - 1)) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('progressText').innerText = `Question ${currentQuestion + 1} of ${currentQuiz.questions.length}`;
}

function triggerAutosave() {
    const notice = document.getElementById('saveNotice');
    notice.innerText = 'Saving...';
    notice.style.opacity = 1;
    setTimeout(() => {
        notice.innerText = 'Autosaved just now';
        setTimeout(() => notice.style.opacity = 0, 2000);
    }, 500);
}

function startTimer() {
    const display = document.getElementById('timeDisplay');
    const timerUI = document.getElementById('quizTimer');

    timerInterval = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitQuiz(true);
            return;
        }
        timeLeft--;
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        display.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        if (timeLeft < 60 && !timerUI.classList.contains('warning')) {
            timerUI.classList.add('warning');
        }
    }, 1000);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err.message));
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

async function submitQuiz(isAuto = false) {
    if (!isAuto) {
        const unanswered = userAnswers.filter(a => a === null).length;
        if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)) {
            return;
        }
    }
    
    clearInterval(timerInterval);
    
    // Calculate Score
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    
    userAnswers.forEach((ans, i) => {
        if (ans === null) skipped++;
        else if (ans === currentQuiz.questions[i].correct) correct++;
        else wrong++;
    });

    const timeSpent = (15 * 60) - timeLeft;

    const attemptData = {
        studentId: currentStudent.id,
        quizId: currentQuiz.id,
        teacherId: currentQuiz.teacherId,
        score: correct,
        total: currentQuiz.questions.length,
        correct, wrong, skipped, timeSpent,
        userAnswers
    };

    await db.add('attempts', attemptData);
    await db.logActivity(currentStudent.name, 'Student', `Submitted Quiz: ${currentQuiz.title}`);
    
    // Save to session so result page can show it
    localStorage.setItem('activeQuizAttempt', JSON.stringify(attemptData));

    document.body.innerHTML = `
        <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-color);">
            <i class="fa-solid fa-spinner fa-spin fa-3x" style="color: var(--primary-color);"></i>
            <h2 style="margin-top: 1rem; color: var(--text-primary);">Submitting your answers...</h2>
        </div>
    `;
    
    setTimeout(() => {
        window.location.href = 'student-result.html';
    }, 1500);
}
