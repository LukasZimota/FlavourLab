const axios = require('axios');
const cheerio = require('cheerio');
// Importiere die Google Translate Bibliothek
const {Translate} = require('@google-cloud/translate').v2;

// Initialisiere den Translate-Client
const translate = new Translate();

/**
 * Versucht, ein Rezept von einer URL zu extrahieren (JSON-LD)
 * UND übersetzt es anschließend ins Deutsche.
 */
async function extractRecipeFromUrl(url) {
    try {
        // 1. Webseite laden (als normaler Browser tarnen)
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000 // Max 10 Sekunden warten
        });

        const html = response.data;
        const $ = cheerio.load(html);
        
        let recipeData = null;

        // 2. Suche nach JSON-LD
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const jsonContent = $(el).html();
                if (!jsonContent) return;
                
                const data = JSON.parse(jsonContent);
                const found = findRecipeObject(data);
                if (found) {
                    recipeData = found;
                    return false; 
                }
            } catch (e) {
                console.error("JSON-LD Parse Fehler:", e);
            }
        });

        if (!recipeData) {
            throw new Error("Kein strukturiertes Rezept (JSON-LD) auf dieser Seite gefunden.");
        }

        // 3. Daten extrahieren (noch Englisch/Originalsprache)
        let result = {
            title: decodeHtmlEntity(recipeData.name || "Unbekanntes Rezept"),
            imageUrl: extractImage(recipeData.image),
            ingredients: extractIngredients(recipeData.recipeIngredient),
            instructions: extractInstructions(recipeData.recipeInstructions),
            servings:ybExtractServings(recipeData.recipeYield) || 4,
            url: url
        };

        // 4. ÜBERSETZUNG: Automatisch ins Deutsche übersetzen
        console.log("Starte Übersetzung...");
        result = await translateRecipeData(result);
        
        return result;

    } catch (error) {
        console.error("Fehler im Importer:", error.message);
        throw new Error("Konnte Rezept nicht laden: " + error.message);
    }
}

/**
 * Übersetzt Titel, Zutaten und Anleitung ins Deutsche.
 */
async function translateRecipeData(data) {
    const target = 'de';

    try {
        // Wir sammeln alle Texte, um sie in EINEM Rutsch zu übersetzen (spart Zeit & API-Calls)
        // Aufbau des Arrays: [Titel, ...Zutaten, ...Schritte]
        
        let textToTranslate = [];
        
        // 1. Titel
        textToTranslate.push(data.title);
        
        // 2. Zutaten
        const ingredientsStart = textToTranslate.length;
        textToTranslate = textToTranslate.concat(data.ingredients);
        
        // 3. Schritte
        const instructionsStart = textToTranslate.length;
        textToTranslate = textToTranslate.concat(data.instructions);

        // API Aufruf
        const [translations] = await translate.translate(textToTranslate, target);
        
        // Zurück mappen in das Objekt
        
        // Titel ist das erste Element
        data.title = translations[0];

        // Zutaten extrahieren
        data.ingredients = translations.slice(ingredientsStart, instructionsStart);

        // Schritte extrahieren
        data.instructions = translations.slice(instructionsStart);

        return data;

    } catch (error) {
        console.error("Fehler bei der Übersetzung:", error);
        // Falls Übersetzung fehlschlägt, geben wir das Original zurück (besser als Absturz)
        return data; 
    }
}


// --- Helfer-Funktionen (Parsing) ---

function findRecipeObject(obj) {
    if (!obj) return null;
    if (Array.isArray(obj)) {
        for (let item of obj) {
            const result = findRecipeObject(item);
            if (result) return result;
        }
        return null;
    }
    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
        return findRecipeObject(obj['@graph']);
    }
    if (isRecipeType(obj['@type'])) {
        return obj;
    }
    return null;
}

function isRecipeType(type) {
    if (!type) return false;
    if (Array.isArray(type)) {
        return type.includes('Recipe');
    }
    return type === 'Recipe' || type === 'https://schema.org/Recipe';
}

function extractImage(imageField) {
    if (!imageField) return "";
    if (typeof imageField === 'string') return imageField;
    if (Array.isArray(imageField) && imageField.length > 0) return imageField[0];
    if (typeof imageField === 'object') {
        if (imageField.url) return imageField.url;
        if (imageField['@type'] === 'ImageObject' && imageField.url) return imageField.url;
    }
    return "";
}

function extractIngredients(ingField) {
    if (!ingField) return [];
    if (typeof ingField === 'string') return [ingField];
    if (Array.isArray(ingField)) {
        return ingField.map(line => decodeHtmlEntity(line.toString().trim()));
    }
    return [];
}

function extractInstructions(instrField) {
    if (!instrField) return [];
    if (typeof instrField === 'string') {
        return [decodeHtmlEntity(instrField.trim())];
    }
    if (Array.isArray(instrField)) {
        return instrField.map(step => {
            if (typeof step === 'string') return decodeHtmlEntity(step.trim());
            if (step.text) return decodeHtmlEntity(step.text.trim());
            if (step.itemListElement) return extractInstructions(step.itemListElement);
            return "";
        }).flat().filter(s => s !== "");
    }
    return [];
}

function ybExtractServings(yieldField) {
    if (!yieldField) return null;
    const str = yieldField.toString();
    const match = str.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
    return null;
}

function decodeHtmlEntity(str) {
    if (!str) return "";
    return str.replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
              .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
              .replace(/&ß;/g, 'ß').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
              .replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

module.exports = { extractRecipeFromUrl };