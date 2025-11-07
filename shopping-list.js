import { auth, db } from './firebase-config.js';

// --- Functions HIER initialisieren (mit Region) ---
const functions = firebase.app().functions('europe-west3');
// ---

// --- Globale Variablen ---
let currentUser;

// --- DOM-Elemente (Deklaration) ---
let loader, navbar, mainContent;
let dateSelectionList, generateBtn, resultsList, listMessage;
let dateSelectorContainer, editDatesBtn;
// NEU: DOM-Elemente für das Info-Modal
let infoModal, infoModalCloseBtn, infoModalTitle, infoModalList;


// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => {
    if (loader) loader.style.display = 'none';
    if (navbar) navbar.classList.remove('content-hidden');
    if (mainContent) mainContent.classList.remove('content-hidden');
};

// --- Initialisierung ---
const init = () => {
    console.log("Shopping List Init Start (Version 44 - Klick-Modal)");
    
    // --- DOM-Elemente HIER HOLEN ---
    loader = document.getElementById('loader');
    navbar = document.querySelector('.navbar');
    mainContent = document.querySelector('.main-content');
    dateSelectionList = document.getElementById('date-selection-list');
    generateBtn = document.getElementById('btn-generate-list');
    resultsList = document.getElementById('shopping-list-results');
    listMessage = document.getElementById('shopping-list-message');
    dateSelectorContainer = document.getElementById('date-selector-container');
    editDatesBtn = document.getElementById('btn-edit-dates');
    // NEU: Info-Modal Elemente
    infoModal = document.getElementById('info-modal');
    infoModalCloseBtn = document.getElementById('info-modal-close-btn');
    infoModalTitle = document.getElementById('info-modal-title');
    infoModalList = document.getElementById('info-modal-list');
    // --- ENDE DOM-Elemente holen ---

    // Sicherheitscheck
    if (!dateSelectionList || !generateBtn || !resultsList || !listMessage || !dateSelectorContainer || !editDatesBtn || !loader || !infoModal) {
        console.error("FEHLER: Wichtige HTML-Elemente für Einkaufsliste fehlen!");
        return;
    }

    // Auth Wächter
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log("Shopping List: Nutzer eingeloggt.");
            showContent();
            
            // Bugfix (von Ansatz 35): Immer Tage erstellen, dann laden
            displayDateSelection(); 
            loadListFromStorage();
            
        } else {
            currentUser = null;
            window.location.href = 'index.html';
        }
    });

    // Event Listener für Knöpfe
    if (generateBtn) generateBtn.addEventListener('click', generateList);
    if (editDatesBtn) editDatesBtn.addEventListener('click', editDates);

    // Klick-Listener für Datums-Buttons
    if (dateSelectionList) {
        dateSelectionList.addEventListener('click', (e) => {
            const button = e.target.closest('.date-select-btn');
            if (button) { button.classList.toggle('active'); }
        });
    }

    // Kombinierter Klick-Listener für Akkordeon, Abhaken UND INFO
    if (resultsList) {
        resultsList.addEventListener('click', (e) => {
            const target = e.target;
            
            // Fall 1: Klick auf den Header -> Auf/Zuklappen
            const header = target.closest('.category-header');
            if (header) {
                const content = header.nextElementSibling;
                if (content && content.classList.contains('category-content')) {
                    content.classList.toggle('open');
                    header.querySelector('.category-toggle-icon').classList.toggle('rotated');
                }
                return; 
            }

            // NEU: Fall 2: Klick auf das Info-Symbol -> Modal öffnen
            const infoBtn = target.closest('.info-trigger-btn');
            if (infoBtn) {
                e.preventDefault();
                const ingredientName = infoBtn.dataset.ingredient;
                const sources = infoBtn.dataset.sources.split('|'); // Array zurückholen
                openInfoModal(ingredientName, sources);
                return;
            }

            // Fall 3: Klick auf ein Item (Label oder Checkbox) -> Abhaken
            const itemLabelOrInput = target.closest('label, input[type="checkbox"]');
            if (itemLabelOrInput) {
                e.preventDefault(); 
                const item = itemLabelOrInput.closest('.shopping-list-item');
                if (item) {
                    item.classList.toggle('checked'); // 'checked' Klasse für CSS
                    saveCheckedState(); // Status im LocalStorage speichern
                }
            }
        });
    }
    
    // NEU: Listener zum Schließen des Info-Modals
    if (infoModalCloseBtn) infoModalCloseBtn.addEventListener('click', closeInfoModal);
    if (infoModal) infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) { // Klick auf den Overlay-Hintergrund
            closeInfoModal();
        }
    });
};

