// --- recipes.js (Haupt-Controller) ---

import { auth } from './firebase-config.js';
// Importiere alle Module
import * as state from './recipe.state.js';
import * as ui from './recipe.ui.js';
import * as service from './recipe.service.js';

// --- Event-Handler (Die "Was passiert wenn..." Logik) ---

// Klick in die Rezept-Galerie
function handleGalleryClick(e) {
    if (e.target.closest('#btn-open-create-modal')) {
        state.resetModalState(); // Status zurücksetzen
        ui.openCreateModal(); // UI öffnen
        return;
    }
    const clickedRecipe = e.target.closest('.recipe-data-item');
    if (clickedRecipe) {
        handleViewRecipeClick(clickedRecipe.dataset.id);
    }
}

// Klick auf "Rezept ansehen"
async function handleViewRecipeClick(recipeId) {
    state.setCurrentRecipeId(recipeId);
    ui.showViewModalLoading();
    try {
        const recipeData = await service.fetchRecipeForView(recipeId);
        ui.openViewModal(recipeData);
    } catch (error) {
        ui.showViewModalError(error.message);
    }
}

// Klick auf "Bearbeiten" im Ansicht-Modal
async function handleEditRecipeClick() {
    if (!state.state.currentRecipeId) return;
    
    state.setCurrentEditingRecipeId(state.state.currentRecipeId); // Setze Edit-Modus
    
    try {
        const recipeData = await service.fetchRecipeForEdit(state.state.currentRecipeId);
        ui.openEditModal(recipeData); // UI-Funktion mit Daten aufrufen
    } catch (error) {
        alert(error.message);
        state.setCurrentEditingRecipeId(null);
    }
}

// Klick auf "Löschen" im Ansicht-Modal
async function handleDeleteRecipeClick() {
    if (!state.state.currentRecipeId) {
        alert("Fehler: Kein Rezept ausgewählt.");
        return;
    }
    if (!confirm('Bist du sicher, dass du dieses Rezept löschen möchtest?')) return;

    try {
        await service.deleteRecipe(state.state.currentRecipeId);
        ui.closeViewModal();
        // Lade Rezepte neu, um die Galerie zu aktualisieren
        await handleLoadRecipes();
    } catch (error) {
        alert(error.message);
    }
}


// *** GEÄNDERT: Geht wie gewünscht zurück zur Google-Suche ***
/**
 * Öffnet Google Images in einem neuen Tab (für den "Link"-Modus).
 */
function handleFindImageClick(e) {
    e.preventDefault();
    
    const title = ui.elements.modalRecipeName.value.trim();
    if (!title) {
        alert('Gib zuerst einen Rezeptnamen ein, um nach Bildern zu suchen.');
        ui.elements.modalRecipeName.focus();
        return;
    }

    // Baut die Such-URL für Google Images
    const query = encodeURIComponent(title);
    const url = `https://www.google.com/search?tbm=isch&q=${query}`;

    // Öffnet die Suche in einem neuen Tab
    window.open(url, '_blank');
    
    ui.elements.modalRecipeImage.focus();
    alert('Google Bilder wurde im neuen Tab geöffnet.\n\nKopiere die Bild-URL (Rechtsklick -> "Bildadresse kopieren") und füge sie hier ein.');
}

