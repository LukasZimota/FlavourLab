import { auth, db } from './firebase-config.js';

// --- Globale Variablen (NUR Deklaration) ---
let currentUser; 
let currentEditingId = null; 

// --- DOM-Elemente (NUR Deklaration) ---
let modal, closeModalBtn, saveCookbookBtn, modalCookbookNameInput, modalCookbookImageInput, modalTitle;
let cookbookGallery, galleryMessage, loader, navbar, mainContent, dashboardTitle;

// --- Pop-up Funktionen ---
const openCreateModal = () => {
    currentEditingId = null;
    modalTitle.textContent = 'Neues Kochbuch erstellen';
    modalCookbookNameInput.value = '';
    modalCookbookImageInput.value = '';
    modal.classList.remove('modal-hidden');
};

const openEditModal = async (cookbookId) => {
    currentEditingId = cookbookId;
    modalTitle.textContent = 'Kochbuch bearbeiten';
    modalCookbookNameInput.value = 'Lade...';
    modalCookbookImageInput.value = 'Lade...';
    modal.classList.remove('modal-hidden');
    try {
        const docRef = db.collection('users').doc(currentUser.uid).collection('cookbooks').doc(cookbookId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            modalCookbookNameInput.value = data.title;
            modalCookbookImageInput.value = data.imageUrl || '';
        } else {
            alert("Fehler: Kochbuch nicht gefunden.");
            closeModal();
        }
    } catch (error) {
        console.error("Fehler beim Laden der Kochbuchdaten:", error);
        alert("Fehler beim Laden der Daten.");
        closeModal();
    }
};

const closeModal = () => {
    modal.classList.add('modal-hidden');
    currentEditingId = null;
    modalTitle.textContent = 'Neues Kochbuch erstellen';
    modalCookbookNameInput.value = '';
    modalCookbookImageInput.value = '';
};

// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => {
    if (loader) loader.style.display = 'none';
    if (navbar) navbar.classList.remove('content-hidden');
    if (mainContent) mainContent.classList.remove('content-hidden');
};

// --- Funktion zum Laden des Nutzerprofils (Name) ---
const loadUserProfile = async (userId) => {
    if (!dashboardTitle) return; 
    try {
        const userDocRef = db.collection('users').doc(userId);
        const docSnap = await userDocRef.get();
        if (docSnap.exists) {
            const userData = docSnap.data();
            const firstName = userData.firstName;
            if (firstName) {
                dashboardTitle.textContent = `${firstName}'s Kochbücher`;
            } else {
                dashboardTitle.textContent = 'Deine Kochbücher';
            }
        } else {
            console.log("Nutzer-Dokument nicht gefunden.");
            dashboardTitle.textContent = 'Deine Kochbücher';
        }
    } catch (error) {
        console.error("Fehler beim Laden des Nutzerprofils:", error);
        dashboardTitle.textContent = 'Deine Kochbücher';
    }
};

// --- Funktion, die die "Plus"-Kachel erstellt ---
const createAddCookbookTile = () => {
    if (!cookbookGallery) return;
    const item = document.createElement('div');
    item.className = 'cookbook-item add-cookbook-tile';
    item.id = 'btn-open-modal'; 
    item.innerHTML = '<span class="plus-icon">+</span>';
    cookbookGallery.appendChild(item);
};

// --- Funktion zum Laden der Kochbücher (VOLLSTÄNDIG) ---
const loadCookbooks = async (userId) => {
    if (!cookbookGallery || !galleryMessage) {
        console.error("Fehler (im Ladevorgang): cookbookGallery oder galleryMessage nicht gefunden.");
        return;
    }
    cookbookGallery.innerHTML = '';
    galleryMessage.textContent = 'Lade Kochbücher...';

    try {
        const snapshot = await db.collection('users').doc(userId).collection('cookbooks').orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            galleryMessage.textContent = 'Erstelle dein erstes Kochbuch!';
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

            // HTML mit Stift-Icon und Menü
            item.innerHTML = `
                <div class="cookbook-item-background" style="${style}"></div>
                <span class="cookbook-title">${cookbook.title}</span>
                <div class="cookbook-menu-toggle" role="button" aria-label="Kochbuch-Optionen">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V12h2.293z"/>
                    </svg>
                </div>
                <div class="cookbook-menu">
                    <a href="#" class="menu-btn-edit">Bearbeiten</a>
                    <a href="#" class="menu-btn-delete">Löschen</a>
                </div>
            `;
            cookbookGallery.appendChild(item);
        });
    } catch (error) {
        console.error('Fehler beim Laden der Kochbücher:', error);
        galleryMessage.textContent = 'Ein Fehler ist aufgetreten.';
    }

    // "Plus"-Kachel als letztes hinzufügen
    createAddCookbookTile();
};