// --- NEUE FUNKTIONEN: Info-Modal steuern ---
const openInfoModal = (ingredientName, sources) => {
    if (!infoModal || !infoModalTitle || !infoModalList) return;
    
    infoModalTitle.textContent = `"${ingredientName}" wird verwendet in:`;
    
    infoModalList.innerHTML = ''; // Liste leeren
    sources.forEach(recipeName => {
        const li = document.createElement('li');
        li.textContent = recipeName;
        infoModalList.appendChild(li);
    });
    
    infoModal.classList.remove('modal-hidden');
};

const closeInfoModal = () => {
    if (infoModal) infoModal.classList.add('modal-hidden');
};
// --- ENDE NEUE FUNKTIONEN ---


// --- Funktion: Zeigt die nächsten 7 Tage als Buttons an ---
const displayDateSelection = () => {
    if (!dateSelectionList) return;
    dateSelectionList.innerHTML = '';
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        const dateKey = getLocalDateKey(currentDate);
        let dateString = currentDate.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
        if (i === 0) { dateString = `Heute (${dateString})`; }
        else if (i === 1) { dateString = `Morgen (${dateString})`; }
        const button = document.createElement('button');
        button.className = 'date-select-btn';
        button.dataset.date = dateKey;
        button.textContent = dateString;
        dateSelectionList.appendChild(button);
    }
};

// --- Funktion: Startet die Listenerstellung (KORREKT) ---
const generateList = () => {
    if (!currentUser) return;
    const selectedButtons = dateSelectionList.querySelectorAll('.date-select-btn.active');
    const selectedDates = Array.from(selectedButtons).map(btn => btn.dataset.date);
    
    if (selectedDates.length === 0) {
        listMessage.textContent = "Bitte wähle mindestens einen Tag aus."; 
        resultsList.innerHTML = ''; 
        return;
    }
    
    selectedDates.sort();
    const startDate = selectedDates[0];
    const endDate = selectedDates[selectedDates.length - 1];
    
    console.log(`[TEST] Sende an Server: startDate=${startDate}, endDate=${endDate}`);
    
    try { localStorage.removeItem('savedCheckedItems'); } catch (e) { console.error("Fehler Löschen 'checked' Status:", e); }
    listMessage.textContent = "Wir erstellen ihre Einkaufsliste";
    resultsList.innerHTML = '';

    callGetShoppingList(startDate, endDate);
    
    dateSelectorContainer.classList.add('collapsed');
    generateBtn.style.display = 'none';
    editDatesBtn.style.display = 'block';
};

// --- Funktion zum Bearbeiten der Tage ---
const editDates = () => {
    dateSelectorContainer.classList.remove('collapsed');
    generateBtn.style.display = 'block';
    editDatesBtn.style.display = 'none';
    resultsList.innerHTML = '';
    listMessage.textContent = '';
    try {
        localStorage.removeItem('savedShoppingList');
        localStorage.removeItem('savedListMessage');
        localStorage.removeItem('savedCheckedItems');
        console.log("Gespeicherte Liste und Häkchen entfernt.");
    } catch (e) { console.error("Fehler beim Löschen aus localStorage:", e); }
};

// --- Funktion, die die Cloud Function aufruft (KORREKT) ---
const callGetShoppingList = async (startDate, endDate) => {
    console.log("[TEST 3] Rufe Cloud Function 'getShoppingList' auf...");
    try {
        const getShoppingListFunction = functions.httpsCallable('getShoppingList');
        
        const result = await getShoppingListFunction({ 
            startDate: startDate, 
            endDate: endDate 
        });
        
        const categories = result.data.categories; 
        console.log("[TEST 7] Antwort vom Server (kategorisiert):", categories);
        
        displayShoppingList(categories); 

    } catch (error) {
        console.error("Fehler beim Aufruf der Cloud Function:", error);
        listMessage.textContent = `Fehler beim Aufruf der Cloud Function: ${error.message}`;
    }
};

