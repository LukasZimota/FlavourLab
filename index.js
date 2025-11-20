/*
 * WICHTIG: Stelle sicher, dass deine package.json im functions-Ordner
 * "firebase-admin", "firebase-functions", "axios" und "cheerio" enthält.
 */

// Notwendige Imports
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue, FieldPath} = require("firebase-admin/firestore"); 

// Helfer-Funktionen
const { parseIngredient, categorizeIngredient } = require('./ingredientParser.js');
const { extractRecipeFromUrl } = require('./recipeImporter.js'); // NEU: Importer

// Initialisiere die App und Firestore
initializeApp();
const db = getFirestore();


/*
 * ==================================================================
 * CLOUD FUNCTION: fetchRecipeFromUrl (NEU)
 * Ruft den Importer auf und gibt die Daten an das Frontend zurück.
 * ==================================================================
 */
exports.fetchRecipeFromUrl = onCall({region: "europe-west3"}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Du musst angemeldet sein.");
    }
    
    const { url } = request.data;
    if (!url) {
        throw new HttpsError("invalid-argument", "URL fehlt.");
    }

    try {
        console.log(`Starte Import für URL: ${url}`);
        const recipeData = await extractRecipeFromUrl(url);
        return recipeData; // Gibt { title, ingredients, ... } zurück
    } catch (error) {
        console.error("Fehler im Rezept-Importer:", error);
        throw new HttpsError("internal", error.message);
    }
});


/*
 * ==================================================================
 * CLOUD FUNCTION: inviteUserToCookbook
 * (Bestehend, unverändert)
 * ==================================================================
 */
exports.inviteUserToCookbook = onCall({region: "europe-west3"}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Du musst angemeldet sein.");
    }
    
    const inviterUid = request.auth.uid;
    const { cookbookId, inviteeEmail } = request.data;

    if (!cookbookId || !inviteeEmail) {
        throw new HttpsError("invalid-argument", "Kochbuch-ID oder E-Mail fehlt.");
    }
    
    const normalizedEmail = inviteeEmail.toLowerCase().trim();

    try {
        const cookbookRef = db.collection("cookbooks").doc(cookbookId);
        const cookbookSnap = await cookbookRef.get();

        if (!cookbookSnap.exists) {
            throw new HttpsError("not-found", "Kochbuch nicht gefunden.");
        }
        
        const cookbookData = cookbookSnap.data();
        if (cookbookData.ownerId !== inviterUid) {
            throw new HttpsError("permission-denied", "Nur der Besitzer kann einladen.");
        }

        const usersRef = db.collection("users");
        const userQuery = await usersRef.where("email", "==", normalizedEmail).limit(1).get();

        if (userQuery.empty) {
            throw new HttpsError("not-found", "Nutzer mit dieser E-Mail nicht gefunden.");
        }
        
        const inviteeUser = userQuery.docs[0];
        const inviteeUid = inviteeUser.id;

        if (inviteeUid === inviterUid) {
             throw new HttpsError("invalid-argument", "Du kannst dich nicht selbst einladen.");
        }

        if (cookbookData.members && cookbookData.members[inviteeUid]) {
             throw new HttpsError("already-exists", "Dieser Nutzer ist bereits Mitglied.");
        }

        const existingInviteQuery = await db.collection("invitations")
            .where("toUserId", "==", inviteeUid)
            .where("cookbookId", "==", cookbookId)
            .where("status", "==", "pending")
            .limit(1).get();
        
        if (!existingInviteQuery.empty) {
            throw new HttpsError("already-exists", "Eine Einladung an diesen Nutzer wurde bereits gesendet.");
        }

        const invitationRef = db.collection("invitations").doc(); 
        
        const inviterProfile = await db.collection("users").doc(inviterUid).get();
        let inviterName = "Ein Nutzer"; 
        
        if (inviterProfile.exists) {
            inviterName = inviterProfile.data().firstName || "Ein Nutzer";
        }
        
        await invitationRef.set({
            fromUserId: inviterUid,
            fromUserName: inviterName, 
            toUserId: inviteeUid,
            toUserEmail: normalizedEmail,
            cookbookId: cookbookId,
            cookbookTitle: cookbookData.title,
            status: "pending",
            createdAt: FieldValue.serverTimestamp()
        });

        return { success: true, message: "Einladung wurde versendet!" };

    } catch (error) {
        console.error("Fehler beim Erstellen der Einladung:", error);
        if (error instanceof HttpsError) {
            throw error; 
        }
        throw new HttpsError("internal", "Ein Server-Fehler ist aufgetreten.");
    }
});


