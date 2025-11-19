// --- recipe.state.js ---
// Hält den gesamten Status der Rezeptseite.

export const state = {
    currentUser: null,
    currentCookbookId: null,
    currentRecipeId: null,
    currentEditingRecipeId: null,
    ingredientsArray: [],
    stepsArray: [],
    currentRating: 0,
    currentServings: 4,
    currentEditingIngredientIndex: null,
    currentEditingStepIndex: null,
    allCookbookRecipes: [],
    currentFilters: { search: '', rating: 0, tags: [] },
    currentImageMode: 'auto', // *** NEUER STATUS ***
};

// --- Mutationen (Funktionen, die den Status ändern) ---

export function initCookbookId() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const cookbookId = urlParams.get('id');
        if (!cookbookId) {
            alert('Kein Kochbuch ausgewählt!');
            window.location.href = 'dashboard.html';
            return;
        }
        state.currentCookbookId = cookbookId;
    } catch (error) {
        console.error("Fehler beim Lesen der URL:", error);
        alert("Fehler Kochbuch-ID.");
        window.location.href = 'dashboard.html';
    }
}

export function setCurrentUser(user) {
    state.currentUser = user;
}

export function setAllRecipes(recipes) {
    state.allCookbookRecipes = recipes;
}

export function setFilters(search, rating, tags) {
    state.currentFilters = { search, rating, tags };
}

export function removeFilter(type, value) {
    if (type === 'search') { state.currentFilters.search = ''; }
    if (type === 'rating') { state.currentFilters.rating = 0; }
    if (type === 'tag') {
        state.currentFilters.tags = state.currentFilters.tags.filter(t => t !== value);
    }
}

export function resetFilters() {
    state.currentFilters = { search: '', rating: 0, tags: [] };
}

export function setCurrentRecipeId(id) {
    state.currentRecipeId = id;
}

export function setCurrentEditingRecipeId(id) {
    state.currentEditingRecipeId = id;
}

// *** NEUE FUNKTION ***
export function setCurrentImageMode(mode) {
    state.currentImageMode = mode;
}

export function setRating(rating) {
    state.currentRating = Number(rating);
}

export function setServings(servings) {
    state.currentServings = servings;
}

export function setIngredients(ingredients) {
    state.ingredientsArray = ingredients || [];
}

export function addIngredient(ingredient) {
    if (state.currentEditingIngredientIndex !== null) {
        state.ingredientsArray[state.currentEditingIngredientIndex] = ingredient;
    } else {
        state.ingredientsArray.push(ingredient);
    }
    clearIngredientEdit();
}

export function removeIngredient(index) {
    state.ingredientsArray.splice(index, 1);
}

export function setEditIngredient(index) {
    state.currentEditingIngredientIndex = index;
    state.currentEditingStepIndex = null; // Anderes zurücksetzen
}

export function clearIngredientEdit() {
    state.currentEditingIngredientIndex = null;
}

export function setSteps(steps) {
    state.stepsArray = steps || [];
}

export function addStep(step) {
    if (state.currentEditingStepIndex !== null) {
        state.stepsArray[state.currentEditingStepIndex] = step;
    } else {
        state.stepsArray.push(step);
    }
    clearStepEdit();
}

export function removeStep(index) {
    state.stepsArray.splice(index, 1);
}

export function setEditStep(index) {
    state.currentEditingStepIndex = index;
    state.currentEditingIngredientIndex = null; // Anderes zurücksetzen
}

export function clearStepEdit() {
    state.currentEditingStepIndex = null;
}

export function resetModalState() {
    state.currentEditingRecipeId = null;
    state.ingredientsArray = [];
    state.stepsArray = [];
    state.currentRating = 0;
    state.currentServings = 4;
    state.currentImageMode = 'auto'; // *** ZURÜCKSETZEN HINZUGEFÜGT ***
    clearIngredientEdit();
    clearStepEdit();
}