// --- Funktion zur Anzeige der finalen Liste (JETZT MIT INFO-BUTTON-DATEN) ---
const displayShoppingList = (categories, message) => {
    console.log("[TEST 8] 'displayShoppingList' wird aufgerufen (Akkordeon-Version).");
    if (!resultsList || !listMessage) return;
    resultsList.innerHTML = '';
    
    if (!categories || Object.keys(categories).length === 0) {
        listMessage.textContent = message || "Keine Zutaten in den ausgewählten Rezepten gefunden.";
        return;
    }

    let totalIngredients = 0;
    
    let savedCheckedItems = [];
    try { const saved = localStorage.getItem('savedCheckedItems'); if (saved) { savedCheckedItems = JSON.parse(saved); } }
    catch (e) { console.error("Fehler Laden Check-Status:", e); }

    const categoryNames = Object.keys(categories).sort();

    for (const categoryName of categoryNames) {
        const ingredients = categories[categoryName];
        if (ingredients.length > 0) {
            totalIngredients += ingredients.length;
            
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-section'; 
            
            // Header (Standardmäßig GEÖFFNET)
            const header = document.createElement('div');
            header.className = 'category-header';
            header.innerHTML = `
                <h3>${categoryName}</h3>
                <span class="category-toggle-icon rotated">▼</span>
            `;
            
            // Content (Standardmäßig GEÖFFNET)
            const content = document.createElement('div');
            content.className = 'category-content open'; 
            
            const randomId = (text) => `item-${text.replace(/[^a-zA-Z0-9]/g, '-')}-${Math.floor(Math.random() * 10000)}`;

            let itemsHtml = ingredients.map(item => {
                const itemId = randomId(item.fullName);
                const isChecked = savedCheckedItems.includes(item.fullName);
                
                // --- NEU: Info-Button HTML ---
                // Wir speichern die Daten im Button, um sie beim Klick zu lesen
                // Wir nutzen '|' als Trennzeichen für die Rezept-Liste
                const infoBtnHtml = `
                    <button class="info-trigger-btn" 
                            data-ingredient="${item.fullName}" 
                            data-sources="${item.sources.join('|')}">
                        i
                    </button>
                `;
                // --- ENDE NEU ---
                
                return `
                <li class="shopping-list-item ${isChecked ? 'checked' : ''}" data-full-name="${item.fullName}">
                    <input type="checkbox" id="${itemId}" name="${item.fullName}" ${isChecked ? 'checked' : ''}>
                    <label for="${itemId}">${item.fullName}</label>
                    ${infoBtnHtml}
                </li>
            `}).join('');

            content.innerHTML = `<ul class="shopping-list-ul">${itemsHtml}</ul>`;
            
            categoryDiv.appendChild(header);
            categoryDiv.appendChild(content);
            resultsList.appendChild(categoryDiv);
        }
    }
    
    const messageText = message || `Insgesamt ${totalIngredients} Zutaten-Einträge gefunden:`;
    listMessage.textContent = messageText;

    try {
        localStorage.setItem('savedShoppingList', JSON.stringify(categories)); 
        localStorage.setItem('savedListMessage', messageText);
        console.log("Liste im localStorage gespeichert.");
    } catch (e) { console.error("Fehler Speichern localStorage:", e); }
};

// --- Funktion zum Laden der Liste aus dem Storage ---
const loadListFromStorage = () => {
    try {
        const savedList = localStorage.getItem('savedShoppingList');
        const savedMessage = localStorage.getItem('savedListMessage');
        if (savedList && savedMessage) {
            console.log("Gespeicherte Einkaufsliste gefunden.");
            const categories = JSON.parse(savedList); 
            
            displayShoppingList(categories, savedMessage); 
            
            dateSelectorContainer.classList.add('collapsed');
            generateBtn.style.display = 'none';
            editDatesBtn.style.display = 'block';
            return true; // Wichtig für den Bugfix
        }
    } catch (e) {
        console.error("Fehler Laden aus localStorage:", e);
        localStorage.removeItem('savedShoppingList');
        localStorage.removeItem('savedListMessage');
        localStorage.removeItem('savedCheckedItems');
    }
    console.log("Keine gespeicherte Liste gefunden.");
    return false; // Wichtig für den Bugfix
};

// --- Funktion zum Speichern des "Abgehakt"-Status (KORRIGIERT) ---
const saveCheckedState = () => {
    if (!resultsList) return;
    const checkedItems = [];
    // Finde die 'checked' KLASSE
    const allItems = resultsList.querySelectorAll('li.shopping-list-item.checked'); 
    allItems.forEach(li => {
        // Speichere den 'fullName' aus dem data-Attribut, nicht den TextContent
        if (li.dataset.fullName) {
            checkedItems.push(li.dataset.fullName); 
        }
    });
    try {
        localStorage.setItem('savedCheckedItems', JSON.stringify(checkedItems));
        console.log("Abgehakt-Status gespeichert:", checkedItems);
    } catch (e) {
        console.error("Fehler Speichern Check-Status:", e);
    }
};

// --- Hilfsfunktion für LOKALES Datum ---
function getLocalDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);