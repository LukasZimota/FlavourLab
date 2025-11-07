import { auth, db } from './firebase-config.js';

// --- Globale Variablen ---
let currentUser;
let currentCookbookId; // Wird aus der URL geladen
let currentRecipeId = null; // ID des Rezepts, das im "Anzeigen"-Modal offen ist
let currentEditingRecipeId = null; // ID des Rezepts, das im "Bearbeiten"-Modal offen ist
let ingredientsArray = [];
let stepsArray = [];
let currentRating = 0;
let allCookbookRecipes = []; // Cache für alle Rezepte dieses Kochbuchs
let currentFilters = { search: '', rating: 0, tags: [] };

// --- DOM-Elemente (Deklaration) ---
let loader, navbar, mainContent;
let cookbookTitleDisplay, recipeGallery, galleryMessage;
let recipeModal, recipeModalCloseBtn, saveRecipeBtn, recipeModalTitle, modalRecipeName, modalRecipeImage;
let ingredientInput, addIngredientBtn, ingredientList;
let stepInput, addStepBtn, stepList;
let ratingGroup, ratingStars, modalRecipeNotes, tagSelectionGroup;
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
    if (tagSelectionGroup) { tagSelectionGroup.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active')); }
    recipeModal.classList.remove('modal-hidden');
};

