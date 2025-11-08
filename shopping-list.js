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
// Info-Modal Elemente
let infoModal, infoModalCloseBtn, infoModalTitle, infoModalList;
// Add-Item Modal Elemente
let btnOpenAddItemModal, addItemModal, addItemCloseBtn, addItemForm, addItemInput;
// NEU: Druck-Knopf
let btnPrintList;


// --- Hilfsfunktion für IDs ---
const getRandomId = (text) => `item-${text.replace(/[^a-zA-Z0-9]/g, '-')}-${Math.floor(Math.random() * 10000)}`;

// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => {
    if (loader) loader.style.display = 'none';
    if (navbar) navbar.classList.remove('content-hidden');
    if (mainContent) mainContent.classList.remove('content-hidden');
    
    // Zeige den "Plus"-Knopf nur, wenn die Liste geladen ist
    if (btnOpenAddItemModal) btnOpenAddItemModal.classList.remove('content-hidden');
};

// --- Initialisierung ---
const init = () => {
    console.log("Shopping List Init Start (Version 47 - Print Button)");
    
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
    // Info-Modal Elemente
    infoModal = document.getElementById('info-modal');
    infoModalCloseBtn = document.getElementById('info-modal-close-btn');
    infoModalTitle = document.getElementById('info-modal-title');
    infoModalList = document.getElementById('info-modal-list');
    // Add-Item Modal Elemente
    btnOpenAddItemModal = document.getElementById('btn-open-add-item-modal');
    addItemModal = document.getElementById('add-item-modal');
    addItemCloseBtn = document.getElementById('add-item-close-btn');
    addItemForm = document.getElementById('add-item-form');
    addItemInput = document.getElementById('add-item-input');
    // NEU: Druck-Knopf
    btnPrintList = document.getElementById('btn-print-list');
    // --- ENDE DOM-Elemente holen ---

    // Sicherheitscheck (erweitert)
    if (!dateSelectionList || !generateBtn || !resultsList || !listMessage || !dateSelectorContainer || !editDatesBtn || !loader || !infoModal || !btnOpenAddItemModal || !addItemModal || !btnPrintList) {
        console.error("FEHLER: Wichtige HTML-Elemente für Einkaufsliste fehlen!");
        return;
    }
    
    // "Plus"-Knopf am Anfang verstecken
    btnOpenAddItemModal.classList.add('content-hidden');

    // Auth Wächter
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log("Shopping List: Nutzer eingeloggt.");
            showContent();
            
            // Immer Tage erstellen, dann laden
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
    // NEU: Druck-Knopf Listener
    if (btnPrintList) btnPrintList.addEventListener('click', () => window.print());

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

            // Fall 2: Klick auf das Info-Symbol -> Modal öffnen
            const infoBtn = target.closest('.info-trigger-btn');
            if (infoBtn) {
                e.preventDefault();
                const ingredientName = infoBtn.dataset.ingredient;
                // Nur ausführen, wenn sources vorhanden (custom items haben das nicht)
                if (infoBtn.dataset.sources) {
                    const sources = infoBtn.dataset.sources.split('|'); // Array zurückholen
                    openInfoModal(ingredientName, sources);
                }
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
    
    // Listener zum Schließen des Info-Modals
    if (infoModalCloseBtn) infoModalCloseBtn.addEventListener('click', closeInfoModal);
    if (infoModal) infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) { // Klick auf den Overlay-Hintergrund
            closeInfoModal();
        }
    });
    
    // Listener für das Add-Item-Modal
    if (btnOpenAddItemModal) btnOpenAddItemModal.addEventListener('click', openAddItemModal);
    if (addItemCloseBtn) addItemCloseBtn.addEventListener('click', closeAddItemModal);
    if (addItemModal) addItemModal.addEventListener('click', (e) => {
        if (e.target === addItemModal) { // Klick auf den Overlay-Hintergrund
            closeAddItemModal();
        }
    });
    if (addItemForm) addItemForm.addEventListener('submit', handleAddItemSubmit);
};

