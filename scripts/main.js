import { registerSettings } from "./config.js";
import { FactionReputationTracker } from "./models/reputation-tracker.js";
import { FactionReputationWindow } from "./apps/reputation-window.js";
import { SavrasLib } from "./savras-lib.min.js";

/**
 * Opens the Faction Reputation Window, reusing an existing instance if one is active.
 */
function openReputationWindow() {
    try {
        if (FactionReputationWindow._activeInstance) {
            FactionReputationWindow._activeInstance.bringToFront();
            FactionReputationWindow._activeInstance.render(true);
        } else {
            new FactionReputationWindow().render(true);
        }
    } catch (error) {
        console.error('DiploGlass | Failed to open reputation window:', error);
    }
}

// Make module API globally available for macros
window.DiploGlass = {
    open: openReputationWindow,
    FactionReputationTracker
};

// Savras telemetry - anonymous usage statistics (opt-out via module settings)
export const telemetry = new SavrasLib({
    moduleId: 'diploglass',
    telemetryUrl: 'https://savras.dnd-session.de/api/v1/telemetry',
    consentDefault: true,
    startupMessage: 'DiploGlass telemetry initialized'
});

Hooks.once('init', () => {
    registerSettings();
    registerHandlebarsHelpers();
});

// Inject reputation button into player list
// V14 renamed PlayerList to Players, changing the hook from renderPlayerList to renderPlayers
function _onRenderPlayerList(app, html) {
    const playerAccess = game.settings.get('diploglass', 'playerAccess');

    // Hide button for non-GMs if access is 'none'
    if (!game.user.isGM && playerAccess === 'none') return;

    const container = document.createElement('div');
    container.innerHTML = `
        <button class="fr-player-list-btn">
            <i class="fas fa-handshake"></i> Reputation
        </button>
    `;
    const button = container.firstElementChild;

    button.addEventListener('click', () => {
        openReputationWindow();
    });

    // html is HTMLElement in V13+/V14 (ApplicationV2), jQuery in V12
    const root = html instanceof HTMLElement ? html : html[0];
    const playerList = root.querySelector('.player-list') || root;
    playerList.prepend(button);
}

Hooks.on('renderPlayerList', _onRenderPlayerList); // V12/V13
Hooks.on('renderPlayers', _onRenderPlayerList);     // V14+

Hooks.on('getSceneControlButtons', (controls) => {
    const playerAccess = game.settings.get('diploglass', 'playerAccess');

    // Hide control for non-GMs if access is 'none'
    if (!game.user.isGM && playerAccess === 'none') return;

    // V13: controls is an object, V12: controls is an array
    if (typeof controls.find === "function") {
        // V12 structure: controls is an array
        const tokenControls = controls.find(c => c.name === "token");
        if (tokenControls) {
            tokenControls.tools.push({
                name: "faction-reputation",
                title: "DIPLOGLASS.Controls.OpenWindow",
                icon: "fas fa-handshake",
                onClick: () => openReputationWindow(),
                button: true
            });
        }
    } else {
        // V13 structure: controls is an object with named properties
        if (controls.tokens) {
            controls.tokens.tools["diploglass"] = {
                name: "diploglass",
                title: "DIPLOGLASS.Controls.OpenWindow",
                icon: "fa-solid fa-handshake",
                visible: true,
                button: true,
                onChange: () => openReputationWindow()
            };
        }
    }
});

/**
 * Handlebars Helpers - registered for template use and macro API access.
 * Available as: {{reputationColor value}}, {{reputationLabel value}}, {{eq a b}}, {{substring str start end}}
 */
function registerHandlebarsHelpers() {
    Handlebars.registerHelper('reputationColor', function (level) {
        const levelData = FactionReputationTracker.getReputationLevels().find(l => l.value === level);
        return levelData?.color || '#808080';
    });

    Handlebars.registerHelper('reputationLabel', function (level) {
        const levelData = FactionReputationTracker.getReputationLevels().find(l => l.value === level);
        return levelData?.label || game.i18n?.localize("DIPLOGLASS.Unknown") || 'Unknown';
    });

    Handlebars.registerHelper('eq', function (a, b) {
        return a === b;
    });

    Handlebars.registerHelper('substring', function (str, start, end) {
        return str ? str.substring(start, end || start + 1) : '';
    });
}
