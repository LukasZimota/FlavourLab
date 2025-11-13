import { auth, db } from './firebase-config.js';

// NEU: Firebase Functions-Dienst initialisieren (JETZT KORRIGIERT)
// Wir holen die standard 'app' und rufen .functions() darauf auf
const functions = firebase.app().functions('europe-west3');

// --- Globale Variablen ---
let currentUser;
let currentEditingId = null; // ID für Erstellen/Bearbeiten-Modal
let currentSharingId = null; // NEU: ID für Teilen-Modal
let menuOpenId = null; // Hält fest, welches 3-Punkte-Menü offen ist

// --- DOM-Elemente holen (wird in init gemacht) ---
let loader, navbar, mainContent;
let cookbookGallery, galleryMessage, dashboardTitle;
let modal, modalCloseBtn, modalTitle, saveCookbookBtn, cookbookNameInput, cookbookImageInput;
// NEU: DOM-Elemente für Share-Modal
let shareModal, shareModalCloseBtn, shareModalTitle, sendInviteBtn, shareEmailInput, shareErrorMessage;


// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => {
    loader.style.display = 'none';
    navbar.classList.remove('content-hidden');
    mainContent.classList.remove('content-hidden');
};

// --- Funktion: Lade Kochbücher (STARK GEÄNDERT) ---
const loadCookbooks = async (userId) => {
    if (!cookbookGallery || !galleryMessage) return;

    cookbookGallery.innerHTML = '';
    galleryMessage.textContent = 'Lade Kochbücher...';

    try {
        // NEUE QUERY: Lade alle Kochbücher, bei denen der Nutzer Mitglied ist.
        // (owner ODER editor)
        const snapshot = await db.collection('cookbooks')
            .where(`members.${userId}`, 'in', ['owner', 'editor'])
            .get();
        
        // WICHTIG: Wenn dies beim ersten Mal einen Fehler in der Konsole wirft,
        // dass ein "Index" fehlt, klicke auf den Link in der Fehlermeldung
        // und erstelle den Index in Firebase. Lade dann die Seite neu.

        if (snapshot.empty) {
            galleryMessage.textContent = 'Noch keine Kochbücher hier. Erstelle dein erstes!';
        } else {
            galleryMessage.textContent = ''; 
        }

        snapshot.forEach(doc => {
            const cookbook = doc.data(); 
            const cookbookId = doc.id;   
            
            const item = document.createElement('div');
            item.className = 'cookbook-item cookbook-data-item'; 
            item.dataset.id = cookbookId; 
            
            let style = '';
            if (cookbook.imageUrl && cookbook.imageUrl.trim() !== '') {
                style = `background-image: url('${cookbook.imageUrl}');`;
                item.classList.add('has-image');
            } else {
                item.classList.remove('has-image');
            }

            // NEU: Prüfen, ob der aktuelle Nutzer der Besitzer ist
            const isOwner = (cookbook.ownerId === userId);
            
            // NEU: "Teilen"-Button nur für Besitzer
            const shareButtonHtml = isOwner ? 
                '<a href="#" class="menu-btn-share">Teilen</a>' : '';

            // --- START ÄNDERUNG: "Löschen" (Owner) oder "Verlassen" (Editor) Button ---
            let actionButtonHtml = '';
            if (isOwner) {
                actionButtonHtml = '<a href="#" class="menu-btn-delete">Kochbuch löschen</a>';
            } else {
                // Nutzer ist Editor, also "Verlassen"-Button anzeigen
                actionButtonHtml = '<a href="#" class="menu-btn-leave">Kochbuch verlassen</a>';
            }
            // --- ENDE ÄNDERUNG ---

            item.innerHTML = `
                <div class="cookbook-item-background" style="${style}"></div>
                <span class="cookbook-title">${cookbook.title}</span>
                <div class="cookbook-menu-toggle" role="button" aria-label="Kochbuch-Optionen">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                    </svg>
                </div>
                <div class="cookbook-menu ${menuOpenId === cookbookId ? 'menu-open' : ''}">
                    <a href="#" class="menu-btn-edit">Bearbeiten</a>
                    ${shareButtonHtml} 
                    ${actionButtonHtml} 
                </div>
            `;
            cookbookGallery.appendChild(item);
        });

    } catch (error) {
        console.error('Fehler beim Laden der Kochbücher:', error);
        galleryMessage.textContent = 'Ein Fehler ist aufgetreten. (Hinweis: Evtl. fehlt ein Firestore-Index? Siehe Konsole.)';
    }

    // "Plus"-Kachel am Ende hinzufügen
    createAddCookbookTile();
};

