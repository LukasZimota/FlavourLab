// --- recipe.service.js ---
// Zuständig für alle Firestore-Operationen (Lesen & Schreiben).

import { db } from './firebase-config.js';
import { state, setAllRecipes, setIngredients, setSteps } from './recipe.state.js';

export async function loadCookbookDetails(userId, cookbookId) {
    try {
        const doc = await db.collection('cookbooks').doc(cookbookId).get();
        if (doc.exists) {
            return doc.data().title; // Gibt den Titel zurück
        } else {
            return 'Kochbuch nicht gefunden';
        }
    } catch (error) {
        console.error("Fehler beim Laden des Kochbuch-Titels:", error);
        return 'Ladefehler';
    }
}

export async function loadRecipes(userId, cookbookId) {
    try {
        const snapshot = await db.collection('cookbooks').doc(cookbookId)
                                 .collection('recipes').orderBy('createdAt', 'desc').get();
        
        const recipes = [];
        snapshot.forEach(doc => {
            recipes.push({ id: doc.id, ...doc.data() });
        });
        
        setAllRecipes(recipes); // Status mit den geladenen Rezepten aktualisieren
        return snapshot.empty; // Zurückgeben, ob die Sammlung leer war

    } catch (error) {
        console.error('Fehler beim Laden der Rezepte:', error);
        throw error; // Fehler weitergeben, damit der Aufrufer reagieren kann
    }
}

export async function fetchRecipeForView(recipeId) {
    if (!state.currentUser || !state.currentCookbookId) return;
    try {
        const doc = await db.collection('cookbooks').doc(state.currentCookbookId)
                            .collection('recipes').doc(recipeId).get();
        
        if (!doc.exists) {
            throw new Error("Rezept nicht gefunden.");
        }
        return doc.data(); // Rezeptdaten zurückgeben
    } catch (error) {
        console.error("Fehler beim Laden des Rezepts:", error);
        throw new Error("Ein Fehler ist aufgetreten.");
    }
}

export async function fetchRecipeForEdit(recipeId) {
    if (!state.currentUser || !state.currentCookbookId) return;
    try {
        const docRef = db.collection('cookbooks').doc(state.currentCookbookId)
                         .collection('recipes').doc(recipeId);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
            const data = docSnap.data();
            // Status für das Modal vorab füllen
            setIngredients(data.ingredients);
            setSteps(data.instructions);
            return data; // Rezeptdaten zurückgeben
        } else {
            throw new Error("Rezept nicht gefunden.");
        }
    } catch (error) {
        console.error("Fehler beim Laden zur Bearbeitung:", error);
        throw new Error("Fehler beim Laden.");
    }
}

export async function saveRecipe(recipeData) {
    try {
        if (state.currentEditingRecipeId) {
            // Bearbeiten-Modus
            const docRef = db.collection('cookbooks').doc(state.currentCookbookId)
                             .collection('recipes').doc(state.currentEditingRecipeId);
            await docRef.update(recipeData);
        } else {
            // Erstellen-Modus
            recipeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('cookbooks').doc(state.currentCookbookId)
                      .collection('recipes').add(recipeData);
        }
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        throw new Error("Fehler beim Speichern.");
    }
}

export async function deleteRecipe(recipeId) {
    if (!state.currentUser || !state.currentCookbookId) return;
    try {
        await db.collection('cookbooks').doc(state.currentCookbookId)
                  .collection('recipes').doc(recipeId).delete();
        console.log('Rezept gelöscht!');
    } catch (error) {
        console.error('Fehler beim Löschen:', error);
        throw new Error("Fehler beim Löschen.");
    }
}