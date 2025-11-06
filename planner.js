import { auth, db } from './firebase-config.js';

// --- Globale Variablen ---
let currentUser;
let allUserRecipes = []; // Enthält {id, title, imageUrl, cookbookId}
let allUserCookbooks = [];
let plannedMeals = {}; // Speichert geladene Pläne { "YYYY-MM-DD": { breakfast: [...], lunch: [...] } }
let plannerListener = null; // Echtzeit-Listener
let currentWeekStartDate = getMonday(new Date());

// Variablen für den Planungs-Workflow
let currentTargetDate = null;
let tempSelectedRecipe = null; // WICHTIG: DIESE ZEILE HAT GEFEHLT
let selectedCookbookId = 'all';

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
  d = new Date(d); const day = d.getDay() || 7;
  if (day !== 1) d.setHours(-24 * (day - 1));
  d.setHours(0, 0, 0, 0); return d;
}

// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => {
    // console.log("==> showContent() wird aufgerufen.");
    if (loader) loader.style.display = 'none';
    if (navbar) navbar.classList.remove('content-hidden');
    if (mainContent) mainContent.classList.remove('content-hidden');
    // console.log("==> Inhalt sollte jetzt sichtbar sein.");
};

// --- Initialisierung ---
const init = () => {
    console.log("Planner Init Start");
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
        alert("Ein kritischer HTML-Fehler ist aufgetreten.");
        return;
    }
    console.log("==> Alle Elemente gefunden.");

    // Auth Wächter
    console.log("==> Füge onAuthStateChanged Listener hinzu...");
    auth.onAuthStateChanged(async (user) => {
        console.log("==> onAuthStateChanged hat ausgelöst!");
        if (user) {
            console.log("   -> Nutzer ist eingeloggt.");
            currentUser = user;
            showContent(); // Inhalt SOFORT anzeigen
            try {
                await loadCookbooksAndRecipes();
                displayCookbookFilters();
                displayCurrentWeek(); // Startet Anzeige & Listener
            } catch (error) { console.error("FEHLER Laden:", error); displayCurrentWeek(); }
        } else {
            console.log("   -> Nutzer ist NICHT eingeloggt.");
            if (plannerListener) plannerListener();
            plannedMeals = {}; currentUser = null;
            window.location.href = 'index.html';
        }
    });

     // Event Listeners Grid
     if (plannerGrid) {
        plannerGrid.addEventListener('click', (e) => {
            const addButton = e.target.closest('.add-recipe-to-day-btn-main');
            if (addButton) {
                if (addButton.closest('.past-day')) { alert("Du kannst keine Rezepte zu vergangenen Tagen hinzufügen."); return; }
                const date = addButton.dataset.date;
                const dateString = addButton.closest('.planner-day').querySelector('h3').textContent;
                console.log(`Öffne Rezeptauswahl für ${date}`);
                openSelectRecipeModal(date, dateString);
                return;
            }
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
             if (e.target === selectRecipeModal) { closeSelectRecipeModal(); return; }
             const selectedItem = e.target.closest('.recipe-select-item');
             if (selectedItem) {
                 const recipeId = selectedItem.dataset.recipeId;
                 const selectedRecipe = allUserRecipes.find(r => r.id === recipeId);
                 if (selectedRecipe) {
                     tempSelectedRecipe = selectedRecipe; // HIER WAR DER FEHLER
                     console.log("Rezept zwischengespeichert:", tempSelectedRecipe.title);
                     closeSelectRecipeModal();
                     openMealTypeModal();
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
                     updateRecipeListInModal();
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
    console.log("--> displayCurrentWeek(): Start");
    displayPlannerDays();
    listenToPlannedRecipesForWeek();
};

// --- Navigationsfunktionen ---
const showPreviousWeek = () => {
    if (!currentWeekStartDate) return;
    console.log("--> Gehe zu voriger Woche");
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() - 7);
    displayCurrentWeek();
};
const showNextWeek = () => {
    if (!currentWeekStartDate) return;
    console.log("--> Gehe zu nächster Woche");
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() + 7);
    displayCurrentWeek();
};

// --- Funktion zum Anzeigen der Tage (ANGEPASST) ---
const displayPlannerDays = () => {
    if (!currentWeekStartDate) { console.error("FEHLER in displayPlannerDays: Startdatum fehlt!"); return; }
    console.log("--> displayPlannerDays(): Start ab:", currentWeekStartDate.toLocaleDateString());
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
        const dateKey = getLocalDateKey(currentDate); // Lokales Datum
        const dayDiv = document.createElement('div'); dayDiv.className = 'planner-day'; dayDiv.dataset.date = dateKey;
        if (currentDate < today) { dayDiv.classList.add('past-day'); }

        dayDiv.innerHTML = `
            <h3>${dateString}</h3>
            <div class="meal-slots-container" id="slots-container-${dateKey}"></div> 
            <button class="add-recipe-to-day-btn-main" data-date="${dateKey}">Rezept hinzufügen +</button>
        `;
        plannerGrid.appendChild(dayDiv);
        displayPlannedRecipesForDay(dateKey);
    }
};

// --- Lädt Kochbücher UND Rezepte (Compat-Syntax) ---
const loadCookbooksAndRecipes = async () => {
    console.log("   -> loadCookbooksAndRecipes(): Start");
    if (!currentUser) { return Promise.reject("Kein Nutzer"); }
    allUserCookbooks = []; allUserRecipes = [];
    try {
        const cookbookSnapshot = await db.collection('users').doc(currentUser.uid).collection('cookbooks').get();
        console.log("      Kochbücher:", cookbookSnapshot.size);
        const recipeLoadPromises = [];
        cookbookSnapshot.forEach(cookbookDoc => {
            allUserCookbooks.push({ id: cookbookDoc.id, title: cookbookDoc.data().title || 'Unbenannt' });
            const recipePromise = db.collection('users').doc(currentUser.uid).collection('cookbooks').doc(cookbookDoc.id).collection('recipes').get()
                .then(recipeSnapshot => {
                    const recipesFromThisBook = [];
                    recipeSnapshot.forEach(recipeDoc => {
                        const data = recipeDoc.data();
                        recipesFromThisBook.push({
                            id: recipeDoc.id, title: data.title || 'Unbenannt', imageUrl: data.imageUrl || null, cookbookId: cookbookDoc.id
                        });
                    });
                    return recipesFromThisBook;
                }).catch(err => { console.error(`Fehler Rezepte ${cookbookDoc.id}:`, err); return []; });
            recipeLoadPromises.push(recipePromise);
        });
        allUserCookbooks.sort((a, b) => a.title.localeCompare(b.title));
        const results = await Promise.all(recipeLoadPromises);
        allUserRecipes = results.flat();
        allUserRecipes.sort((a, b) => a.title.localeCompare(b.title));
        console.log("   -> loadCookbooksAndRecipes(): ERFOLG:", allUserCookbooks.length, "Kochbücher,", allUserRecipes.length, "Rezepte");
    } catch (error) { console.error("Fehler Laden:", error); alert("Fehler Rezept/Kochbuch-Laden."); return Promise.reject(error); }
};

// --- Zeigt die Kochbuch-Filterbuttons an ---
const displayCookbookFilters = () => {
    if (!cookbookFilterList) return;
    cookbookFilterList.innerHTML = '';
    console.log("Zeige Kochbuch-Filter:", allUserCookbooks);
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active'; allBtn.dataset.cookbookId = 'all'; allBtn.textContent = 'Alle';
    cookbookFilterList.appendChild(allBtn);
    allUserCookbooks.forEach(book => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn'; btn.dataset.cookbookId = book.id; btn.textContent = book.title;
        cookbookFilterList.appendChild(btn);
    });
};

