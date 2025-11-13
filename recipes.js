import { auth, db } from './firebase-config.js';

// --- Globale Variablen ---
let currentUser;
let currentCookbookId;
let currentRecipeId = null;
let currentEditingRecipeId = null;
let ingredientsArray = [];
let stepsArray = [];
let currentRating = 0;
let currentServings = 4;
let currentEditingIngredientIndex = null; // Hält den Index der Zutat, die bearbeitet wird
let currentEditingStepIndex = null; // Hält den Index des Schritts, der bearbeitet wird
let allCookbookRecipes = [];
let currentFilters = { search: '', rating: 0, tags: [] };

// --- DOM-Elemente (Deklaration) ---
let loader, navbar, mainContent;
let cookbookTitleDisplay, recipeGallery, galleryMessage;
let recipeModal, recipeModalCloseBtn, saveRecipeBtn, recipeModalTitle, modalRecipeName, modalRecipeImage;
let ingredientInput, addIngredientBtn, ingredientList;
let stepInput, addStepBtn, stepList;
let ratingGroup, ratingStars, modalRecipeNotes, tagSelectionGroup;
let servingsGroup, servingButtons, customServingInput;
let viewModal, viewModalCloseBtn, viewRecipeContent, editRecipeBtn, deleteRecipeBtn;
let openFilterBtn, filterModal, filterModalCloseBtn, filterSearchInput, filterRatingGroup, filterRatingStars, clearRatingFilterBtn, filterTagGroup, applyFilterBtn;
let activeFiltersDisplay;

