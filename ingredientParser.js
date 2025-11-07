// Dies ist der Inhalt für: functions/ingredientParser.js

// Wir importieren die Kategorien, da der Parser sie zum Kategorisieren braucht
const categories = require('./categories.js');

/**
 * PARSER (Ansatz 37)
 * Nimmt einen String (z.B. "1kg Mehl") und zerlegt ihn.
 * Rechnet Einheiten (kg, l, etc.) in Basis-Einheiten (g, ml) um.
 */
const parseIngredient = (line) => {
    line = line.trim();
    
    // Regex: 1. Menge (Zahlen, Komma, Punkt), 2. (Optional) Einheit, 3. Name
    const regex = /^([\d.,]+)\s*([a-zA-Z]+)?\s+(.*)$/;
    
    let match = line.match(regex);
    let amountStr = "1";
    let unit = "";
    let name = "";

    if (match) {
        amountStr = match[1] || "1";
        unit = match[2] ? match[2].toLowerCase() : "stück"; 
        name = match[3].trim();
    } else {
        const simpleRegex = /^([\d.,]+)\s+(.*)$/;
        match = line.match(simpleRegex);
        if (match) {
            amountStr = match[1] || "1";
            unit = "stück"; 
            name = match[2].trim();
        } else {
            amountStr = "1"; 
            unit = "prise"; 
            name = line.trim();
        }
    }
    
    // Menge in eine saubere Zahl umwandeln (1,5 -> 1.5)
    let amount = parseFloat(amountStr.replace(',', '.')) || 0;

    // --- EINHEITEN-KONVERTIERUNG ---
    const baseUnitMap = {
        'g': 'g', 'gramm': 'g', 'kg': 'g', 'kilogramm': 'g', 'pfund': 'g',
        'ml': 'ml', 'milliliter': 'ml', 'l': 'ml', 'liter': 'ml', 'cl': 'ml',
        'el': 'el', 'esslöffel': 'el',
        'tl': 'tl', 'teelöffel': 'tl',
        'stück': 'stück', 'stk': 'stück', 'st': 'stück',
        'prise': 'prise', 'zehe': 'prise' 
    };

    const conversionFactorMap = {
        'g': 1, 'gramm': 1, 'kg': 1000, 'kilogramm': 1000, 'pfund': 500,
        'ml': 1, 'milliliter': 1, 'l': 1000, 'liter': 1000, 'cl': 10,
        'el': 1, 'esslöffel': 1,
        'tl': 1, 'teelöffel': 1,
        'stück': 1, 'stk': 1, 'st': 1,
        'prise': 1, 'zehe': 1
    };

    const originalUnit = unit.toLowerCase();
    
    if (baseUnitMap[originalUnit]) {
        // Bekannte Einheit
        const baseUnit = baseUnitMap[originalUnit]; 
        const factor = conversionFactorMap[originalUnit]; 
        
        return { 
            name: name,         
            amount: amount * factor, 
            unit: baseUnit, 
            fullName: line      
        };
    } else {
        // Unbekannte Einheit (z.B. "Bund", "Packung")
        return { 
            name: `${unit} ${name}`, // "Bund Petersilie"
            amount: amount,          
            unit: 'stück',           
            fullName: line      
        };
    }
};

/**
 * KATEGORISIERER
 * Nimmt einen Namen (z.B. "Mehl") und findet die Kategorie.
 */
const categorizeIngredient = (name) => {
    const lowerName = name.toLowerCase().trim();
    // Iteriere durch die importierten Kategorien
    for (const category in categories) { 
        if (categories[category].some(keyword => lowerName.includes(keyword))) {
            return category;
        }
    }
    return "Sonstiges";
};

// Wir exportieren beide Funktionen, damit index.js sie verwenden kann
module.exports = {
    parseIngredient,
    categorizeIngredient
};