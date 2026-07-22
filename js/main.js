// Theme Management
function toggleTheme() {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    
    if (html.getAttribute('data-theme') === 'dark') {
        html.removeAttribute('data-theme');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        localStorage.setItem('theme', 'dark');
    }
}

// Load saved theme
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const icon = document.getElementById('theme-icon');
        if(icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }
});

// UI Toggles for Auth Page
function switchTab(tab) {
    const teacherTab = document.getElementById('tab-teacher');
    const studentTab = document.getElementById('tab-student');
    
    const teacherForm = document.getElementById('teacher-form');
    const teacherSignupForm = document.getElementById('teacher-signup-form');
    const studentForm = document.getElementById('student-form');

    if (!teacherTab || !studentTab) return; // Not on auth page

    if (tab === 'teacher') {
        teacherTab.classList.add('active');
        studentTab.classList.remove('active');
        
        teacherForm.style.display = 'block';
        teacherSignupForm.style.display = 'none';
        studentForm.style.display = 'none';
    } else {
        studentTab.classList.add('active');
        teacherTab.classList.remove('active');
        
        teacherForm.style.display = 'none';
        teacherSignupForm.style.display = 'none';
        studentForm.style.display = 'block';
    }
}

function toggleTeacherMode(mode) {
    const loginForm = document.getElementById('teacher-form');
    const signupForm = document.getElementById('teacher-signup-form');

    if (mode === 'signup') {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    } else {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    }
}

// Form Handlers
async function handleTeacherLogin(e) {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    const password = e.target.querySelector('input[type="password"]').value;

    const teacher = await db.getTeacherByEmail(email);
    // Since Firebase stores hashed passwords, we verify using the new method
    const validLogin = await db.verifyLogin(email, password);

    if (validLogin && validLogin.role === 'teacher') {
        if (validLogin.status === 'active') {
            db.setSession(validLogin);
            await db.logActivity(validLogin.name, 'Teacher', 'Account Login');
            window.location.href = 'pages/dashboard.html';
        } else {
            alert('Your account is currently deactivated by the admin.');
        }
    } else {
        alert('Invalid email or password.');
    }
}

async function handleTeacherSignup(e) {
    e.preventDefault();
    const name = e.target.querySelectorAll('input[type="text"]')[0].value;
    const institution = e.target.querySelectorAll('input[type="text"]')[1].value;
    const email = e.target.querySelector('input[type="email"]').value;
    const passwords = e.target.querySelectorAll('input[type="password"]');

    if (passwords[0].value !== passwords[1].value) {
        alert('Passwords do not match.');
        return;
    }

    const existing = await db.getTeacherByEmail(email);
    if (existing) {
        alert('An account with this email already exists.');
        return;
    }

    await db.add('users', {
        name,
        institution,
        email,
        password: passwords[0].value,
        role: 'teacher',
        status: 'active' // Auto-approved as requested
    });

    await db.logActivity(name, 'Teacher', 'Teacher Registration');
    alert('Account created successfully! You can now sign in.');
    toggleTeacherMode('login');
}

async function handleStudentLogin(e) {
    e.preventDefault();
    const studentId = e.target.querySelectorAll('input')[0].value;
    const password = e.target.querySelectorAll('input')[1].value;

    const student = await db.getStudentByCredentials(studentId, password);

    if (student) {
        db.setSession(student);
        await db.logActivity(student.name, 'Student', 'Account Login');
        window.location.href = 'pages/student-dashboard.html';
    } else {
        alert('Invalid Student ID or Password.');
    }
}
