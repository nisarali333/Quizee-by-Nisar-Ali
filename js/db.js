/**
 * Database Layer for Quizee (Firebase Online Database)
 */

const firebaseConfig = {
    apiKey: "AIzaSyC_dH7X3yXz_IbT5Ny9SYrJjwLmx26mfP8",
    authDomain: "quizee-aa21f.firebaseapp.com",
    projectId: "quizee-aa21f",
    storageBucket: "quizee-aa21f.firebasestorage.app",
    messagingSenderId: "295276648468",
    appId: "1:295276648468:web:063c731fda866e7d3eef01",
    measurementId: "G-1NTYT5Y9ES"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

class QuizeeDB {
    constructor() {
        this.db = firestore;
        // Attempt to create the super admin on init asynchronously
        this.seedSuperAdmin();
    }

    async seedSuperAdmin() {
        try {
            const adminRef = this.db.collection('users').doc('admin_1');
            const doc = await adminRef.get();
            if (!doc.exists) {
                await adminRef.set({
                    id: 'admin_1',
                    role: 'admin',
                    status: 'active',
                    name: 'Nisar Ali',
                    email: 'Nisar Ali',
                    password: await this.hashPassword('Nisar@1234'),
                    createdAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error("Error seeding admin:", error);
        }
    }

    // Basic CRUD Operations (Async)
    async get(collectionName) {
        try {
            const snapshot = await this.db.collection(collectionName).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`Error getting ${collectionName}:`, error);
            return [];
        }
    }

    async getById(collectionName, id) {
        try {
            const doc = await this.db.collection(collectionName).doc(id).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error(`Error getting ${collectionName} by ID:`, error);
            return null;
        }
    }

    async add(collectionName, item) {
        try {
            item.createdAt = new Date().toISOString();
            // Store password hashed if it's a user
            if (collectionName === 'users' && item.password) {
                item.password = await this.hashPassword(item.password);
            }
            const docRef = await this.db.collection(collectionName).add(item);
            item.id = docRef.id;
            return item;
        } catch (error) {
            console.error(`Error adding to ${collectionName}:`, error);
            throw error;
        }
    }

    async update(collectionName, id, updates) {
        try {
            updates.updatedAt = new Date().toISOString();
            if (collectionName === 'users' && updates.password) {
                updates.password = await this.hashPassword(updates.password);
            }
            await this.db.collection(collectionName).doc(id).update(updates);
            return { id, ...updates };
        } catch (error) {
            console.error(`Error updating ${collectionName}:`, error);
            throw error;
        }
    }

    async delete(collectionName, id) {
        try {
            await this.db.collection(collectionName).doc(id).delete();
        } catch (error) {
            console.error(`Error deleting from ${collectionName}:`, error);
            throw error;
        }
    }

    // Specific Queries
    async getTeacherByEmail(email) {
        try {
            const snapshot = await this.db.collection('users')
                .where('role', '==', 'teacher')
                .where('email', '==', email)
                .get();
            if (snapshot.empty) return null;
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        } catch (error) {
            console.error("Error finding teacher:", error);
            return null;
        }
    }

    async getStudentByCredentials(studentId, rawPassword) {
        try {
            const snapshot = await this.db.collection('users')
                .where('role', '==', 'student')
                .where('studentId', '==', studentId)
                .get();
            if (snapshot.empty) return null;
            
            const student = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            const hashedInput = await this.hashPassword(rawPassword);
            if (student.password === hashedInput) {
                return student;
            }
            return null;
        } catch (error) {
            console.error("Error finding student:", error);
            return null;
        }
    }

    // Generic login check for all users
    async verifyLogin(identifier, rawPassword) {
        try {
            // First check admin
            const adminSnapshot = await this.db.collection('users').where('role', '==', 'admin').where('email', '==', identifier).get();
            if (!adminSnapshot.empty) {
                const admin = { id: adminSnapshot.docs[0].id, ...adminSnapshot.docs[0].data() };
                const hashedInput = await this.hashPassword(rawPassword);
                if (admin.password === hashedInput) return admin;
            }

            // Then check teacher
            const teacherSnapshot = await this.db.collection('users').where('role', '==', 'teacher').where('email', '==', identifier).get();
            if (!teacherSnapshot.empty) {
                const teacher = { id: teacherSnapshot.docs[0].id, ...teacherSnapshot.docs[0].data() };
                const hashedInput = await this.hashPassword(rawPassword);
                if (teacher.password === hashedInput) return teacher;
            }

            return null;
        } catch (error) {
            console.error("Error verifying login:", error);
            return null;
        }
    }

    async logActivity(user, role, action, ip = '127.0.0.1') {
        try {
            await this.add('logs', { user, role, action, ip });
        } catch (error) {
            console.error("Error logging activity:", error);
        }
    }

    // Security: Basic SHA-256 Hashing for passwords
    async hashPassword(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    // Session Management (Using SessionStorage + LocalStorage fallback)
    setSession(user) {
        // Don't store full hashed password in session
        const sessionUser = { ...user };
        delete sessionUser.password;
        sessionStorage.setItem('session', JSON.stringify(sessionUser));
        localStorage.setItem('session', JSON.stringify(sessionUser));
    }

    getSession() {
        const session = sessionStorage.getItem('session') || localStorage.getItem('session');
        return session ? JSON.parse(session) : null;
    }

    clearSession() {
        sessionStorage.removeItem('session');
        localStorage.removeItem('session');
        sessionStorage.removeItem('activeQuizAttempt');
        localStorage.removeItem('activeQuizAttempt');
    }
}

// Global DB instance
const db = new QuizeeDB();