// Klick auf "Rezept speichern" (Erstellen oder Bearbeiten)
// *** STARK GEÄNDERT: Prüft jetzt den Image-Mode ***
async function handleSaveRecipeClick() {
    const title = ui.elements.modalRecipeName.value.trim();
    if (!title) { alert('Bitte gib einen Rezeptnamen ein.'); return; }
    
    const notes = ui.elements.modalRecipeNotes.value.trim();
    
    let servings = state.state.currentServings;
    if (ui.elements.customServingInput.value) {
        const customVal = parseInt(ui.elements.customServingInput.value, 10);
        if (!isNaN(customVal) && customVal > 0) {
            servings = customVal;
        }
    }
    if (!servings || servings <= 0) {
        alert('Bitte gib eine gültige Portionsgröße ein.');
        ui.elements.customServingInput.focus();
        return;
    }

    // *** NEUE BILD-LOGIK ***
    let imageUrl = '';
    const imageMode = state.state.currentImageMode;

    if (imageMode === 'auto') {
        // "Automatisch": Baut eine Unsplash Source URL
        // Ersetzt Leerzeichen durch Kommas für bessere Suchergebnisse
        const query = encodeURIComponent(title.split(' ').join(','));
        imageUrl = `https://source.unsplash.com/featured/800x600/?${query}`;
    } 
    else if (imageMode === 'link') {
        // "Link": Nimmt den Wert aus dem Input-Feld
        imageUrl = ui.elements.modalRecipeImage.value.trim();
    } 
    else if (imageMode === 'upload') {
        // "Upload": Platzhalter für die Zukunft
        imageUrl = ''; // (Oder eine Standard-URL)
    }
    // *** ENDE BILD-LOGIK ***


    const selectedTags = [];
    if (ui.elements.tagSelectionGroup) {
        ui.elements.tagSelectionGroup.querySelectorAll('.tag-btn.active').forEach(btn => {
            selectedTags.push(btn.dataset.tag);
        });
    }

    const recipeData = {
        title: title,
        imageUrl: imageUrl, // Verwendet die neue 'imageUrl' Variable
        ingredients: state.state.ingredientsArray,
        instructions: state.state.stepsArray,
        notes: notes,
        tags: selectedTags,
        rating: Number(state.state.currentRating),
        servings: Number(servings)
    };

    try {
        await service.saveRecipe(recipeData);
        ui.closeRecipeModal();
        await handleLoadRecipes(); // Rezepte neu laden
    } catch (error) {
        alert(error.message);
    }
}

// --- Handler für Zutaten & Schritte ---

function handleAddIngredient() {
    const ingredient = ui.elements.ingredientInput.value.trim();
    if (!ingredient) return;
    
    state.addIngredient(ingredient); // Status aktualisieren
    ui.renderIngredientList();       // UI neu rendern
    ui.elements.ingredientInput.value = '';
    ui.elements.ingredientInput.focus();
}

function handleIngredientListClick(e) {
    const btn = e.target.closest('button.item-action-btn');
    if (!btn) return;
    e.preventDefault();
    
    const index = Number(btn.dataset.index);
    if (btn.classList.contains('menu-btn-delete-item')) {
        state.removeIngredient(index);
        ui.renderIngredientList(); // UI neu rendern
    }
    if (btn.classList.contains('menu-btn-edit-item')) {
        state.setEditIngredient(index);
        ui.startEditIngredient(index); // UI-Funktion
    }
}

function handleAddStep() {
    const step = ui.elements.stepInput.value.trim();
    if (!step) return;

    state.addStep(step);       // Status aktualisieren
    ui.renderStepsList();      // UI neu rendern
    ui.elements.stepInput.value = '';
    ui.elements.stepInput.focus();
}

function handleStepListClick(e) {
    const btn = e.target.closest('button.item-action-btn');
    if (!btn) return;
    e.preventDefault();

    const index = Number(btn.dataset.index);
    if (btn.classList.contains('menu-btn-delete-item')) {
        state.removeStep(index);
        ui.renderStepsList(); // UI neu rendern
    }
    if (btn.classList.contains('menu-btn-edit-item')) {
        state.setEditStep(index);
        ui.startEditStep(index); // UI-Funktion
    }
}

// --- Filter-Handler ---

