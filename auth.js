import { auth, db } from './firebase-config.js'; // db importieren

// --- Globale Variable für den Modus ---
let isLoginMode = true; // Startet im Login-Modus

// --- DOM-Elemente holen ---
const firstnameGroup = document.getElementById('firstname-group');
const firstnameInput = document.getElementById('firstname');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginTab = document.getElementById('btn-login-tab');
const registerTab = document.getElementById('btn-register-tab');
const actionButton = document.getElementById('btn-action');
const errorMessage = document.getElementById('error-message');

// --- Funktion: Zum Login-Modus wechseln ---
const showLogin = () => {
    isLoginMode = true;
    firstnameGroup.classList.add('hidden'); // Vorname verstecken
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    actionButton.textContent = 'Login';
    actionButton.classList.remove('register-mode');
    errorMessage.textContent = '';
};

// --- Funktion: Zum Registrier-Modus wechseln ---
const showRegister = () => {
    isLoginMode = false;
    firstnameGroup.classList.remove('hidden'); // Vorname anzeigen
    loginTab.classList.remove('active');
    registerTab.classList.add('active');
    actionButton.textContent = 'Registrieren';
    actionButton.classList.add('register-mode');
    errorMessage.textContent = '';
};

// --- Registrierungs-Funktion (mit Firestore) ---
const registerUser = () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    const firstName = firstnameInput.value.trim();

    errorMessage.textContent = '';

    // Validierung
    if (!firstName) {
        errorMessage.textContent = 'Bitte gib deinen Vornamen ein.';
        return;
    }

    // Schritt 1: Auth-Account erstellen
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log('Erfolgreich registriert:', userCredential.user.uid);
            
            // Schritt 2: Nutzerdaten in Firestore speichern
            const userDocRef = db.collection('users').doc(userCredential.user.uid);
            
            return userDocRef.set({
                firstName: firstName,
                email: email, // Wichtig für "Teilen"-Funktion
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            // Schritt 3: Nach Auth UND Firestore weiterleiten
            console.log('Nutzerdaten in Firestore gespeichert.');
            window.location.href = 'dashboard.html';
        })
        .catch((error) => {
            console.error('Fehler bei Registrierung:', error.message);
            errorMessage.textContent = getGermanErrorMessage(error.code);
        });
};

// --- Login-Funktion ---
const loginUser = () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    errorMessage.textContent = '';

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log('Erfolgreich eingeloggt:', userCredential.user);
            window.location.href = 'dashboard.html';
        })
        .catch((error) => {
            console.error('Fehler bei Login:', error.message);
            errorMessage.textContent = getGermanErrorMessage(error.code);
        });
};

// --- Event Listeners ---
// Klick auf Login-Tab
loginTab.addEventListener('click', showLogin);
// Klick auf Registrieren-Tab
registerTab.addEventListener('click', showRegister);

// Klick auf den "Bestätigen"-Knopf
actionButton.addEventListener('click', () => {
    if (isLoginMode) {
        loginUser();
    } else {
        registerUser();
    }
});

// --- Hilfsfunktion für deutsche Fehlermeldungen ---
function getGermanErrorMessage(errorCode) {
    // (unverändert)
    switch (errorCode) {
        case 'auth/invalid-email': return 'Bitte gib eine gültige E-Mail-Adresse ein.';
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password': return 'E-Mail oder Passwort ist falsch.';
        case 'auth/weak-password': return 'Das Passwort ist zu schwach (min. 6 Zeichen).';
        case 'auth/email-already-in-use': return 'Diese E-Mail-Adresse wird bereits verwendet.';
        default: return 'Ein unbekannter Fehler ist aufgetreten.';
    }}