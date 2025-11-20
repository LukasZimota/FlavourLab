// --- recipes.js (Haupt-Controller) ---

import { auth } from './firebase-config.js';
// Importiere alle Module
import * as state from './recipe.state.js';
import * as ui from './recipe.ui.js';
import * as service from './recipe.service.js';
// NEU: Kochmodus importieren
import * as cookingMode from './cooking.mode.js';

// Cloud Functions Referenz holen
const functions = firebase.app().functions('europe-west3');

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


// Öffnet Google Images in einem neuen Tab
function handleFindImageClick(e) {
    e.preventDefault();
    
    const title = ui.elements.modalRecipeName.value.trim();
    if (!title) {
        alert('Gib zuerst einen Rezeptnamen ein, um nach Bildern zu suchen.');
        ui.elements.modalRecipeName.focus();
        return;
    }

    const query = encodeURIComponent(title);
    const url = `https://www.google.com/search?tbm=isch&q=${query}`;
    window.open(url, '_blank');
    ui.elements.modalRecipeImage.focus();
}


// --- Import-Logik (Option B) ---

function handleOpenImportModal() {
    const modal = document.getElementById('import-modal');
    const input = document.getElementById('import-url-input');
    const msg = document.getElementById('import-status-message');
    
    input.value = '';
    msg.textContent = '';
    modal.classList.remove('modal-hidden');
    input.focus();
}

function handleCloseImportModal() {
    document.getElementById('import-modal').classList.add('modal-hidden');
}

async function handleStartImport() {
    const urlInput = document.getElementById('import-url-input');
    const msg = document.getElementById('import-status-message');
    const url = urlInput.value.trim();

    if (!url) {
        msg.textContent = "Bitte gib eine URL ein.";
        msg.style.color = "red";
        return;
    }

    msg.textContent = "Lade Rezeptdaten... (Das kann kurz dauern)";
    msg.style.color = "#555";
    
    const btn = document.getElementById('btn-start-import');
    btn.disabled = true;

    try {
        // Cloud Function aufrufen
        const fetchRecipeFunction = functions.httpsCallable('fetchRecipeFromUrl');
        const result = await fetchRecipeFunction({ url: url });
        const data = result.data;

        console.log("Importierte Daten:", data);

        // Import-Modal schließen
        handleCloseImportModal();

        // Erstellen-Modal öffnen (Option B - Vorbefüllen)
        state.resetModalState(); // Erst alles leeren
        ui.openCreateModal(); // Modal öffnen

        // Felder befüllen
        ui.elements.modalRecipeName.value = data.title || "";
        
        // Bild setzen
        if (data.imageUrl) {
            ui.elements.modalRecipeImage.value = data.imageUrl;
            ui.setImageModeUI('link'); // Auf "Link"-Tab wechseln
        }

        // Zutaten befüllen
        if (data.ingredients && Array.isArray(data.ingredients)) {
            state.setIngredients(data.ingredients);
            ui.renderIngredientList();
        }

        // Schritte befüllen
        if (data.instructions && Array.isArray(data.instructions)) {
            state.setSteps(data.instructions);
            ui.renderStepsList();
        }

        // Portionen befüllen
        if (data.servings) {
            ui.setServings(null); // Custom aktivieren
            ui.elements.customServingInput.value = data.servings;
            state.setServings(data.servings);
        }
        
        // Notiz: Quelle hinzufügen
        ui.elements.modalRecipeNotes.value = `Importiert von: ${data.url}`;

    } catch (error) {
        console.error("Import Fehler:", error);
        msg.textContent = "Fehler: " + error.message;
        msg.style.color = "red";
    } finally {
        btn.disabled = false;
    }
}

// ------------------------------------

// NEU: Handler für den Kochmodus Button
async function handleStartCookingClick() {
    const recipeId = state.state.currentRecipeId;
    if (!recipeId) return;

    try {
        // Wir holen die Daten frisch oder nehmen sie aus dem State, falls vorhanden.
        // Da wir im View-Modal sind, sollten die Daten eigentlich da sein, aber
        // zur Sicherheit holen wir sie via Service (der hat Caching-Logik evtl?)
        // Einfacher: Wir rufen fetchRecipeForView nochmal auf (ist cached meistens)
        // oder wir greifen auf ein gespeichertes Objekt zu.
        
        const recipeData = await service.fetchRecipeForView(recipeId);
        
        // Modul starten
        cookingMode.startCookingMode(recipeData);

    } catch (error) {
        alert("Konnte Kochmodus nicht starten: " + error.message);
    }
}