// --- Funktionen für Auswahl-Modal 1 ---
const openSelectRecipeModal = (date, dateString) => {
    if (!selectRecipeModal || !selectRecipeTitle || !recipeSearchInput || !cookbookFilterList) return;
    currentTargetDate = date;
    selectRecipeTitle.textContent = `Rezept auswählen für ${dateString}`;
    recipeSearchInput.value = '';
    selectedCookbookId = 'all';
    document.querySelectorAll('#cookbook-filter-list .filter-btn').forEach(btn => { btn.classList.toggle('active', btn.dataset.cookbookId === 'all'); });
    updateRecipeListInModal();
    selectRecipeModal.classList.remove('modal-hidden');
    recipeSearchInput.focus();
};
const closeSelectRecipeModal = () => { if (!selectRecipeModal) return; selectRecipeModal.classList.add('modal-hidden'); };

// --- Funktionen für Auswahl-Modal 2 ---
const openMealTypeModal = () => {
    if (!mealTypeModal) return;
    mealTypeModal.classList.remove('modal-hidden');
};
const closeMealTypeModal = () => {
    if (!mealTypeModal) return;
    mealTypeModal.classList.add('modal-hidden');
    tempSelectedRecipe = null;
    currentTargetDate = null;
};

// --- Filtert und zeigt Rezepte im Modal ---
const updateRecipeListInModal = () => {
    const searchTerm = recipeSearchInput.value.toLowerCase().trim();
    console.log(`Update Liste: Filter='${selectedCookbookId}', Suche='${searchTerm}'`);
    let recipesToShow = allUserRecipes;
    if (selectedCookbookId !== 'all') { recipesToShow = allUserRecipes.filter(recipe => recipe.cookbookId === selectedCookbookId); }
    if (searchTerm) { recipesToShow = recipesToShow.filter(recipe => recipe.title.toLowerCase().includes(searchTerm)); }
    displayRecipesInModal(recipesToShow);
};