// --- Pop-up Funktionen ---
const openCreateModal = () => {
    currentEditingRecipeId = null;
    recipeModalTitle.textContent = 'Neues Rezept hinzufügen';
    modalRecipeName.value = ''; modalRecipeImage.value = ''; modalRecipeNotes.value = '';
    ingredientsArray = []; renderIngredientList();
    stepsArray = []; renderStepsList();
    setRating(0);
    setServings(4); // Setzt 4 als aktiv
    customServingInput.value = ''; // Leert das "Eigene"-Feld
    if (tagSelectionGroup) { tagSelectionGroup.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active')); }
    
    closeRecipeModalCleanup(); // Bearbeiten-Status zurücksetzen
    
    recipeModal.classList.remove('modal-hidden');
};

const openEditModal = async () => {
    if (!currentRecipeId) return;
    currentEditingRecipeId = currentRecipeId;
    recipeModalTitle.textContent = 'Rezept bearbeiten';

    closeRecipeModalCleanup(); // Bearbeiten-Status zurücksetzen

    try {
        const docRef = db.collection('cookbooks').doc(currentCookbookId)
                         .collection('recipes').doc(currentEditingRecipeId);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
            const data = docSnap.data();
            modalRecipeName.value = data.title || '';
            modalRecipeImage.value = data.imageUrl || '';
            modalRecipeNotes.value = data.notes || '';
            ingredientsArray = data.ingredients || []; renderIngredientList();
            stepsArray = data.instructions || []; renderStepsList();
            setRating(data.rating || 0);

            const savedServings = data.servings || 4; 
            
            // NEU: Logik für [1, 2, 4]
            const presetServings = [1, 2, 4];
            if (presetServings.includes(savedServings)) {
                setServings(savedServings); // Klickt den Button
                customServingInput.value = ''; // Leert das Feld
            } else {
                // Es ist eine EIGENE Zahl
                setServings(null); // Deaktiviert alle Buttons
                customServingInput.value = savedServings; // Füllt das Feld
                currentServings = savedServings; // Setzt den globalen Wert
            }

            const savedTags = data.tags || [];
            if (tagSelectionGroup) {
                tagSelectionGroup.querySelectorAll('.tag-btn').forEach(btn => {
                    btn.classList.toggle('active', savedTags.includes(btn.dataset.tag));
                });
            }
            closeViewModal(); 
            recipeModal.classList.remove('modal-hidden'); 
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

// Setzt den Bearbeiten-Status der Listen zurück
const closeRecipeModalCleanup = () => {
    // Zutaten-Bearbeitung zurücksetzen
    currentEditingIngredientIndex = null;
    if (addIngredientBtn) {
        addIngredientBtn.textContent = '+';
        addIngredientBtn.classList.remove('edit-mode');
    }
    if (ingredientInput) ingredientInput.value = '';

    // Schritte-Bearbeitung zurücksetzen
    currentEditingStepIndex = null;
    if (addStepBtn) {
        addStepBtn.textContent = '+';
        addStepBtn.classList.remove('edit-mode');
    }
    if (stepInput) stepInput.value = '';
};

const closeRecipeModal = () => {
    recipeModal.classList.add('modal-hidden');
    currentEditingRecipeId = null;
    closeRecipeModalCleanup(); // Immer aufräumen
};

const openViewModal = async (recipeId) => {
    // ... (Diese Funktion ist unverändert)
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
        
        let ratingHtml = `<div class="display-rating" data-rating="${recipe.rating || 0}">`;
        if (recipe.rating && recipe.rating > 0) {
            for (let i = 1; i <= 5; i++) { ratingHtml += (i <= recipe.rating) ? '★' : '☆'; }
        } else { ratingHtml += 'Keine Bewertung'; }
        ratingHtml += '</div>';

        let servingsHtml = '';
        if (recipe.servings && recipe.servings > 0) {
            servingsHtml = `<strong>Portionen:</strong> <span class="display-servings">${recipe.servings}</span>`;
        }
        
        let tagsHtml = '';
        if (recipe.tags && recipe.tags.length > 0) {
            tagsHtml = '<strong>Tags:</strong><div class="display-tags">';
            recipe.tags.forEach(tag => { tagsHtml += `<span class="display-tag-pill">${tag}</span>`; });
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
            ${imageHtml} <h3>${recipe.title}</h3> ${ratingHtml} ${servingsHtml} ${tagsHtml}
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

// --- Filter-Modal Funktionen (unverändert) ---
const openFilterModal = () => {
    if (!filterModal) return;
    filterSearchInput.value = currentFilters.search;
    setFilterRating(currentFilters.rating);
    filterTagGroup.querySelectorAll('.tag-btn').forEach(btn => {
        btn.classList.toggle('active', currentFilters.tags.includes(btn.dataset.tag));
    });
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

// --- Funktion zum Anzeigen des Inhalts (unverändert) ---
const showContent = () => { 
    if (loader) loader.style.display = 'none'; 
    if (navbar) navbar.classList.remove('content-hidden'); 
    if (mainContent) mainContent.classList.remove('content-hidden'); 
};

// --- (Platzhalter - nicht mehr verwendet) ---
const closeAllItemMenus = () => {
    // Nicht mehr benötigt
};

// --- Zutaten-Funktionen (Überarbeitet auf Hover-Icons) ---
const renderIngredientList = () => { 
    if (!ingredientList) return; 
    ingredientList.innerHTML = ''; 
    ingredientsArray.forEach((ingredient, index) => { 
        const li = document.createElement('li'); 
        li.innerHTML = ''; // Start clean

        const textSpan = document.createElement('span');
        textSpan.className = 'list-item-text';
        textSpan.textContent = ingredient;
        li.appendChild(textSpan);
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';
        actionsDiv.innerHTML = `
            <button type="button" class="item-action-btn menu-btn-edit-item" title="Bearbeiten" data-index="${index}" data-type="ingredient">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.5-.5H3v-.5a.5.5 0 0 1-.5-.5v-1.5c0-.276-.224-.5-.5-.5s-.5.224-.5.5v1.5c0 .013 0 .027.002.04L.5 13.5a.5.5 0 0 0 .5.5h2.793l6.5-6.5-2.793-2.793z"/>
                </svg>
            </button>
            <button type="button" class="item-action-btn menu-btn-delete-item" title="Löschen" data-index="${index}" data-type="ingredient">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                </svg>
            </button>
        `;
        
        li.appendChild(actionsDiv);
        ingredientList.appendChild(li); 
    }); 
};

const addIngredient = () => { 
    if (!ingredientInput) return; 
    const ingredient = ingredientInput.value.trim(); 
    if (!ingredient) return;

    if (currentEditingIngredientIndex !== null) {
        ingredientsArray[currentEditingIngredientIndex] = ingredient;
        currentEditingIngredientIndex = null; 
        addIngredientBtn.textContent = '+';
        addIngredientBtn.classList.remove('edit-mode');
    } else {
        ingredientsArray.push(ingredient); 
    }
    
    renderIngredientList(); 
    ingredientInput.value = ''; 
    ingredientInput.focus(); 
};

const removeIngredient = (index) => { 
    ingredientsArray.splice(index, 1); 
    renderIngredientList(); 
};

const editIngredient = (index) => {
    if (index === null || ingredientsArray[index] === undefined) return;
    
    closeRecipeModalCleanup(); // Alle anderen Edits beenden

    currentEditingIngredientIndex = index;
    ingredientInput.value = ingredientsArray[index];
    addIngredientBtn.textContent = '✔';
    addIngredientBtn.classList.add('edit-mode');
    ingredientInput.focus();
};


// --- Schritte-Funktionen (Überarbeitet auf Hover-Icons) ---
const renderStepsList = () => { 
    if (!stepList) return; 
    stepList.innerHTML = ''; 
    stepsArray.forEach((step, index) => { 
        const li = document.createElement('li'); 
        li.innerHTML = ''; // Start clean

        const textSpan = document.createElement('span');
        textSpan.className = 'list-item-text';
        textSpan.textContent = step;
        li.appendChild(textSpan);
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';
        actionsDiv.innerHTML = `
            <button type="button" class="item-action-btn menu-btn-edit-item" title="Bearbeiten" data-index="${index}" data-type="step">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.5-.5H3v-.5a.5.5 0 0 1-.5-.5v-1.5c0-.276-.224-.5-.5-.5s-.5.224-.5.5v1.5c0 .013 0 .027.002.04L.5 13.5a.5.5 0 0 0 .5.5h2.793l6.5-6.5-2.793-2.793z"/>
                </svg>
            </button>
            <button type="button" class="item-action-btn menu-btn-delete-item" title="Löschen" data-index="${index}" data-type="step">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                </svg>
            </button>
        `;
        
        li.appendChild(actionsDiv);
        stepList.appendChild(li); 
    }); 
};

const addStep = () => { 
    if (!stepInput) return; 
    const step = stepInput.value.trim(); 
    if (!step) return; 
    
    if (currentEditingStepIndex !== null) {
        stepsArray[currentEditingStepIndex] = step;
        currentEditingStepIndex = null; 
        addStepBtn.textContent = '+';
        addStepBtn.classList.remove('edit-mode');
    } else {
        stepsArray.push(step); 
    }
    
    renderStepsList(); 
    stepInput.value = ''; 
    stepInput.focus(); 
};

const removeStep = (index) => { 
    stepsArray.splice(index, 1); 
    renderStepsList(); 
};

const editStep = (index) => {
    if (index === null || stepsArray[index] === undefined) return;

    closeRecipeModalCleanup(); // Alle anderen Edits beenden

    currentEditingStepIndex = index;
    stepInput.value = stepsArray[index];
    addStepBtn.textContent = '✔';
    addStepBtn.classList.add('edit-mode');
    stepInput.focus();
};


// --- Bewertungs-Funktionen (unverändert) ---
const setRating = (rating) => {
    currentRating = Number(rating);
    if (ratingStars) {
        ratingStars.forEach(star => {
            star.classList.toggle('active', star.dataset.value <= currentRating);
        });
    }
};

// --- Portionen-Funktionen (NEUE LOGIK) ---
const setServings = (value) => {
    // value kann eine Zahl (von Buttons) oder null (von Input) sein
    if (value !== null) {
        // Ein Button wurde geklickt
        currentServings = Number(value);
        if (customServingInput) customServingInput.value = '';
        
        // Visuelles Update für Buttons
        if (servingButtons) {
            servingButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value == currentServings);
            });
        }
    } else {
        // Das Input-Feld wird benutzt
        const customValue = parseInt(customServingInput.value, 10);
        if (!isNaN(customValue) && customValue > 0) {
            currentServings = customValue;
        } else {
            currentServings = 0; // Ungültig, wenn leer
        }
        
        // Visuelles Update: ALLE Buttons deaktivieren
        if (servingButtons) {
            servingButtons.forEach(btn => {
                btn.classList.remove('active');
            });
        }
    }
};


// --- Initialisierung (ERWEITERT) ---
const init = () => {
    console.log("recipes.js Init Start (Version mit Portions-Fix & Tag-Redesign)");

    // --- DOM-Elemente holen ---
    loader = document.getElementById('loader');
    navbar = document.querySelector('.navbar');
    mainContent = document.querySelector('.main-content');
    cookbookTitleDisplay = document.getElementById('cookbook-title');
    recipeGallery = document.getElementById('recipe-gallery');
    galleryMessage = document.getElementById('recipe-gallery-message');
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
    servingsGroup = document.getElementById('modal-servings-select');
    customServingInput = document.getElementById('modal-serving-custom');
    servingButtons = servingsGroup ? servingsGroup.querySelectorAll('.serving-btn') : [];
    modalRecipeNotes = document.getElementById('modal-recipe-notes');
    tagSelectionGroup = document.getElementById('modal-tag-selection');
    viewModal = document.getElementById('view-recipe-modal');
    viewModalCloseBtn = document.getElementById('view-modal-close-btn');
    viewRecipeContent = document.getElementById('view-recipe-content');
    editRecipeBtn = document.getElementById('btn-edit-recipe');
    deleteRecipeBtn = document.getElementById('btn-delete-recipe');
    openFilterBtn = document.getElementById('open-filter-btn');
    filterModal = document.getElementById('filter-modal');
    filterModalCloseBtn = document.getElementById('filter-modal-close-btn');
    filterSearchInput = document.getElementById('filter-search-input');
    filterRatingGroup = document.getElementById('filter-rating-group');
    filterRatingStars = filterRatingGroup ? filterRatingGroup.querySelectorAll('.rating-star') : [];
    clearRatingFilterBtn = document.getElementById('clear-rating-filter');
    filterTagGroup = document.getElementById('filter-tag-group');
    applyFilterBtn = document.getElementById('btn-apply-filters');
    activeFiltersDisplay = document.getElementById('active-filters-display');
    // --- ENDE DOM-Elemente holen ---
    
    // (Sicherheitscheck, URL-Params, Auth Wächter - unverändert)
    if (!cookbookTitleDisplay || !recipeGallery || !galleryMessage || !recipeModal || !viewModal || !tagSelectionGroup || !ratingGroup || !filterModal || !openFilterBtn || !activeFiltersDisplay || !servingsGroup || !customServingInput || !ingredientList || !stepList) {
        console.error("FEHLER: Wichtige HTML-Elemente auf der Rezeptseite fehlen!");
        return;
    }
    try { 
        const urlParams = new URLSearchParams(window.location.search); 
        const cookbookId = urlParams.get('id'); 
        if (!cookbookId) { alert('Kein Kochbuch ausgewählt!'); window.location.href = 'dashboard.html'; return; } 
        currentCookbookId = cookbookId; 
    }
    catch (error) { console.error("Fehler URL:", error); alert("Fehler Kochbuch-ID."); window.location.href = 'dashboard.html'; return; }
    auth.onAuthStateChanged((user) => { 
        if (user) { 
            currentUser = user; 
            if (currentCookbookId) { 
                loadCookbookDetails(user.uid, currentCookbookId); 
                loadRecipes(user.uid, currentCookbookId); 
            } 
            showContent(); 
        } else { 
            currentUser = null; 
            window.location.href = 'index.html'; 
        } 
    });

    // --- Event Listeners (Angepasst) ---
    if (recipeGallery) recipeGallery.addEventListener('click', (e) => { if (e.target.closest('#btn-open-create-modal')) { openCreateModal(); return; } const clickedRecipe = e.target.closest('.recipe-data-item'); if (clickedRecipe) { openViewModal(clickedRecipe.dataset.id); } });
    if (saveRecipeBtn) saveRecipeBtn.addEventListener('click', saveRecipe);
    if (recipeModalCloseBtn) recipeModalCloseBtn.addEventListener('click', closeRecipeModal);
    if (recipeModal) recipeModal.addEventListener('click', (e) => { if (e.target === recipeModal) closeRecipeModal(); });
    if (deleteRecipeBtn) deleteRecipeBtn.addEventListener('click', deleteRecipe);
    if (viewModalCloseBtn) viewModalCloseBtn.addEventListener('click', closeViewModal);
    if (viewModal) viewModal.addEventListener('click', (e) => { if (e.target === viewModal) closeViewModal(); });
    if (editRecipeBtn) editRecipeBtn.addEventListener('click', openEditModal);
    if (addIngredientBtn) addIngredientBtn.addEventListener('click', addIngredient);
    if (ingredientInput) ingredientInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addIngredient(); } });
    if (addStepBtn) addStepBtn.addEventListener('click', addStep);
    if (stepInput) stepInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } });
    
    if (ratingStars) {
        ratingStars.forEach(star => {
            star.addEventListener('click', () => { setRating(star.dataset.value); });
            star.addEventListener('mouseover', () => {
                 ratingStars.forEach(s => { s.classList.toggle('hover', s.dataset.value <= star.dataset.value); });
            });
        });
        ratingGroup.addEventListener('mouseleave', () => { setRating(currentRating); });
    }
    
    // NEUE PORTIONS-LISTENER
    if (servingsGroup) {
        servingsGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.serving-btn');
            if (btn) {
                setServings(btn.dataset.value); // Ruft mit "1", "2" oder "4" auf
            }
        });
    }
    if (customServingInput) {
        // Ruft setServings(null) auf, um die Buttons zu deaktivieren
        customServingInput.addEventListener('input', () => setServings(null)); 
        customServingInput.addEventListener('focus', () => setServings(null));
    }
    // ENDE NEUE PORTIONS-LISTENER
    
    if (tagSelectionGroup) {
        tagSelectionGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.tag-btn');
            if (btn) { e.preventDefault(); btn.classList.toggle('active'); }
        });
    }
    
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
    if (filterTagGroup) {
        filterTagGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.tag-btn');
            if (btn) { e.preventDefault(); btn.classList.toggle('active'); }
        });
    }
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

    // NEU: Event-Delegation für Zutaten-Liste
    if (ingredientList) {
        ingredientList.addEventListener('click', (e) => {
            const btn = e.target.closest('button.item-action-btn'); // Nur auf Action-Buttons reagieren
            if (!btn) return;

            e.preventDefault();
            const index = Number(btn.dataset.index);
            
            if (btn.classList.contains('menu-btn-delete-item')) {
                removeIngredient(index);
            }
            if (btn.classList.contains('menu-btn-edit-item')) {
                editIngredient(index);
            }
        });
    }
    
    // NEU: Event-Delegation für Schritte-Liste
    if (stepList) {
        stepList.addEventListener('click', (e) => {
            const btn = e.target.closest('button.item-action-btn'); // Nur auf Action-Buttons reagieren
            if (!btn) return;

            e.preventDefault();
            const index = Number(btn.dataset.index);
            
            if (btn.classList.contains('menu-btn-delete-item')) {
                removeStep(index);
            }
            if (btn.classList.contains('menu-btn-edit-item')) {
                editStep(index);
            }
        });
    }
};