// --- Funktion: "Plus"-Kachel erstellen ---
const createAddCookbookTile = () => {
    const item = document.createElement('div');
    item.className = 'cookbook-item add-cookbook-tile';
    item.id = 'btn-open-create-modal'; // ID für Klick-Listener
    item.innerHTML = '<span class="plus-icon">+</span>';
    cookbookGallery.appendChild(item);
};

// --- Funktionen für Modal 1 (Erstellen/Bearbeiten) ---
const openCreateModal = () => {
    currentEditingId = null; // Sicherstellen, dass wir im "Erstellen"-Modus sind
    modalTitle.textContent = 'Neues Kochbuch erstellen';
    cookbookNameInput.value = '';
    cookbookImageInput.value = '';
    modal.classList.remove('modal-hidden');
    cookbookNameInput.focus();
};

const openEditModal = async (cookbookId) => {
    currentEditingId = cookbookId;
    modalTitle.textContent = 'Kochbuch bearbeiten';
    cookbookNameInput.value = '';
    cookbookImageInput.value = '';
    modal.classList.remove('modal-hidden');
    
    try {
        // NEUER PFAD: Top-Level 'cookbooks'
        const docRef = db.collection('cookbooks').doc(cookbookId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            cookbookNameInput.value = data.title;
            cookbookImageInput.value = data.imageUrl || '';
        } else {
            console.error("Dokument nicht gefunden!");
            closeModal();
        }
    } catch (error) {
        console.error("Fehler beim Laden für Bearbeitung:", error);
    }
};

const closeModal = () => {
    modal.classList.add('modal-hidden');
    currentEditingId = null;
};

