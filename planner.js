import { auth, db } from './firebase-config.js';

// --- Globale Variablen ---
let currentUser;
let allUserRecipes = []; // Enthält {id, title, imageUrl, cookbookId}
let allUserCookbooks = []; // Enthält {id, title}
let plannedMeals = {}; // Speichert geladene Pläne { "YYYY-MM-DD": { ... } }
let plannerListener = null; // Echtzeit-Listener
let currentWeekStartDate = getMonday(new Date());

// Variablen für den Planungs-Workflow
let currentTargetDate = null;
let tempSelectedRecipe = null;
let selectedCookbookId = 'all'; // Filter für das Modal

// --- START: NEUE Emoji-Funktion ---
const PLACEHOLDER_EMOJIS = ['🍽️', '🍳', '🥣', '🥗', '🍲', '🥑']; 
const getRandomPlaceholder = () => {
    // Wählt ein zufälliges Emoji aus der Liste
    return PLACEHOLDER_EMOJIS[Math.floor(Math.random() * PLACEHOLDER_EMOJIS.length)];
};
// --- ENDE: NEUE Emoji-Funktion ---

// --- DOM-Elemente holen ---
const loader = document.getElementById('loader');
const navbar = document.querySelector('.navbar');
const mainContent = document.querySelector('.main-content');
let plannerGrid;
// Modal 1 (Rezeptauswahl)
let selectRecipeModal;
let selectRecipeCloseBtn;
let recipeSelectList;
let selectRecipeTitle;
let recipeSearchInput;
let cookbookFilterList;
// Modal 2 (Mahlzeit-Auswahl)
let mealTypeModal;
let mealTypeCloseBtn;
let mealTypeOptions;
// Wochen-Navigation
let prevWeekBtn;
let nextWeekBtn;
let weekDisplay;

// --- Hilfsfunktion: Finde den Montag ---
function getMonday(d) {
  d = new Date(d); const day = d.getDay() || 7; // So=0, Mo=1... Sa=6 -> So=7
  if (day !== 1) d.setHours(-24 * (day - 1)); // Gehe zurück zum Montag
  d.setHours(0, 0, 0, 0); return d; // Setze auf Mitternacht
}

// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => {
    if (loader) loader.style.display = 'none';
    if (navbar) navbar.classList.remove('content-hidden');
    if (mainContent) mainContent.classList.remove('content-hidden');
};

