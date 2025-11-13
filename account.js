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
// Ansicht 3: Einladungen
let btnShowInvites, accountInvitesDisplay, btnHideInvites, invitesList, invitesMessage;
// NEU: Ansicht 4: "Über uns"
let btnShowLegal, accountLegalDisplay, btnHideLegal;
let btnShowImprint, btnShowPrivacy, imprintContent, privacyContent;


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

// --- Funktion zum Laden der Statistik (unverändert) ---
const loadUserStats = async (userId) => {
    if (!statCookbooks || !statRecipes || !statPlanned) return;

    statCookbooks.textContent = "Lade...";
    statRecipes.textContent = "Lade...";
    statPlanned.textContent = "Lade...";

    try {
        const cookbookQuery = db.collection('cookbooks')
                                .where(`members.${userId}`, 'in', ['owner', 'editor']);
        const cookbookPromise = cookbookQuery.get();
        
        const plannedPromise = db.collection('users').doc(userId).collection('plannedMeals').get();

        const [cookbookSnap, plannedSnap] = await Promise.all([cookbookPromise, plannedPromise]);

        const cookbookCount = cookbookSnap.size;
        statCookbooks.textContent = cookbookCount;

        let plannedRecipeCount = 0;
        plannedSnap.forEach(doc => {
            const data = doc.data();
            if (data.breakfast) plannedRecipeCount += data.breakfast.length;
            if (data.lunch) plannedRecipeCount += data.lunch.length;
            if (data.dinner) plannedRecipeCount += data.dinner.length;
            if (data.snacks) plannedRecipeCount += data.snacks.length;
        });
        statPlanned.textContent = plannedRecipeCount;

        let totalRecipeCount = 0;
        const recipeCountPromises = [];
        
        cookbookSnap.forEach(cookbookDoc => {
            recipeCountPromises.push(
                db.collection('cookbooks').doc(cookbookDoc.id)
                  .collection('recipes').get()
            );
        });
        
        const recipeSnaps = await Promise.all(recipeCountPromises);
        
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

// --- Funktion zum Laden der Einladungen (unverändert) ---
const loadUserInvitations = async (userId) => {
    if (!invitesList || !invitesMessage) return;
    
    invitesMessage.textContent = "Lade Einladungen...";
    invitesList.innerHTML = ""; 

    try {
        const snapshot = await db.collection("invitations")
            .where("toUserId", "==", userId) 
            .where("status", "==", "pending") 
            .orderBy("createdAt", "desc")
            .get();

        if (snapshot.empty) {
            invitesMessage.textContent = "Du hast keine offenen Einladungen.";
            return;
        }
        
        invitesMessage.textContent = ""; 
        snapshot.forEach(doc => {
            const invite = doc.data();
            const div = document.createElement('div');
            div.className = 'invite-item';
            div.innerHTML = `
                <div class="invite-info">
                    <span class="cookbook-name">${invite.cookbookTitle}</span>
                    <span class="sender-email">Eingeladen von: ${invite.fromUserName}</span>
                </div>
                <div class="invite-actions" data-invite-id="${doc.id}" data-cookbook-id="${invite.cookbookId}">
                    <button class="btn-accept-invite">Annehmen</button>
                    <button class="btn-decline-invite">Ablehnen</button>
                </div>
            `;
            invitesList.appendChild(div);
        });

    } catch (error) {
        console.error("Fehler beim Laden der Einladungen:", error);
        invitesMessage.textContent = "Einladungen konnten nicht geladen werden.";
    }
};

// --- Einladung annehmen (unverändert) ---
const acceptInvitation = async (inviteId, cookbookId) => {
    try {
        const cookbookRef = db.collection("cookbooks").doc(cookbookId);
        const inviteRef = db.collection("invitations").doc(inviteId);
        const batch = db.batch();
        batch.update(cookbookRef, {
            [`members.${currentUser.uid}`]: "editor"
        });
        batch.update(inviteRef, {
            status: "accepted"
        });
        await batch.commit();
        loadUserInvitations(currentUser.uid); 
        loadUserStats(currentUser.uid); 
        // alert("Einladung angenommen! Du hast jetzt Zugriff auf das Kochbuch."); 
        // Ersetze alert durch eine bessere Benachrichtigung, wenn möglich
        console.log("Einladung angenommen!");

    } catch (error) {
        console.error("Fehler beim Annehmen der Einladung:", error);
        // alert("Fehler: " + error.message);
    }
};

// --- Einladung ablehnen (unverändert) ---
const declineInvitation = async (inviteId) => {
    try {
        await db.collection("invitations").doc(inviteId).update({
            status: "declined"
        });
        loadUserInvitations(currentUser.uid); 
    } catch (error) {
        console.error("Fehler beim Ablehnen der Einladung:", error);
    }
};


// --- Funktionen zum Umschalten der Ansicht (JETZT ERWEITERT) ---
const showDataView = () => {
    displayFirstname.textContent = currentUserData.firstName || "(Kein Name gespeichert)";
    displayEmail.textContent = currentUserData.email || currentUser.email;
    accountTitle.classList.add('hidden');
    accountMenu.classList.add('hidden');
    logoutButton.classList.add('hidden');
    
    accountDataDisplay.classList.remove('hidden');
    accountStatsDisplay.classList.add('hidden');
    accountInvitesDisplay.classList.add('hidden');
    accountLegalDisplay.classList.add('hidden'); // NEU
};

const showStatsView = () => {
    accountTitle.classList.add('hidden');
    accountMenu.classList.add('hidden');
    logoutButton.classList.add('hidden');

    accountDataDisplay.classList.add('hidden');
    accountStatsDisplay.classList.remove('hidden');
    accountInvitesDisplay.classList.add('hidden');
    accountLegalDisplay.classList.add('hidden'); // NEU
};

const showInvitesView = () => {
    accountTitle.classList.add('hidden');
    accountMenu.classList.add('hidden');
    logoutButton.classList.add('hidden');

    accountDataDisplay.classList.add('hidden');
    accountStatsDisplay.classList.add('hidden');
    accountInvitesDisplay.classList.remove('hidden');
    accountLegalDisplay.classList.add('hidden'); // NEU
};

// NEU: Ansicht für "Über uns"
const showLegalView = () => {
    accountTitle.classList.add('hidden');
    accountMenu.classList.add('hidden');
    logoutButton.classList.add('hidden');

    accountDataDisplay.classList.add('hidden');
    accountStatsDisplay.classList.add('hidden');
    accountInvitesDisplay.classList.add('hidden');
    accountLegalDisplay.classList.remove('hidden'); // NEU

    // Standardmäßig Impressum anzeigen
    showImprintContent();
};

const showMenuView = () => {
    accountTitle.classList.remove('hidden');
    accountMenu.classList.remove('hidden');
    logoutButton.classList.remove('hidden');

    accountDataDisplay.classList.add('hidden');
    accountStatsDisplay.classList.add('hidden');
    accountInvitesDisplay.classList.add('hidden');
    accountLegalDisplay.classList.add('hidden'); // NEU
};

// --- NEU: Sub-Tab-Navigation für "Über uns" ---
const showImprintContent = () => {
    if (btnShowImprint) btnShowImprint.classList.add('active');
    if (btnShowPrivacy) btnShowPrivacy.classList.remove('active');
    if (imprintContent) imprintContent.classList.remove('hidden');
    if (privacyContent) privacyContent.classList.add('hidden');
};

const showPrivacyContent = () => {
    if (btnShowImprint) btnShowImprint.classList.remove('active');
    if (btnShowPrivacy) btnShowPrivacy.classList.add('active');
    if (imprintContent) imprintContent.classList.add('hidden');
    if (privacyContent) privacyContent.classList.remove('hidden');
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
    
    // Ansicht 3
    btnShowInvites = document.getElementById('btn-show-invites');
    accountInvitesDisplay = document.getElementById('account-invites-display');
    btnHideInvites = document.getElementById('btn-hide-invites');
    invitesList = document.getElementById('invites-list');
    invitesMessage = document.getElementById('invites-message');

    // NEU: Ansicht 4
    btnShowLegal = document.getElementById('btn-show-legal');
    accountLegalDisplay = document.getElementById('account-legal-display');
    btnHideLegal = document.getElementById('btn-hide-legal');
    btnShowImprint = document.getElementById('btn-show-imprint');
    btnShowPrivacy = document.getElementById('btn-show-privacy');
    imprintContent = document.getElementById('imprint-content');
    privacyContent = document.getElementById('privacy-content');

    // Sicherheitscheck (erweitert)
    if (!loader || !navbar || !mainContent || !accountTitle || !logoutButton || 
        !btnShowData || !accountDataDisplay || !btnShowStats || !accountStatsDisplay || 
        !btnShowInvites || !accountInvitesDisplay || !btnShowLegal || !accountLegalDisplay) { // NEU
        console.error("FEHLER: Wichtige HTML-Elemente auf der Kontoseite fehlen!");
    }

    // Auth Wächter (erweitert)
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            console.log('Konto: Nutzer ist eingeloggt:', user.email);
            
            await Promise.all([
                loadUserProfile(user.uid),
                loadUserStats(user.uid),
                loadUserInvitations(user.uid) 
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
    btnShowInvites.addEventListener('click', showInvitesView);
    btnHideInvites.addEventListener('click', showMenuView);
    
    // NEU: Listener für "Über uns"
    btnShowLegal.addEventListener('click', showLegalView);
    btnHideLegal.addEventListener('click', showMenuView);
    btnShowImprint.addEventListener('click', showImprintContent);
    btnShowPrivacy.addEventListener('click', showPrivacyContent);


    // Event-Delegation für Annehmen/Ablehnen
    if (invitesList) {
        invitesList.addEventListener('click', (e) => {
            const target = e.target;
            const acceptButton = target.closest('.btn-accept-invite'); // Klasse geändert
            const declineButton = target.closest('.btn-decline-invite'); // Klasse geändert
            
            if (!acceptButton && !declineButton) return;
            
            const actionsDiv = target.closest('.invite-actions');
            if (!actionsDiv) return;
            
            const inviteId = actionsDiv.dataset.inviteId;
            const cookbookId = actionsDiv.dataset.cookbookId;

            if (acceptButton) {
                acceptButton.disabled = true; 
                acceptInvitation(inviteId, cookbookId);
            }
            if (declineButton) {
                declineButton.disabled = true; 
                declineInvitation(inviteId);
            }
        });
    }
};

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);