// Klick auf "Rezept speichern"
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

    let imageUrl = '';
    const imageMode = state.state.currentImageMode;

    if (imageMode === 'auto') {
        const query = encodeURIComponent(title.split(' ').join(','));
        imageUrl = `https://source.unsplash.com/featured/800x600/?${query}`;
    } 
    else if (imageMode === 'link') {
        imageUrl = ui.elements.modalRecipeImage.value.trim();
    } 
    else if (imageMode === 'upload') {
        imageUrl = ''; 
    }

    const selectedTags = [];
    if (ui.elements.tagSelectionGroup) {
        ui.elements.tagSelectionGroup.querySelectorAll('.tag-btn.active').forEach(btn => {
            selectedTags.push(btn.dataset.tag);
        });
    }

    const recipeData = {
        title: title,
        imageUrl: imageUrl, 
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
    
    state.addIngredient(ingredient); 
    ui.renderIngredientList();       
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
        ui.renderIngredientList(); 
    }
    if (btn.classList.contains('menu-btn-edit-item')) {
        state.setEditIngredient(index);
        ui.startEditIngredient(index); 
    }
}

function handleAddStep() {
    const step = ui.elements.stepInput.value.trim();
    if (!step) return;

    state.addStep(step);       
    ui.renderStepsList();      
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
        ui.renderStepsList(); 
    }
    if (btn.classList.contains('menu-btn-edit-item')) {
        state.setEditStep(index);
        ui.startEditStep(index); 
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

    state.setFilters(search, rating, tags); 
    ui.renderFilteredRecipes();             
    ui.displayActiveFilters();              
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
    
    ui.renderFilteredRecipes();
    ui.displayActiveFilters();
}

// --- Hilfs-Handler ---

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
    
    // Bild-Tabs
    ui.elements.imageModeTabs?.addEventListener('click', (e) => {
        const button = e.target.closest('.image-mode-btn');
        if (!button) return;
        const mode = button.dataset.mode;
        if (mode === 'upload') { e.preventDefault(); return; }
        ui.setImageModeUI(mode); 
    });
    
    ui.elements.findImageBtn?.addEventListener('click', handleFindImageClick);

    // --- Menü-Logik für Ansicht-Modal ---
    
    const menuTrigger = document.getElementById('btn-recipe-menu-trigger');
    const dropdown = document.getElementById('recipe-dropdown-menu');
    
    if (menuTrigger && dropdown) {
        menuTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); 
            dropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!dropdown.classList.contains('hidden')) {
                if (!dropdown.contains(e.target) && !menuTrigger.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            }
        });
        dropdown.addEventListener('click', () => {
             dropdown.classList.add('hidden');
        });
    }
    
    // Buttons im Ansicht-Modal
    document.getElementById('btn-delete-recipe')?.addEventListener('click', handleDeleteRecipeClick);
    document.getElementById('btn-edit-recipe')?.addEventListener('click', handleEditRecipeClick);
    
    // NEU: Button für Kochmodus
    document.getElementById('btn-start-cooking')?.addEventListener('click', handleStartCookingClick);

    ui.elements.viewModalCloseBtn?.addEventListener('click', ui.closeViewModal);
    ui.elements.viewModal?.addEventListener('click', (e) => { if (e.target === ui.elements.viewModal) ui.closeViewModal(); });
    
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
    
    ui.elements.filterTagGroup?.addEventListener('click', (e) => {
        const btn = e.target.closest('.tag-btn');
        if (btn) { e.preventDefault(); btn.classList.toggle('active'); }
    });

    // Import Button Listener
    const openImportBtn = document.getElementById('btn-open-import');
    const closeImportBtn = document.getElementById('import-modal-close-btn');
    const startImportBtn = document.getElementById('btn-start-import');
    const importModal = document.getElementById('import-modal');

    if(openImportBtn) openImportBtn.addEventListener('click', handleOpenImportModal);
    if(closeImportBtn) closeImportBtn.addEventListener('click', handleCloseImportModal);
    if(startImportBtn) startImportBtn.addEventListener('click', handleStartImport);
    if(importModal) importModal.addEventListener('click', (e) => { if(e.target === importModal) handleCloseImportModal(); });
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
                const titlePromise = service.loadCookbookDetails(user.uid, state.state.currentCookbookId);
                const recipesPromise = handleLoadRecipes(); 
                
                const title = await titlePromise;
                ui.setCookbookTitle(title);
                
                await recipesPromise; 
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