/*
 * ==================================================================
 * CLOUD FUNCTION: getShoppingList
 * (Bestehend, unverändert)
 * ==================================================================
 */
exports.getShoppingList = onCall({region: "europe-west3"}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Du musst angemeldet sein.");
    }
    const userId = request.auth.uid;
    const { startDate, endDate } = request.data;

    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
        throw new HttpsError("invalid-argument", "Start- oder Enddatum fehlt.");
    }
    
    try {
        const plannedMealsRef = db.collection("users").doc(userId).collection("plannedMeals");
        
        const q = plannedMealsRef.where(FieldPath.documentId(), ">=", startDate)
                                 .where(FieldPath.documentId(), "<=", endDate);
        
        const snapshot = await q.get();
        if (snapshot.empty) {
            return { categories: {}, totalItems: 0 };
        }

        const mealTypes = ["breakfast", "lunch", "dinner", "snacks"];
        const recipePromises = []; 
        
        snapshot.forEach(doc => {
            const dayData = doc.data();
            if (!dayData) return;
            mealTypes.forEach(type => {
                const meals = dayData[type];
                if (meals && Array.isArray(meals)) {
                    meals.forEach(recipe => {
                        if (recipe && typeof recipe === 'object' && recipe.cookbookId && recipe.id) {
                            const recipeRef = db.collection('cookbooks').doc(recipe.cookbookId)
                                              .collection('recipes').doc(recipe.id);
                            recipePromises.push( recipeRef.get() );
                        }
                    });
                }
            });
        });

        if (recipePromises.length === 0) {
            return { categories: {}, totalItems: 0 };
        }

        const recipeSnapshots = await Promise.all(recipePromises);
        const aggregatedMap = new Map();

        recipeSnapshots.forEach(doc => {
            if (!doc.exists) return; 

            const recipeData = doc.data();
            const recipeTitle = recipeData.title || "Unbenanntes Rezept"; 
            const ingredients = recipeData.ingredients; 

            if (ingredients && Array.isArray(ingredients)) {
                ingredients.forEach(line => {
                    if (typeof line !== 'string' || line.trim() === "") return; 
                    try {
                        const item = parseIngredient(line); 
                        const key = `${item.name.toLowerCase()}|${item.unit}`;
                        
                        if (aggregatedMap.has(key)) {
                            const existingItem = aggregatedMap.get(key);
                            existingItem.amount += item.amount;
                            if (!existingItem.sources.includes(recipeTitle)) {
                                existingItem.sources.push(recipeTitle);
                            }
                        } else {
                            aggregatedMap.set(key, {
                                name: item.name, 
                                unit: item.unit,
                                amount: item.amount,
                                sources: [recipeTitle] 
                            });
                        }
                    } catch (e) {
                        console.error(`Fehler beim Parsen: "${line}"`, e);
                    }
                });
            }
        });

        const categorizedItems = {}; 
        let totalItems = 0;

        aggregatedMap.forEach(item => { 
            const category = categorizeIngredient(item.name); 
            if (!categorizedItems[category]) {
                categorizedItems[category] = [];
            }
            
            totalItems++;
            
            let amount = item.amount;
            let unit = item.unit;

            if (unit === 'g' && amount >= 1000) { amount /= 1000; unit = 'kg'; }
            if (unit === 'ml' && amount >= 1000) { amount /= 1000; unit = 'l'; }
            amount = Math.round(amount * 100) / 100;
            
            let fullName = "";
            if (unit === "stück") fullName = `${amount} ${item.name}`;
            else if (unit === "prise") fullName = `${item.name}`;
            else fullName = `${String(amount).replace('.', ',')} ${unit} ${item.name}`; 
            
            categorizedItems[category].push({
                fullName: fullName,
                amount: amount, 
                unit: unit,     
                name: item.name,
                sources: item.sources 
            });
        });

        return { categories: categorizedItems, totalItems: totalItems };

    } catch (error) {
        if (error instanceof HttpsError) { throw error; }
        console.error("Fehler in getShoppingList:", error);
        throw new HttpsError("internal", "Einkaufsliste konnte nicht erstellt werden.");
    }
});