const openEditModal = async () => {
    if (!currentRecipeId) return;
    currentEditingRecipeId = currentRecipeId;
    recipeModalTitle.textContent = 'Rezept bearbeiten';

    try {
        // *** NEUER PFAD ***
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
            const savedTags = data.tags || [];
            if (tagSelectionGroup) {
                tagSelectionGroup.querySelectorAll('.tag-btn').forEach(btn => {
                    btn.classList.toggle('active', savedTags.includes(btn.dataset.tag));
                });
            }
            closeViewModal(); // Schließe Anzeigemodal
            recipeModal.classList.remove('modal-hidden'); // Öffne Bearbeitenmodal
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
};

const openViewModal = async (recipeId) => {
    if (!currentUser || !currentCookbookId) return;
    currentRecipeId = recipeId;
    viewRecipeContent.innerHTML = '<h3>Lade Rezept...</h3>';
    viewModal.classList.remove('modal-hidden');

    try {
        // *** NEUER PFAD ***
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
            ${imageHtml} <h3>${recipe.title}</h3> ${ratingHtml} ${tagsHtml}
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

// --- Funktion zum Anzeigen des Inhalts ---
const showContent = () => { 
    if (loader) loader.style.display = 'none'; 
    if (navbar) navbar.classList.remove('content-hidden'); 
    if (mainContent) mainContent.classList.remove('content-hidden'); 
};

// --- Zutaten-Funktionen ---
const renderIngredientList = () => { 
    if (!ingredientList) return; 
    ingredientList.innerHTML = ''; 
    ingredientsArray.forEach((ingredient, index) => { 
        const li = document.createElement('li'); 
        li.textContent = ingredient; 
        const deleteBtn = document.createElement('button'); 
        deleteBtn.textContent = '×'; 
        deleteBtn.className = 'delete-item-btn'; 
        deleteBtn.onclick = () => removeIngredient(index); 
        li.appendChild(deleteBtn); 
        ingredientList.appendChild(li); 
    }); 
};
const addIngredient = () => { 
    if (!ingredientInput) return; 
    const ingredient = ingredientInput.value.trim(); 
    if (ingredient) { 
        ingredientsArray.push(ingredient); 
        renderIngredientList(); 
        ingredientInput.value = ''; 
        ingredientInput.focus(); 
    } 
};
const removeIngredient = (index) => { 
    ingredientsArray.splice(index, 1); 
    renderIngredientList(); 
};

// --- Schritte-Funktionen ---
const renderStepsList = () => { 
    if (!stepList) return; 
    stepList.innerHTML = ''; 
    stepsArray.forEach((step, index) => { 
        const li = document.createElement('li'); 
        li.textContent = step; 
        const deleteBtn = document.createElement('button'); 
        deleteBtn.textContent = '×'; 
        deleteBtn.className = 'delete-item-btn'; 
        deleteBtn.onclick = () => removeStep(index); 
        li.appendChild(deleteBtn); 
        stepList.appendChild(li); 
    }); 
};
const addStep = () => { 
    if (!stepInput) return; 
    const step = stepInput.value.trim(); 
    if (step) { 
        stepsArray.push(step); 
        renderStepsList(); 
        stepInput.value = ''; 
        stepInput.focus(); 
    } 
};
const removeStep = (index) => { 
    stepsArray.splice(index, 1); 
    renderStepsList(); 
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

// --- Initialisierung ---
const init = () => {
    console.log("recipes.js Init Start (NEUE VERSION)");

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

    // Sicherheitscheck
    if (!cookbookTitleDisplay || !recipeGallery || !galleryMessage || !recipeModal || !viewModal || !tagSelectionGroup || !ratingGroup || !filterModal || !openFilterBtn || !activeFiltersDisplay) {
        console.error("FEHLER: Wichtige HTML-Elemente auf der Rezeptseite fehlen!");
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
    auth.onAuthStateChanged((user) => { 
        if (user) { 
            currentUser = user; 
            if (currentCookbookId) { 
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
};

// --- Funktion: Lade Kochbuch-Details (GEÄNDERT) ---
const loadCookbookDetails = async (userId, cookbookId) => {
    if (!cookbookTitleDisplay) return;
    try { 
        // *** NEUER PFAD ***
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

// --- Funktion: "Plus"-Kachel erstellen (unverändert) ---
const createAddRecipeTile = () => {
    if (!recipeGallery) return;
    const item = document.createElement('div'); 
    item.className = 'recipe-item add-recipe-tile'; 
    item.id = 'btn-open-create-modal'; 
    item.innerHTML = '<span class="plus-icon">+</span>'; 
    recipeGallery.appendChild(item);
};

// --- Funktion: Lade Rezepte (GEÄNDERT) ---
const loadRecipes = async (userId, cookbookId) => {
    if (!galleryMessage || !recipeGallery) { console.error("FEHLER: Galerie-Elemente fehlen!"); return; }
    galleryMessage.textContent = 'Lade Rezepte...';
    allCookbookRecipes = [];
    currentFilters = { search: '', rating: 0, tags: [] };
    
    try {
        // *** NEUER PFAD ***
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
        
        renderFilteredRecipes(); // <--- Diese Funktion rendert jetzt alles
        displayActiveFilters();
    } catch (error) {
        console.error('Fehler beim Laden der Rezepte:', error);
        galleryMessage.textContent = 'Ein Fehler ist aufgetreten.';
    }
};

// --- (Filter-Funktionen - JETZT VOLLSTÄNDIG) ---
const applyFilters = () => {
    console.log("Filter werden angewendet...");
    currentFilters.search = filterSearchInput.value.toLowerCase().trim();
    const activeStar = filterRatingGroup.querySelector('.rating-star.active:last-child');
    currentFilters.rating = activeStar ? Number(activeStar.dataset.value) : 0;
    currentFilters.tags = [];
    filterTagGroup.querySelectorAll('.tag-btn.active').forEach(btn => {
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

    // Filter anwenden
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
    
    // *** HIER IST DIE KORREKTUR ***
    // "Plus"-Kachel immer zuerst hinzufügen
    createAddRecipeTile(); 

    // Nachricht anzeigen, wenn nötig
    if (filteredRecipes.length === 0) {
        if(allCookbookRecipes.length > 0) {
             galleryMessage.textContent = "Keine Rezepte entsprechen deinen Filtern.";
        } else {
             galleryMessage.textContent = "Füge dein erstes Rezept hinzu!";
        }
    } else {
        galleryMessage.textContent = '';
    }

    // Gefilterte Rezepte rendern
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

// --- Funktion: Speichere Rezept (GEÄNDERT) ---
const saveRecipe = async () => {
    const title = modalRecipeName.value.trim();
    const imageUrl = modalRecipeImage.value.trim();
    const ingredients = ingredientsArray;
    const instructions = stepsArray;
    const notes = modalRecipeNotes.value.trim();
    const rating = currentRating;
    const selectedTags = [];
    if (tagSelectionGroup) {
        tagSelectionGroup.querySelectorAll('.tag-btn.active').forEach(btn => {
            selectedTags.push(btn.dataset.tag);
        });
    }
    const tags = selectedTags;
    
    if (!title) { alert('Bitte gib einen Rezeptnamen ein.'); return; }

    const recipeData = {
        title: title, imageUrl: imageUrl, ingredients: ingredients, instructions: instructions,
        notes: notes, tags: tags, rating: Number(rating)
    };
    
    try {
        if (currentEditingRecipeId) {
            // ---- MODUS: BEARBEITEN ----
            // *** NEUER PFAD ***
            const docRef = db.collection('cookbooks').doc(currentCookbookId)
                             .collection('recipes').doc(currentEditingRecipeId);
            await docRef.update(recipeData);
        } else {
            // ---- MODUS: NEU ERSTELLEN ----
            // *** NEUER PFAD ***
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

// --- Funktion: Lösche Rezept (GEÄNDERT) ---
const deleteRecipe = async () => {
    if (!currentRecipeId) { alert("Fehler: Kein Rezept ausgewählt."); return; }
    if (!confirm('Bist du sicher, dass du dieses Rezept löschen möchtest?')) return;
    if (!currentUser || !currentCookbookId) return;
    
    try {
        // *** NEUER PFAD ***
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