// --- Initialisierung ---
const init = () => {
    console.log("Planner Init Start (NEUE VERSION)");
    // Elemente holen
    plannerGrid = document.getElementById('planner-grid');
    selectRecipeModal = document.getElementById('select-recipe-modal');
    selectRecipeCloseBtn = document.getElementById('select-recipe-close-btn');
    recipeSelectList = document.getElementById('recipe-select-list');
    selectRecipeTitle = document.getElementById('select-recipe-title');
    recipeSearchInput = document.getElementById('recipe-search-input');
    cookbookFilterList = document.getElementById('cookbook-filter-list');
    prevWeekBtn = document.getElementById('btn-prev-week');
    nextWeekBtn = document.getElementById('btn-next-week');
    weekDisplay = document.getElementById('week-display');
    mealTypeModal = document.getElementById('meal-type-modal');
    mealTypeCloseBtn = document.getElementById('meal-type-close-btn');
    mealTypeOptions = mealTypeModal.querySelector('.meal-type-options');

    // Sicherheitscheck
    if (!plannerGrid || !selectRecipeModal || !mealTypeModal || !mealTypeCloseBtn || !mealTypeOptions || !recipeSelectList || !selectRecipeTitle || !recipeSearchInput || !prevWeekBtn || !nextWeekBtn || !weekDisplay || !cookbookFilterList) {
        console.error("FEHLER: Wichtige HTML-Elemente fehlen!");
        return;
    }

    // Auth Wächter
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            showContent(); // Inhalt SOFORT anzeigen
            try {
                // Lade ALLE Rezepte (eigene & geteilte)
                await loadCookbooksAndRecipes(); 
                displayCookbookFilters(); // Zeige Filter-Buttons an
                displayCurrentWeek(); // Startet Anzeige & Listener für Pläne
            } catch (error) { 
                console.error("FEHLER beim Laden von Rezepten/Kochbüchern:", error); 
                displayCurrentWeek(); // Zeige trotzdem den Kalender an
            }
        } else {
            if (plannerListener) plannerListener(); // Listener trennen
            plannedMeals = {}; currentUser = null;
            window.location.href = 'index.html';
        }
    });

     // Event Listeners Grid (für "Hinzufügen" und "Löschen")
     if (plannerGrid) {
        plannerGrid.addEventListener('click', (e) => {
            // Klick auf "Rezept hinzufügen +"
            const addButton = e.target.closest('.add-recipe-to-day-btn-main');
            if (addButton) {
                if (addButton.closest('.past-day')) { return; }
                const date = addButton.dataset.date;
                const dateString = addButton.closest('.planner-day').querySelector('h3').textContent;
                openSelectRecipeModal(date, dateString);
                return;
            }
            // Klick auf "x" (Löschen)
            const removeButton = e.target.closest('.remove-planned');
             if (removeButton) {
                 const planId = removeButton.dataset.planId;
                 const date = removeButton.closest('.planner-day').dataset.date;
                 const mealType = removeButton.closest('.meal-slot').dataset.mealType;
                 removePlannedRecipe(date, mealType, planId);
                 return;
             }
        });
     }

     // Event Listeners Modal 1 (Rezeptauswahl)
     if (selectRecipeCloseBtn) { selectRecipeCloseBtn.addEventListener('click', closeSelectRecipeModal); }
     if (selectRecipeModal) {
         selectRecipeModal.addEventListener('click', (e) => {
             // Klick auf Hintergrund
             if (e.target === selectRecipeModal) { closeSelectRecipeModal(); return; }
             // Klick auf ein Rezept in der Liste
             const selectedItem = e.target.closest('.recipe-select-item');
             if (selectedItem) {
                 const recipeId = selectedItem.dataset.recipeId;
                 const selectedRecipe = allUserRecipes.find(r => r.id === recipeId);
                 if (selectedRecipe) {
                     tempSelectedRecipe = selectedRecipe; // Rezept zwischenspeichern
                     console.log("Rezept zwischengespeichert:", tempSelectedRecipe.title);
                     closeSelectRecipeModal();
                     openMealTypeModal(); // Modal 2 öffnen
                 }
             }
         });
     }
     
     // Event Listeners Modal 2 (Mahlzeit-Auswahl)
     if (mealTypeCloseBtn) { mealTypeCloseBtn.addEventListener('click', closeMealTypeModal); }
     if (mealTypeOptions) {
         mealTypeOptions.addEventListener('click', (e) => {
             const mealButton = e.target.closest('.meal-type-btn');
             if (mealButton) {
                 const mealType = mealButton.dataset.mealType;
                 console.log(`Mahlzeit ${mealType} ausgewählt.`);
                 // Rezept jetzt final planen
                 planRecipe(currentTargetDate, mealType, tempSelectedRecipe);
                 closeMealTypeModal();
             }
         });
     }
     if (mealTypeModal) { mealTypeModal.addEventListener('click', (e) => { if (e.target === mealTypeModal) closeMealTypeModal(); }); }

     // Suche & Filter
     if (recipeSearchInput) { recipeSearchInput.addEventListener('input', updateRecipeListInModal); }
     if (cookbookFilterList) {
         cookbookFilterList.addEventListener('click', (e) => {
             const filterButton = e.target.closest('.filter-btn');
             if (filterButton) {
                 const newCookbookId = filterButton.dataset.cookbookId;
                 if (newCookbookId !== selectedCookbookId) {
                     selectedCookbookId = newCookbookId;
                     console.log("Neuer Filter ausgewählt:", selectedCookbookId);
                     document.querySelectorAll('#cookbook-filter-list .filter-btn').forEach(btn => {
                         btn.classList.toggle('active', btn.dataset.cookbookId === selectedCookbookId);
                     });
                     updateRecipeListInModal(); // Rezeptliste im Modal neu filtern
                 }
             }
         });
     }
     
     // Wochennavigation
     if (prevWeekBtn) prevWeekBtn.addEventListener('click', showPreviousWeek);
     if (nextWeekBtn) nextWeekBtn.addEventListener('click', showNextWeek);
};