// --- Funktion zum SPEICHERN (Erstellen ODER Bearbeiten) ---
const saveCookbook = async () => {
    const name = modalCookbookNameInput.value.trim(); 
    const imageUrl = modalCookbookImageInput.value.trim();
    if (!name || !currentUser) { alert('Bitte einen Namen eingeben.'); return; }
    try {
        const dataToSave = { title: name, imageUrl: imageUrl };
        if (currentEditingId) {
            const docRef = db.collection('users').doc(currentUser.uid).collection('cookbooks').doc(currentEditingId);
            await docRef.update(dataToSave);
            console.log("Kochbuch aktualisiert!");
        } else {
            dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('users').doc(currentUser.uid).collection('cookbooks').add(dataToSave);
            console.log("Neues Kochbuch erstellt!");
        }
        loadCookbooks(currentUser.uid);
        closeModal(); 
    } catch (error) { console.error('Fehler beim Speichern:', error); }
};

// --- Funktion zum Löschen eines Kochbuchs ---
const deleteCookbook = async (cookbookId) => {
    if (!confirm('Sicher? Alle Rezepte in diesem Kochbuch werden DAUERHAFT gelöscht!')) return;
    if (!currentUser) return;
    try {
        const recipeSnapshot = await db.collection('users').doc(currentUser.uid).collection('cookbooks').doc(cookbookId).collection('recipes').get();
        const deletePromises = [];
        recipeSnapshot.forEach(doc => { deletePromises.push(doc.ref.delete()); });
        await Promise.all(deletePromises);
        await db.collection('users').doc(currentUser.uid).collection('cookbooks').doc(cookbookId).delete();
        console.log('Kochbuch gelöscht!');
        loadCookbooks(currentUser.uid);
    } catch (error) { console.error("Fehler beim Löschen:", error); }
};


// --- Initialisierungs-Funktion (WICHTIG) ---
const init = () => {
    console.log("app.js Init Start");
    
    // --- DOM-Elemente HIER HOLEN (NACH DOMContentLoaded) ---
    modal = document.getElementById('cookbook-modal');
    closeModalBtn = document.getElementById('modal-close-btn');
    saveCookbookBtn = document.getElementById('btn-save-cookbook');
    modalCookbookNameInput = document.getElementById('modal-cookbook-name');
    modalCookbookImageInput = document.getElementById('modal-cookbook-image');
    modalTitle = document.getElementById('modal-title');
    cookbookGallery = document.getElementById('cookbook-gallery');
    galleryMessage = document.getElementById('gallery-message');
    loader = document.getElementById('loader');
    navbar = document.querySelector('.navbar');
    mainContent = document.querySelector('.main-content');
    dashboardTitle = document.getElementById('dashboard-title');

    // Sicherheitscheck
    if (!cookbookGallery || !galleryMessage || !dashboardTitle || !modal) {
        console.error("APP.JS FEHLER: Wichtige HTML-Elemente auf dashboard.html fehlen!");
        // Stoppt nicht, damit Login/Logout evtl. noch geht, aber loggt Fehler
    } else {
        console.log("APP.JS: Alle DOM-Elemente erfolgreich gefunden.");
    }

    // --- Auth Wächter HIER HIN ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user; 
            showContent(); // Inhalt SOFORT anzeigen

            try {
                // Lade Profil und Kochbücher parallel
                await Promise.all([
                    loadUserProfile(user.uid),
                    loadCookbooks(user.uid)
                ]);
                console.log("Profil und Kochbücher geladen.");
            } catch (error) {
                console.error("Fehler beim Laden von Profil oder Kochbüchern:", error);
            }

            // Event Listener für Klicks in der Galerie
            if (cookbookGallery) {
                cookbookGallery.addEventListener('click', (e) => {
                    if (e.target.closest('#btn-open-modal')) { openCreateModal(); return; }
                    const menuToggle = e.target.closest('.cookbook-menu-toggle');
                    if (menuToggle) { e.preventDefault(); const menu = menuToggle.nextElementSibling; if (menu) { document.querySelectorAll('.cookbook-menu.menu-open').forEach(m => { if (m !== menu) m.classList.remove('menu-open'); }); menu.classList.toggle('menu-open'); } return; }
                    const deleteBtn = e.target.closest('.menu-btn-delete');
                    if (deleteBtn) { e.preventDefault(); const item = deleteBtn.closest('.cookbook-data-item'); if (item) deleteCookbook(item.dataset.id); return; }
                    const editBtn = e.target.closest('.menu-btn-edit');
                    if (editBtn) { e.preventDefault(); const item = editBtn.closest('.cookbook-data-item'); if (item) openEditModal(item.dataset.id); return; }
                    const clickedItem = e.target.closest('.cookbook-data-item');
                    if (clickedItem) { window.location.href = `recipes.html?id=${clickedItem.dataset.id}`; }
                });
            }
            
            // Menü-Schließen-Logik
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.cookbook-menu') && !e.target.closest('.cookbook-menu-toggle')) {
                    document.querySelectorAll('.cookbook-menu.menu-open').forEach(menu => {
                        menu.classList.remove('menu-open');
                    });
                }
            });

        } else {
            currentUser = null;
            window.location.href = 'index.html';
        }
    });

    // --- Event Listeners für Modal HIER HIN ---
    if (saveCookbookBtn) saveCookbookBtn.addEventListener('click', saveCookbook);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) { closeModal(); }
    });
};

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);