// --- Info-Modal steuern ---
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

// --- Add-Item-Modal steuern ---
const openAddItemModal = () => {
    if (addItemModal) addItemModal.classList.remove('modal-hidden');
    if (addItemInput) {
        addItemInput.value = ''; // Eingabefeld leeren
        addItemInput.focus(); // Fokus auf das Eingabefeld
    }
};

const closeAddItemModal = () => {
    if (addItemModal) addItemModal.classList.add('modal-hidden');
};

// --- Item aus Pop-up hinzufügen ---
const handleAddItemSubmit = (e) => {
    e.preventDefault(); // Formular-Neuladen verhindern
    if (!addItemInput) return;
    
    const itemName = addItemInput.value.trim();
    if (itemName) {
        addCustomItemToList(itemName); // Hauptlogik
        closeAddItemModal();
    }
};

// --- Logik, um Item zur "Sonstiges"-Kategorie hinzuzufügen ---
const addCustomItemToList = (itemName) => {
    if (!resultsList) return;

    // 1. Lade die AKTUELLE Liste (inkl. generierter Items)
    let categories = loadCategoriesFromStorage();
    
    // 2. Erstelle oder finde die "Sonstiges"-Kategorie
    if (!categories["Sonstiges"]) {
        categories["Sonstiges"] = [];
        console.log("Erstelle 'Sonstiges'-Kategorie im Objekt.");
    }

    // 3. Füge das neue Item hinzu (mit 'sources'-Attribut für Kompatibilität)
    const newItem = {
        fullName: itemName,
        sources: ["(Selbst hinzugefügt)"] // Platzhalter
    };
    
    // Füge es AN DEN ANFANG der "Sonstiges"-Liste hinzu
    categories["Sonstiges"].unshift(newItem);

    // 4. Zeige die (jetzt modifizierte) Liste an.
    displayShoppingList(categories); 
    
    // 5. (Optional) Scrolle zur "Sonstiges"-Kategorie
    const categorySection = resultsList.querySelector(`[data-category="Sonstiges"]`);
    if (categorySection) {
        // Stelle sicher, dass sie offen ist
        categorySection.querySelector('.category-content').classList.add('open');
        categorySection.querySelector('.category-toggle-icon').classList.add('rotated');
    }
};


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
    if(btnPrintList) btnPrintList.style.display = 'none'; // Druck-Knopf verstecken
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
        
        // Rufe displayShoppingList auf. Diese speichert die Liste automatisch.
        displayShoppingList(categories); 

    } catch (error) {
        console.error("Fehler beim Aufruf der Cloud Function:", error);
        listMessage.textContent = `Fehler beim Aufruf der Cloud Function: ${error.message}`;
    }
};

