/*
 * WICHTIG: Stelle sicher, dass deine package.json im functions-Ordner
 * "firebase-admin" und "firebase-functions" enthält.
 */

// Notwendige Imports
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue, FieldPath} = require("firebase-admin/firestore"); 

// Importiere die ausgelagerten Helfer-Funktionen
const { parseIngredient, categorizeIngredient } = require('./ingredientParser.js');

// Initialisiere die App und Firestore
initializeApp();
const db = getFirestore();


/*
 * ==================================================================
 * CLOUD FUNCTION: inviteUserToCookbook
 * ==================================================================
 * (Diese Funktion ist FERTIG und KORREKT)
 */
exports.inviteUserToCookbook = onCall({region: "europe-west3"}, async (request) => {
    // ... (Diese Funktion bleibt unverändert) ...
    
    // 1. Prüfen, ob der Aufrufer authentifiziert ist
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Du musst angemeldet sein.");
    }
    
    const inviterUid = request.auth.uid;
    const { cookbookId, inviteeEmail } = request.data;

    // 2. Daten validieren
    if (!cookbookId || !inviteeEmail) {
        throw new HttpsError("invalid-argument", "Kochbuch-ID oder E-Mail fehlt.");
    }
    
    // E-Mail normalisieren
    const normalizedEmail = inviteeEmail.toLowerCase().trim();

    try {
        // 3. Prüfen, ob der Aufrufer der Besitzer des Kochbuchs ist
        const cookbookRef = db.collection("cookbooks").doc(cookbookId);
        const cookbookSnap = await cookbookRef.get();

        if (!cookbookSnap.exists) {
            throw new HttpsError("not-found", "Kochbuch nicht gefunden.");
        }
        
        const cookbookData = cookbookSnap.data();
        if (cookbookData.ownerId !== inviterUid) {
            throw new HttpsError("permission-denied", "Nur der Besitzer kann einladen.");
        }

        // 4. Finde den eingeladenen Nutzer anhand der E-Mail
        const usersRef = db.collection("users");
        const userQuery = await usersRef.where("email", "==", normalizedEmail).limit(1).get();

        if (userQuery.empty) {
            throw new HttpsError("not-found", "Nutzer mit dieser E-Mail nicht gefunden.");
        }
        
        const inviteeUser = userQuery.docs[0];
        const inviteeUid = inviteeUser.id;

        // 5. Prüfen, ob der eingeladene Nutzer der Besitzer selbst ist
        if (inviteeUid === inviterUid) {
             throw new HttpsError("invalid-argument", "Du kannst dich nicht selbst einladen.");
        }

        // 6. Prüfen, ob Nutzer bereits Mitglied ist
        if (cookbookData.members && cookbookData.members[inviteeUid]) {
             throw new HttpsError("already-exists", "Dieser Nutzer ist bereits Mitglied.");
        }

        // 7. Prüfen, ob bereits eine offene Einladung existiert
        const existingInviteQuery = await db.collection("invitations")
            .where("toUserId", "==", inviteeUid)
            .where("cookbookId", "==", cookbookId)
            .where("status", "==", "pending")
            .limit(1).get();
        
        if (!existingInviteQuery.empty) {
            throw new HttpsError("already-exists", "Eine Einladung an diesen Nutzer wurde bereits gesendet.");
        }

        // 8. Einladung erstellen
        const invitationRef = db.collection("invitations").doc(); // Neue ID
        
        // Profil des Einladenden holen (absturzsicher)
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
 * HILFSFUNKTIONEN FÜR getShoppingList
 * (Diese sind ausgelagert in ingredientParser.js und categories.js)
 * ==================================================================
 */


/*
 * ==================================================================
 * CLOUD FUNCTION: getShoppingList
 * ==================================================================
 * (Ansatz 40: MIT QUELL-TRACKING FÜR INFO-SYMBOL)
 */
exports.getShoppingList = onCall({region: "europe-west3"}, async (request) => {
    
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Du musst angemeldet sein.");
    }
    const userId = request.auth.uid;
    const { startDate, endDate } = request.data;

    // Validierung (von Ansatz 22, ist korrekt)
    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
        console.error("Absturzgrund: startDate oder endDate fehlen.", { startDate, endDate });
        throw new HttpsError("invalid-argument", "Start- oder Enddatum fehlt. (Fehlercode: SLoV1)");
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
        
        // 1. Alle Rezept-Pfade sammeln (robust, von Ansatz 22)
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
                        } else {
                            console.warn("Überspringe fehlerhaften Planeintrag:", recipe);
                        }
                    });
                }
            });
        });

        if (recipePromises.length === 0) {
            return { categories: {}, totalItems: 0 };
        }

        // 2. Alle Rezepte abrufen
        const recipeSnapshots = await Promise.all(recipePromises);

        // 3. Aggregieren (Addieren) - JETZT MIT QUELL-TRACKING
        const aggregatedMap = new Map();

        // Iteriere durch die Rezept-Dokumente (NICHT mehr nur die Strings)
        recipeSnapshots.forEach(doc => {
            if (!doc.exists) return; // Überspringe gelöschte Rezepte

            const recipeData = doc.data();
            const recipeTitle = recipeData.title || "Unbenanntes Rezept"; // Der Name des Rezepts
            const ingredients = recipeData.ingredients; // Das Array an Strings

            if (ingredients && Array.isArray(ingredients)) {
                
                ingredients.forEach(line => {
                    if (typeof line !== 'string' || line.trim() === "") return; 
                    
                    try {
                        const item = parseIngredient(line); // z.B. { name: "Mehl", amount: 1000, unit: "g" }
                        const key = `${item.name.toLowerCase()}|${item.unit}`;
                        
                        if (aggregatedMap.has(key)) {
                            // Zutat existiert -> Addieren UND Quelle hinzufügen
                            const existingItem = aggregatedMap.get(key);
                            existingItem.amount += item.amount;
                            
                            // Füge die Rezeptquelle hinzu (nur wenn noch nicht vorhanden)
                            if (!existingItem.sources.includes(recipeTitle)) {
                                existingItem.sources.push(recipeTitle);
                            }
                        } else {
                            // Zutat ist neu -> In die Map einfügen
                            aggregatedMap.set(key, {
                                name: item.name, 
                                unit: item.unit,
                                amount: item.amount,
                                sources: [recipeTitle] // Beginne die Quellen-Liste
                            });
                        }
                    } catch (e) {
                        console.error(`Fehler beim Parsen der Zutat: "${line}"`, e);
                    }
                });
            }
        });
        // --- ENDE SCHRITT 3 ---


        // 4. Kategorisieren & Formatieren (nach der Aggregation)
        const categorizedItems = {}; 
        let totalItems = 0;

        aggregatedMap.forEach(item => { // item = { name: "Mehl", ..., sources: ["Kuchen", "Brot"] }
            const category = categorizeIngredient(item.name); 
            
            if (!categorizedItems[category]) {
                categorizedItems[category] = [];
            }
            
            totalItems++;
            
            // Formatierung (von Ansatz 37)
            let amount = item.amount;
            let unit = item.unit;

            if (unit === 'g' && amount >= 1000) {
                amount = amount / 1000;
                unit = 'kg';
            }
            if (unit === 'ml' && amount >= 1000) {
                amount = amount / 1000;
                unit = 'l';
            }

            amount = Math.round(amount * 100) / 100;
            
            let fullName = "";
            if (unit === "stück") {
                fullName = `${amount} ${item.name}`;
            } else if (unit === "prise") {
                 fullName = `${item.name}`;
            } else {
                fullName = `${String(amount).replace('.', ',')} ${unit} ${item.name}`; 
            }
            
            // Sende das VOLLE Objekt an den Client
            categorizedItems[category].push({
                fullName: fullName,
                amount: amount, 
                unit: unit,     
                name: item.name,
                sources: item.sources // <-- HIER SIND DIE REZEPTNAMEN
            });
        });

        return { categories: categorizedItems, totalItems: totalItems };

    } catch (error) {
        if (error instanceof HttpsError) { throw error; }
        console.error("Schwerer Fehler in getShoppingList:", error);
        throw new HttpsError("internal", "Einkaufsliste konnte nicht erstellt werden.");
    }
});