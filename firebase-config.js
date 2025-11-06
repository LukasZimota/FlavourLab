//
// KEINE IMPORTS FÜR FIREBASE HIER!
// Wir benutzen das 'firebase' Objekt, das global von den HTML-Dateien geladen wird.
//

// Dein Firebase Konfigurations-Objekt
const firebaseConfig = {
  apiKey: "AIzaSyC30lv71rSYm3uXUXFMqViZB3aFA0jdrV0",
  authDomain: "flouvourlab.firebaseapp.com",
  projectId: "flouvourlab",
  storageBucket: "flouvourlab.firebasestorage.app",
  messagingSenderId: "41925570901",
  appId: "1:41925570901:web:bfc0e6614278d38380bfdc",
  measurementId: "G-99QV6TXW26"
};


// Initialisiere Firebase mit dem globalen Objekt
// Der 'if'-Check ist hier auch nicht nötig, da Firebase das selbst handhabt.
firebase.initializeApp(firebaseConfig);

// Hole Referenzen zu den Diensten
const auth = firebase.auth();
const db = firebase.firestore();

// Exportiere die Referenzen (das funktioniert weiterhin)
export { auth, db };