// --- Funktion zur Anzeige der finalen Liste (SPEICHERT JETZT IMMER) ---
const displayShoppingList = (categories, customMessage = null) => {
    console.log("[TEST 8] 'displayShoppingList' wird aufgerufen.");
    if (!resultsList || !listMessage || !btnPrintList) return;
    resultsList.innerHTML = '';
    
    if (!categories || Object.keys(categories).length === 0) {
        listMessage.textContent = customMessage || "Keine Zutaten in den ausgewählten Rezepten gefunden.";
        btnPrintList.style.display = 'none'; // Druck-Knopf verstecken
        // Speichere auch den leeren Zustand!
        saveCategoriesToStorage({}, customMessage || "Keine Zutaten gefunden.");
        return;
    }

    let totalIngredients = 0;
    
    let savedCheckedItems = [];
    try { const saved = localStorage.getItem('savedCheckedItems'); if (saved) { savedCheckedItems = JSON.parse(saved); } }
    catch (e) { console.error("Fehler Laden Check-Status:", e); }

    const categoryNames = Object.keys(categories).sort();
    
    // Verschiebe "Sonstiges" ans Ende, falls es existiert
    if (categoryNames.includes("Sonstiges")) {
        categoryNames.splice(categoryNames.indexOf("Sonstiges"), 1);
        categoryNames.push("Sonstiges");
    }

    for (const categoryName of categoryNames) {
        const ingredients = categories[categoryName];
        if (ingredients && ingredients.length > 0) {
            totalIngredients += ingredients.length;
            
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-section'; 
            categoryDiv.dataset.category = categoryName; 
            
            const header = document.createElement('div');
            header.className = 'category-header';
            header.innerHTML = `
                <h3>${categoryName}</h3>
                <span class="category-toggle-icon rotated">▼</span>
            `;
            
            const content = document.createElement('div');
            content.className = 'category-content open'; 
            
            let itemsHtml = ingredients.map(item => {
                const itemId = getRandomId(item.fullName);
                const isChecked = savedCheckedItems.includes(item.fullName);
                
                let infoBtnHtml = '';
                // Zeige Info-Knopf nur, wenn 'sources' existiert UND nicht der Platzhalter ist
                if (item.sources && item.sources.length > 0 && item.sources[0] !== "(Selbst hinzugefügt)") {
                    infoBtnHtml = `
                        <button class="info-trigger-btn" 
                                data-ingredient="${item.fullName}" 
                                data-sources="${item.sources.join('|')}">
                            i
                        </button>
                    `;
                }
                
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
    
    // BERECHNE NACHRICHT NEU (wichtig für custom items)
    const messageText = customMessage || `Insgesamt ${totalIngredients} Zutaten-Einträge gefunden:`;
    listMessage.textContent = messageText;

    // Zeige den Druck-Knopf, da wir eine Liste haben
    btnPrintList.style.display = 'block';

    // SPEICHERE ALLES (neue Liste UND neue Nachricht)
    saveCategoriesToStorage(categories, messageText);
};

// --- Funktion zum Laden der Liste aus dem Storage ---
const loadListFromStorage = () => {
    if (!btnPrintList) return false;
    try {
        const categories = loadCategoriesFromStorage();
        const savedMessage = localStorage.getItem('savedListMessage');
        
        if (savedMessage) { 
            console.log("Gespeicherte Einkaufsliste gefunden.");
            
            displayShoppingList(categories, savedMessage); 
            
            dateSelectorContainer.classList.add('collapsed');
            generateBtn.style.display = 'none';
            editDatesBtn.style.display = 'block';
            
            // Stelle sicher, dass der Druck-Knopf angezeigt wird, wenn die Liste nicht leer ist
            if (Object.keys(categories).length > 0) {
                btnPrintList.style.display = 'block';
            }
            
            return true;
        }
    } catch (e) {
        console.error("Fehler Laden aus localStorage:", e);
        localStorage.removeItem('savedShoppingList');
        localStorage.removeItem('savedListMessage');
        localStorage.removeItem('savedCheckedItems');
    }
    
    console.log("Keine gespeicherte Liste gefunden.");
    btnPrintList.style.display = 'none'; // Verstecke Druck-Knopf
    return false;
};

// --- NEUE Storage Helper-Funktionen ---
const loadCategoriesFromStorage = () => {
    try {
        const savedList = localStorage.getItem('savedShoppingList');
        if (savedList) {
            return JSON.parse(savedList);
        }
    } catch (e) {
        console.error("Fehler Laden der Kategorien aus Storage:", e);
        return {};
    }
    return {}; // Standard-Rückgabe
};

const saveCategoriesToStorage = (categories, message) => {
    try {
        localStorage.setItem('savedShoppingList', JSON.stringify(categories)); 
        if (message) {
            localStorage.setItem('savedListMessage', message);
        }
        console.log("Liste im localStorage gespeichert.");
    } catch (e) { console.error("Fehler Speichern localStorage:", e); }
};
// --- ENDE Storage Helper ---


// --- Funktion zum Speichern des "Abgehakt"-Status (KORRIGIERT) ---
const saveCheckedState = () => {
    if (!resultsList) return;
    const checkedItems = [];
    const allItems = resultsList.querySelectorAll('li.shopping-list-item.checked'); 
    allItems.forEach(li => {
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