// --- Hauptfunktion zum Anzeigen/Aktualisieren der Woche ---
const displayCurrentWeek = () => {
    if (!currentWeekStartDate) { console.error("FEHLER: Startdatum fehlt!"); return; }
    displayPlannerDays(); // HTML-Grid für die 7 Tage erstellen
    listenToPlannedRecipesForWeek(); // Echtzeit-Listener für Pläne starten
};

// --- Navigationsfunktionen ---
const showPreviousWeek = () => {
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() - 7);
    displayCurrentWeek();
};
const showNextWeek = () => {
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() + 7);
    displayCurrentWeek();
};

// --- Funktion zum Anzeigen der Tage ---
const displayPlannerDays = () => {
    if (!plannerGrid || !weekDisplay) { console.error("FEHLER: Grid oder WeekDisplay fehlt!"); return; }
    
    plannerGrid.innerHTML = '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(currentWeekStartDate);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const options = { day: 'numeric', month: 'short' };
    weekDisplay.textContent = `Woche: ${weekStart.toLocaleDateString('de-DE', options)} - ${weekEnd.toLocaleDateString('de-DE', options)}`;

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStart); currentDate.setDate(weekStart.getDate() + i);
        const dateString = currentDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'numeric' });
        const dateKey = getLocalDateKey(currentDate); // Format: "YYYY-MM-DD"
        
        const dayDiv = document.createElement('div'); 
        dayDiv.className = 'planner-day'; 
        dayDiv.dataset.date = dateKey;
        if (currentDate < today) { dayDiv.classList.add('past-day'); }

        dayDiv.innerHTML = `
            <h3>${dateString}</h3>
            <div class="meal-slots-container" id="slots-container-${dateKey}"></div> 
            <button class="add-recipe-to-day-btn-main" data-date="${dateKey}">Rezept hinzufügen +</button>
        `;
        plannerGrid.appendChild(dayDiv);
        
        // Zeige bereits geladene Pläne für diesen Tag (falls vorhanden)
        displayPlannedRecipesForDay(dateKey); 
    }
};

// --- Lädt Kochbücher UND Rezepte (STARK GEÄNDERT) ---
const loadCookbooksAndRecipes = async () => {
    console.log("   -> Lade alle Kochbücher und Rezepte (NEUE METHODE)");
    if (!currentUser) { return Promise.reject("Kein Nutzer"); }
    
    allUserCookbooks = []; 
    allUserRecipes = [];
    
    try {
        // 1. Finde alle Kochbücher (eigene & geteilte)
        const cookbookSnapshot = await db.collection('cookbooks')
            .where(`members.${currentUser.uid}`, 'in', ['owner', 'editor'])
            .get();

        console.log("      Gefundene Kochbücher:", cookbookSnapshot.size);
        
        const recipeLoadPromises = [];
        
        // 2. Gehe jedes Kochbuch durch
        cookbookSnapshot.forEach(cookbookDoc => {
            allUserCookbooks.push({ 
                id: cookbookDoc.id, 
                title: cookbookDoc.data().title || 'Unbenannt' 
            });
            
            // 3. Erstelle ein Versprechen (Promise), um ALLE Rezepte aus diesem Kochbuch zu laden
            const recipePromise = db.collection('cookbooks').doc(cookbookDoc.id)
                .collection('recipes').get()
                .then(recipeSnapshot => {
                    const recipesFromThisBook = [];
                    recipeSnapshot.forEach(recipeDoc => {
                        const data = recipeDoc.data();
                        recipesFromThisBook.push({
                            id: recipeDoc.id, 
                            title: data.title || 'Unbenannt', 
                            imageUrl: data.imageUrl || null, 
                            cookbookId: cookbookDoc.id // Wichtig für die Planung!
                        });
                    });
                    return recipesFromThisBook;
                }).catch(err => { 
                    console.error(`Fehler beim Laden der Rezepte für Kochbuch ${cookbookDoc.id}:`, err); 
                    return []; // Bei Fehler leeres Array zurückgeben
                });
            
            recipeLoadPromises.push(recipePromise);
        });

        // Sortiere Kochbücher alphabetisch für die Filter-Liste
        allUserCookbooks.sort((a, b) => a.title.localeCompare(b.title));
        
        // 4. Warte, bis ALLE Rezepte aus ALLEN Kochbüchern geladen sind
        const results = await Promise.all(recipeLoadPromises);
        allUserRecipes = results.flat(); // Füge alle Rezept-Arrays zu einem großen Array zusammen
        
        // Sortiere Rezepte alphabetisch für die Anzeige im Modal
        allUserRecipes.sort((a, b) => a.title.localeCompare(b.title));
        
        console.log(`   -> Laden ERFOLGREICH: ${allUserCookbooks.length} Kochbücher, ${allUserRecipes.length} Rezepte`);
        
    } catch (error) { 
        console.error("Fehler beim Laden von Kochbüchern & Rezepten:", error); 
        alert("Ein Fehler ist beim Laden deiner Rezepte aufgetreten.");
        return Promise.reject(error); 
    }
};

