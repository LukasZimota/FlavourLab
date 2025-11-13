// V2 - Diese Datei ist neu, um Cache-Probleme zu beheben
import { auth, db } from './firebase-config.js';

// --- Globale Variablen ---
let currentUser;
let currentCookbookId; // Wird aus der URL geladen
let currentRecipeId = null; // ID des Rezepts, das im "Anzeigen"-Modal offen ist
let currentEditingRecipeId = null; // ID des Rezepts, das im "Bearbeiten"-Modal offen ist

// Listen für das Erstellen/Bearbeiten-Modal
let ingredientsArray = [];
let stepsArray = [];
let currentRating = 0;
let currentServings = 4; // Standard-Portionen
let currentRecipeTags = []; // Tags für das aktuell bearbeitete Rezept
let userTags = []; // Globale Tag-Liste des Nutzers
let tagColors = {}; // Objekt zum Speichern der Tag-Farben

// Variablen für den Bearbeiten-Modus der Listen
let currentEditingIngredientIndex = null; 
let currentEditingStepIndex = null;

// Cache & Filter
let allCookbookRecipes = []; // Cache für alle Rezepte dieses Kochbuchs
let currentFilters = { search: '', rating: 0, tags: [] };

// --- DOM-Elemente (Deklaration) ---
let loader, navbar, mainContent;
let cookbookTitleDisplay, recipeGallery, galleryMessage;
let recipeModal, recipeModalCloseBtn, saveRecipeBtn, recipeModalTitle, modalRecipeName, modalRecipeImage;
let ingredientInput, addIngredientBtn, ingredientList;
let stepInput, addStepBtn, stepList;
let ratingGroup, ratingStars, modalRecipeNotes;
let viewModal, viewModalCloseBtn, viewRecipeContent, editRecipeBtn, deleteRecipeBtn;
let openFilterBtn, filterModal, filterModalCloseBtn, filterSearchInput, filterRatingGroup, filterRatingStars, clearRatingFilterBtn, applyFilterBtn;
let activeFiltersDisplay;
// NEU: Portionen
let servingsSelectGroup, servingCustomInput;
// NEU: Tags
let selectedTagsContainer, modalTagInput, btnAddTag, userTagList, userTagListLabel;
// NEU: Filter-Tags
let filterTagGroup, filterTagListLabel;


// --- NEU: Tag-Farb-Logik ---
const TAG_COLORS_LIST = [
    '#007aff', // Blau
    '#34c759', // Grün
    '#ff9500', // Orange
    '#5856d6', // Lila
    '#ff3b30', // Rot
    '#ff2d55', // Pink
    '#af52de', // Violett
    '#5ac8fa', // Türkis
    '#ffcc00', // Gelb
];

const getTagColor = (tagName) => {
    // Standard-Farben für die 5 Original-Tags
    if (tagName === "Vegan") return TAG_COLORS_LIST[0];
    if (tagName === "Vegetarisch") return TAG_COLORS_LIST[1];
    if (tagName === "Glutenfrei") return TAG_COLORS_LIST[2];
    if (tagName === "Laktosefrei") return TAG_COLORS_LIST[3];
    if (tagName === "Schnell") return TAG_COLORS_LIST[4];
    
    // Dynamische Zuweisung für neue Tags
    if (!tagColors[tagName]) {
        // Einfacher Hash, um eine Farbe aus der Liste zu wählen
        let hash = 0;
        for (let i = 0; i < tagName.length; i++) {
            hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
        }
        hash = Math.abs(hash);
        
        // Wähle eine Farbe aus den verbleibenden (Index 5-8)
        const colorIndex = 5 + (hash % (TAG_COLORS_LIST.length - 5));
        tagColors[tagName] = TAG_COLORS_LIST[colorIndex];
    }
    return tagColors[tagName];
};

// Hilfsfunktion, um die richtige Textfarbe für einen Hintergrund zu finden
const getTextColorForBg = (bgColor) => {
    // Spezielle Ausnahme für das helle Lila
    if (bgColor === '#5856d6' || bgColor === '#af52de') {
        return '#000000'; // Schwarz
    }
    return '#ffffff'; // Standard: Weiß
};


// --- Pop-up Funktionen ---
const openCreateModal = () => {
    currentEditingRecipeId = null;
    recipeModalTitle.textContent = 'Neues Rezept hinzufügen';
    modalRecipeName.value = ''; 
    modalRecipeImage.value = ''; 
    modalRecipeNotes.value = '';
    
    ingredientsArray = []; 
    renderIngredientList();
    stepsArray = []; 
    renderStepsList();
    setRating(0);
    setServings(4); // Standard-Portionen
    
    currentRecipeTags = []; // Tag-Liste leeren
    renderSelectedTags();
    renderUserTagSuggestions();
    
    recipeModal.classList.remove('modal-hidden');
    modalRecipeName.focus();
};

