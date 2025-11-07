import { auth, db } from './firebase-config.js';

// --- Globale Variablen ---
let currentUser;
let currentUserData = {};

// --- DOM-Elemente holen ---
let loader, navbar, mainContent;
let accountTitle, logoutButton, accountMenu;
// Ansicht 1: Daten
let btnShowData, accountDataDisplay, displayFirstname, displayEmail, btnHideData;
// Ansicht 2: Stats
let btnShowStats, accountStatsDisplay, btnHideStats;
let statCookbooks, statRecipes, statPlanned;
// NEU - Ansicht 3: Einladungen
let btnShowInvites, accountInvitesDisplay, btnHideInvites, invitesList, invitesMessage;


// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => {
    if (loader) loader.style.display = 'none';
    if (navbar) navbar.classList.remove('content-hidden');
    if (mainContent) mainContent.classList.remove('content-hidden');
};

// --- Funktion zum Laden des Profils (unverändert) ---
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

// --- Funktion zum Laden der Statistik (STARK GEÄNDERT) ---
const loadUserStats = async (userId) => {
    if (!statCookbooks || !statRecipes || !statPlanned) return;

    statCookbooks.textContent = "Lade...";
    statRecipes.textContent = "Lade...";
    statPlanned.textContent = "Lade...";

    try {
        // --- 1. Kochbücher zählen (NEUE QUERY) ---
        // Zähle alle Kochbücher, bei denen der Nutzer Mitglied ist
        const cookbookQuery = db.collection('cookbooks')
                                .where(`members.${userId}`, 'in', ['owner', 'editor']);
        const cookbookPromise = cookbookQuery.get();
        
        // --- 2. Geplante Mahlzeiten zählen (UNVERÄNDERT) ---
        const plannedPromise = db.collection('users').doc(userId).collection('plannedMeals').get();

        // Warte auf beide Zählungen
        const [cookbookSnap, plannedSnap] = await Promise.all([cookbookPromise, plannedPromise]);

        const cookbookCount = cookbookSnap.size;
        statCookbooks.textContent = cookbookCount;

        // --- 2b. Geplante REZEPTE zählen (UNVERÄNDERT) ---
        let plannedRecipeCount = 0;
        plannedSnap.forEach(doc => {
            const data = doc.data();
            if (data.breakfast) plannedRecipeCount += data.breakfast.length;
            if (data.lunch) plannedRecipeCount += data.lunch.length;
            if (data.dinner) plannedRecipeCount += data.dinner.length;
            if (data.snacks) plannedRecipeCount += data.snacks.length;
        });
        statPlanned.textContent = plannedRecipeCount;

        // --- 3. Rezepte zählen (NEUE LOGIK) ---
        let totalRecipeCount = 0;
        const recipeCountPromises = [];
        
        // Für jedes Kochbuch, das wir oben gefunden haben...
        cookbookSnap.forEach(cookbookDoc => {
            // ...eine Zähl-Anfrage für die 'recipes'-Sub-Collection erstellen
            // (Wir verwenden den NEUEN Pfad)
            recipeCountPromises.push(
                db.collection('cookbooks').doc(cookbookDoc.id)
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

// --- NEU: Funktion zum Laden der Einladungen ---
const loadUserInvitations = async (userId) => {
    if (!invitesList || !invitesMessage) return;
    
    invitesMessage.textContent = "Lade Einladungen...";
    invitesList.innerHTML = ""; // Liste leeren

    try {
        const snapshot = await db.collection("invitations")
            .where("toUserId", "==", userId) // An mich
            .where("status", "==", "pending") // Die noch offen sind
            .orderBy("createdAt", "desc")
            .get();

        if (snapshot.empty) {
            invitesMessage.textContent = "Du hast keine offenen Einladungen.";
            return;
        }
        
        invitesMessage.textContent = ""; // Nachricht entfernen
        snapshot.forEach(doc => {
            const invite = doc.data();
            const div = document.createElement('div');
            div.className = 'invite-item';
            
            // Speichere die IDs auf dem Action-Container für Klick-Events
            div.innerHTML = `
                <p>
                    <strong>${invite.cookbookTitle}</strong><br>
                    <span>Eingeladen von: ${invite.fromUserName}</span>
                </p>
                <div class="invite-actions" data-invite-id="${doc.id}" data-cookbook-id="${invite.cookbookId}">
                    <button class="btn-accept">Annehmen</button>
                    <button class="btn-decline">Ablehnen</button>
                </div>
            `;
            invitesList.appendChild(div);
        });

    } catch (error) {
        console.error("Fehler beim Laden der Einladungen:", error);
        invitesMessage.textContent = "Einladungen konnten nicht geladen werden.";
    }
};

// --- NEU: Einladung annehmen ---
const acceptInvitation = async (inviteId, cookbookId) => {
    try {
        const cookbookRef = db.collection("cookbooks").doc(cookbookId);
        const inviteRef = db.collection("invitations").doc(inviteId);

        // Batch-Write, um sicherzustellen, dass beides passiert
        const batch = db.batch();
        
        // 1. Füge den Nutzer zur 'members'-Map im Kochbuch hinzu
        batch.update(cookbookRef, {
            [`members.${currentUser.uid}`]: "editor" // Fügt den Nutzer als "editor" hinzu
        });
        
        // 2. Markiere die Einladung als "accepted"
        batch.update(inviteRef, {
            status: "accepted"
        });

        await batch.commit();
        
        // UI aktualisieren
        loadUserInvitations(currentUser.uid); // Lade Einladungen neu
        loadUserStats(currentUser.uid); // Lade Statistik neu (wg. +1 Kochbuch)
        alert("Einladung angenommen! Du hast jetzt Zugriff auf das Kochbuch.");

    } catch (error) {
        console.error("Fehler beim Annehmen der Einladung:", error);
        alert("Fehler: " + error.message);
    }
};

// --- NEU: Einladung ablehnen ---
const declineInvitation = async (inviteId) => {
    try {
        // Markiere die Einladung als "declined"
        await db.collection("invitations").doc(inviteId).update({
            status: "declined"
        });
        
        // UI aktualisieren
        loadUserInvitations(currentUser.uid); // Lade Einladungen neu
        
    } catch (error) {
        console.error("Fehler beim Ablehnen der Einladung:", error);
    }
};


// --- Funktionen zum Umschalten der Ansicht (ERWEITERT) ---
const showDataView = () => {
    displayFirstname.textContent = currentUserData.firstName || "(Kein Name gespeichert)";
    displayEmail.textContent = currentUserData.email || currentUser.email;
    accountMenu.classList.add('hidden');
    logoutButton.classList.add('hidden');
    accountDataDisplay.classList.remove('hidden');
    accountStatsDisplay.classList.add('hidden');
    accountInvitesDisplay.classList.add('hidden'); // NEU
};

const showStatsView = () => {
    accountMenu.classList.add('hidden');
    logoutButton.classList.add('hidden');
    accountDataDisplay.classList.add('hidden');
    accountStatsDisplay.classList.remove('hidden');
    accountInvitesDisplay.classList.add('hidden'); // NEU
};

// NEU
const showInvitesView = () => {
    accountMenu.classList.add('hidden');
    logoutButton.classList.add('hidden');
    accountDataDisplay.classList.add('hidden');
    accountStatsDisplay.classList.add('hidden');
    accountInvitesDisplay.classList.remove('hidden'); // NEU
};

const showMenuView = () => {
    accountMenu.classList.remove('hidden');
    logoutButton.classList.remove('hidden');
    accountDataDisplay.classList.add('hidden');
    accountStatsDisplay.classList.add('hidden');
    accountInvitesDisplay.classList.add('hidden'); // NEU
};

// --- Logout-Funktion (unverändert) ---
const logoutUser = () => {
    auth.signOut().then(() => {
        console.log("Nutzer ausgeloggt.");
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Fehler beim Logout:", error);
    });
};

// --- Initialisierung (ERWEITERT) ---
const init = () => {
    // DOM-Elemente holen
    loader = document.getElementById('loader');
    navbar = document.querySelector('.navbar');
    mainContent = document.querySelector('.main-content');
    accountTitle = document.getElementById('account-title');
    logoutButton = document.getElementById('btn-logout');
    accountMenu = document.querySelector('.account-menu');
    
    // Ansicht 1
    btnShowData = document.getElementById('btn-show-data');
    accountDataDisplay = document.getElementById('account-data-display');
    displayFirstname = document.getElementById('display-firstname');
    displayEmail = document.getElementById('display-email');
    btnHideData = document.getElementById('btn-hide-data');
    
    // Ansicht 2
    btnShowStats = document.getElementById('btn-show-stats');
    accountStatsDisplay = document.getElementById('account-stats-display');
    btnHideStats = document.getElementById('btn-hide-stats');
    statCookbooks = document.getElementById('stat-cookbooks');
    statRecipes = document.getElementById('stat-recipes');
    statPlanned = document.getElementById('stat-planned');
    
    // NEU: Ansicht 3
    btnShowInvites = document.getElementById('btn-show-invites');
    accountInvitesDisplay = document.getElementById('account-invites-display');
    btnHideInvites = document.getElementById('btn-hide-invites');
    invitesList = document.getElementById('invites-list');
    invitesMessage = document.getElementById('invites-message');

    // Sicherheitscheck (erweitert)
    if (!loader || !navbar || !mainContent || !accountTitle || !logoutButton || !btnShowData || !accountDataDisplay || !btnShowStats || !accountStatsDisplay || !btnShowInvites || !accountInvitesDisplay) {
        console.error("FEHLER: Wichtige HTML-Elemente auf der Kontoseite fehlen!");
    }

    // Auth Wächter (erweitert)
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            console.log('Konto: Nutzer ist eingeloggt:', user.email);
            
            // Lade Profil, Statistik UND Einladungen
            await Promise.all([
                loadUserProfile(user.uid),
                loadUserStats(user.uid),
                loadUserInvitations(user.uid) // NEU
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
    
    // Menü-Navigation
    btnShowData.addEventListener('click', showDataView);
    btnHideData.addEventListener('click', showMenuView);
    btnShowStats.addEventListener('click', showStatsView);
    btnHideStats.addEventListener('click', showMenuView);
    btnShowInvites.addEventListener('click', showInvitesView); // NEU
    btnHideInvites.addEventListener('click', showMenuView); // NEU

    // NEU: Event-Delegation für Annehmen/Ablehnen
    if (invitesList) {
        invitesList.addEventListener('click', (e) => {
            const target = e.target;
            const acceptButton = target.closest('.btn-accept');
            const declineButton = target.closest('.btn-decline');
            
            if (!acceptButton && !declineButton) return; // Klick war woanders
            
            const actionsDiv = target.closest('.invite-actions');
            if (!actionsDiv) return; // Sollte nicht passieren
            
            const inviteId = actionsDiv.dataset.inviteId;
            const cookbookId = actionsDiv.dataset.cookbookId;

            if (acceptButton) {
                acceptButton.disabled = true; // Klick verhindern
                acceptInvitation(inviteId, cookbookId);
            }
            if (declineButton) {
                declineButton.disabled = true; // Klick verhindern
                declineInvitation(inviteId);
            }
        });
    }
};

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);