// --- (Restliche Funktionen sind unverändert) ---

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

const createAddRecipeTile = () => {
    if (!recipeGallery) return;
    const item = document.createElement('div'); 
    item.className = 'recipe-item add-recipe-tile'; 
    item.id = 'btn-open-create-modal'; 
    item.innerHTML = '<span class="plus-icon">+</span>'; 
    recipeGallery.appendChild(item);
};

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

const applyFilters = () => {
    currentFilters.search = filterSearchInput.value.toLowerCase().trim();
    const activeStar = filterRatingGroup.querySelector('.rating-star.active:last-child');
    currentFilters.rating = activeStar ? Number(activeStar.dataset.value) : 0;
    currentFilters.tags = [];
    filterTagGroup.querySelectorAll('.tag-btn.active').forEach(btn => {
        currentFilters.tags.push(btn.dataset.tag);
    });
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
    currentFilters.tags.forEach(tag => {
        hasFilters = true;
        activeFiltersDisplay.innerHTML += `<span class="active-filter-pill">${tag}<button data-filter-type="tag" data-filter-value="${tag}">&times;</button></span>`;
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
    filterTagGroup.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));
    renderFilteredRecipes();
    displayActiveFilters();
};

const renderFilteredRecipes = () => {
    if (!recipeGallery) return;
    recipeGallery.innerHTML = '';
    let filteredRecipes = [...allCookbookRecipes];

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

const saveRecipe = async () => {
    const title = modalRecipeName.value.trim();
    const imageUrl = modalRecipeImage.value.trim();
    const ingredients = ingredientsArray;
    const instructions = stepsArray;
    const notes = modalRecipeNotes.value.trim();
    const rating = currentRating;
    
    // NEU: Stellt sicher, dass der Wert aus dem Input-Feld gelesen wird, falls keine Buttons aktiv sind
    let servings = currentServings;
    if (customServingInput.value) {
        const customVal = parseInt(customServingInput.value, 10);
        if (!isNaN(customVal) && customVal > 0) {
            servings = customVal;
        }
    }

    const selectedTags = [];
    if (tagSelectionGroup) {
        tagSelectionGroup.querySelectorAll('.tag-btn.active').forEach(btn => {
            selectedTags.push(btn.dataset.tag);
        });
    }
    const tags = selectedTags;
    
    if (!title) { alert('Bitte gib einen Rezeptnamen ein.'); return; }
    // NEU: Stellt sicher, dass 'servings' ein gültiger Wert ist
    if (!servings || servings <= 0) { 
        alert('Bitte gib eine gültige Portionsgröße ein.'); 
        customServingInput.focus();
        return; 
    } 

    const recipeData = {
        title: title, 
        imageUrl: imageUrl, 
        ingredients: ingredients, 
        instructions: instructions,
        notes: notes, 
        tags: tags, 
        rating: Number(rating),
        servings: Number(servings) // Speichert die korrigierte Zahl
    };
    
    try {
        if (currentEditingRecipeId) {
            const docRef = db.collection('cookbooks').doc(currentCookbookId)
                             .collection('recipes').doc(currentEditingRecipeId);
            await docRef.update(recipeData);
        } else {
            recipeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('cookbooks').doc(currentCookbookId)
                      .collection('recipes').add(recipeData);
        }
        closeRecipeModal();
        loadRecipes(currentUser.uid, currentCookbookId); 
    } catch (error) { 
        console.error('Fehler beim Speichern:', error); 
    }
};

const deleteRecipe = async () => {
    if (!currentRecipeId) { alert("Fehler: Kein Rezept ausgewählt."); return; }
    if (!confirm('Bist du sicher, dass du dieses Rezept löschen möchtest?')) return;
    if (!currentUser || !currentCookbookId) return;
    
    try {
        await db.collection('cookbooks').doc(currentCookbookId)
                  .collection('recipes').doc(currentRecipeId).delete();
        
        console.log('Rezept gelöscht!');
        closeViewModal();
        loadRecipes(currentUser.uid, currentCookbookId); 
    } catch (error) { 
        console.error('Fehler beim Löschen:', error); 
    }
};

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);