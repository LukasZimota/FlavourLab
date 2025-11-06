import { auth, db } from './firebase-config.js';

// --- Globale Variablen ---
let currentUser;
let currentUserData = {};

// --- DOM-Elemente holen (wird in init gemacht) ---
let loader, navbar, mainContent;
let accountTitle, logoutButton;
let accountMenu, btnShowData;
let accountDataDisplay, displayFirstname, displayEmail, btnHideData;
let btnShowStats, accountStatsDisplay, btnHideStats; // NEU
let statCookbooks, statRecipes, statPlanned; // NEU

// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => {
    if (loader) loader.style.display = 'none';
    if (navbar) navbar.classList.remove('content-hidden');
    if (mainContent) mainContent.classList.remove('content-hidden');
};

// --- Funktion zum Laden des Profils (Name & E-Mail) ---
const loadUserProfile = async (userId) => {
    try {
        const userDocRef = db.collection('users').doc(userId);
        const docSnap = await userDocRef.get();
        if (docSnap.exists) {
            currentUserData = docSnap.data();
            if (currentUserData.firstName) {
                accountTitle.textContent = `Hi, ${currentUserData.firstName}!`;
            }
        } else {
            console.log("Nutzer-Dokument nicht gefunden.");
            accountTitle.textContent = `Hi, ${currentUser.email}!`;
        }
    } catch (error) { console.error("Fehler beim Laden des Nutzerprofils:", error); }
};

// --- NEU: Funktion zum Laden der Statistik ---
const loadUserStats = async (userId) => {
    if (!statCookbooks || !statRecipes || !statPlanned) return; // Stellt sicher, dass die Elemente da sind

    statCookbooks.textContent = "Lade...";
    statRecipes.textContent = "Lade...";
    statPlanned.textContent = "Lade...";

    try {
        // 1. Kochbücher zählen (einfach)
        const cookbookPromise = db.collection('users').doc(userId).collection('cookbooks').get();
        
        // 2. Geplante Mahlzeiten zählen (komplexer)
        const plannedPromise = db.collection('users').doc(userId).collection('plannedMeals').get();

        // Warte auf beide Zählungen
        const [cookbookSnap, plannedSnap] = await Promise.all([cookbookPromise, plannedPromise]);

        const cookbookCount = cookbookSnap.size;
        statCookbooks.textContent = cookbookCount;

        // 2b. Geplante REZEPTE zählen (durch alle Dokumente iterieren)
        let plannedRecipeCount = 0;
        plannedSnap.forEach(doc => {
            const data = doc.data();
            if (data.breakfast) plannedRecipeCount += data.breakfast.length;
            if (data.lunch) plannedRecipeCount += data.lunch.length;
            if (data.dinner) plannedRecipeCount += data.dinner.length;
            if (data.snacks) plannedRecipeCount += data.snacks.length;
        });
        statPlanned.textContent = plannedRecipeCount;

        // 3. Rezepte zählen (am komplexesten)
        let totalRecipeCount = 0;
        const recipeCountPromises = [];
        // Für jedes Kochbuch...
        cookbookSnap.forEach(cookbookDoc => {
            // ...eine Zähl-Anfrage für die 'recipes'-Sub-Collection erstellen
            recipeCountPromises.push(
                db.collection('users').doc(userId)
                  .collection('cookbooks').doc(cookbookDoc.id)
                  .collection('recipes').get()
            );
        });
        // Auf alle Zähl-Anfragen warten
        const recipeSnaps = await Promise.all(recipeCountPromises);
        // Die Ergebnisse summieren
        recipeSnaps.forEach(snap => {
            totalRecipeCount += snap.size;
        });
        statRecipes.textContent = totalRecipeCount;

    } catch (error) {
        console.error("Fehler beim Laden der Statistik:", error);
        statCookbooks.textContent = "Fehler";
        statRecipes.textContent = "Fehler";
        statPlanned.textContent = "Fehler";
    }
};


// --- Funktionen zum Umschalten der Ansicht ---
const showDataView = () => {
    displayFirstname.textContent = currentUserData.firstName || "(Kein Name gespeichert)";
    displayEmail.textContent = currentUserData.email || currentUser.email;
    accountMenu.classList.add('hidden');
    logoutButton.classList.add('hidden');
    accountDataDisplay.classList.remove('hidden');
    accountStatsDisplay.classList.add('hidden'); // NEU: Stats verstecken
};

// NEU: Statistik-Ansicht zeigen
const showStatsView = () => {
    accountMenu.classList.add('hidden');
    logoutButton.classList.add('hidden');
    accountDataDisplay.classList.add('hidden');
    accountStatsDisplay.classList.remove('hidden');
};

const showMenuView = () => {
    accountMenu.classList.remove('hidden');
    logoutButton.classList.remove('hidden');
    accountDataDisplay.classList.add('hidden');
    accountStatsDisplay.classList.add('hidden'); // NEU: Stats verstecken
};

// --- Logout-Funktion ---
const logoutUser = () => { /* ... (unverändert) ... */ };

// --- Initialisierung ---
const init = () => {
    // DOM-Elemente holen
    loader = document.getElementById('loader');
    navbar = document.querySelector('.navbar');
    mainContent = document.querySelector('.main-content');
    accountTitle = document.getElementById('account-title');
    logoutButton = document.getElementById('btn-logout');
    accountMenu = document.querySelector('.account-menu');
    btnShowData = document.getElementById('btn-show-data');
    accountDataDisplay = document.getElementById('account-data-display');
    displayFirstname = document.getElementById('display-firstname');
    displayEmail = document.getElementById('display-email');
    btnHideData = document.getElementById('btn-hide-data');
    // NEU: Statistik-Elemente holen
    btnShowStats = document.getElementById('btn-show-stats');
    accountStatsDisplay = document.getElementById('account-stats-display');
    btnHideStats = document.getElementById('btn-hide-stats');
    statCookbooks = document.getElementById('stat-cookbooks');
    statRecipes = document.getElementById('stat-recipes');
    statPlanned = document.getElementById('stat-planned');

    // Sicherheitscheck
    if (!loader || !navbar || !mainContent || !accountTitle || !logoutButton || !btnShowData || !accountDataDisplay || !btnShowStats || !accountStatsDisplay || !btnHideStats) {
        console.error("FEHLER: Wichtige HTML-Elemente auf der Kontoseite fehlen!");
    }

    // Auth Wächter
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            console.log('Konto: Nutzer ist eingeloggt:', user.email);
            
            // Lade Profil UND Statistik
            await Promise.all([
                loadUserProfile(user.uid),
                loadUserStats(user.uid) // NEU
            ]);
            
            showContent();
        } else {
            currentUser = null;
            currentUserData = {};
            window.location.href = 'index.html';
        }
    });

    // Event Listeners
    logoutButton.addEventListener('click', logoutUser);
    btnShowData.addEventListener('click', showDataView);
    btnHideData.addEventListener('click', showMenuView);
    
    // NEU: Listener für Statistik
    btnShowStats.addEventListener('click', showStatsView);
    btnHideStats.addEventListener('click', showMenuView);
};

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);