const openEditModal = async () => {
    if (!currentRecipeId) return;
    currentEditingRecipeId = currentRecipeId;
    recipeModalTitle.textContent = 'Rezept bearbeiten';

    try {
        const docRef = db.collection('cookbooks').doc(currentCookbookId)
                         .collection('recipes').doc(currentEditingRecipeId);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
            const data = docSnap.data();
            modalRecipeName.value = data.title || '';
            modalRecipeImage.value = data.imageUrl || '';
            modalRecipeNotes.value = data.notes || '';
            
            ingredientsArray = data.ingredients || []; 
            renderIngredientList();
            stepsArray = data.instructions || []; 
            renderStepsList();
            setRating(data.rating || 0);
            setServings(data.servings || 4); // Lade Portionen, sonst 4
            
            currentRecipeTags = data.tags || []; // Lade Tags
            renderSelectedTags();
            renderUserTagSuggestions();

            closeViewModal(); 
            recipeModal.classList.remove('modal-hidden'); 
            modalRecipeName.focus();
        } else { 
            alert("Fehler: Rezept nicht gefunden."); 
            currentEditingRecipeId = null; 
        }
    } catch (error) { 
        console.error("Fehler beim Laden zur Bearbeitung:", error); 
        alert("Fehler beim Laden."); 
        currentEditingRecipeId = null; 
    }
};

const closeRecipeModal = () => {
    recipeModal.classList.add('modal-hidden');
    currentEditingRecipeId = null;
    // Setze Bearbeiten-Modus der Listen zurück
    resetIngredientInput();
    resetStepInput();
};

const openViewModal = async (recipeId) => {
    if (!currentUser || !currentCookbookId) return;
    currentRecipeId = recipeId;
    viewRecipeContent.innerHTML = '<h3>Lade Rezept...</h3>';
    viewModal.classList.remove('modal-hidden');

    try {
        const doc = await db.collection('cookbooks').doc(currentCookbookId)
                            .collection('recipes').doc(recipeId).get();
        
        if (!doc.exists) { 
            viewRecipeContent.innerHTML = '<h3>Rezept nicht gefunden.</h3>'; 
            return; 
        }
        
        const recipe = doc.data();
        
        // (Rest der Funktion zum Anzeigen des HTMLs ist unverändert)
        let ratingHtml = `<div class="display-rating" data-rating="${recipe.rating || 0}">`;
        if (recipe.rating && recipe.rating > 0) {
            for (let i = 1; i <= 5; i++) { ratingHtml += (i <= recipe.rating) ? '★' : '☆'; }
        } else { ratingHtml += 'Keine Bewertung'; }
        ratingHtml += '</div>';

        // NEU: Portionen anzeigen
        let servingsHtml = '';
        if (recipe.servings) {
            servingsHtml = `<span class="display-servings">Für ${recipe.servings} Personen</span>`;
        }
        
        // NEU: Tags mit Farbe
        let tagsHtml = '';
        if (recipe.tags && recipe.tags.length > 0) {
            tagsHtml = '<strong>Tags:</strong><div class="display-tags">';
            recipe.tags.forEach(tag => {
                const color = getTagColor(tag);
                const textColor = getTextColorForBg(color);
                tagsHtml += `<span class="display-tag-pill" data-tag="${tag}" style="background-color: ${color}; color: ${textColor};">${tag}</span>`;
            });
            tagsHtml += '</div>';
        }
        
        let notesHtml = '';
        if (recipe.notes && recipe.notes.trim() !== '') {
            notesHtml = `<strong>Notizen & Tipps:</strong><p class="display-notes">${recipe.notes.replace(/\n/g, '<br>')}</p>`;
        }
        
        let ingredientsHtml = 'Keine Zutaten angegeben.';
        if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
            ingredientsHtml = '<ul>' + recipe.ingredients.map(ing => `<li>${ing}</li>`).join('') + '</ul>';
        }
        
        let instructionsHtml = 'Keine Anleitung angegeben.';
        if (Array.isArray(recipe.instructions) && recipe.instructions.length > 0) {
            instructionsHtml = '<ol>' + recipe.instructions.map(step => `<li>${step}</li>`).join('') + '</ol>';
        }
        
        let imageHtml = '';
        if (recipe.imageUrl && recipe.imageUrl.trim() !== '') {
            imageHtml = `<img src="${recipe.imageUrl}" alt="${recipe.title}">`;
        }
        
        viewRecipeContent.innerHTML = `
            ${imageHtml} 
            <h3>${recipe.title} ${servingsHtml}</h3> 
            ${ratingHtml} 
            ${tagsHtml}
            <strong>Zutaten:</strong> ${ingredientsHtml}
            <strong>Anleitung:</strong> ${instructionsHtml}
            ${notesHtml}
        `;
    } catch (error) { 
        console.error("Fehler beim Laden des Rezepts:", error); 
        viewRecipeContent.innerHTML = '<h3>Ein Fehler ist aufgetreten.</h3>'; 
    }
};

const closeViewModal = () => { 
    viewModal.classList.add('modal-hidden'); 
    currentRecipeId = null; 
    viewRecipeContent.innerHTML = ''; 
};