function handleApplyFilters() {
    const search = ui.elements.filterSearchInput.value.toLowerCase().trim();
    const activeStar = ui.elements.filterRatingGroup.querySelector('.rating-star.active:last-child');
    const rating = activeStar ? Number(activeStar.dataset.value) : 0;
    
    const tags = [];
    ui.elements.filterTagGroup.querySelectorAll('.tag-btn.active').forEach(btn => {
        tags.push(btn.dataset.tag);
    });

    state.setFilters(search, rating, tags); // Status aktualisieren
    ui.renderFilteredRecipes();             // UI aktualisieren
    ui.displayActiveFilters();              // UI aktualisieren
    ui.closeFilterModal();
}

function handleActiveFilterClick(e) {
    if (e.target.classList.contains('clear-all-filters-btn')) {
        state.resetFilters();
        ui.setFilterRating(0);
        ui.elements.filterTagGroup.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));
    }
    
    const pillButton = e.target.closest('.active-filter-pill button');
    if (pillButton) {
        const type = pillButton.dataset.filterType;
        const value = pillButton.dataset.filterValue;
        state.removeFilter(type, value);
    }
    
    // Nach jedem Klick (löschen oder alle löschen) neu rendern
    ui.renderFilteredRecipes();
    ui.displayActiveFilters();
}

// --- Hilfs-Handler ---

// Wrapper, um das Laden der Rezepte zu kapseln
async function handleLoadRecipes() {
    if (!state.state.currentUser || !state.state.currentCookbookId) return;
    
    ui.elements.galleryMessage.textContent = 'Lade Rezepte...';
    try {
        const isEmpty = await service.loadRecipes(state.state.currentUser.uid, state.state.currentCookbookId);
        if (isEmpty) {
            ui.elements.galleryMessage.textContent = 'Füge dein erstes Rezept hinzu!';
        } else {
            ui.elements.galleryMessage.textContent = '';
        }
    } catch (error) {
        ui.elements.galleryMessage.textContent = 'Ein Fehler ist aufgetreten.';
    }
    
    // Nach dem Laden immer die (gefilterte) UI neu rendern
    ui.renderFilteredRecipes();
    ui.displayActiveFilters();
}

// --- Initialisierung ---

