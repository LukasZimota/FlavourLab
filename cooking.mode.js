// --- cooking.mode.js ---
// Dieses Modul steuert den "Kochmodus" (Vollbild, Schritte, Timer)

let currentRecipe = null;
let currentStepIndex = 0;
let timerInterval = null;
let timerSeconds = 0;

// UI Elemente cachen (werden beim Start geladen)
let ui = {
    overlay: null,
    stepDisplay: null,
    stepCounter: null,
    prevBtn: null,
    nextBtn: null,
    ingredientsList: null,
    notesArea: null,
    sidebarLeft: null,
    sidebarRight: null,
    timerDisplay: null,
    timerInput: null,
    timerBtn: null
};

/**
 * Initialisiert den Kochmodus und öffnet das Overlay
 * @param {Object} recipe - Das Rezept-Objekt mit Zutaten, Schritten etc.
 */
export function startCookingMode(recipe) {
    currentRecipe = recipe;
    currentStepIndex = 0;

    // Elemente finden (erst hier, da sie im DOM existieren müssen)
    cacheElements();
    
    // Daten befüllen
    renderIngredients();
    renderNotes();
    updateStepView();
    
    // Startzustand der Sidebars:
    // Auf Desktop offen (Klasse 'closed' entfernen)
    // Auf Mobile zu (Klasse 'mobile-open' entfernen)
    ui.sidebarLeft.classList.remove('closed', 'mobile-open');
    ui.sidebarRight.classList.remove('closed', 'mobile-open');
    
    // Event Listener für diesen Modus setzen
    attachEvents();

    // Overlay anzeigen
    ui.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Scrollen im Hintergrund verhindern
}

function cacheElements() {
    ui.overlay = document.getElementById('cooking-mode-overlay');
    ui.stepDisplay = document.getElementById('cooking-step-text');
    ui.stepCounter = document.getElementById('cooking-step-counter');
    ui.prevBtn = document.getElementById('btn-cooking-prev');
    ui.nextBtn = document.getElementById('btn-cooking-next');
    ui.ingredientsList = document.getElementById('cooking-ingredients-list');
    ui.notesArea = document.getElementById('cooking-notes');
    ui.sidebarLeft = document.getElementById('cooking-sidebar-left');
    ui.sidebarRight = document.getElementById('cooking-sidebar-right');
    
    // Timer
    ui.timerDisplay = document.getElementById('cooking-timer-display');
    ui.timerInput = document.getElementById('cooking-timer-input');
    ui.timerBtn = document.getElementById('btn-cooking-timer-toggle');
}

function attachEvents() {
    // Navigation
    ui.prevBtn.onclick = () => changeStep(-1);
    ui.nextBtn.onclick = () => changeStep(1);
    
    // Schließen
    document.getElementById('btn-close-cooking').onclick = closeCookingMode;

    // Sidebars Toggles (Intelligent für Desktop & Mobile)
    document.getElementById('btn-toggle-ingredients').onclick = () => {
        if (window.innerWidth > 900) {
            ui.sidebarLeft.classList.toggle('closed'); // Desktop: Breite auf 0
        } else {
            ui.sidebarLeft.classList.toggle('mobile-open'); // Mobile: Reinschieben
        }
    };
    
    document.getElementById('btn-toggle-notes').onclick = () => {
        if (window.innerWidth > 900) {
            ui.sidebarRight.classList.toggle('closed');
        } else {
            ui.sidebarRight.classList.toggle('mobile-open');
        }
    };
    
    // NEU: Mobile Close Buttons (Die X-Buttons IM Sidebar)
    const closeLeft = document.getElementById('btn-close-left-mobile');
    const closeRight = document.getElementById('btn-close-right-mobile');
    
    if(closeLeft) closeLeft.onclick = () => ui.sidebarLeft.classList.remove('mobile-open');
    if(closeRight) closeRight.onclick = () => ui.sidebarRight.classList.remove('mobile-open');

    // Timer
    ui.timerBtn.onclick = toggleTimer;
}

function closeCookingMode() {
    ui.overlay.classList.add('hidden');
    document.body.style.overflow = ''; // Scrollen wieder erlauben
    stopTimer(); // Timer stoppen falls er läuft
}

// --- Schritt-Logik ---

function updateStepView() {
    if (!currentRecipe.instructions || currentRecipe.instructions.length === 0) {
        ui.stepDisplay.textContent = "Keine Schritte vorhanden.";
        ui.stepCounter.textContent = "";
        return;
    }

    const totalSteps = currentRecipe.instructions.length;
    
    // Text setzen
    ui.stepDisplay.textContent = currentRecipe.instructions[currentStepIndex];
    ui.stepCounter.textContent = `Schritt ${currentStepIndex + 1} von ${totalSteps}`;

    // Buttons aktivieren/deaktivieren
    ui.prevBtn.disabled = currentStepIndex === 0;
    
    if (currentStepIndex === totalSteps - 1) {
        ui.nextBtn.innerHTML = "Fertig ✓";
    } else {
        ui.nextBtn.innerHTML = "Weiter →";
    }
}

function changeStep(direction) {
    const newIndex = currentStepIndex + direction;
    if (newIndex >= 0 && newIndex < currentRecipe.instructions.length) {
        currentStepIndex = newIndex;
        updateStepView();
    } else if (newIndex >= currentRecipe.instructions.length) {
        // Wenn man beim letzten Schritt "Weiter" klickt -> Schließen?
        if(confirm("Herzlichen Glückwunsch! Rezept abgeschlossen. Modus beenden?")) {
            closeCookingMode();
        }
    }
}

// --- Sidebar Inhalte ---

function renderIngredients() {
    ui.ingredientsList.innerHTML = '';
    if (!currentRecipe.ingredients) return;

    currentRecipe.ingredients.forEach(ing => {
        const li = document.createElement('li');
        li.innerHTML = `
            <label class="cooking-checkbox">
                <input type="checkbox">
                <span>${ing}</span>
            </label>
        `;
        ui.ingredientsList.appendChild(li);
    });
}

function renderNotes() {
    ui.notesArea.value = currentRecipe.notes || '';
    // Optional: Autosave Logik für Notizen könnte hier hin
}


// --- Timer Logik ---

function toggleTimer() {
    if (timerInterval) {
        // Stop
        stopTimer();
    } else {
        // Start
        const minutes = parseInt(ui.timerInput.value, 10);
        if (isNaN(minutes) || minutes <= 0) return;
        
        timerSeconds = minutes * 60;
        ui.timerInput.style.display = 'none';
        ui.timerDisplay.style.display = 'block';
        ui.timerDisplay.textContent = formatTime(timerSeconds);
        ui.timerBtn.textContent = 'Stop';
        ui.timerBtn.classList.add('active');

        timerInterval = setInterval(() => {
            timerSeconds--;
            ui.timerDisplay.textContent = formatTime(timerSeconds);
            
            if (timerSeconds <= 0) {
                timerFinished();
            }
        }, 1000);
    }
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    ui.timerBtn.textContent = 'Start';
    ui.timerBtn.classList.remove('active');
    ui.timerDisplay.style.display = 'none';
    ui.timerInput.style.display = 'block';
}

function timerFinished() {
    stopTimer();
    alert("⏰ Timer abgelaufen!");
    // Hier könnte man auch einen Sound abspielen
}

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}