// --- Filter-Modal Funktionen ---
const openFilterModal = () => {
    if (!filterModal) return;
    filterSearchInput.value = currentFilters.search;
    setFilterRating(currentFilters.rating);
    
    // NEU: Fülle Filter-Tags dynamisch
    filterTagGroup.innerHTML = '';
    if (userTags.length === 0) {
        filterTagListLabel.style.display = 'none';
    } else {
        filterTagListLabel.style.display = 'block';
        userTags.forEach(tag => {
            const color = getTagColor(tag);
            const textColor = getTextColorForBg(color);
            const isActive = currentFilters.tags.includes(tag);
            
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = `active-filter-pill ${isActive ? 'active' : ''}`;
            pill.dataset.tag = tag;
            pill.textContent = tag;
            pill.style.setProperty('--tag-color-default', color);
            // Spezielle Textfarbe-Regel (für Laktosefrei)
            if (isActive && textColor === '#000000') {
                pill.style.color = '#000000';
            }
            
            filterTagGroup.appendChild(pill);
        });
    }

    filterModal.classList.remove('modal-hidden');
};
const closeFilterModal = () => { 
    if (!filterModal) return; 
    filterModal.classList.add('modal-hidden'); 
};
const setFilterRating = (rating) => {
    if (!filterRatingStars) return;
    filterRatingStars.forEach(star => {
        star.classList.toggle('active', star.dataset.value <= rating);
    });
};

// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => { 
    if (loader) loader.style.display = 'none'; 
    if (navbar) navbar.classList.remove('content-hidden'); 
    if (mainContent) mainContent.classList.remove('content-hidden'); 
};

// --- Zutaten-Funktionen (ÜBERARBEITET) ---
const renderIngredientList = () => { 
    if (!ingredientList) return; 
    ingredientList.innerHTML = ''; 
    ingredientsArray.forEach((ingredient, index) => { 
        const li = document.createElement('li'); 
        li.innerHTML = `
            <span>${ingredient}</span>
            <div class="item-actions">
                <button type="button" class="item-action-btn menu-btn-edit-item" data-index="${index}" title="Bearbeiten">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/></svg>
                </button>
                <button type="button" class="item-action-btn menu-btn-delete-item" data-index="${index}" title="Löschen">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>
                </button>
            </div>
        `;
        ingredientList.appendChild(li); 
    }); 
};
const addIngredient = () => { 
    if (!ingredientInput) return; 
    const ingredient = ingredientInput.value.trim(); 
    if (!ingredient) return;

    if (currentEditingIngredientIndex !== null) {
        // Im Bearbeiten-Modus: Eintrag aktualisieren
        ingredientsArray[currentEditingIngredientIndex] = ingredient;
        currentEditingIngredientIndex = null;
    } else {
        // Im Neu-Modus: Eintrag hinzufügen
        ingredientsArray.push(ingredient); 
    }
    
    renderIngredientList(); 
    resetIngredientInput();
};
const editIngredient = (index) => {
    currentEditingIngredientIndex = index;
    ingredientInput.value = ingredientsArray[index];
    ingredientInput.focus();
    addIngredientBtn.textContent = '✔';
    addIngredientBtn.classList.add('edit-mode');
};
const removeIngredient = (index) => { 
    ingredientsArray.splice(index, 1); 
    renderIngredientList(); 
    resetIngredientInput(); // Falls man gerade diesen Eintrag bearbeitet hat
};
const resetIngredientInput = () => {
    ingredientInput.value = ''; 
    currentEditingIngredientIndex = null;
    addIngredientBtn.textContent = '+';
    addIngredientBtn.classList.remove('edit-mode');
};

// --- Schritte-Funktionen (ÜBERARBEITET) ---
const renderStepsList = () => { 
    if (!stepList) return; 
    stepList.innerHTML = ''; 
    stepsArray.forEach((step, index) => { 
        const li = document.createElement('li'); 
        li.innerHTML = `
            <span>${step}</span>
            <div class="item-actions">
                <button type="button" class="item-action-btn menu-btn-edit-item" data-index="${index}" title="Bearbeiten">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/></svg>
                </button>
                <button type="button" class="item-action-btn menu-btn-delete-item" data-index="${index}" title="Löschen">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>
                </button>
            </div>
        `;
        stepList.appendChild(li); 
    }); 
};
const addStep = () => { 
    if (!stepInput) return; 
    const step = stepInput.value.trim(); 
    if (!step) return;

    if (currentEditingStepIndex !== null) {
        // Im Bearbeiten-Modus: Eintrag aktualisieren
        stepsArray[currentEditingStepIndex] = step;
    } else {
        // Im Neu-Modus: Eintrag hinzufügen
        stepsArray.push(step); 
    }
    
    renderStepsList(); 
    resetStepInput();
};
const editStep = (index) => {
    currentEditingStepIndex = index;
    stepInput.value = stepsArray[index];
    stepInput.focus();
    addStepBtn.textContent = '✔';
    addStepBtn.classList.add('edit-mode');
};
const removeStep = (index) => { 
    stepsArray.splice(index, 1); 
    renderStepsList(); 
    resetStepInput(); // Falls man gerade diesen Eintrag bearbeitet hat
};
const resetStepInput = () => {
    stepInput.value = ''; 
    currentEditingStepIndex = null;
    addStepBtn.textContent = '+';
    addStepBtn.classList.remove('edit-mode');
};


// --- Bewertungs-Funktionen (im Erstellen/Bearbeiten-Modal) ---
const setRating = (rating) => {
    currentRating = Number(rating);
    if (ratingStars) {
        ratingStars.forEach(star => {
            star.classList.toggle('active', star.dataset.value <= currentRating);
        });
    }
};

