import { registerSettings } from "./config.js";
import { FactionReputationTracker } from "./models/reputation-tracker.js";
import { FactionReputationWindow } from "./apps/reputation-window.js";

// Make tracker globally available for macros/API usage
window.FactionReputationTracker = FactionReputationTracker;

Hooks.once('init', () => {
    registerSettings();
    registerHandlebarsHelpers();
});

Hooks.on('renderPlayerList', (app, html) => {
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
        new FactionReputationWindow().render(true);
    });

    const playerList = html.querySelector('.player-list');
    if (playerList) {
        playerList.before(button);
    } else {
        const root = html instanceof HTMLElement ? html : html[0];
        const list = root.querySelector('.player-list') || root;
        list.prepend(button);
    }
});

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
                onClick: () => new FactionReputationWindow().render(true),
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
                onChange: () => new FactionReputationWindow().render(true)
            };
        }
    }
});

function registerHandlebarsHelpers() {
    Handlebars.registerHelper('reputationColor', function (level) {
        const levelData = FactionReputationTracker.getReputationLevels().find(l => l.value === level);
        return levelData?.color || '#808080';
    });

    Handlebars.registerHelper('reputationLabel', function (level) {
        const levelData = FactionReputationTracker.getReputationLevels().find(l => l.value === level);
        return levelData?.label || 'Unbekannt';
    });

    Handlebars.registerHelper('eq', function (a, b) {
        return a === b;
    });

    Handlebars.registerHelper('substring', function (str, start, length) {
        return str ? str.substring(start, length || start + 1) : '';
    });
}