// --- Zeigt die Kochbuch-Filterbuttons an (unverändert) ---
const displayCookbookFilters = () => {
    if (!cookbookFilterList) return;
    cookbookFilterList.innerHTML = '';
    
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active'; 
    allBtn.dataset.cookbookId = 'all'; 
    allBtn.textContent = 'Alle';
    cookbookFilterList.appendChild(allBtn);
    
    allUserCookbooks.forEach(book => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn'; 
        btn.dataset.cookbookId = book.id; 
        btn.textContent = book.title;
        cookbookFilterList.appendChild(btn);
    });
};

// --- Funktionen für Auswahl-Modal 1 (unverändert) ---
const openSelectRecipeModal = (date, dateString) => {
    if (!selectRecipeModal || !selectRecipeTitle || !recipeSearchInput || !cookbookFilterList) return;
    currentTargetDate = date;
    selectRecipeTitle.textContent = `Rezept auswählen für ${dateString}`;
    recipeSearchInput.value = '';
    
    // Setze Filter auf "Alle" zurück
    selectedCookbookId = 'all';
    document.querySelectorAll('#cookbook-filter-list .filter-btn').forEach(btn => { 
        btn.classList.toggle('active', btn.dataset.cookbookId === 'all'); 
    });
    
    updateRecipeListInModal(); // Zeige alle Rezepte
    selectRecipeModal.classList.remove('modal-hidden');
    recipeSearchInput.focus();
};
const closeSelectRecipeModal = () => { 
    if (!selectRecipeModal) return; 
    selectRecipeModal.classList.add('modal-hidden'); 
};

// --- Funktionen für Auswahl-Modal 2 (unverändert) ---
const openMealTypeModal = () => {
    if (!mealTypeModal) return;
    mealTypeModal.classList.remove('modal-hidden');
};
const closeMealTypeModal = () => {
    if (!mealTypeModal) return;
    mealTypeModal.classList.add('modal-hidden');
    tempSelectedRecipe = null; // Zwischengespeichertes Rezept löschen
    currentTargetDate = null; // Zieldatum löschen
};

// --- Filtert und zeigt Rezepte im Modal (unverändert) ---
const updateRecipeListInModal = () => {
    const searchTerm = recipeSearchInput.value.toLowerCase().trim();
    
    let recipesToShow = allUserRecipes;
    
    // Nach Kochbuch filtern
    if (selectedCookbookId !== 'all') { 
        recipesToShow = allUserRecipes.filter(recipe => recipe.cookbookId === selectedCookbookId); 
    }
    // Nach Suche filtern
    if (searchTerm) { 
        recipesToShow = recipesToShow.filter(recipe => recipe.title.toLowerCase().includes(searchTerm)); 
    }
    
    displayRecipesInModal(recipesToShow);
};