// --- NEU: Portionen-Funktionen ---
const setServings = (servings) => {
    const servingValue = Number(servings);
    
    // Setze alle Buttons zurück
    servingsSelectGroup.querySelectorAll('.serving-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if ([1, 2, 4].includes(servingValue)) {
        // Wenn es ein Button-Wert ist, aktiviere den Button
        const btnToActivate = servingsSelectGroup.querySelector(`.serving-btn[data-value="${servingValue}"]`);
        if (btnToActivate) {
            btnToActivate.classList.add('active');
        }
        servingCustomInput.value = ''; // Leere das "Eigene"-Feld
        currentServings = servingValue;
    } else {
        // Wenn es ein "Eigener"-Wert ist, setze ihn ins Input-Feld
        servingCustomInput.value = servingValue;
        currentServings = servingValue;
    }
    console.log("Portionen gesetzt auf:", currentServings);
};


// --- NEU: Funktionen für das dynamische Tag-System ---

// Lädt die globale Tag-Liste des Nutzers aus Firestore
const loadUserTags = async () => {
    if (!currentUser) return;
    const tagDocRef = db.collection('users').doc(currentUser.uid).collection('settings').doc('tags');
    
    try {
        const doc = await tagDocRef.get();
        if (doc.exists && doc.data().allTags) {
            userTags = doc.data().allTags;
        } else {
            // Wenn der Nutzer noch keine Tags hat, erstelle die 5 Standard-Tags
            const defaultTags = ["Vegan", "Vegetarisch", "Glutenfrei", "Laktosefrei", "Schnell"];
            await tagDocRef.set({ allTags: defaultTags });
            userTags = defaultTags;
        }
        console.log("Globale Nutzer-Tags geladen:", userTags);
        // Fülle die Farben-Map
        userTags.forEach(tag => getTagColor(tag));
    } catch (error) {
        console.error("Fehler beim Laden der Nutzer-Tags:", error);
        userTags = ["Vegan", "Vegetarisch", "Glutenfrei", "Laktosefrei", "Schnell"]; // Fallback
    }
};

// Speichert neue Tags (falls erstellt) in der globalen Liste
const saveNewTagsToFirestore = async () => {
    if (!currentUser) return;
    
    let newTagsFound = false;
    currentRecipeTags.forEach(tag => {
        if (!userTags.includes(tag)) {
            userTags.push(tag);
            newTagsFound = true;
        }
    });

    if (newTagsFound) {
        console.log("Speichere neue Tags in globaler Liste:", userTags);
        const tagDocRef = db.collection('users').doc(currentUser.uid).collection('settings').doc('tags');
        try {
            await tagDocRef.set({ allTags: userTags }, { merge: true });
        } catch (error) {
            console.error("Fehler beim Speichern der neuen Tags:", error);
        }
    }
};

// Zeigt die für das Rezept ausgewählten Tags an
const renderSelectedTags = () => {
    selectedTagsContainer.innerHTML = '';
    currentRecipeTags.forEach(tag => {
        const color = getTagColor(tag);
        const textColor = getTextColorForBg(color);
        
        const pill = document.createElement('div');
        pill.className = 'tag-pill active';
        pill.dataset.tag = tag;
        pill.textContent = tag;
        pill.style.backgroundColor = color;
        pill.style.borderColor = color;
        pill.style.color = textColor;
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'tag-remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = `Tag "${tag}" entfernen`;
        
        pill.appendChild(removeBtn);
        selectedTagsContainer.appendChild(pill);
    });
};

// Zeigt die globalen Tags als Vorschläge an
const renderUserTagSuggestions = () => {
    userTagList.innerHTML = '';
    
    // Finde Tags, die in `userTags` aber NICHT in `currentRecipeTags` sind
    const suggestions = userTags.filter(tag => !currentRecipeTags.includes(tag));
    
    if (suggestions.length > 0) {
        userTagListLabel.style.display = 'block';
        suggestions.forEach(tag => {
            const color = getTagColor(tag);
            
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'tag-pill suggestion';
            pill.dataset.tag = tag;
            pill.textContent = tag;
            pill.style.borderColor = color;
            pill.style.color = color;
            
            userTagList.appendChild(pill);
        });
    } else {
        userTagListLabel.style.display = 'none';
    }
};

// Fügt einen Tag aus dem Input-Feld hinzu
const addNewTag = () => {
    const tagName = modalTagInput.value.trim();
    if (!tagName) return; // Nichts tun, wenn leer
    
    // Verhindere Duplikate (Groß/Kleinschreibung egal)
    const exists = currentRecipeTags.some(tag => tag.toLowerCase() === tagName.toLowerCase());
    
    if (!exists) {
        // Finde die korrekte Schreibweise, falls der Tag schon als Vorschlag existiert
        const existingTag = userTags.find(tag => tag.toLowerCase() === tagName.toLowerCase());
        currentRecipeTags.push(existingTag || tagName); // Nimm existierenden oder neuen
        
        renderSelectedTags();
        renderUserTagSuggestions();
    }
    
    modalTagInput.value = ''; // Input leeren
    modalTagInput.focus();
};

// Wählt einen Tag aus der Vorschlagsliste aus
const selectTagSuggestion = (tagName) => {
    if (!tagName) return;
    
    const exists = currentRecipeTags.includes(tagName);
    if (!exists) {
        currentRecipeTags.push(tagName);
        renderSelectedTags();
        renderUserTagSuggestions();
    }
};

