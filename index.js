// Importiere die v2-Funktionen (onCall, HttpsError)
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

// Initialisiere die Admin-App
initializeApp();
const db = getFirestore();

// --- Das "Wörterbuch" für Kategorien ---
const categories = {
  // Backzutaten
  "mehl": "Backzutaten", "zucker": "Backzutaten", "backpulver": "Backzutaten",
  "vanillezucker": "Backzutaten", "hefe": "Backzutaten",
  // Milchprodukte
  "ei": "Milchprodukte, Eier & Käse", "eier": "Milchprodukte, Eier & Käse",
  "milch": "Milchprodukte, Eier & Käse", "butter": "Milchprodukte, Eier & Käse",
  "joghurt": "Milchprodukte, Eier & Käse", "quark": "Milchprodukte, Eier & Käse",
  "sahne": "Milchprodukte, Eier & Käse", "käse": "Milchprodukte, Eier & Käse",
  "parmesan": "Milchprodukte, Eier & Käse", "mozzarella": "Milchprodukte, Eier & Käse",
  // Gemüse & Obst
  "zwiebel": "Obst & Gemüse", "zwiebeln": "Obst & Gemüse", "knoblauch": "Obst & Gemüse",
  "kartoffel": "Obst & Gemüse", "kartoffeln": "Obst & Gemüse", "karotte": "Obst & Gemüse",
  "karotten": "Obst & Gemüse", "tomate": "Obst & Gemüse", "tomaten": "Obst & Gemüse",
  "paprika": "Obst & Gemüse", "salat": "Obst & Gemüse", "gurke": "Obst & Gemüse",
  "apfel": "Obst & Gemüse", "äpfel": "Obst & Gemüse", "banane": "Obst & Gemüse",
  "bananen": "Obst & Gemüse", "zitrone": "Obst & Gemüse", "spinat": "Obst & Gemüse",
  // Fleisch & Fisch
  "hähnchenbrust": "Fleisch & Fisch", "hackfleisch": "Fleisch & Fisch", "lachs": "Fleisch & Fisch",
  // Vorrat
  "reis": "Vorrat & Nudeln", "nudeln": "Vorrat & Nudeln", "pasta": "Vorrat & Nudeln",
  "olivenöl": "Vorrat & Nudeln", "salz": "Vorrat & Nudeln", "pfeffer": "Vorrat & Nudeln",
  "öl": "Vorrat & Nudeln", "essig": "Vorrat & Nudeln",
};

// --- Hilfsfunktion zum Zerlegen (Parsen) ---
function parseIngredient(ingredientString) {
  const text = ingredientString.trim();
  const regex = /^([\d.,/]+)?\s*([a-zA-Z]+)?\s+(.*)$/;
  const match = text.match(regex);
  let amount, unit, name;

  if (match) {
    amount = parseFloat(match[1] ? match[1].replace(',', '.') : 1);
    unit = match[2] ? match[2].toLowerCase() : 'Stk';
    name = match[3];
  } else {
    amount = 1; unit = 'Stk'; name = text;
  }

  // Einheiten normalisieren
  if (unit === "gramm") unit = "g";
  if (unit === "stück" || unit === "stk.") unit = "Stk";
  if (unit === "liter") unit = "l";
  if (unit === "el") unit = "EL";
  if (unit === "tl") unit = "TL";
  
  name = name.toLowerCase().replace(/\(.*\)/, "").trim();
  return { amount, unit, name };
}

// --- Hilfsfunktion zum Kategorisieren ---
function getCategory(ingredientName) {
  for (const key in categories) {
    if (ingredientName.includes(key)) {
      return categories[key];
    }
  }
  return "Sonstiges";
}


