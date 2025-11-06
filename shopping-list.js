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

// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => {
    if (loader) loader.style.display = 'none';
    if (navbar) navbar.classList.remove('content-hidden');
    if (mainContent) mainContent.classList.remove('content-hidden');
};

// --- Initialisierung ---
const init = () => {
    console.log("Shopping List Init Start");
    
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
    // --- ENDE DOM-Elemente holen ---

    // Sicherheitscheck
    if (!dateSelectionList || !generateBtn || !resultsList || !listMessage || !dateSelectorContainer || !editDatesBtn || !loader) {
        console.error("FEHLER: Wichtige HTML-Elemente für Einkaufsliste fehlen!");
        return;
    }

    // Auth Wächter
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log("Shopping List: Nutzer eingeloggt.");
            showContent();
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

    // Klick-Listener für das Abhaken von Zutaten
    if (resultsList) {
        resultsList.addEventListener('click', (e) => {
            if (e.target && e.target.tagName === 'LI') {
                e.target.classList.toggle('checked-off');
                saveCheckedState();
            }
        });
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

// --- Funktion: Startet die Listenerstellung ---
const generateList = () => {
    if (!currentUser) return;
    const selectedButtons = dateSelectionList.querySelectorAll('.date-select-btn.active');
    const selectedDates = Array.from(selectedButtons).map(btn => btn.dataset.date);
    if (selectedDates.length === 0) {
        listMessage.textContent = "Bitte wähle mindestens einen Tag aus."; resultsList.innerHTML = ''; return;
    }
    try { localStorage.removeItem('savedCheckedItems'); } catch (e) { console.error("Fehler Löschen 'checked' Status:", e); }
    listMessage.textContent = "Liste wird erstellt... (Server rechnet 🧠)";
    resultsList.innerHTML = '';
    console.log("[TEST] Tage ausgewählt:", selectedDates);

    // Rufe die Cloud Function auf
    callGetShoppingList(selectedDates);
    
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

// --- Funktion, die die Cloud Function aufruft (ANGEPASST) ---
const callGetShoppingList = async (dates) => {
    console.log("[TEST 3] Rufe Cloud Function 'getShoppingList' auf...");
    try {
        const getShoppingListFunction = functions.httpsCallable('getShoppingList');
        const result = await getShoppingListFunction({ dates: dates });
        
        // --- ÄNDERUNG HIER ---
        // Empfange das 'categories'-Objekt statt 'ingredients'-Array
        const categories = result.data.categories; 
        
        console.log("[TEST 7] Antwort vom Server (kategorisiert):", categories);
        
        // Zeige die kategorisierte Liste an
        displayShoppingList(categories); 
        // --- ENDE ÄNDERUNG ---

    } catch (error) {
        console.error("Fehler beim Aufruf der Cloud Function:", error);
        listMessage.textContent = `Fehler: ${error.message}`;
    }
};

// --- Funktion zur Anzeige der finalen Liste (ANGEPASST FÜR KATEGORIEN) ---
const displayShoppingList = (categories, message) => {
    console.log("[TEST 8] 'displayShoppingList' wird aufgerufen.");
    if (!resultsList || !listMessage) return;
    resultsList.innerHTML = '';
    
    // Prüfen, ob das Objekt leer ist
    if (!categories || Object.keys(categories).length === 0) {
        listMessage.textContent = message || "Keine Zutaten in den ausgewählten Rezepten gefunden.";
        return;
    }

    let totalIngredients = 0;
    
    // Gespeicherten "abgehakt"-Status laden
    let savedCheckedItems = [];
    try { const saved = localStorage.getItem('savedCheckedItems'); if (saved) { savedCheckedItems = JSON.parse(saved); } }
    catch (e) { console.error("Fehler Laden Check-Status:", e); }

    // --- NEUE LOGIK: Durch Kategorien iterieren ---
    // Kategorien sortieren (z.B. "Backzutaten", "Obst & Gemüse", ...)
    const categoryNames = Object.keys(categories).sort();

    for (const categoryName of categoryNames) {
        const ingredients = categories[categoryName];
        if (ingredients.length > 0) {
            // Kategorie-Überschrift erstellen
            const categoryHeader = document.createElement('h4');
            categoryHeader.className = 'shopping-list-category-title';
            categoryHeader.textContent = categoryName;
            resultsList.appendChild(categoryHeader);

            // Zutaten für diese Kategorie (sind schon sortiert vom Server)
            ingredients.forEach(ingredient => {
                totalIngredients++;
                const li = document.createElement('li');
                li.textContent = ingredient; // z.B. "300 g Mehl"
                if (savedCheckedItems.includes(ingredient)) {
                    li.classList.add('checked-off');
                }
                resultsList.appendChild(li);
            });
        }
    }
    // --- ENDE NEUE LOGIK ---
    
    const messageText = message || `Insgesamt ${totalIngredients} Zutaten-Einträge gefunden:`;
    listMessage.textContent = messageText;

    // Liste im localStorage speichern
    try {
        localStorage.setItem('savedShoppingList', JSON.stringify(categories)); // Speichert das Kategorie-Objekt
        localStorage.setItem('savedListMessage', messageText);
        console.log("Liste im localStorage gespeichert.");
    } catch (e) { console.error("Fehler Speichern localStorage:", e); }
};

// --- Funktion zum Laden der Liste aus dem Storage (ANGEPASST FÜR KATEGORIEN) ---
const loadListFromStorage = () => {
    try {
        const savedList = localStorage.getItem('savedShoppingList');
        const savedMessage = localStorage.getItem('savedListMessage');
        if (savedList && savedMessage) {
            console.log("Gespeicherte Einkaufsliste gefunden.");
            const categories = JSON.parse(savedList); // Ist jetzt ein Objekt
            
            displayShoppingList(categories, savedMessage); // Zeigt die kategorisierte Liste an
            
            dateSelectorContainer.classList.add('collapsed');
            generateBtn.style.display = 'none';
            editDatesBtn.style.display = 'block';
            return true;
        }
    } catch (e) {
        console.error("Fehler Laden aus localStorage:", e);
        // Aufräumen
        localStorage.removeItem('savedShoppingList');
        localStorage.removeItem('savedListMessage');
        localStorage.removeItem('savedCheckedItems');
    }
    console.log("Keine gespeicherte Liste gefunden.");
    return false;
};

// --- Funktion zum Speichern des "Abgehakt"-Status ---
const saveCheckedState = () => {
    if (!resultsList) return;
    const checkedItems = [];
    const allItems = resultsList.querySelectorAll('li.checked-off');
    allItems.forEach(li => {
        checkedItems.push(li.textContent);
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