// Entfernt einen Tag aus der "Ausgewählt"-Liste
const removeSelectedTag = (tagName) => {
    if (!tagName) return;
    
    currentRecipeTags = currentRecipeTags.filter(tag => tag !== tagName);
    renderSelectedTags();
    renderUserTagSuggestions();
};
// --- ENDE: Tag-Funktionen ---


// --- Initialisierung ---
const init = async () => { // <--- NEU: async
    console.log("recipes.js Init Start (V2)");

    // --- DOM-Elemente holen ---
    loader = document.getElementById('loader');
    navbar = document.querySelector('.navbar');
    mainContent = document.querySelector('.main-content');
    cookbookTitleDisplay = document.getElementById('cookbook-title');
    recipeGallery = document.getElementById('recipe-gallery');
    galleryMessage = document.getElementById('recipe-gallery-message');
    
    // Erstellen/Bearbeiten-Modal
    recipeModal = document.getElementById('create-recipe-modal');
    recipeModalCloseBtn = document.getElementById('create-modal-close-btn');
    saveRecipeBtn = document.getElementById('btn-save-recipe');
    recipeModalTitle = recipeModal.querySelector('h3');
    modalRecipeName = document.getElementById('modal-recipe-name');
    modalRecipeImage = document.getElementById('modal-recipe-image');
    ingredientInput = document.getElementById('modal-ingredient-input');
    addIngredientBtn = document.getElementById('btn-add-ingredient');
    ingredientList = document.getElementById('ingredient-list');
    stepInput = document.getElementById('modal-step-input');
    addStepBtn = document.getElementById('btn-add-step');
    stepList = document.getElementById('step-list');
    ratingGroup = document.getElementById('modal-recipe-rating');
    ratingStars = ratingGroup ? ratingGroup.querySelectorAll('.rating-star') : [];
    modalRecipeNotes = document.getElementById('modal-recipe-notes');
    
    // Portionen
    servingsSelectGroup = document.getElementById('modal-servings-select');
    servingCustomInput = document.getElementById('modal-serving-custom');
    
    // NEU: Tags
    selectedTagsContainer = document.getElementById('selected-tags-container');
    modalTagInput = document.getElementById('modal-tag-input');
    btnAddTag = document.getElementById('btn-add-tag');
    userTagList = document.getElementById('user-tag-list');
    userTagListLabel = document.getElementById('user-tag-list-label');

    // Anzeigen-Modal
    viewModal = document.getElementById('view-recipe-modal');
    viewModalCloseBtn = document.getElementById('view-modal-close-btn');
    viewRecipeContent = document.getElementById('view-recipe-content');
    editRecipeBtn = document.getElementById('btn-edit-recipe');
    deleteRecipeBtn = document.getElementById('btn-delete-recipe');
    
    // Filter-Modal
    openFilterBtn = document.getElementById('open-filter-btn');
    filterModal = document.getElementById('filter-modal');
    filterModalCloseBtn = document.getElementById('filter-modal-close-btn');
    filterSearchInput = document.getElementById('filter-search-input');
    filterRatingGroup = document.getElementById('filter-rating-group');
    filterRatingStars = filterRatingGroup ? filterRatingGroup.querySelectorAll('.rating-star') : [];
    clearRatingFilterBtn = document.getElementById('clear-rating-filter');
    filterTagGroup = document.getElementById('filter-tag-group'); // NEU
    filterTagListLabel = document.getElementById('filter-tag-list-label'); // NEU
    applyFilterBtn = document.getElementById('btn-apply-filters');
    activeFiltersDisplay = document.getElementById('active-filters-display');
    // --- ENDE DOM-Elemente holen ---

    // Sicherheitscheck (NEUE TAG-ELEMENTE HINZUGEFÜGT)
    if (!cookbookTitleDisplay || !recipeGallery || !galleryMessage || !recipeModal || !viewModal || 
        !ratingGroup || !filterModal || !openFilterBtn || !activeFiltersDisplay || !servingsSelectGroup || 
        !servingCustomInput || !selectedTagsContainer || !modalTagInput || !btnAddTag || !userTagList || !filterTagGroup || !filterTagListLabel) {
        console.error("FEHLER: Wichtige HTML-Elemente auf der Rezeptseite fehlen!");
        // Stoppe die Ausführung, wenn Elemente fehlen
        if(loader) loader.style.display = 'none';
        document.body.innerHTML = "Fehler beim Laden der Seite. (DOM-Elemente nicht gefunden). Bitte leere deinen Cache (Strg+Shift+R) und versuche es erneut.";
        return;
    }
    
    // URL-Parameter holen
    try { 
        const urlParams = new URLSearchParams(window.location.search); 
        const cookbookId = urlParams.get('id'); 
        if (!cookbookId) { alert('Kein Kochbuch ausgewählt!'); window.location.href = 'dashboard.html'; return; } 
        currentCookbookId = cookbookId; 
    }
    catch (error) { console.error("Fehler URL:", error); alert("Fehler Kochbuch-ID."); window.location.href = 'dashboard.html'; return; }

    // Auth Wächter
    auth.onAuthStateChanged(async (user) => { 
        if (user) { 
            currentUser = user; 
            if (currentCookbookId) { 
                // NEU: Lade zuerst die globalen Tags, DANN die Rezepte
                await loadUserTags(); // Warten, bis Tags da sind
                loadCookbookDetails(user.uid, currentCookbookId); // Lädt Titel
                loadRecipes(user.uid, currentCookbookId); // Lädt Rezepte
            } 
            showContent(); 
        } else { 
            currentUser = null; 
            window.location.href = 'index.html'; 
        } 
    });

    // --- Event Listeners ---
    if (recipeGallery) recipeGallery.addEventListener('click', (e) => { if (e.target.closest('#btn-open-create-modal')) { openCreateModal(); return; } const clickedRecipe = e.target.closest('.recipe-data-item'); if (clickedRecipe) { openViewModal(clickedRecipe.dataset.id); } });
    if (saveRecipeBtn) saveRecipeBtn.addEventListener('click', saveRecipe);
    if (recipeModalCloseBtn) recipeModalCloseBtn.addEventListener('click', closeRecipeModal);
    if (recipeModal) recipeModal.addEventListener('click', (e) => { if (e.target === recipeModal) closeRecipeModal(); });
    if (deleteRecipeBtn) deleteRecipeBtn.addEventListener('click', deleteRecipe);
    if (viewModalCloseBtn) viewModalCloseBtn.addEventListener('click', closeViewModal);
    if (viewModal) viewModal.addEventListener('click', (e) => { if (e.target === viewModal) closeViewModal(); });
    if (editRecipeBtn) editRecipeBtn.addEventListener('click', openEditModal);
    
    // Zutaten-Liste (Bearbeiten / Löschen)
    if (addIngredientBtn) addIngredientBtn.addEventListener('click', addIngredient);
    if (ingredientInput) ingredientInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addIngredient(); } });
    if (ingredientList) ingredientList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.menu-btn-edit-item');
        if (editBtn) { editIngredient(Number(editBtn.dataset.index)); return; }
        const deleteBtn = e.target.closest('.menu-btn-delete-item');
        if (deleteBtn) { removeIngredient(Number(deleteBtn.dataset.index)); return; }
    });

    // Schritte-Liste (Bearbeiten / Löschen)
    if (addStepBtn) addStepBtn.addEventListener('click', addStep);
    if (stepInput) stepInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } });
    if (stepList) stepList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.menu-btn-edit-item');
        if (editBtn) { editStep(Number(editBtn.dataset.index)); return; }
        const deleteBtn = e.target.closest('.menu-btn-delete-item');
        if (deleteBtn) { removeStep(Number(deleteBtn.dataset.index)); return; }
    });

    // Bewertung (Bestehend)
    if (ratingStars) {
        ratingStars.forEach(star => {
            star.addEventListener('click', () => { setRating(star.dataset.value); });
            star.addEventListener('mouseover', () => {
                 ratingStars.forEach(s => { s.classList.toggle('hover', s.dataset.value <= star.dataset.value); });
            });
        });
        ratingGroup.addEventListener('mouseleave', () => { setRating(currentRating); });
    }
    
    // NEU: Portionen (Bestehend, aber Logik geändert)
    if (servingsSelectGroup) {
        servingsSelectGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.serving-btn');
            if (btn) {
                setServings(Number(btn.dataset.value));
            }
        });
    }
    if (servingCustomInput) {
        servingCustomInput.addEventListener('input', () => {
            const customValue = Number(servingCustomInput.value);
            if (customValue > 0) {
                setServings(customValue); // Aktiviert "Eigene"-Logik
            }
        });
    }

    // NEU: Tag-System-Listener
    if (btnAddTag) btnAddTag.addEventListener('click', addNewTag);
    if (modalTagInput) modalTagInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNewTag(); } });
    // Klick auf "Ausgewählte Tags" (zum Entfernen)
    if (selectedTagsContainer) selectedTagsContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.tag-remove-btn');
        if (removeBtn) {
            removeSelectedTag(removeBtn.parentElement.dataset.tag);
        }
    });
    // Klick auf "Vorschlags-Tags" (zum Hinzufügen)
    if (userTagList) userTagList.addEventListener('click', (e) => {
        const suggestionPill = e.target.closest('.tag-pill.suggestion');
        if (suggestionPill) {
            selectTagSuggestion(suggestionPill.dataset.tag);
        }
    });

    // Filter-Modal (Bestehend)
    if (openFilterBtn) openFilterBtn.addEventListener('click', openFilterModal);
    if (filterModalCloseBtn) filterModalCloseBtn.addEventListener('click', closeFilterModal);
    if (filterModal) filterModal.addEventListener('click', (e) => { if (e.target === filterModal) closeFilterModal(); });
    if (applyFilterBtn) applyFilterBtn.addEventListener('click', applyFilters);
    if (filterRatingStars) {
        let currentFilterRating = 0;
        filterRatingStars.forEach(star => {
            star.addEventListener('click', () => {
                if (star.classList.contains('active') && star.dataset.value == currentFilterRating) {
                     currentFilterRating = 0;
                } else {
                     currentFilterRating = star.dataset.value;
                }
                setFilterRating(currentFilterRating);
            });
        });
        if (clearRatingFilterBtn) {
            clearRatingFilterBtn.addEventListener('click', () => {
                currentFilterRating = 0;
                setFilterRating(0);
            });
        }
    }
    // NEU: Klick-Logik für Filter-Tags
    if (filterTagGroup) {
        filterTagGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.active-filter-pill');
            if (btn) { 
                e.preventDefault(); 
                btn.classList.toggle('active');
                // Farb-Fix für Laktosefrei
                const color = getTextColorForBg(btn.style.getPropertyValue('--tag-color-default'));
                if(btn.classList.contains('active') && color === '#000000') {
                    btn.style.color = '#000000';
                } else if (btn.classList.contains('active')) {
                    btn.style.color = '#ffffff';
                } else {
                    btn.style.color = btn.style.getPropertyValue('--tag-color-default');
                }
            }
        });
    }
    // (Bestehend)
    if (activeFiltersDisplay) {
        activeFiltersDisplay.addEventListener('click', (e) => {
            if (e.target.classList.contains('clear-all-filters-btn')) {
                resetAllFilters(); return;
            }
            const pillButton = e.target.closest('.active-filter-pill button');
            if (pillButton) {
                const type = pillButton.dataset.filterType;
                const value = pillButton.dataset.filterValue;
                removeFilter(type, value);
            }
        });
    }
};