// --- Zeigt Rezepte im Modal an (mit Bild) (GEÄNDERT) ---
const displayRecipesInModal = (recipes) => {
    if (!recipeSelectList) return;
    recipeSelectList.innerHTML = '';
    
    if (!recipes || recipes.length === 0) {
        if (recipeSearchInput.value.trim() || selectedCookbookId !== 'all') {
            recipeSelectList.innerHTML = '<p style="padding: 1rem; text-align: center; color: grey;">Keine passenden Rezepte gefunden.</p>';
        } else {
             recipeSelectList.innerHTML = '<p style="padding: 1rem; text-align: center; color: grey;">Du hast (noch) keine Rezepte erstellt.</p>';
        }
        return;
    }
    
    recipes.forEach(recipe => {
        const div = document.createElement('div'); 
        div.className = 'recipe-select-item'; 
        div.dataset.recipeId = recipe.id;
        
        // --- START ÄNDERUNG (Zufalls-Emoji) ---
        // Wähle ein zufälliges Emoji, statt das statische CSS-Emoji zu verwenden
        let imgHtml = `<div class="recipe-select-img-placeholder">${getRandomPlaceholder()}</div>`;
        if (recipe.imageUrl) { 
            imgHtml = `<img src="${recipe.imageUrl}" alt="${recipe.title}" class="recipe-select-img" loading="lazy">`; 
        }
        // --- ENDE ÄNDERUNG ---

        div.innerHTML = ` ${imgHtml} <span class="recipe-select-title">${recipe.title}</span> `;
        recipeSelectList.appendChild(div);
    });
};

// --- Funktion zum Speichern (unverändert) ---
// (Speichert den Plan im Profil des Nutzers)
const planRecipe = async (date, mealType, recipeData) => {
    if (!currentUser || !date || !mealType || !recipeData || !recipeData.id) return;
    console.log(`Speichere ${recipeData.title} für ${date} / ${mealType}`);
    
    try {
        const dayDocRef = db.collection('users').doc(currentUser.uid).collection('plannedMeals').doc(date);
        
        // Das Objekt, das wir in den Plan einfügen
        const plannedRecipe = {
            id: recipeData.id, 
            title: recipeData.title, 
            imageUrl: recipeData.imageUrl || null, 
            cookbookId: recipeData.cookbookId || null, // WICHTIG für Einkaufsliste
            plannedAt: firebase.firestore.Timestamp.now()
        };
        
        // Füge das Rezept zum Array der jeweiligen Mahlzeit hinzu
        const updateData = {};
        updateData[mealType] = firebase.firestore.FieldValue.arrayUnion(plannedRecipe);
        
        await dayDocRef.set(updateData, { merge: true }); // 'merge: true' erstellt das Dokument, falls es nicht existiert
        
        console.log(`Rezept ${recipeData.title} geplant.`);
    } catch (error) { 
        console.error("Fehler beim Planen:", error); 
        alert("Rezept konnte nicht geplant werden."); 
    }
};

// --- Funktion zum Entfernen (unverändert) ---
const removePlannedRecipe = async (date, mealType, recipeIdToRemove) => {
    if (!currentUser || !date || !mealType || !recipeIdToRemove) return;
    if (!confirm("Sicher entfernen?")) return;

    const dayPlans = plannedMeals[date];
    if (!dayPlans || !dayPlans[mealType]) { 
        console.error("Fehler: Plan nicht im lokalen Objekt gefunden."); 
        return; 
    }
    
    // Finde das genaue Objekt, das entfernt werden soll, da arrayRemove das ganze Objekt braucht
    const recipeToRemove = dayPlans[mealType].find(recipe => recipe.id === recipeIdToRemove);
    
    if (!recipeToRemove) { 
        console.error("Fehler: Zu löschendes Rezeptobjekt nicht gefunden."); 
        return; 
    }
    
    try {
        const dayDocRef = db.collection('users').doc(currentUser.uid).collection('plannedMeals').doc(date);
        
        const updateData = {};
        updateData[mealType] = firebase.firestore.FieldValue.arrayRemove(recipeToRemove);
        
        await dayDocRef.update(updateData);
        console.log("Geplantes Rezept entfernt.");
        // Der Echtzeit-Listener kümmert sich um das UI-Update
    } catch (error) { 
        console.error("Fehler beim Entfernen:", error); 
        alert("Rezept konnte nicht entfernt werden."); 
    }
};

