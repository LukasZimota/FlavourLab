// --- recipe.ui.js ---
// Verwaltet alle DOM-Elemente und UI-Rendering-Funktionen.

import { state, setRating as setRatingState, setServings as setServingsState, setCurrentImageMode } from './recipe.state.js';

// Objekt zum Speichern aller DOM-Element-Referenzen
export const elements = {};

// Diese Funktion füllt das 'elements'-Objekt
export function cacheElements() {
    elements.loader = document.getElementById('loader');
    elements.navbar = document.querySelector('.navbar');
    elements.mainContent = document.querySelector('.main-content');
    elements.cookbookTitleDisplay = document.getElementById('cookbook-title');
    elements.recipeGallery = document.getElementById('recipe-gallery');
    elements.galleryMessage = document.getElementById('recipe-gallery-message');
    
    // Erstellen-Modal
    elements.recipeModal = document.getElementById('create-recipe-modal');
    elements.recipeModalCloseBtn = document.getElementById('create-modal-close-btn');
    elements.saveRecipeBtn = document.getElementById('btn-save-recipe');
    elements.recipeModalTitle = elements.recipeModal.querySelector('h3');
    elements.modalRecipeName = document.getElementById('modal-recipe-name');
    
    // *** NEUE BILD-ELEMENTE ***
    elements.imageModeTabs = document.querySelector('.image-mode-tabs');
    elements.imageModePanels = {
        auto: document.getElementById('image-mode-auto-content'),
        link: document.getElementById('image-mode-link-content'),
        upload: document.getElementById('image-mode-upload-content')
    };
    elements.modalRecipeImage = document.getElementById('modal-recipe-image'); // (bleibt)
    elements.findImageBtn = document.querySelector('.image-source-btn'); // (bleibt)
    
    elements.ingredientInput = document.getElementById('modal-ingredient-input');
    elements.addIngredientBtn = document.getElementById('btn-add-ingredient');
    elements.ingredientList = document.getElementById('ingredient-list');
    elements.stepInput = document.getElementById('modal-step-input');
    elements.addStepBtn = document.getElementById('btn-add-step');
    elements.stepList = document.getElementById('step-list');
    elements.ratingGroup = document.getElementById('modal-recipe-rating');
    elements.ratingStars = elements.ratingGroup ? elements.ratingGroup.querySelectorAll('.rating-star') : [];
    elements.servingsGroup = document.getElementById('modal-servings-select');
    elements.customServingInput = document.getElementById('modal-serving-custom');
    elements.servingButtons = elements.servingsGroup ? elements.servingsGroup.querySelectorAll('.serving-btn') : [];
    elements.modalRecipeNotes = document.getElementById('modal-recipe-notes');
    elements.tagSelectionGroup = document.getElementById('modal-tag-selection');
    
    // Ansicht-Modal
    elements.viewModal = document.getElementById('view-recipe-modal');
    elements.viewModalCloseBtn = document.getElementById('view-modal-close-btn');
    elements.viewRecipeContent = document.getElementById('view-recipe-content');
    elements.editRecipeBtn = document.getElementById('btn-edit-recipe');
    elements.deleteRecipeBtn = document.getElementById('btn-delete-recipe');
    
    // Filter-Modal
    elements.openFilterBtn = document.getElementById('open-filter-btn');
    elements.filterModal = document.getElementById('filter-modal');
    elements.filterModalCloseBtn = document.getElementById('filter-modal-close-btn');
    elements.filterSearchInput = document.getElementById('filter-search-input');
    elements.filterRatingGroup = document.getElementById('filter-rating-group');
    elements.filterRatingStars = elements.filterRatingGroup ? elements.filterRatingGroup.querySelectorAll('.rating-star') : [];
    elements.clearRatingFilterBtn = document.getElementById('clear-rating-filter');
    elements.filterTagGroup = document.getElementById('filter-tag-group');
    elements.applyFilterBtn = document.getElementById('btn-apply-filters');
    elements.activeFiltersDisplay = document.getElementById('active-filters-display');
}

// --- Globale UI-Funktionen ---

