import { FactionReputationTracker } from "../models/reputation-tracker.js";
import { FactionConfigWindow } from "./config-window.js";
import { escapeHtml } from "./utils/html-helpers.js";
import { generateBarSegments, getPillClass, formatDisplayValue } from "./utils/reputation-helpers.js";
import { createAddFactionDialogContent, createAddCommentDialogContent } from "./utils/dialog-templates.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class FactionReputationWindow extends HandlebarsApplicationMixin(ApplicationV2) {

    // Static reference to active instance for cross-window communication
    static _activeInstance = null;

    // Track selected faction
    _selectedFactionId = null;

    // Track active tab
    _activeTab = 'overview';

    static DEFAULT_OPTIONS = {
        id: "faction-reputation-window",
        tag: "div",
        window: {
            title: "DIPLOGLASS.WindowTitle",
            icon: "fas fa-handshake",
            resizable: true
        },
        position: {
            width: 900,
            height: 620
        },
        classes: ["fr-window"],
        actions: {
            addFaction: FactionReputationWindow.prototype._onAddFaction,
            deleteFaction: FactionReputationWindow.prototype._onDeleteFaction,
            openJournal: FactionReputationWindow.prototype._onOpenJournal,
            configFaction: FactionReputationWindow.prototype._onConfigFaction,
            changeReputation: FactionReputationWindow.prototype._onReputationChange,
            selectFaction: FactionReputationWindow.prototype._onSelectFaction,
            setReputation: FactionReputationWindow.prototype._onSetReputation,
            setPreset: FactionReputationWindow.prototype._onSetPreset,
            resetFaction: FactionReputationWindow.prototype._onResetFaction,
            openSettings: FactionReputationWindow.prototype._onOpenSettings,
            switchTab: FactionReputationWindow.prototype._onSwitchTab,
            addComment: FactionReputationWindow.prototype._onAddComment,
            exportFactions: FactionReputationWindow.prototype._onExportFactions
        }
    };

    static PARTS = {
        content: {
            template: "modules/diploglass/templates/faction-window.html"
        }
    };

    /**
     * Check whether the current user has edit permission.
     * GMs always can; non-GMs need the 'edit' playerAccess setting.
     */
    _canEdit() {
        if (game.user.isGM) return true;
        return game.settings.get('diploglass', 'playerAccess') === 'edit';
    }

    /**
     * Generate bar segments for a reputation bar.
     * Delegates to the extracted utility function.
     */
    _generateBarSegments(steps, minValue, maxValue, currentValue) {
        return generateBarSegments(steps, minValue, maxValue, currentValue);
    }

    /**
     * Get pill class based on reputation value.
     * Delegates to the extracted utility function.
     */
    _getPillClass(value, minValue, maxValue) {
        return getPillClass(value, minValue, maxValue);
    }

    /**
     * Format display value with + sign for positive numbers.
     * Delegates to the extracted utility function.
     */
    _formatDisplayValue(value) {
        return formatDisplayValue(value);
    }

    /**
     * Generate level details for the Levels tab from faction levels
     * @param {Array} factionLevels - Array of levels from getLevelsForFaction
     * @param {number} currentReputation - Current reputation value
     */
    _generateLevelDetailsFromFactionLevels(factionLevels, currentReputation) {
        // Sort by value descending (highest first) for display
        return [...factionLevels]
            .sort((a, b) => b.value - a.value)
            .map(level => ({
                value: level.value,
                displayValue: this._formatDisplayValue(level.value),
                color: level.color,
                label: level.label,
                isCurrent: level.value === currentReputation
            }));
    }

    async _prepareContext(options) {
        const factions = FactionReputationTracker.getFactionsWithBounds();
        const factionList = Object.values(factions);

        // Get both reputation data stores (we'll choose per faction which one to use)
        const playerReputations = FactionReputationTracker.getPlayerReputations();
        const globalReputations = FactionReputationTracker.getGlobalReputations();

        // Auto-select first faction if none selected
        if (!this._selectedFactionId && factionList.length > 0) {
            this._selectedFactionId = factionList[0].id;
        }

        // Ensure selected faction still exists
        if (this._selectedFactionId && !factions[this._selectedFactionId]) {
            this._selectedFactionId = factionList.length > 0 ? factionList[0].id : null;
        }

        // Process faction data for sidebar - each faction uses its own mode setting
        const factionData = factionList.map(faction => {
            const { steps, minValue, maxValue } = faction;
            const usePerPlayer = FactionReputationTracker.usePerPlayerReputationForFaction(faction);
            let reputation;

            if (usePerPlayer) {
                // For per-player mode, show current user's reputation in sidebar
                // GM sees first player's reputation for consistency with edit actions
                const userId = game.user.isGM
                    ? (Object.keys(playerReputations)[0] || game.users.find(u => !u.isGM && u.character)?.id || game.user.id)
                    : game.user.id;
                reputation = playerReputations[userId]?.[faction.id] || 0;
            } else {
                reputation = globalReputations[faction.id] || 0;
            }

            // Get faction-specific levels (with RollTable labels/colors if available)
            const levels = FactionReputationTracker.getLevelsForFaction(faction);
            const currentLevel = levels.find(l => l.value === reputation);
            const rankLabel = currentLevel?.label || FactionReputationTracker.getRankLabel(faction, reputation);
            const rankColor = currentLevel?.color || FactionReputationTracker.getRankColor(reputation, minValue, maxValue);
            const statusText = FactionReputationTracker.getStatusFromRollTable(faction.rollTableId, reputation);

            return {
                ...faction,
                reputation: reputation,
                rankLabel: rankLabel,
                rankColor: rankColor,
                pillClass: this._getPillClass(reputation, minValue, maxValue),
                displayValue: this._formatDisplayValue(reputation),
                isSelected: faction.id === this._selectedFactionId,
                journal: faction.journalId ? game.journal.get(faction.journalId) : null,
                rollTableStatus: statusText,
                barSegments: this._generateBarSegments(steps, minValue, maxValue, reputation),
                isPerPlayerMode: usePerPlayer
            };
        });

        // Get full data for selected faction
        let selectedFaction = null;
        let selectedFactionUsePerPlayer = false;
        let factionLevels = [];
        if (this._selectedFactionId) {
            const faction = factions[this._selectedFactionId];
            if (faction) {
                const { steps, minValue, maxValue } = faction;
                selectedFactionUsePerPlayer = FactionReputationTracker.usePerPlayerReputationForFaction(faction);
                let reputation;

                if (selectedFactionUsePerPlayer) {
                    // GM sees first player's reputation for consistency with edit actions
                    const userId = game.user.isGM
                        ? (Object.keys(playerReputations)[0] || game.users.find(u => !u.isGM && u.character)?.id || game.user.id)
                        : game.user.id;
                    reputation = playerReputations[userId]?.[faction.id] || 0;
                } else {
                    reputation = globalReputations[faction.id] || 0;
                }

                // Get faction-specific levels (with RollTable labels/colors if available)
                factionLevels = FactionReputationTracker.getLevelsForFaction(faction);

                // Get current rank info from faction levels
                const currentLevel = factionLevels.find(l => l.value === reputation);
                const rankLabel = currentLevel?.label || FactionReputationTracker.getRankLabel(faction, reputation);
                const rankColor = currentLevel?.color || FactionReputationTracker.getRankColor(reputation, minValue, maxValue);
                const statusText = FactionReputationTracker.getStatusFromRollTable(faction.rollTableId, reputation);

                // Generate level details for Levels tab (using faction levels)
                const levelDetails = this._generateLevelDetailsFromFactionLevels(factionLevels, reputation);

                // Get and format change log entries
                const changeLogEntries = this._formatChangeLogEntries(faction.id);

                selectedFaction = {
                    ...faction,
                    reputation: reputation,
                    rankLabel: rankLabel,
                    rankColor: rankColor,
                    pillClass: this._getPillClass(reputation, minValue, maxValue),
                    displayValue: this._formatDisplayValue(reputation),
                    journal: faction.journalId ? game.journal.get(faction.journalId) : null,
                    rollTableStatus: statusText,
                    barSegments: this._generateBarSegments(steps, minValue, maxValue, reputation),
                    levelDetails: levelDetails,
                    changeLog: changeLogEntries,
                    isPerPlayerMode: selectedFactionUsePerPlayer
                };
            }
        }

        // Determine current user ID for actions based on selected faction's mode
        // For per-player factions, GM should use the first player's ID to keep data consistent
        let currentUserId = 'global';
        if (selectedFactionUsePerPlayer) {
            if (game.user.isGM) {
                // GM uses first available player ID from existing reputations, or first non-GM user
                const firstPlayerId = Object.keys(playerReputations)[0]
                    || game.users.find(u => !u.isGM && u.character)?.id;
                currentUserId = firstPlayerId || game.user.id;
            } else {
                currentUserId = game.user.id;
            }
        }

        // Prepare character reputations list for per-player mode (shows each actor separately)
        let playerReputationsList = [];
        if (selectedFactionUsePerPlayer && selectedFaction) {
            const { minValue, maxValue } = selectedFaction;

            // Get all actors owned by non-GM players (ownership level 3 = OWNER)
            const playerActors = game.actors.filter(actor => {
                // Check if any non-GM user has owner permission on this actor
                for (const [userId, level] of Object.entries(actor.ownership)) {
                    if (level === 3) {
                        const user = game.users.get(userId);
                        if (user && !user.isGM) return true;
                    }
                }
                return false;
            });

            playerReputationsList = playerActors.map(actor => {
                // Find the owner user for display
                let ownerUser = null;
                for (const [userId, level] of Object.entries(actor.ownership)) {
                    if (level === 3) {
                        const user = game.users.get(userId);
                        if (user && !user.isGM) {
                            ownerUser = user;
                            break;
                        }
                    }
                }

                // Use actor ID for reputation storage
                const reputation = playerReputations[actor.id]?.[this._selectedFactionId] || 0;
                const currentLevel = factionLevels.find(l => l.value === reputation);
                const rankLabel = currentLevel?.label || FactionReputationTracker.getRankLabel(selectedFaction, reputation);

                // Display: "ActorName (PlayerName)" or just "ActorName" if no owner found
                const displayName = ownerUser ? `${actor.name} (${ownerUser.name})` : actor.name;
                const initial = actor.name?.charAt(0)?.toUpperCase() || '?';

                return {
                    actorId: actor.id,
                    actorName: actor.name,
                    name: displayName,
                    avatar: actor.img,
                    initial: initial,
                    reputation: reputation,
                    displayValue: this._formatDisplayValue(reputation),
                    rankLabel: rankLabel,
                    pillClass: this._getPillClass(reputation, minValue, maxValue),
                    ownerColor: ownerUser?.color || '#888888'
                };
            });

            // Add actors to each level for the Levels tab display
            if (selectedFaction?.levelDetails) {
                selectedFaction.levelDetails = selectedFaction.levelDetails.map(level => ({
                    ...level,
                    actorsAtLevel: playerReputationsList
                        .filter(p => p.reputation === level.value)
                        .map(p => ({
                            name: p.actorName,
                            color: p.ownerColor || '#888888'
                        }))
                }));
            }
        }

        // Determine edit permission based on GM status and playerAccess setting
        const playerAccess = game.settings.get('diploglass', 'playerAccess');
        const canEdit = game.user.isGM || playerAccess === 'edit';

        return {
            factions: factionData,
            selectedFaction: selectedFaction,
            hasGMPermission: game.user.isGM,
            canEdit: canEdit,
            journals: game.journal.contents,
            usePerPlayerReputation: selectedFactionUsePerPlayer,
            reputationLevels: factionLevels,
            currentUserId: currentUserId,
            playerReputations: playerReputationsList
        };
    }

    async _onReputationChange(event, target) {
        if (!this._canEdit()) {
            ui.notifications.warn(game.i18n.localize("DIPLOGLASS.NoPermission"));
            return;
        }

        const factionId = target.dataset.factionId;
        const userId = target.dataset.userId || 'global';
        const change = parseInt(target.dataset.change);
        if (isNaN(change)) return;

        try {
            await FactionReputationTracker.changeReputation(userId, factionId, change);
            this.render();
        } catch (error) {
            console.error('FactionReputationTracker | Error changing reputation:', error);
            ui.notifications.error(game.i18n.localize("DIPLOGLASS.Notifications.ErrorChangingReputation"));
        }
    }

    async _onAddFaction(event, target) {
        const self = this;
        const defaultSteps = FactionReputationTracker.DEFAULT_STEPS;

        // Helper function to get or create Diploglass folder
        const getOrCreateFolder = async (type) => {
            const folderName = "Diploglass";
            let folder = game.folders.find(f => f.name === folderName && f.type === type);
            if (!folder) {
                folder = await Folder.create({ name: folderName, type: type });
            }
            return folder;
        };

        // Build dialog content from extracted template
        const dialogContent = createAddFactionDialogContent({
            journals: game.journal.contents,
            rollTables: game.tables.contents,
            defaultSteps: defaultSteps,
            i18n: game.i18n.localize.bind(game.i18n)
        });

        // Create dialog with manual close handling for validation
        let dialog;
        dialog = new Dialog({
            title: game.i18n.localize("DIPLOGLASS.Dialogs.AddFactionTitle"),
            content: dialogContent,
            buttons: {
                create: {
                    icon: '<i class="fas fa-check"></i>',
                    label: game.i18n.localize("DIPLOGLASS.Dialogs.Create"),
                    callback: async (html) => {
                        // Validate name
                        const name = html.find('[name="name"]').val().trim();
                        if (!name) {
                            ui.notifications.warn(game.i18n.localize("DIPLOGLASS.Notifications.PleaseEnterName"));
                            // Re-render dialog to keep it open
                            setTimeout(() => dialog.render(true), 50);
                            return;
                        }

                        // Get journal and RollTable selections (empty string becomes null)
                        const journalId = html.find('[name="journalId"]').val() || null;
                        const rollTableId = html.find('[name="rollTableId"]').val() || null;

                        // Validate steps value - must be odd number between 3 and 21
                        let steps = parseInt(html.find('[name="steps"]').val()) || defaultSteps;

                        // Check if steps is even - show warning and re-open dialog
                        if (steps % 2 === 0) {
                            ui.notifications.warn(game.i18n.localize("DIPLOGLASS.Notifications.StepsMustBeOdd"));
                            setTimeout(() => dialog.render(true), 50);
                            return;
                        }

                        // Validate range
                        if (steps < 3 || steps > 21) {
                            ui.notifications.warn(game.i18n.localize("DIPLOGLASS.Notifications.StepsOutOfRange"));
                            setTimeout(() => dialog.render(true), 50);
                            return;
                        }

                        // All validation passed - create faction
                        try {
                            await FactionReputationTracker.createFaction(name, journalId, true, steps, rollTableId);
                            self.render(true);
                        } catch (error) {
                            console.error('DiploGlass | Failed to create faction:', error);
                            ui.notifications.error(game.i18n.localize("DIPLOGLASS.ErrorCreatingFaction") || "Failed to create faction");
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("DIPLOGLASS.Cancel")
                }
            },
            default: "create",
            render: (html) => {
                // Add glassmorphism class to dialog
                html.closest('.dialog').addClass('fr-glass-dialog');

                // Handle create journal button
                html.find('[data-create="journal"]').on('click', async (event) => {
                    event.preventDefault();
                    const nameInput = html.find('[name="name"]').val().trim();
                    const journalName = nameInput || game.i18n.localize("DIPLOGLASS.Dialogs.NewJournal");

                    const folder = await getOrCreateFolder("JournalEntry");
                    const journal = await JournalEntry.create({
                        name: journalName,
                        folder: folder.id
                    });

                    // Add to dropdown and select it
                    const select = html.find('[name="journalId"]');
                    select.append(`<option value="${journal.id}">${escapeHtml(journal.name)}</option>`);
                    select.val(journal.id);

                    ui.notifications.info(game.i18n.format("DIPLOGLASS.Notifications.JournalCreated", { name: journal.name }));
                });

                // Handle create RollTable button
                html.find('[data-create="rolltable"]').on('click', async (event) => {
                    event.preventDefault();
                    const nameInput = html.find('[name="name"]').val().trim();
                    const stepsInput = parseInt(html.find('[name="steps"]').val()) || defaultSteps;
                    const tableName = nameInput
                        ? `${nameInput} - ${game.i18n.localize("DIPLOGLASS.RollTable")}`
                        : game.i18n.localize("DIPLOGLASS.Dialogs.NewRollTable");

                    const folder = await getOrCreateFolder("RollTable");

                    // Generate default entries based on steps
                    const results = FactionReputationTracker.generateRollTableResults(stepsInput);

                    const table = await RollTable.create({
                        name: tableName,
                        folder: folder.id,
                        formula: `1d${stepsInput}`,
                        results: results
                    });

                    // Add to dropdown and select it
                    const select = html.find('[name="rollTableId"]');
                    select.append(`<option value="${table.id}">${escapeHtml(table.name)}</option>`);
                    select.val(table.id);

                    ui.notifications.info(game.i18n.format("DIPLOGLASS.Notifications.RollTableCreated", { name: table.name }));
                });
            }
        });
        dialog.render(true);
    }

    async _onDeleteFaction(event, target) {
        const factionId = target.dataset.factionId;
        const factions = FactionReputationTracker.getFactions();
        const faction = factions[factionId];
        if (!faction) return;

        const deleteContent = game.i18n.format("DIPLOGLASS.Dialogs.DeleteFactionContent", { name: faction.name });

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("DIPLOGLASS.Dialogs.DeleteFactionTitle"),
            content: `<div class="fr-dialog-content"><p>${deleteContent}</p></div>`,
            render: (html) => {
                html.closest('.dialog').addClass('fr-glass-dialog');
            }
        });

        if (confirmed) {
            try {
                await FactionReputationTracker.deleteFaction(factionId);
                this.render();
            } catch (error) {
                console.error('DiploGlass | Failed to delete faction:', error);
                ui.notifications.error(game.i18n.localize("DIPLOGLASS.ErrorDeletingFaction") || "Failed to delete faction");
            }
        }
    }

    _onOpenJournal(event, target) {
        const journalId = target.dataset.journalId;
        const journal = game.journal.get(journalId);
        if (journal) {
            journal.sheet.render(true);
        }
    }

    async _onConfigFaction(event, target) {
        const factionId = target.dataset.factionId;
        new FactionConfigWindow(factionId).render(true);
    }

    _onSelectFaction(event, target) {
        const factionId = target.dataset.factionId;
        if (factionId) {
            this._selectedFactionId = factionId;
            this.render();
        }
    }

    async _onSetReputation(event, target) {
        if (!this._canEdit()) {
            ui.notifications.warn(game.i18n.localize("DIPLOGLASS.NoPermission"));
            return;
        }

        const factionId = target.dataset.factionId;
        const userId = target.dataset.userId || 'global';
        const value = parseInt(target.value);
        if (isNaN(value)) return;

        try {
            await FactionReputationTracker.setReputation(userId, factionId, value);
            this.render();
        } catch (error) {
            console.error('FactionReputationTracker | Error setting reputation:', error);
            ui.notifications.error(game.i18n.localize("DIPLOGLASS.Notifications.ErrorSettingReputation"));
        }
    }

    async _onSetPreset(event, target) {
        if (!this._canEdit()) {
            ui.notifications.warn(game.i18n.localize("DIPLOGLASS.NoPermission"));
            return;
        }

        const factionId = target.dataset.factionId;
        const userId = target.dataset.userId || 'global';
        const value = parseInt(target.dataset.value);
        if (isNaN(value)) return;

        try {
            await FactionReputationTracker.setReputation(userId, factionId, value);
            this.render();
        } catch (error) {
            console.error('FactionReputationTracker | Error setting preset:', error);
            ui.notifications.error(game.i18n.localize("DIPLOGLASS.Notifications.ErrorSettingReputation"));
        }
    }

    async _onResetFaction(event, target) {
        if (!this._canEdit()) {
            ui.notifications.warn(game.i18n.localize("DIPLOGLASS.NoPermission"));
            return;
        }

        const factionId = target.dataset.factionId;
        const faction = FactionReputationTracker.getFactions()[factionId];
        if (!faction) return;

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("DIPLOGLASS.ResetFaction"),
            content: `<div class="fr-dialog-content"><p>${game.i18n.localize("DIPLOGLASS.ResetFactionConfirm")}</p></div>`,
            render: (html) => {
                html.closest('.dialog').addClass('fr-glass-dialog');
            }
        });

        if (confirmed) {
            try {
                if (FactionReputationTracker.usePerPlayerReputationForFaction(faction)) {
                    // In per-player mode, reset ALL player reputations for this faction
                    const playerReps = FactionReputationTracker.getPlayerReputations();
                    for (const userId of Object.keys(playerReps)) {
                        if (playerReps[userId]?.[factionId] !== undefined) {
                            await FactionReputationTracker.setReputation(userId, factionId, 0);
                        }
                    }
                } else {
                    await FactionReputationTracker.setReputation('global', factionId, 0);
                }
                this.render();
            } catch (error) {
                console.error('FactionReputationTracker | Error resetting faction:', error);
                ui.notifications.error(game.i18n.localize("DIPLOGLASS.Notifications.ErrorResettingFaction"));
            }
        }
    }

    _onOpenSettings(event, target) {
        // Open the module settings
        game.settings.sheet.render(true, { activeCategory: "diploglass" });
    }

    _onExportFactions(event, target) {
        FactionReputationTracker.downloadExport();
        ui.notifications.info(game.i18n.localize("DIPLOGLASS.Notifications.FactionsExported"));

        // Send telemetry for export action
        import('../main.js').then(mod => mod.telemetry?.send('export')).catch(() => {});
    }

    /**
     * Switch between tabs (Overview, Players, Levels)
     */
    _onSwitchTab(event, target) {
        const tabName = target.dataset.tab;
        if (!tabName) return;

        // Save active tab for persistence across renders
        this._activeTab = tabName;

        // Update tab button active state
        const tabButtons = this.element.querySelectorAll('.fr-tab');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content visibility
        const tabContents = this.element.querySelectorAll('.fr-tab-content');
        tabContents.forEach(content => {
            content.classList.toggle('active', content.dataset.tabContent === tabName);
        });
    }

    /**
     * Hook called after render to attach event listeners
     */
    _onRender(context, options) {
        super._onRender(context, options);

        // Register this instance for cross-window communication
        FactionReputationWindow._activeInstance = this;

        // Send telemetry ping (once per session)
        import('../main.js').then(mod => mod.telemetry?.send('reputation-window')).catch(() => {});

        // Attach search functionality
        const searchInput = this.element.querySelector('#fr-faction-search');
        if (searchInput) {
            searchInput.addEventListener('input', this._onSearchFactions.bind(this));
        }

        // Restore active tab after render
        if (this._activeTab && this._activeTab !== 'overview') {
            // Check if the tab exists (e.g., players tab only exists in per-player mode)
            const targetTab = this.element.querySelector(`.fr-tab[data-tab="${this._activeTab}"]`);
            if (targetTab) {
                const tabButtons = this.element.querySelectorAll('.fr-tab');
                tabButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.tab === this._activeTab);
                });

                const tabContents = this.element.querySelectorAll('.fr-tab-content');
                tabContents.forEach(content => {
                    content.classList.toggle('active', content.dataset.tabContent === this._activeTab);
                });
            } else {
                // Tab doesn't exist (e.g., switched to non-per-player faction), reset to overview
                this._activeTab = 'overview';
            }
        }
    }

    /**
     * Clean up static reference when window is closed
     */
    _onClose(options) {
        super._onClose(options);
        if (FactionReputationWindow._activeInstance === this) {
            FactionReputationWindow._activeInstance = null;
        }
    }

    /**
     * Filter faction list based on search input
     */
    _onSearchFactions(event) {
        const searchTerm = event.target.value.toLowerCase().trim();
        const factionItems = this.element.querySelectorAll('.fr-nav-item');
        const noFactionsNav = this.element.querySelector('.fr-no-factions-nav');
        let visibleCount = 0;

        factionItems.forEach(item => {
            const nameElement = item.querySelector('.fr-nav-item-name span');
            if (nameElement) {
                const factionName = nameElement.textContent.toLowerCase();
                const isMatch = searchTerm === '' || factionName.includes(searchTerm);
                item.style.display = isMatch ? '' : 'none';
                if (isMatch) visibleCount++;
            }
        });

        // Show/hide "no factions" message based on search results
        if (noFactionsNav) {
            // If searching and no matches found, show a "no matches" message
            if (searchTerm !== '' && visibleCount === 0) {
                noFactionsNav.style.display = '';
                noFactionsNav.querySelector('p').textContent = game.i18n.localize("DIPLOGLASS.NoSearchResults");
            } else if (searchTerm === '' && factionItems.length === 0) {
                // Original no factions state
                noFactionsNav.style.display = '';
                noFactionsNav.querySelector('p').textContent = game.i18n.localize("DIPLOGLASS.NoFactions");
            } else {
                noFactionsNav.style.display = visibleCount === 0 ? '' : 'none';
            }
        } else if (searchTerm !== '' && visibleCount === 0) {
            // Create a temporary "no results" message if there are factions but none match
            const navList = this.element.querySelector('.fr-nav-list');
            let tempNoResults = navList.querySelector('.fr-no-results-temp');
            if (!tempNoResults) {
                tempNoResults = document.createElement('div');
                tempNoResults.className = 'fr-no-factions-nav fr-no-results-temp';
                tempNoResults.innerHTML = `<p>${game.i18n.localize("DIPLOGLASS.NoSearchResults")}</p>`;
                navList.appendChild(tempNoResults);
            }
            tempNoResults.style.display = '';
        } else {
            // Remove temp message if it exists
            const tempNoResults = this.element.querySelector('.fr-no-results-temp');
            if (tempNoResults) {
                tempNoResults.remove();
            }
        }
    }

    /**
     * Format change log entries for display
     * @param {string} factionId - The faction ID
     * @returns {Array} Formatted change log entries
     */
    _formatChangeLogEntries(factionId) {
        const entries = FactionReputationTracker.getChangeLog(factionId);

        return entries.map(entry => {
            // Get user names
            const user = entry.userId !== 'global' ? game.users.get(entry.userId) : null;
            const changedByUser = game.users.get(entry.changedBy);
            const commentedByUser = entry.commentedBy ? game.users.get(entry.commentedBy) : null;

            // Format timestamp
            const date = new Date(entry.timestamp);
            const formattedDate = date.toLocaleDateString(game.i18n.lang, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Format comment timestamp if present
            let formattedCommentDate = null;
            if (entry.commentedAt) {
                const commentDate = new Date(entry.commentedAt);
                formattedCommentDate = commentDate.toLocaleDateString(game.i18n.lang, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            // Determine change direction
            const change = entry.newValue - entry.oldValue;
            const changeIcon = change > 0 ? 'fa-arrow-up' : (change < 0 ? 'fa-arrow-down' : 'fa-minus');
            const changeClass = change > 0 ? 'positive' : (change < 0 ? 'negative' : 'neutral');

            return {
                id: entry.id,
                date: formattedDate,
                oldValue: entry.oldValue,
                newValue: entry.newValue,
                change: change,
                changeIcon: changeIcon,
                changeClass: changeClass,
                userName: user?.name || game.i18n.localize("DIPLOGLASS.GroupReputation"),
                changedByName: changedByUser?.name || game.i18n.localize("DIPLOGLASS.Settings.GMOnly"),
                comment: entry.comment || null,
                commentedByName: commentedByUser?.name || null,
                commentDate: formattedCommentDate
            };
        });
    }

    /**
     * Handle adding a comment to a change log entry
     */
    async _onAddComment(event, target) {
        if (!game.user.isGM) {
            ui.notifications.warn(game.i18n.localize("DIPLOGLASS.Notifications.OnlyGMCanChange"));
            return;
        }

        const factionId = target.dataset.factionId;
        const entryId = target.dataset.entryId;

        // Get current comment if exists
        const entries = FactionReputationTracker.getChangeLog(factionId);
        const entry = entries.find(e => e.id === entryId);
        const currentComment = entry?.comment || '';

        // Build dialog content from extracted template
        const content = createAddCommentDialogContent({
            currentComment: currentComment,
            i18n: game.i18n.localize.bind(game.i18n)
        });

        new Dialog({
            title: game.i18n.localize("DIPLOGLASS.ChangeLog.AddComment"),
            content: content,
            buttons: {
                save: {
                    icon: '<i class="fas fa-check"></i>',
                    label: game.i18n.localize("DIPLOGLASS.Save"),
                    callback: async (html) => {
                        const comment = html.find('[name="comment"]').val().trim();
                        if (comment !== null && comment !== undefined) {
                            await FactionReputationTracker.addCommentToLogEntry(factionId, entryId, comment || '');
                            this.render(true);
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("DIPLOGLASS.Cancel")
                }
            },
            default: "save",
            render: (html) => {
                html.closest('.dialog').addClass('fr-glass-dialog');
            }
        }).render(true);
    }
}

