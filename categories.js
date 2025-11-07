// Dies ist der Inhalt für: functions/categories.js

const categories = {

    /**
     * Obst & Gemüse
     * Füge hier alle Obst- und Gemüsesorten hinzu.
     */
    "Obst & Gemüse": [
        "apfel", "aprikose", "artischocke", "aubergine", "avocado",
        "banane", "birne", "blaubeere", "blumenkohl", "bohne", "bohnen",
        "brombeere", "brokkoli", "champignon", "chili", "champions",
        "dattel", "erbse", "erbsen", "erdbeere", "feldsalat",
        "fenchel", "feige", "granatapfel", "grapefruit", "gurke",
        "heidelbeere", "himbeere", "honigmelone", "ingwer",
        "johannisbeere", "karotte", "kartoffel", "kartoffeln", "khaki",
        "kirsche", "kiwi", "knoblauch", "kohl", "kohlrabi", "koriander",
        "kürbis", "lauch", "limette", "linse", "linsen", "litschi",
        "mais", "mandarine", "mango", "maracuja", "melone", "mirabelle",
        "möhre", "nektarine", "olive", "orange", "pak choi", "paprika",
        "pastinake", "persimone", "pfirsich", "pflaume", "pilze", "porree",
        "preiselbeere", "quitte", "radieschen", "rhabarber", "rosenkohl",
        "rote beete", "rote bete", "rotkohl", "rucola", "salat",
        "sellerie", "spargel", "spinat", "spitzkohl", "stachelbeere",
        "süßkartoffel", "tomate", "tomaten", "traube", "trauben",
        "wassermelone", "weißkohl", "wirsing", "zitrone", "zitronengras",
        "zucchini", "zwetschge", "zwiebel"
    ],

    /**
     * Milchprodukte & Eier
     * Alles aus dem Kühlregal (Milch, Käse, Joghurt...)
     */
    "Milchprodukte & Eier": [
        "ayran", "bergkäse", "brie", "büffelmozzarella", "butter",
        "buttermilch", "camembert", "cheddar", "creme fraiche", "ei",
        "eier", "emmentaler", "feta", "frischkäse", "gouda", "gorgonzola",
        "halloumi", "joghurt", "käse", "kefir", "kondensmilch",
        "mascarpone", "milch", "mozzarella", "parmesan", "pecorino",
        "quark", "ricotta", "sahne", "saure sahne", "schmand", "schlagsahne",
        "schmelzkäse", "speisequark", "ziegenkäse"
    ],

    /**
     * Fleisch & Fisch
     * Fleisch, Wurst, Fisch und Meeresfrüchte.
     */
    "Fleisch & Fisch": [
        "bratwurst", "chorizo", "fisch", "forelle", "garnele", "garnelen",
        "hackfleisch", "hähnchen", "huhn", "kabeljau", "kalb", "kassler",
        "lachs", "lamm", "leber", "leberwurst", "lyoner", "merguez",
        "mettwurst", "pute", "rind", "salami", "schinken", "schwein",
        "seehecht", "serrano", "speck", "thunfisch", "truthahn",
        "weißwurst", "wiener", "wild", "wurst", "zander"
    ],

    /**
     * Backzutaten
     * Alles zum Backen (Mehl, Zucker, Nüsse...)
     */
    "Backzutaten": [
        "agavendicksaft", "ahornsirup", "backkakao", "backpulver",
        "brauner zucker", "dinkelmehl", "gelatine", "hagelzucker",
        "haselnuss", "haselnüsse", "hefe", "honig", "kakao",
        "kakaopulver", "kokosflocken", "kokosraspeln", "kuvertüre",
        "mandel", "mandeln", "marzipan", "mehl", "nuss", "nüsse",
        "orangeat", "paniermehl", "pinienkerne", "pistazie", "pistazien",
        "puderzucker", "roggermehl", "sahnesteif", "schokolade",
        "speisestärke", "stärke", "streusel", "trockenhefe",
        "vanille", "vanilleextrakt", "vanilleschote", "vanillezucker",
        "walnuss", "walnüsse", "weizenmehl", "zitroneat", "zucker"
    ],

    /**
     * Trockenvorrat & Konserven
     * Nudeln, Reis, Konserven, Saucen, Kaffee...
     */
    "Trockenvorrat": [
        "ajvar", "apfelmus", "balsamico", "bouillon", "brühe", "bulgur",
        "chips", "cornflakes", "couscous", "cracker", "dinkelflocken",
        "erdnussbutter", "essig", "fischkonserve", "gemüsebrühe",
        "getrocknete tomaten", "haferflocken", "harissa", "hühnerbrühe",
        "kaffee", "kapern", "ketchup", "kichererbse", "kichererbsen",
        "knäckebrot", "kokosmilch", "konserve", "lasagneplatten", "linsen",
        "marmelade", "mayonnaise", "mehl", "misopaste", "müsli",
        "nudel", "nudeln", "nutella", "oliven",
        "paniermehl", "passierte tomaten", "pasta", "pesto", "pflanzenöl",
        "polenta", "pommes", "quinoa", "reis", "remoulade", "rindfleischbrühe",
        "sambal oelek", "sardellen", "sardinen", "sauerkraut", "senf",
        "sojasauce", "sonnenblumenöl", "spaghetti", "suppe", "tahini",
        "tee", "tofu", "tomatenmark", "tonic water", "tortilla", "wraps",
        "zucker", "zwieback"
    ],

    /**
     * Gewürze
     * Alle trockenen Gewürze und Kräuter.
     */
    "Gewürze": [
        "anis", "basilikum", "beifuß", "bockshornklee", "bohnenkraut",
        "chiliflocken", "chilipulver", "chili", "curry", "currypulver",
        "dill", "estragon", "fenchelsamen", "gewürznelken", "harissa",
        "kardamom", "kerbel", "knoblauchpulver", "koriander", "kräuter",
        "kreuzkümmel", "kümmel", "kurkuma", "lorbeer", "majoran",
        "muskatnuss", "nelken", "oregano", "paprikapulver", "petersilie",
        "pfeffer", "piment", "rosmarin", "safran", "salbei", "salz",
        "schnittlauch", "senfkörner", "sternanis", "thymian", "vanille",
        "wacholder", "zimt", "zwiebelpulver"
    ],
    
    /**
     * Getränke
     * Säfte, Wasser, Alkohol...
     */
    "Getränke": [
        "apfelsaft", "bier", "cola", "eistee", "gin", "hafermilch",
        "kaffee", "limonade", "mandelmilch", "mineralwasser", "orangensaft",
        "prosecco", "reisdrink", "rotwein", "saft", "sekt", "sojamilch",
        "tonic water", "wasser", "weißwein", "wodka"
    ],

    /**
     * Sonstiges
     * Tofu, Fertiggerichte, Eis...
     */
    "Sonstiges": [
        "eis", "eiswürfel", "fertiggericht", "pommes", "räuchertofu",
        "seitan", "tempeh", "tofu"
    ],
    /**
     * Öle
     * unterschiedlichste Arten von Öl
     */
    "Öl": [
        "öl", "olivenöl", "rapsöl", "maiskeimöl"
    ]



};

// Wir exportieren das Objekt, damit index.js es lesen kann
module.exports = categories;