// --- Zeigt Rezepte im Modal an (mit Bild) ---
const displayRecipesInModal = (recipes) => {
    if (!recipeSelectList) return;
    recipeSelectList.innerHTML = '';
    console.log("Zeige Rezepte im Modal:", recipes.length, "Stück");
    if (!recipes || recipes.length === 0) {
        if (recipeSearchInput.value.trim() || selectedCookbookId !== 'all') {
            recipeSelectList.innerHTML = '<p style="padding: 1rem; text-align: center; color: grey;">Keine passenden Rezepte gefunden.</p>';
        } else {
             recipeSelectList.innerHTML = '<p style="padding: 1rem; text-align: center; color: grey;">Du hast (noch) keine Rezepte erstellt.</p>';
        }
        return;
    }
    recipes.forEach(recipe => {
        const div = document.createElement('div'); div.className = 'recipe-select-item'; div.dataset.recipeId = recipe.id;
        let imgHtml = '<div class="recipe-select-img-placeholder"></div>';
        if (recipe.imageUrl) { imgHtml = `<img src="${recipe.imageUrl}" alt="${recipe.title}" class="recipe-select-img" loading="lazy">`; }
        div.innerHTML = ` ${imgHtml} <span class="recipe-select-title">${recipe.title}</span> `;
        recipeSelectList.appendChild(div);
    });
};

// --- Funktion zum Speichern (NEUE STRUKTUR - COMPAT) ---
const planRecipe = async (date, mealType, recipeData) => {
    if (!currentUser || !date || !mealType || !recipeData || !recipeData.id) return;
    console.log(`Speichere ${recipeData.title} für ${date} / ${mealType}`);
    try {
        const dayDocRef = db.collection('users').doc(currentUser.uid).collection('plannedMeals').doc(date);
        const plannedRecipe = {
            id: recipeData.id, title: recipeData.title, imageUrl: recipeData.imageUrl || null, cookbookId: recipeData.cookbookId || null,
            plannedAt: firebase.firestore.Timestamp.now()
        };
        const updateData = {};
        updateData[mealType] = firebase.firestore.FieldValue.arrayUnion(plannedRecipe);
        await dayDocRef.set(updateData, { merge: true });
        console.log(`Rezept ${recipeData.title} geplant.`);
    } catch (error) { console.error("Fehler beim Planen:", error); alert("Rezept konnte nicht geplant werden."); }
};