// --- Funktion: Lade Kochbuch-Details (Bestehend) ---
const loadCookbookDetails = async (userId, cookbookId) => {
    if (!cookbookTitleDisplay) return;
    try { 
        const doc = await db.collection('cookbooks').doc(cookbookId).get(); 
        if (doc.exists) { 
            cookbookTitleDisplay.textContent = `Rezepte in: ${doc.data().title}`; 
        } else { 
            cookbookTitleDisplay.textContent = 'Kochbuch nicht gefunden'; 
        } 
    } catch (error) { 
        console.error("Fehler beim Laden des Kochbuch-Titels:", error); 
        cookbookTitleDisplay.textContent = 'Ladefehler';
    }
};

// --- Funktion: "Plus"-Kachel erstellen (Bestehend) ---
const createAddRecipeTile = () => {
    if (!recipeGallery) return;
    const item = document.createElement('div'); 
    item.className = 'recipe-item add-recipe-tile'; 
    item.id = 'btn-open-create-modal'; 
    item.innerHTML = '<span class="plus-icon">+</span>'; 
    recipeGallery.appendChild(item);
};

// --- Funktion: Lade Rezepte (Bestehend) ---
const loadRecipes = async (userId, cookbookId) => {
    if (!galleryMessage || !recipeGallery) { console.error("FEHLER: Galerie-Elemente fehlen!"); return; }
    galleryMessage.textContent = 'Lade Rezepte...';
    allCookbookRecipes = [];
    currentFilters = { search: '', rating: 0, tags: [] };
    
    try {
        const snapshot = await db.collection('cookbooks').doc(cookbookId)
                                 .collection('recipes').orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            galleryMessage.textContent = 'Füge dein erstes Rezept hinzu!';
        } else {
            galleryMessage.textContent = '';
        }
        
        snapshot.forEach(doc => {
            allCookbookRecipes.push({ id: doc.id, ...doc.data() });
        });
        
        renderFilteredRecipes(); 
        displayActiveFilters();
    } catch (error) {
        console.error('Fehler beim Laden der Rezepte:', error);
        galleryMessage.textContent = 'Ein Fehler ist aufgetreten.';
    }
};

