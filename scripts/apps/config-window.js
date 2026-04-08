import { FactionReputationTracker } from "../models/reputation-tracker.js";
import { FactionReputationWindow } from "./reputation-window.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class FactionConfigWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(factionId, options = {}) {
        super(options);
        this.factionId = factionId;
    }

    static DEFAULT_OPTIONS = {
        id: "faction-config",
        tag: "form",
        window: {
            title: "DIPLOGLASS.ConfigFaction",
            icon: "fas fa-cog",
            resizable: true
        },
        position: {
            width: 612,
            height: 622
        },
        classes: ["fr-window"],
        form: {
            handler: FactionConfigWindow.prototype._onSubmit,
            closeOnSubmit: true
        },
        actions: {
            cancelConfig: FactionConfigWindow.prototype._onCancel,
            createRollTable: FactionConfigWindow.prototype._onCreateRollTable,
            browseIcon: FactionConfigWindow.prototype._onBrowseIcon,
            clearIcon: FactionConfigWindow.prototype._onClearIcon
        }
    };

    static PARTS = {
        form: {
            template: "modules/diploglass/templates/faction-config.html"
        }
    };

    async _prepareContext(options) {
        const factions = FactionReputationTracker.getFactions();
        const faction = factions[this.factionId];

        if (!faction) {
            ui.notifications.warn("Faction not found");
            this.close();
            return {};
        }

        // Ensure faction has steps value (backwards compatibility)
        const factionWithDefaults = {
            ...faction,
            steps: faction.steps ?? FactionReputationTracker.DEFAULT_STEPS,
            rollTableId: faction.rollTableId ?? null,
            icon: faction.icon ?? null,
            usePerPlayerReputation: faction.usePerPlayerReputation ?? FactionReputationTracker.usePerPlayerReputation()
        };

        return {
            faction: factionWithDefaults,
            journals: game.journal.contents,
            rollTables: game.tables.contents
        };
    }

    _onCancel(event, target) {
        this.close();
    }

    async _onCreateRollTable(event, target) {
        const factions = FactionReputationTracker.getFactions();
        const faction = factions[this.factionId];

        if (!faction) return;

        // Get current steps value from form or faction
        const stepsInput = this.element.querySelector('#steps');
        const steps = parseInt(stepsInput?.value, 10) || faction?.steps || FactionReputationTracker.DEFAULT_STEPS;

        // Generate default rank labels and colors for each reputation value
        const results = FactionReputationTracker.generateRollTableResults(steps);

        // Create the RollTable
        const tableName = `${faction.name} - ${game.i18n.localize("DIPLOGLASS.RollTable")}`;
        const table = await RollTable.create({
            name: tableName,
            formula: `1d${steps}`,
            results: results
        });

        // Update the dropdown and select the new table
        const dropdown = this.element.querySelector('#rollTableId');
        if (dropdown && table) {
            // Add the new option
            const option = document.createElement('option');
            option.value = table.id;
            option.textContent = table.name;
            option.selected = true;
            dropdown.appendChild(option);
        }

        // Notify user
        ui.notifications.info(game.i18n.format("DIPLOGLASS.Notifications.RollTableCreated", { name: tableName }));
    }

    async _onBrowseIcon(event, target) {
        const iconInput = this.element.querySelector('#icon');
        const currentValue = iconInput?.value || '';

        const fp = new FilePicker({
            type: "image",
            current: currentValue,
            callback: (path) => {
                if (iconInput) {
                    iconInput.value = path;
                    // Update the preview
                    this._updateIconPreview(path);
                }
            }
        });
        fp.render(true);
    }

    _onClearIcon(event, target) {
        const iconInput = this.element.querySelector('#icon');
        if (iconInput) {
            iconInput.value = '';
            this._updateIconPreview(null);
        }
    }

    _updateIconPreview(iconPath) {
        const preview = this.element.querySelector('.icon-preview');
        if (!preview) return;

        if (iconPath) {
            const img = document.createElement('img');
            img.src = iconPath;
            img.alt = 'Faction Icon';
            preview.replaceChildren(img);
        } else {
            const icon = document.createElement('i');
            icon.className = 'fas fa-flag';
            preview.replaceChildren(icon);
        }
    }

    async _onSubmit(event, form, formData) {
        // AppV2 formData handling might vary, verify if using standard form submission or extended
        // With handle: generic, formData is a FormDataExtended object usually or vanilla FormData

        const object = formData.object;

        // Validate steps value - must be odd number between 3 and 21
        let steps = parseInt(object.steps, 10) || FactionReputationTracker.DEFAULT_STEPS;
        if (steps < 3) steps = 3;
        if (steps > 21) steps = 21;
        if (steps % 2 === 0) steps = steps + 1; // Ensure odd number

        const factions = FactionReputationTracker.getFactions();
        const faction = factions[this.factionId];

        if (!object.name?.trim()) {
            ui.notifications.warn(game.i18n.localize("DIPLOGLASS.FactionNameRequired") || "Faction name is required");
            return;
        }

        faction.name = object.name;
        faction.journalId = object.journalId || null;
        faction.rollTableId = object.rollTableId || null;
        faction.startAtNeutral = object.startAtNeutral;
        faction.steps = steps;
        faction.icon = object.icon || null;
        faction.usePerPlayerReputation = object.usePerPlayerReputation ?? false;

        await FactionReputationTracker.setFactions(factions);

        // Refresh main window if open using static reference
        if (FactionReputationWindow._activeInstance) {
            FactionReputationWindow._activeInstance.render();
        }
    }
}