export function showContent() {
    if (elements.loader) elements.loader.style.display = 'none';
    if (elements.navbar) elements.navbar.classList.remove('content-hidden');
    if (elements.mainContent) elements.mainContent.classList.remove('content-hidden');
}

export function setCookbookTitle(title) {
    if (elements.cookbookTitleDisplay) {
        elements.cookbookTitleDisplay.textContent = `Rezepte in: ${title}`;
    }
}

// *** NEUE UI-FUNKTION FÜR BILD-TABS ***
export function setImageModeUI(mode) {
    if (!elements.imageModeTabs || !elements.imageModePanels) return;

    // 1. Status im State aktualisieren
    setCurrentImageMode(mode);

    // 2. Buttons aktualisieren
    elements.imageModeTabs.querySelectorAll('.image-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // 3. Panels aktualisieren
    Object.keys(elements.imageModePanels).forEach(key => {
        const panel = elements.imageModePanels[key];
        if (panel) {
            panel.style.display = (key === mode) ? 'block' : 'none';
        }
    });
}

// --- Erstellen/Bearbeiten-Modal UI ---

export function openCreateModal() {
    elements.recipeModalTitle.textContent = 'Neues Rezept hinzufügen';
    elements.modalRecipeName.value = '';
    elements.modalRecipeImage.value = ''; // (wird jetzt im 'link' panel versteckt)
    elements.modalRecipeNotes.value = '';
    
    setImageModeUI('auto'); // *** NEU: Standard-Tab setzen
    
    renderIngredientList();
    renderStepsList();
    setRating(0);
    setServings(4);
    elements.customServingInput.value = '';
    if (elements.tagSelectionGroup) {
        elements.tagSelectionGroup.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));
    }
    closeRecipeModalCleanup();
    elements.recipeModal.classList.remove('modal-hidden');
}

export function openEditModal(data) {
    elements.recipeModalTitle.textContent = 'Rezept bearbeiten';
    closeRecipeModalCleanup();

    elements.modalRecipeName.value = data.title || '';
    elements.modalRecipeImage.value = data.imageUrl || '';
    elements.modalRecipeNotes.value = data.notes || '';

    // *** NEU: Korrekten Bild-Tab beim Bearbeiten auswählen ***
    const imageUrl = data.imageUrl || '';
    if (imageUrl.startsWith('https://source.unsplash.com')) {
        setImageModeUI('auto');
    } else if (imageUrl) {
        setImageModeUI('link');
    } else {
        setImageModeUI('auto'); // Standard, falls kein Bild
    }

    renderIngredientList();
    renderStepsList();
    setRating(data.rating || 0);

    const savedServings = data.servings || 4;
    const presetServings = [1, 2, 4];
    if (presetServings.includes(savedServings)) {
        setServings(savedServings);
        elements.customServingInput.value = '';
    } else {
        setServings(null);
        elements.customServingInput.value = savedServings;
        setServingsState(savedServings);
    }

    const savedTags = data.tags || [];
    if (elements.tagSelectionGroup) {
        elements.tagSelectionGroup.querySelectorAll('.tag-btn').forEach(btn => {
            btn.classList.toggle('active', savedTags.includes(btn.dataset.tag));
        });
    }
    
    closeViewModal();
    elements.recipeModal.classList.remove('modal-hidden');
}

export function closeRecipeModal() {
    elements.recipeModal.classList.add('modal-hidden');
    closeRecipeModalCleanup();
}

export function closeRecipeModalCleanup() {
    if (elements.addIngredientBtn) {
        elements.addIngredientBtn.textContent = '+';
        elements.addIngredientBtn.classList.remove('edit-mode');
    }
    if (elements.ingredientInput) elements.ingredientInput.value = '';

    if (elements.addStepBtn) {
        elements.addStepBtn.textContent = '+';
        elements.addStepBtn.classList.remove('edit-mode');
    }
    if (elements.stepInput) elements.stepInput.value = '';
}

// --- Ansicht-Modal UI ---