// --- Funktion zum Entfernen (NEUE STRUKTUR - COMPAT) ---
const removePlannedRecipe = async (date, mealType, recipeIdToRemove) => {
    if (!currentUser || !date || !mealType || !recipeIdToRemove) return;
    if (!confirm("Sicher entfernen?")) return;
    console.log(`Entferne ${recipeIdToRemove} von ${date} / ${mealType}`);
    const dayPlans = plannedMeals[date];
    if (!dayPlans || !dayPlans[mealType]) { console.error("Fehler: Plan nicht im lokalen Objekt gefunden."); return; }
    const recipeToRemove = dayPlans[mealType].find(recipe => recipe.id === recipeIdToRemove);
    if (!recipeToRemove) { console.error("Fehler: Zu löschendes Rezeptobjekt nicht gefunden."); return; }
    try {
        const dayDocRef = db.collection('users').doc(currentUser.uid).collection('plannedMeals').doc(date);
        const updateData = {};
        updateData[mealType] = firebase.firestore.FieldValue.arrayRemove(recipeToRemove);
        await dayDocRef.update(updateData);
        console.log("Geplantes Rezept entfernt.");
    } catch (error) { console.error("Fehler beim Entfernen:", error); alert("Rezept konnte nicht entfernt werden."); }
};

// --- Funktion für Live-Updates (NEUE STRUKTUR - COMPAT) ---
const listenToPlannedRecipesForWeek = () => {
    if (!currentUser || !currentWeekStartDate) { console.error("FEHLER Listener: Nutzer/Startdatum fehlt!"); return; }
    if (plannerListener) { plannerListener(); }
    const weekStart = new Date(currentWeekStartDate); const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
    const weekStartStr = getLocalDateKey(weekStart); // KORREKTUR: Lokales Datum
    const weekEndStr = getLocalDateKey(weekEnd);     // KORREKTUR: Lokales Datum
    console.log(`   -> Starte Listener für ${weekStartStr} bis ${weekEndStr}`);
    
    const plannedMealsRef = db.collection('users').doc(currentUser.uid).collection('plannedMeals');
    const q = plannedMealsRef.where(firebase.firestore.FieldPath.documentId(), '>=', weekStartStr)
                             .where(firebase.firestore.FieldPath.documentId(), '<', weekEndStr);

    plannerListener = q.onSnapshot((snapshot) => {
        console.log("      -> Plandaten-Update:", snapshot.size, "Tage empfangen");
        plannedMeals = {};
        snapshot.forEach((doc) => {
            plannedMeals[doc.id] = doc.data();
        });
        console.log("      -> Aktualisierte Plandaten:", plannedMeals);
        document.querySelectorAll('.planner-day').forEach(dayDiv => {
            if (document.body.contains(dayDiv)) { displayPlannedRecipesForDay(dayDiv.dataset.date); }
        });
    }, (error) => { console.error("Fehler Listener:", error); if (plannerListener) plannerListener(); plannerListener = null; alert("Fehler beim Laden der Plandaten."); });
};

// --- Funktion zum Anzeigen der Pläne pro Tag (ANGEPASST) ---
const displayPlannedRecipesForDay = (dateKey) => {
    const slotContainer = document.getElementById(`slots-container-${dateKey}`);
    if (!slotContainer) return;
    slotContainer.innerHTML = '';

    const plansForDay = plannedMeals[dateKey];
    const mealOrder = { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen", snacks: "Jause" };

    for (const mealType in mealOrder) {
        const recipesForMeal = (plansForDay && plansForDay[mealType]) ? plansForDay[mealType] : [];
        if (recipesForMeal.length > 0) {
            const mealSlotDiv = document.createElement('div');
            mealSlotDiv.className = 'meal-slot';
            mealSlotDiv.dataset.mealType = mealType;
            let recipesHtml = '';
            recipesForMeal.forEach(plan => {
                let imgHtml = '<div class="planned-recipe-img-placeholder"></div>';
                if (plan.imageUrl) { imgHtml = `<img src="${plan.imageUrl}" alt="${plan.title}" class="planned-recipe-img" loading="lazy">`; }
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

// --- NEU: Hilfsfunktion für LOKALES Datum (löst Zeitzonenproblem) ---
// (Steht oben, aber hier nochmal zur Sicherheit, falls die globale Deklaration fehlschlägt)
function getLocalDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0'); // Monate sind 0-basiert
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);