// --- Filter-Funktionen (Angepasst für neue Tags) ---
const applyFilters = () => {
    console.log("Filter werden angewendet...");
    currentFilters.search = filterSearchInput.value.toLowerCase().trim();
    const activeStar = filterRatingGroup.querySelector('.rating-star.active:last-child');
    currentFilters.rating = activeStar ? Number(activeStar.dataset.value) : 0;
    
    // NEU: Tags aus dem Filter-Modal lesen
    currentFilters.tags = [];
    filterTagGroup.querySelectorAll('.active-filter-pill.active').forEach(btn => {
        currentFilters.tags.push(btn.dataset.tag);
    });
    
    console.log("Aktive Filter:", currentFilters);
    renderFilteredRecipes();
    displayActiveFilters();
    closeFilterModal();
};

const displayActiveFilters = () => {
    if (!activeFiltersDisplay) return;
    activeFiltersDisplay.innerHTML = '';
    let hasFilters = false;
    if (currentFilters.search) {
        hasFilters = true;
        activeFiltersDisplay.innerHTML += `<span class="active-filter-pill">Suche: "${currentFilters.search}"<button data-filter-type="search">&times;</button></span>`;
    }
    if (currentFilters.rating > 0) {
        hasFilters = true;
        activeFiltersDisplay.innerHTML += `<span class="active-filter-pill">${currentFilters.rating} ★+<button data-filter-type="rating">&times;</button></span>`;
    }
    // NEU: Tags mit Farbe anzeigen
    currentFilters.tags.forEach(tag => {
        hasFilters = true;
        const color = getTagColor(tag);
        const textColor = getTextColorForBg(color);
        activeFiltersDisplay.innerHTML += `<span class="active-filter-pill" style="background-color: ${color}; color: ${textColor}; border-color: ${color};" data-tag="${tag}">
            ${tag}
            <button data-filter-type="tag" data-filter-value="${tag}">&times;</button>
           </span>`;
    });
    if (hasFilters) {
        activeFiltersDisplay.innerHTML += `<button class="clear-all-filters-btn">Alle Filter löschen</button>`;
    }
};