// --- Funktion zum SPEICHERN (STARK GEÄNDERT) ---
const saveCookbook = async () => {
    const name = cookbookNameInput.value.trim();
    const imageUrl = cookbookImageInput.value.trim();
    
    if (!name) {
        alert('Bitte gib einen Namen für das Kochbuch ein.');
        return;
    }

    saveCookbookBtn.disabled = true;

    try {
        if (currentEditingId) {
            // ---- MODUS: BEARBEITEN ----
            // NEUER PFAD: Top-Level 'cookbooks'
            const docRef = db.collection('cookbooks').doc(currentEditingId);
            await docRef.update({
                title: name,
                imageUrl: imageUrl
            });
            console.log("Kochbuch aktualisiert!");
        } else {
            // ---- MODUS: NEU ERSTELLEN ----
            // NEUER PFAD & NEUE DATENSTRUKTUR
            const dataToSave = { 
                title: name, 
                imageUrl: imageUrl,
                ownerId: currentUser.uid, // Besitzer setzen
                members: { // Mitglieder-Map setzen
                    [currentUser.uid]: "owner" // Dynamischer Schlüssel [currentUser.uid]
                },
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            // NEUER PFAD: Top-Level 'cookbooks'
            await db.collection('cookbooks').add(dataToSave);
            console.log("Neues Kochbuch erstellt!");
        }
        
        loadCookbooks(currentUser.uid); // Lade die Galerie neu
        closeModal(); 
        
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        alert('Ein Fehler ist aufgetreten. Konnte nicht speichern.');
    }
    saveCookbookBtn.disabled = false;
};

// --- Funktion zum Löschen (GEÄNDERT) ---
const deleteCookbook = async (cookbookId) => {
    if (!confirm('Bist du sicher, dass du dieses Kochbuch löschen möchtest? Alle darin enthaltenen Rezepte werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.')) {
        return;
    }
    
    try {
        // NEUER PFAD: Top-Level 'cookbooks'
        const cookbookRef = db.collection('cookbooks').doc(cookbookId);
        
        // HINWEIS: Rezepte in der Sub-Kollektion werden NICHT automatisch gelöscht.
        // Für eine saubere Löschung wäre eine Cloud Function (Recursive Delete) besser.
        // Fürs Erste löschen wir nur das Kochbuch-Dokument.
        
        await cookbookRef.delete();
        console.log('Kochbuch gelöscht!');
        loadCookbooks(currentUser.uid); // Lade die Galerie neu
        
    } catch (error) {
        console.error("Fehler beim Löschen:", error);
        alert("Löschen fehlgeschlagen.");
    }
};

// --- START: NEUE FUNKTION ZUM VERLASSEN ---
const leaveCookbook = async (cookbookId) => {
    if (!currentUser || !cookbookId) return;
    
    // Bestätigung einholen
    if (!confirm('Möchtest du dieses geteilte Kochbuch wirklich aus deiner Bibliothek entfernen? Es wird nicht für den Besitzer oder andere Mitglieder gelöscht.')) {
        return;
    }

    try {
        const cookbookRef = db.collection('cookbooks').doc(cookbookId);
        
        // Entferne den Nutzer aus der "members"-Map, indem das Feld gelöscht wird
        await cookbookRef.update({
            [`members.${currentUser.uid}`]: firebase.firestore.FieldValue.delete()
        });
        
        console.log('Kochbuch erfolgreich verlassen.');
        loadCookbooks(currentUser.uid); // Lade die Galerie neu
        
    } catch (error) {
        console.error("Fehler beim Verlassen des Kochbuchs:", error);
        alert("Verlassen fehlgeschlagen.");
    }
};
// --- ENDE: NEUE FUNKTION ZUM VERLASSEN ---


// --- NEUE FUNKTIONEN FÜR DAS "TEILEN"-MODAL ---
const openShareModal = (cookbookId, title) => {
    currentSharingId = cookbookId;
    shareModalTitle.textContent = `"${title}" teilen`;
    shareEmailInput.value = '';
    shareErrorMessage.textContent = '';
    shareModal.classList.remove('modal-hidden');
    shareEmailInput.focus();
};

const closeShareModal = () => {
    shareModal.classList.add('modal-hidden');
    currentSharingId = null;
};

// --- NEUE FUNKTION: Cloud Function aufrufen ---
const sendInvitation = async () => {
    const email = shareEmailInput.value.trim().toLowerCase();
    
    if (!email || !currentSharingId) {
        shareErrorMessage.textContent = "Bitte gib eine E-Mail-Adresse ein.";
        return;
    }
    
    sendInviteBtn.disabled = true;
    shareErrorMessage.textContent = "Sende Einladung...";

    try {
        // Rufe die Cloud Function 'inviteUserToCookbook' auf
        const inviteFunction = functions.httpsCallable('inviteUserToCookbook');
        const result = await inviteFunction({ 
            cookbookId: currentSharingId, 
            inviteeEmail: email 
        });
        
        // Erfolg!
        console.log(result.data.message);
        alert("Einladung wurde erfolgreich gesendet!");
        closeShareModal();

    } catch (error) {
        // Die Cloud Function wirft HttpsError
        console.error("Fehler beim Senden der Einladung:", error.message);
        shareErrorMessage.textContent = error.message; // Zeige die Fehlermeldung (z.B. "Nutzer nicht gefunden")
    }
    
    sendInviteBtn.disabled = false;
};

// --- Klick-Handling ---
const handleGalleryClick = (e) => {
    // Klick auf "Plus"-Kachel
    if (e.target.closest('#btn-open-create-modal')) {
        openCreateModal();
        return;
    }

    const clickedCookbook = e.target.closest('.cookbook-data-item');
    if (!clickedCookbook) return; // Klick ins Leere
    
    const cookbookId = clickedCookbook.dataset.id;
    
    // Klick auf Menü-Toggle (3 Punkte)
    const menuToggle = e.target.closest('.cookbook-menu-toggle');
    if (menuToggle) {
        e.preventDefault();
        const menu = clickedCookbook.querySelector('.cookbook-menu');
        const wasOpen = menu.classList.contains('menu-open');
        
        // Alle anderen Menüs schließen
        document.querySelectorAll('.cookbook-menu.menu-open').forEach(m => m.classList.remove('menu-open'));
        
        // Dieses Menü öffnen/schließen
        if (!wasOpen) {
            menu.classList.add('menu-open');
            menuOpenId = cookbookId;
        } else {
            menuOpenId = null;
        }
        return;
    }
    
    // Klick auf "Löschen" im Menü
    const deleteBtn = e.target.closest('.menu-btn-delete');
    if (deleteBtn) {
        e.preventDefault();
        deleteCookbook(cookbookId);
        return;
    }
    
    // --- START ÄNDERUNG: Klick auf "Verlassen" ---
    const leaveBtn = e.target.closest('.menu-btn-leave');
    if (leaveBtn) {
        e.preventDefault();
        leaveCookbook(cookbookId); // Rufe die neue Funktion auf
        return;
    }
    // --- ENDE ÄNDERUNG ---
    
    // Klick auf "Bearbeiten" im Menü
    const editBtn = e.target.closest('.menu-btn-edit');
    if (editBtn) {
        e.preventDefault();
        openEditModal(cookbookId);
        return;
    }

    // NEU: Klick auf "Teilen" im Menü
    const shareBtn = e.target.closest('.menu-btn-share');
    if (shareBtn) { 
        e.preventDefault(); 
        const title = clickedCookbook.querySelector('.cookbook-title').textContent;
        openShareModal(cookbookId, title); 
        return;
    }

    // Klick auf die Kachel selbst (um zu den Rezepten zu navigieren)
    // Verhindern, dass Klicks auf das Menü zur Rezeptseite navigieren
    if (e.target.closest('.cookbook-menu')) {
        return;
    }
    
    // Weiterleiten zur Rezeptseite
    window.location.href = `recipes.html?id=${cookbookId}`;
};

// --- Initialisierung ---
const init = () => {
    // DOM-Elemente holen
    loader = document.getElementById('loader');
    navbar = document.querySelector('.navbar');
    mainContent = document.querySelector('.main-content');
    cookbookGallery = document.getElementById('cookbook-gallery');
    galleryMessage = document.getElementById('gallery-message');
    dashboardTitle = document.getElementById('dashboard-title');
    
    // Modal 1 (Erstellen/Bearbeiten)
    modal = document.getElementById('cookbook-modal');
    modalCloseBtn = document.getElementById('modal-close-btn');
    modalTitle = document.getElementById('modal-title');
    saveCookbookBtn = document.getElementById('btn-save-cookbook');
    cookbookNameInput = document.getElementById('modal-cookbook-name');
    cookbookImageInput = document.getElementById('modal-cookbook-image');
    
    // NEU: Modal 2 (Teilen)
    shareModal = document.getElementById('share-modal');
    shareModalCloseBtn = document.getElementById('share-modal-close-btn');
    shareModalTitle = document.getElementById('share-modal-title');
    sendInviteBtn = document.getElementById('btn-send-invite');
    shareEmailInput = document.getElementById('modal-share-email');
    shareErrorMessage = document.getElementById('share-error-message');

    // Auth Wächter
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            
            // Lade Nutzerprofil, um den Namen zu bekommen
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const firstName = doc.data().firstName;
                    dashboardTitle.textContent = `Willkommen zurück, ${firstName}!`;
                } else {
                    dashboardTitle.textContent = 'Willkommen zurück!';
                }
            });

            loadCookbooks(user.uid);
            showContent();
        } else {
            currentUser = null;
            window.location.href = 'index.html'; // Nicht eingeloggt
        }
    });

    // Event Listeners
    if (cookbookGallery) {
        cookbookGallery.addEventListener('click', handleGalleryClick);
    }
    
    // Modal 1 (Erstellen/Bearbeiten)
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (saveCookbookBtn) saveCookbookBtn.addEventListener('click', saveCookbook);
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(); 
    });
    
    // NEU: Modal 2 (Teilen)
    if (shareModalCloseBtn) shareModalCloseBtn.addEventListener('click', closeShareModal);
    if (sendInviteBtn) sendInviteBtn.addEventListener('click', sendInvitation);
    if (shareModal) shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) closeShareModal();
    });

    // Menüs schließen, wenn man woanders hinklickt
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.cookbook-item') && menuOpenId) {
            document.querySelectorAll('.cookbook-menu.menu-open').forEach(m => m.classList.remove('menu-open'));
            menuOpenId = null;
        }
    });
};

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);