// --- Cloud Function (KORRIGIERTE v2-Syntax) ---
exports.getShoppingList = onCall({ region: "europe-west3" }, async (request) => {
    // 1. Sicherheit
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Du musst angemeldet sein.");
    }
    const uid = request.auth.uid;
    const dates = request.data.dates;
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
        throw new HttpsError("invalid-argument", "Es wurden keine Tage übermittelt.");
    }

    console.log(`[Cloud Function v2] Starte Liste für ${uid} für Tage:`, dates);

    try {
        // --- SCHRITT 1 & 2: Plandaten holen & Rezepte sammeln ---
        const plansRef = db.collection("users").doc(uid).collection("plannedMeals");
        const datePromises = dates.map((date) => plansRef.doc(date).get());
        const planSnapshots = await Promise.all(datePromises);
        
        let recipesToFetch = [];
        planSnapshots.forEach((doc) => {
            if (doc.exists) {
                const dayData = doc.data();
                const mealTypes = ["breakfast", "lunch", "dinner", "snacks"];
                mealTypes.forEach((mealType) => {
                    if (dayData[mealType]) {
                        dayData[mealType].forEach((recipe) => {
                            recipesToFetch.push({
                                cookbookId: recipe.cookbookId,
                                recipeId: recipe.id,
                            });
                        });
                    }
                });
            }
        });
        if (recipesToFetch.length === 0) { return { categories: {} }; }

        // --- SCHRITT 3: Rezepte laden ---
        const recipePromises = recipesToFetch.map((ref) => {
            if (!ref.cookbookId || !ref.recipeId) { return Promise.resolve(null); }
            return db.collection("users").doc(uid).collection("cookbooks")
                     .doc(ref.cookbookId).collection("recipes").doc(ref.recipeId).get();
        });
        const recipeDocs = await Promise.all(recipePromises);

        // --- SCHRITT 4: Zutaten extrahieren & PARSEN ---
        const parsedIngredients = [];
        recipeDocs.forEach((doc) => {
            if (doc && doc.exists) {
                const recipeData = doc.data();
                if (Array.isArray(recipeData.ingredients)) {
                    recipeData.ingredients.forEach(ingredientString => {
                        parsedIngredients.push(parseIngredient(ingredientString));
                    });
                }
            }
        });

        // --- SCHRITT 5: Zutaten ZUSAMMENFASSEN ---
        const combinedIngredients = {};
        const nonAdditiveUnits = ["stk", "prise", "etwas", "schuss"]; // Einheiten, die nicht addiert werden
        
        parsedIngredients.forEach(ing => {
            const key = `${ing.name}_${ing.unit}`;
            if (combinedIngredients[key] && !nonAdditiveUnits.includes(ing.unit.toLowerCase())) {
                combinedIngredients[key].amount += ing.amount; // Addiere Menge
            } else {
                // Erstelle neuen Eintrag (entweder neu, oder weil es "Stk" ist)
                // Bei "Stk" wollen wir separate Einträge (1 Banane, 1 Banane),
                // daher brauchen wir einen einzigartigen Schlüssel.
                const uniqueKey = nonAdditiveUnits.includes(ing.unit.toLowerCase()) ? `${key}_${Math.random()}` : key;
                combinedIngredients[uniqueKey] = ing;
            }
        });

        // --- SCHRITT 6: KATEGORISIEREN ---
        const categorizedList = {};
        for (const key in combinedIngredients) {
            const item = combinedIngredients[key];
            const category = getCategory(item.name);
            if (!categorizedList[category]) {
                categorizedList[category] = [];
            }
            const displayString = `${item.amount} ${item.unit} ${item.name}`;
            categorizedList[category].push(displayString);
        }
        for (const category in categorizedList) {
             categorizedList[category].sort();
        }

        console.log("[Cloud Function] Liste kategorisiert:", categorizedList);

        // --- SCHRITT 7: Strukturierte Daten zurückgeben ---
        return { categories: categorizedList };

    } catch (error) {
        console.error("[Cloud Function] Schwerer Fehler:", error);
        throw new HttpsError("internal", "Ein Server-Fehler ist aufgetreten.");
    }
});