export function openViewModal(recipe) {
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
        recipe.tags.forEach(tag => { 
            tagsHtml += `<span class="display-tag-pill" data-tag="${tag}">${tag}</span>`; 
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
        // *** WICHTIG: Fügt 'crossorigin' hinzu, damit Unsplash-Bilder geladen werden ***
        imageHtml = `<img src="${recipe.imageUrl}" alt="${recipe.title}" crossorigin="anonymous">`;
    }
    
    elements.viewRecipeContent.innerHTML = `
        ${imageHtml} <h3>${recipe.title}</h3> ${ratingHtml} ${servingsHtml} ${tagsHtml}
        <strong>Zutaten:</strong> ${ingredientsHtml}
        <strong>Anleitung:</strong> ${instructionsHtml}
        ${notesHtml}
    `;
    elements.viewModal.classList.remove('modal-hidden');
}

export function showViewModalLoading() {
    elements.viewRecipeContent.innerHTML = '<h3>Lade Rezept...</h3>';
    elements.viewModal.classList.remove('modal-hidden');
}

export function showViewModalError(message) {
    elements.viewRecipeContent.innerHTML = `<h3>${message}</h3>`;
}

export function closeViewModal() {
    elements.viewModal.classList.add('modal-hidden');
    elements.viewRecipeContent.innerHTML = '';
}

// --- Filter-Modal UI ---

export function openFilterModal() {
    if (!elements.filterModal) return;
    elements.filterSearchInput.value = state.currentFilters.search;
    setFilterRating(state.currentFilters.rating);
    elements.filterTagGroup.querySelectorAll('.tag-btn').forEach(btn => {
        btn.classList.toggle('active', state.currentFilters.tags.includes(btn.dataset.tag));
    });
    elements.filterModal.classList.remove('modal-hidden');
}

export function closeFilterModal() {
    if (elements.filterModal) elements.filterModal.classList.add('modal-hidden');
}

export function setFilterRating(rating) {
    if (!elements.filterRatingStars) return;
    elements.filterRatingStars.forEach(star => {
        star.classList.toggle('active', star.dataset.value <= rating);
    });
}

// --- Listen-Rendering (Zutaten & Schritte) ---

export function renderIngredientList() {
    if (!elements.ingredientList) return;
    elements.ingredientList.innerHTML = '';
    state.ingredientsArray.forEach((ingredient, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="list-item-text">${ingredient}</span>
            <div class="item-actions">
                <button type="button" class="item-action-btn menu-btn-edit-item" title="Bearbeiten" data-index="${index}" data-type="ingredient">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.5-.5H3v-.5a.5.5 0 0 1-.5-.5v-1.5c0-.276-.224-.5-.5-.5s-.5.224-.5.5v1.5c0 .013 0 .027.002.04L.5 13.5a.5.5 0 0 0 .5.5h2.793l6.5-6.5-2.793-2.793z"/></svg>
                </button>
                <button type="button" class="item-action-btn menu-btn-delete-item" title="Löschen" data-index="${index}" data-type="ingredient">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>
                </button>
            </div>
        `;
        elements.ingredientList.appendChild(li);
    });
}

export function startEditIngredient(index) {
    closeRecipeModalCleanup(); // Alle anderen Edits beenden
    elements.ingredientInput.value = state.ingredientsArray[index];
    elements.addIngredientBtn.textContent = '✔';
    elements.addIngredientBtn.classList.add('edit-mode');
    elements.ingredientInput.focus();
}

export function renderStepsList() {
    if (!elements.stepList) return;
    elements.stepList.innerHTML = '';
    state.stepsArray.forEach((step, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="list-item-text">${step}</span>
            <div class="item-actions">
                <button type="button" class="item-action-btn menu-btn-edit-item" title="Bearbeiten" data-index="${index}" data-type="step">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.5-.5H3v-.5a.5.5 0 0 1-.5-.5v-1.5c0-.276-.224-.5-.5-.5s-.5.224-.5.5v1.5c0 .013 0 .027.002.04L.5 13.5a.5.5 0 0 0 .5.5h2.793l6.5-6.5-2.793-2.793z"/></svg>
                </button>
                <button type="button" class="item-action-btn menu-btn-delete-item" title="Löschen" data-index="${index}" data-type="step">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>
                </button>
            </div>
        `;
        elements.stepList.appendChild(li);
    });
}

export function startEditStep(index) {
    closeRecipeModalCleanup(); // Alle anderen Edits beenden
    elements.stepInput.value = state.stepsArray[index];
    elements.addStepBtn.textContent = '✔';
    elements.addStepBtn.classList.add('edit-mode');
    elements.stepInput.focus();
}

// --- Bewertungs- & Portions-UI ---

export function setRating(rating) {
    setRatingState(rating); // Status aktualisieren
    if (elements.ratingStars) {
        elements.ratingStars.forEach(star => {
            star.classList.toggle('active', star.dataset.value <= state.currentRating);
        });
    }
}

export function setServings(value) {
    let newServings = 0;
    if (value !== null) {
        // Button-Klick
        newServings = Number(value);
        if (elements.customServingInput) elements.customServingInput.value = '';
    } else {
        // Input-Feld-Nutzung
        const customValue = parseInt(elements.customServingInput.value, 10);
        if (!isNaN(customValue) && customValue > 0) {
            newServings = customValue;
        }
    }
    
    setServingsState(newServings); // Globalen Status aktualisieren

    // Visuelles Update
    if (elements.servingButtons) {
        elements.servingButtons.forEach(btn => {
            btn.classList.toggle('active', value !== null && btn.dataset.value == newServings);
        });
    }
}

// --- Rezept-Galerie-Rendering ---

export function createAddRecipeTile() {
    if (!elements.recipeGallery) return;
    const item = document.createElement('div');
    item.className = 'recipe-item add-recipe-tile';
    item.id = 'btn-open-create-modal';
    item.innerHTML = '<span class="plus-icon">+</span>';
    elements.recipeGallery.appendChild(item);
}

export function renderFilteredRecipes() {
    if (!elements.recipeGallery) return;
    elements.recipeGallery.innerHTML = '';
    let filteredRecipes = [...state.allCookbookRecipes];

    if (state.currentFilters.search) {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.title.toLowerCase().includes(state.currentFilters.search));
    }
    if (state.currentFilters.rating > 0) {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.rating && recipe.rating >= state.currentFilters.rating);
    }
    if (state.currentFilters.tags.length > 0) {
        filteredRecipes = filteredRecipes.filter(recipe => {
            if (!recipe.tags || recipe.tags.length === 0) return false;
            return state.currentFilters.tags.every(filterTag => recipe.tags.includes(filterTag));
        });
    }

    createAddRecipeTile();

    if (filteredRecipes.length === 0) {
        if (state.allCookbookRecipes.length > 0) {
            elements.galleryMessage.textContent = "Keine Rezepte entsprechen deinen Filtern.";
        } else {
            elements.galleryMessage.textContent = "Füge dein erstes Rezept hinzu!";
        }
    } else {
        elements.galleryMessage.textContent = '';
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
        elements.recipeGallery.appendChild(item);
    });
}

export function displayActiveFilters() {
    if (!elements.activeFiltersDisplay) return;
    elements.activeFiltersDisplay.innerHTML = '';
    let hasFilters = false;
    if (state.currentFilters.search) {
        hasFilters = true;
        elements.activeFiltersDisplay.innerHTML += `<span class="active-filter-pill">Suche: "${state.currentFilters.search}"<button data-filter-type="search">&times;</button></span>`;
    }
    if (state.currentFilters.rating > 0) {
        hasFilters = true;
        elements.activeFiltersDisplay.innerHTML += `<span class="active-filter-pill">${state.currentFilters.rating} ★+<button data-filter-type="rating">&times;</button></span>`;
    }
    state.currentFilters.tags.forEach(tag => {
        hasFilters = true;
        elements.activeFiltersDisplay.innerHTML += `<span class="active-filter-pill">${tag}<button data-filter-type="tag" data-filter-value="${tag}">&times;</button></span>`;
    });
    if (hasFilters) {
        elements.activeFiltersDisplay.innerHTML += `<button class="clear-all-filters-btn">Alle Filter löschen</button>`;
    }
}