function attachEventListeners() {
    // Galerie
    ui.elements.recipeGallery?.addEventListener('click', handleGalleryClick);

    // Erstellen-Modal
    ui.elements.saveRecipeBtn?.addEventListener('click', handleSaveRecipeClick);
    ui.elements.recipeModalCloseBtn?.addEventListener('click', ui.closeRecipeModal);
    ui.elements.recipeModal?.addEventListener('click', (e) => { if (e.target === ui.elements.recipeModal) ui.closeRecipeModal(); });
    
    // *** NEUER LISTENER FÜR BILD-TABS ***
    ui.elements.imageModeTabs?.addEventListener('click', (e) => {
        const button = e.target.closest('.image-mode-btn');
        if (!button) return;
        
        const mode = button.dataset.mode;
        if (mode === 'upload') {
            e.preventDefault(); // Verhindert Klick auf "Upload"
            return;
        }
        
        ui.setImageModeUI(mode); // UI-Funktion aktualisiert State + UI
    });
    
    // Listener für "Suchen"-Button (im "Link"-Tab)
    ui.elements.findImageBtn?.addEventListener('click', handleFindImageClick);

    // Ansicht-Modal
    ui.elements.deleteRecipeBtn?.addEventListener('click', handleDeleteRecipeClick);
    ui.elements.viewModalCloseBtn?.addEventListener('click', ui.closeViewModal);
    ui.elements.viewModal?.addEventListener('click', (e) => { if (e.target === ui.elements.viewModal) ui.closeViewModal(); });
    ui.elements.editRecipeBtn?.addEventListener('click', handleEditRecipeClick);
    
    // Zutaten-Liste
    ui.elements.addIngredientBtn?.addEventListener('click', handleAddIngredient);
    ui.elements.ingredientInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddIngredient(); } });
    ui.elements.ingredientList?.addEventListener('click', handleIngredientListClick);
    
    // Schritte-Liste
    ui.elements.addStepBtn?.addEventListener('click', handleAddStep);
    ui.elements.stepInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep(); } });
    ui.elements.stepList?.addEventListener('click', handleStepListClick);

    // Bewertung
    if (ui.elements.ratingStars) {
        ui.elements.ratingStars.forEach(star => {
            star.addEventListener('click', () => { ui.setRating(star.dataset.value); });
            star.addEventListener('mouseover', () => {
                 ui.elements.ratingStars.forEach(s => { s.classList.toggle('hover', s.dataset.value <= star.dataset.value); });
            });
        });
        ui.elements.ratingGroup?.addEventListener('mouseleave', () => { ui.setRating(state.state.currentRating); });
    }
    
    // Portionen
    ui.elements.servingsGroup?.addEventListener('click', (e) => {
        const btn = e.target.closest('.serving-btn');
        if (btn) { ui.setServings(btn.dataset.value); }
    });
    ui.elements.customServingInput?.addEventListener('input', () => ui.setServings(null));
    ui.elements.customServingInput?.addEventListener('focus', () => ui.setServings(null));
    
    // Tags
    ui.elements.tagSelectionGroup?.addEventListener('click', (e) => {
        const btn = e.target.closest('.tag-btn');
        if (btn) { e.preventDefault(); btn.classList.toggle('active'); }
    });
    
    // Filter
    ui.elements.openFilterBtn?.addEventListener('click', ui.openFilterModal);
    ui.elements.filterModalCloseBtn?.addEventListener('click', ui.closeFilterModal);
    ui.elements.filterModal?.addEventListener('click', (e) => { if (e.target === ui.elements.filterModal) ui.closeFilterModal(); });
    ui.elements.applyFilterBtn?.addEventListener('click', handleApplyFilters);
    ui.elements.activeFiltersDisplay?.addEventListener('click', handleActiveFilterClick);
    
    // Filter-Bewertung (hat eigene Logik)
    if (ui.elements.filterRatingStars) {
        let currentFilterRating = 0;
        ui.elements.filterRatingStars.forEach(star => {
            star.addEventListener('click', () => {
                if (star.classList.contains('active') && star.dataset.value == currentFilterRating) {
                     currentFilterRating = 0;
                } else {
                     currentFilterRating = star.dataset.value;
                }
                ui.setFilterRating(currentFilterRating);
            });
        });
        ui.elements.clearRatingFilterBtn?.addEventListener('click', () => {
            currentFilterRating = 0;
            ui.setFilterRating(0);
        });
    }
    
    // Filter-Tags
    ui.elements.filterTagGroup?.addEventListener('click', (e) => {
        const btn = e.target.closest('.tag-btn');
        if (btn) { e.preventDefault(); btn.classList.toggle('active'); }
    });
}

// --- Haupt-Initialisierungsfunktion ---
async function init() {
    console.log("recipes.js Init Start (Refactored Version)");
    
    // 1. DOM-Elemente einmalig finden und speichern
    ui.cacheElements();
    
    // 2. Status initialisieren (Cookbook-ID aus URL holen)
    state.initCookbookId();
    
    // 3. Alle Event-Listener binden
    attachEventListeners();

    // 4. Auth-Wächter starten
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            state.setCurrentUser(user);
            if (state.state.currentCookbookId) {
                // Lade Titel und Rezepte parallel
                const titlePromise = service.loadCookbookDetails(user.uid, state.state.currentCookbookId);
                const recipesPromise = handleLoadRecipes(); // Diese Funktion lädt UND rendert
                
                // Warte auf Titel, dann setze ihn
                const title = await titlePromise;
                ui.setCookbookTitle(title);
                
                await recipesPromise; // Stelle sicher, dass Rezepte fertig geladen sind
            }
            ui.showContent();
        } else {
            state.setCurrentUser(null);
            window.location.href = 'index.html';
        }
    });
}

// --- Starte die Seite ---
document.addEventListener('DOMContentLoaded', init);