const removeFilter = (type, value = null) => {
    if (type === 'search') { currentFilters.search = ''; }
    if (type === 'rating') { currentFilters.rating = 0; }
    if (type === 'tag') { currentFilters.tags = currentFilters.tags.filter(t => t !== value); }
    renderFilteredRecipes();
    displayActiveFilters();
};

const resetAllFilters = () => {
    currentFilters = { search: '', rating: 0, tags: [] };
    filterSearchInput.value = '';
    setFilterRating(0);
    // NEU: Setzt auch die dynamischen Filter-Tags zurück
    filterTagGroup.querySelectorAll('.active-filter-pill').forEach(btn => {
        btn.classList.remove('active');
        btn.style.color = btn.style.getPropertyValue('--tag-color-default');
    });
    renderFilteredRecipes();
    displayActiveFilters();
};

const renderFilteredRecipes = () => {
    if (!recipeGallery) return;
    recipeGallery.innerHTML = '';
    let filteredRecipes = [...allCookbookRecipes];

    // Filter anwenden (Bestehend)
    if (currentFilters.search) {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.title.toLowerCase().includes(currentFilters.search));
    }
    if (currentFilters.rating > 0) {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.rating && recipe.rating >= currentFilters.rating);
    }
    if (currentFilters.tags.length > 0) {
        filteredRecipes = filteredRecipes.filter(recipe => {
            if (!recipe.tags || recipe.tags.length === 0) return false;
            return currentFilters.tags.every(filterTag => recipe.tags.includes(filterTag));
        });
    }

    console.log(filteredRecipes.length, "Rezepte nach Filterung.");
    
    createAddRecipeTile(); 

    if (filteredRecipes.length === 0) {
        if(allCookbookRecipes.length > 0) {
             galleryMessage.textContent = "Keine Rezepte entsprechen deinen Filtern.";
        } else {
             galleryMessage.textContent = "Füge dein erstes Rezept hinzu!";
        }
    } else {
        galleryMessage.textContent = '';
    }

    filteredRecipes.forEach(recipe => {
        const item = document.createElement('div');
        item.className = 'recipe-item recipe-data-item';
        item.dataset.id = recipe.id;
        let style = '';
        if (recipe.imageUrl && recipe.imageUrl.trim() !== '') {
            style = `background-image: url('${recipe.imageUrl}');`;
            item.classList.add('has-image');
        } else {
            item.classList.remove('has-image');
        }
        item.innerHTML = `
            <div class="recipe-item-background" style="${style}"></div>
            <span class="recipe-title">${recipe.title}</span>
        `;
        recipeGallery.appendChild(item);
    });
};

// --- Funktion: Speichere Rezept (ANGEPASST für Portionen & Tags) ---
const saveRecipe = async () => {
    const title = modalRecipeName.value.trim();
    const imageUrl = modalRecipeImage.value.trim();
    const ingredients = ingredientsArray;
    const instructions = stepsArray;
    const notes = modalRecipeNotes.value.trim();
    const rating = currentRating;
    const servings = currentServings; // NEU
    const tags = currentRecipeTags; // NEU
    
    if (!title) { alert('Bitte gib einen Rezeptnamen ein.'); return; }

    const recipeData = {
        title: title, 
        imageUrl: imageUrl, 
        ingredients: ingredients, 
        instructions: instructions,
        notes: notes, 
        tags: tags, // Verwendet die neue Tag-Liste
        rating: Number(rating),
        servings: Number(servings) // Speichert die Portionen
    };
    
    try {
        // NEU: Speichere alle neu erstellten Tags in der globalen Liste
        await saveNewTagsToFirestore();

        if (currentEditingRecipeId) {
            // ---- MODUS: BEARBEITEN ----
            const docRef = db.collection('cookbooks').doc(currentCookbookId)
                             .collection('recipes').doc(currentEditingRecipeId);
            await docRef.update(recipeData);
        } else {
            // ---- MODUS: NEU ERSTELLEN ----
            recipeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('cookbooks').doc(currentCookbookId)
                      .collection('recipes').add(recipeData);
        }
        closeRecipeModal();
        loadRecipes(currentUser.uid, currentCookbookId); // Lade neu
    } catch (error) { 
        console.error('Fehler beim Speichern:', error); 
    }
};

// --- Funktion: Lösche Rezept (Bestehend) ---
const deleteRecipe = async () => {
    if (!currentRecipeId) { alert("Fehler: Kein Rezept ausgewählt."); return; }
    if (!confirm('Bist du sicher, dass du dieses Rezept löschen möchtest?')) return;
    if (!currentUser || !currentCookbookId) return;
    
    try {
        await db.collection('cookbooks').doc(currentCookbookId)
                  .collection('recipes').doc(currentRecipeId).delete();
        
        console.log('Rezept gelöscht!');
        closeViewModal();
        loadRecipes(currentUser.uid, currentCookbookId); // Lade neu
    } catch (error) { 
        console.error('Fehler beim Löschen:', error); 
    }
};

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);