// --- Funktion für Live-Updates (unverändert) ---
const listenToPlannedRecipesForWeek = () => {
    if (!currentUser || !currentWeekStartDate) { return; }
    
    // Alten Listener trennen, falls vorhanden
    if (plannerListener) { 
        plannerListener(); 
    }

    const weekStart = new Date(currentWeekStartDate); 
    const weekEnd = new Date(weekStart); 
    weekEnd.setDate(weekStart.getDate() + 7); // Ende ist 7 Tage später

    const weekStartStr = getLocalDateKey(weekStart);
    const weekEndStr = getLocalDateKey(weekEnd);
    
    console.log(`   -> Starte Listener für Plandaten von ${weekStartStr} bis ${weekEndStr}`);
    
    // Query für Pläne in dieser Woche
    const plannedMealsRef = db.collection('users').doc(currentUser.uid).collection('plannedMeals');
    const q = plannedMealsRef.where(firebase.firestore.FieldPath.documentId(), '>=', weekStartStr)
                             .where(firebase.firestore.FieldPath.documentId(), '<', weekEndStr);

    plannerListener = q.onSnapshot((snapshot) => {
        console.log("      -> Plandaten-Update empfangen:", snapshot.size, "Tage");
        
        // Lokalen Cache der Pläne (plannedMeals) aktualisieren
        plannedMeals = {}; // Erst leeren
        snapshot.forEach((doc) => {
            plannedMeals[doc.id] = doc.data();
        });
        
        // Alle 7 Tage im Grid neu rendern mit den frischen Daten
        document.querySelectorAll('.planner-day').forEach(dayDiv => {
            if (document.body.contains(dayDiv)) { // Sicherstellen, dass das Element noch da ist
                displayPlannedRecipesForDay(dayDiv.dataset.date);
            }
        });
    }, (error) => { 
        console.error("Fehler im Echtzeit-Listener:", error); 
        if (plannerListener) plannerListener(); 
        plannerListener = null; 
        alert("Fehler beim Laden der Plandaten."); 
    });
};

// --- Funktion zum Anzeigen der Pläne pro Tag (GEÄNDERT) ---
const displayPlannedRecipesForDay = (dateKey) => {
    const slotContainer = document.getElementById(`slots-container-${dateKey}`);
    if (!slotContainer) return; // Tag ist nicht (mehr) im DOM
    
    slotContainer.innerHTML = ''; // Slots leeren

    const plansForDay = plannedMeals[dateKey];
    const mealOrder = { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen", snacks: "Jause" };

    // Gehe die Mahlzeiten in der richtigen Reihenfolge durch
    for (const mealType in mealOrder) {
        const recipesForMeal = (plansForDay && plansForDay[mealType]) ? plansForDay[mealType] : [];
        
        // Erstelle einen Slot nur, wenn Rezepte dafür vorhanden sind
        if (recipesForMeal.length > 0) {
            const mealSlotDiv = document.createElement('div');
            mealSlotDiv.className = 'meal-slot';
            mealSlotDiv.dataset.mealType = mealType;
            
            let recipesHtml = '';
            recipesForMeal.forEach(plan => {
                
                // --- START ÄNDERUNG (Zufalls-Emoji) ---
                let imgHtml = `<div class="planned-recipe-img-placeholder">${getRandomPlaceholder()}</div>`;
                if (plan.imageUrl) { 
                    imgHtml = `<img src="${plan.imageUrl}" alt="${plan.title}" class="planned-recipe-img" loading="lazy">`; 
                }
                // --- ENDE ÄNDERUNG ---

                recipesHtml += `
                    <li class="planned-recipe-item">
                        ${imgHtml}
                        <span class="planned-recipe-title">${plan.title}</span>
                        <button class="remove-planned" data-plan-id="${plan.id}">×</button>
                    </li>
                `;
            });
            
            mealSlotDiv.innerHTML = `
                <h4>${mealOrder[mealType]}</h4>
                <ul class="planned-recipes">
                    ${recipesHtml}
                </ul>
            `;
            slotContainer.appendChild(mealSlotDiv);
        }
    }
};

// --- Hilfsfunktion für LOKALES Datum (löst Zeitzonenproblem) ---
function getLocalDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0'); // Monate sind 0-basiert
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);