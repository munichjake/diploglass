import { MODULE_ID, getReputationLevels } from "../config.js";

export class FactionReputationTracker {

    // Default step count for backwards compatibility
    static DEFAULT_STEPS = 7;

    // Config Helpers
    static getReputationLevels() {
        return getReputationLevels();
    }

    /**
     * Calculate the minimum reputation value for a given step count.
     * Steps are centered around 0, so for 7 steps: -3 to +3
     * @param {number} steps - Number of reputation steps (must be odd)
     * @returns {number} Minimum value (negative)
     */
    static getMinValueForSteps(steps) {
        return -Math.floor(steps / 2);
    }

    /**
     * Calculate the maximum reputation value for a given step count.
     * Steps are centered around 0, so for 7 steps: -3 to +3
     * @param {number} steps - Number of reputation steps (must be odd)
     * @returns {number} Maximum value (positive)
     */
    static getMaxValueForSteps(steps) {
        return Math.floor(steps / 2);
    }

    /**
     * Get the steps value for a faction, defaulting to 7 for backwards compatibility
     * @param {object} faction - The faction object
     * @returns {number} Number of reputation steps
     */
    static getFactionSteps(faction) {
        return faction?.steps ?? this.DEFAULT_STEPS;
    }

    /**
     * Get the min/max values for a faction
     * @param {object} faction - The faction object
     * @returns {{minValue: number, maxValue: number, steps: number}}
     */
    static getFactionBounds(faction) {
        const steps = this.getFactionSteps(faction);
        return {
            steps: steps,
            minValue: this.getMinValueForSteps(steps),
            maxValue: this.getMaxValueForSteps(steps)
        };
    }

    static usePerPlayerReputation() {
        return game.settings.get(MODULE_ID, 'usePerPlayerReputation');
    }

    static postChatMessages() {
        return game.settings.get(MODULE_ID, 'postChatMessages');
    }

    static getChatMessageVisibility() {
        return game.settings.get(MODULE_ID, 'chatMessageVisibility');
    }

    // Data Accessors
    /**
     * Get raw faction data from settings
     * @returns {Object} Raw faction data object
     */
    static getFactions() {
        return game.settings.get(MODULE_ID, 'factions') || {};
    }

    /**
     * Get factions with computed step bounds (minValue, maxValue)
     * Ensures backwards compatibility for factions without steps property
     * @returns {Object} Faction data enriched with steps, minValue, maxValue
     */
    static getFactionsWithBounds() {
        const factions = this.getFactions();
        const enriched = {};

        for (const [id, faction] of Object.entries(factions)) {
            const bounds = this.getFactionBounds(faction);
            enriched[id] = {
                ...faction,
                steps: bounds.steps,
                minValue: bounds.minValue,
                maxValue: bounds.maxValue
            };
        }

        return enriched;
    }

    static async setFactions(factions) {
        await game.settings.set(MODULE_ID, 'factions', factions);
    }

    static getPlayerReputations() {
        return game.settings.get(MODULE_ID, 'playerReputations') || {};
    }

    static async setPlayerReputations(reputations) {
        await game.settings.set(MODULE_ID, 'playerReputations', reputations);
    }

    static getGlobalReputations() {
        return game.settings.get(MODULE_ID, 'globalReputations') || {};
    }

    static async setGlobalReputations(reputations) {
        await game.settings.set(MODULE_ID, 'globalReputations', reputations);
    }

    /**
     * Check if per-player reputation should be used for a specific faction
     * Falls back to global setting if faction doesn't have a specific setting
     * @param {object|string} faction - The faction object or faction ID
     * @returns {boolean} Whether to use per-player reputation
     */
    static usePerPlayerReputationForFaction(faction) {
        // If passed a faction ID, look it up
        if (typeof faction === 'string') {
            faction = this.getFactions()[faction];
        }

        // If faction has a specific setting, use it; otherwise fall back to global
        if (faction && typeof faction.usePerPlayerReputation === 'boolean') {
            return faction.usePerPlayerReputation;
        }

        return this.usePerPlayerReputation();
    }

    // Operations
    static async createFaction(name, journalId = null, startAtNeutral = true, steps = null, rollTableId = null, icon = null, usePerPlayerReputation = null) {
        const factions = this.getFactions();
        const factionId = foundry.utils.randomID();

        // Use provided steps or default
        const factionSteps = steps ?? this.DEFAULT_STEPS;

        // Use provided per-player setting or inherit from global setting
        const perPlayerMode = usePerPlayerReputation ?? this.usePerPlayerReputation();

        factions[factionId] = {
            id: factionId,
            name: name,
            journalId: journalId,
            startAtNeutral: startAtNeutral,
            steps: factionSteps,
            rollTableId: rollTableId,
            icon: icon,
            usePerPlayerReputation: perPlayerMode,
            created: Date.now()
        };

        await this.setFactions(factions);

        // Initialize Reputation - use faction-specific min value if not starting at neutral
        const minValue = this.getMinValueForSteps(factionSteps);
        const startLevel = startAtNeutral ? 0 : minValue;

        // Use the faction-specific per-player mode for initialization
        if (perPlayerMode) {
            const reputations = this.getPlayerReputations();
            for (const user of game.users) {
                if (!user.isGM) {
                    if (!reputations[user.id]) reputations[user.id] = {};
                    reputations[user.id][factionId] = startLevel;
                }
            }
            await this.setPlayerReputations(reputations);
        } else {
            const reputations = this.getGlobalReputations();
            reputations[factionId] = startLevel;
            await this.setGlobalReputations(reputations);
        }

        return factionId;
    }

    static async deleteFaction(factionId) {
        const factions = this.getFactions();
        delete factions[factionId];
        await this.setFactions(factions);

        // Always clean both data sources to prevent orphaned data
        // (a faction may have switched modes during its lifetime)
        const playerReputations = this.getPlayerReputations();
        for (const userId in playerReputations) {
            if (playerReputations[userId]) {
                delete playerReputations[userId][factionId];
            }
        }
        await this.setPlayerReputations(playerReputations);

        const globalReputations = this.getGlobalReputations();
        delete globalReputations[factionId];
        await this.setGlobalReputations(globalReputations);
    }

    static async changeReputation(userId, factionId, change) {
        if (typeof change !== 'number' || isNaN(change)) return null;

        // Get faction-specific min/max values
        const faction = this.getFactions()[factionId];
        if (!faction) {
            console.warn(`DiploGlass | Faction ${factionId} not found`);
            return null;
        }
        const { minValue, maxValue } = this.getFactionBounds(faction);
        const usePerPlayer = this.usePerPlayerReputationForFaction(faction);

        let currentLevel, newLevel;

        if (usePerPlayer) {
            const reputations = this.getPlayerReputations();
            if (!reputations[userId]) reputations[userId] = {};

            currentLevel = reputations[userId][factionId] || 0;
            newLevel = Math.max(minValue, Math.min(maxValue, currentLevel + change));

            reputations[userId][factionId] = newLevel;
            await this.setPlayerReputations(reputations);
        } else {
            const reputations = this.getGlobalReputations();
            currentLevel = reputations[factionId] || 0;
            newLevel = Math.max(minValue, Math.min(maxValue, currentLevel + change));

            reputations[factionId] = newLevel;
            await this.setGlobalReputations(reputations);
        }

        // Record change in log
        await this._addChangeLogEntry(factionId, {
            timestamp: Date.now(),
            oldValue: currentLevel,
            newValue: newLevel,
            userId: userId,
            changedBy: game.user.id
        });

        if (this.postChatMessages()) {
            await this._sendReputationChangeMessage(userId, factionId, newLevel);
        }

        return newLevel;
    }

    /**
     * Set reputation to a specific value
     * @param {string} userId - User ID or 'global'
     * @param {string} factionId - Faction ID
     * @param {number} value - New reputation value
     * @returns {Promise<number>} The new reputation level
     */
    static async setReputation(userId, factionId, value) {
        if (typeof value !== 'number' || isNaN(value)) return null;

        // Get faction-specific min/max values
        const faction = this.getFactions()[factionId];
        if (!faction) {
            console.warn(`DiploGlass | Faction ${factionId} not found`);
            return null;
        }
        const { minValue, maxValue } = this.getFactionBounds(faction);
        const usePerPlayer = this.usePerPlayerReputationForFaction(faction);

        // Clamp value to valid range
        const newLevel = Math.max(minValue, Math.min(maxValue, value));

        let currentLevel;
        if (usePerPlayer && userId !== 'global') {
            const reputations = this.getPlayerReputations();
            if (!reputations[userId]) reputations[userId] = {};
            currentLevel = reputations[userId][factionId] || 0;
            reputations[userId][factionId] = newLevel;
            await this.setPlayerReputations(reputations);
        } else {
            const reputations = this.getGlobalReputations();
            currentLevel = reputations[factionId] || 0;
            reputations[factionId] = newLevel;
            await this.setGlobalReputations(reputations);
        }

        // Record change in log (only if value actually changed)
        if (currentLevel !== newLevel) {
            await this._addChangeLogEntry(factionId, {
                timestamp: Date.now(),
                oldValue: currentLevel,
                newValue: newLevel,
                userId: userId,
                changedBy: game.user.id
            });
        }

        if (this.postChatMessages()) {
            await this._sendReputationChangeMessage(userId, factionId, newLevel);
        }

        return newLevel;
    }

    /**
     * Parse RollTable result text to extract label and optional color.
     * Supports format: "Label\n#color" or just "Label"
     * Strips HTML tags (Foundry often wraps text in <p> tags)
     * @param {string} rawText - Raw text from RollTable result
     * @returns {{text: string, color: string|null}} Parsed text and optional color
     */
    static _parseRollTableText(rawText) {
        if (!rawText) return { text: null, color: null };

        // Strip HTML tags
        const div = document.createElement('div');
        div.innerHTML = rawText;
        const cleanText = (div.textContent || div.innerText || rawText).trim();

        // Check if there's a second line with a color
        const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l);

        if (lines.length >= 2) {
            const possibleColor = lines[lines.length - 1];
            // Check if it's a valid color (hex, rgb, or named color)
            if (/^#[0-9A-Fa-f]{3,8}$/.test(possibleColor) ||
                /^rgb\s*\(/i.test(possibleColor) ||
                /^(red|green|blue|yellow|orange|purple|pink|brown|gray|grey|black|white|cyan|magenta)$/i.test(possibleColor)) {
                return {
                    text: lines.slice(0, -1).join(' '),
                    color: possibleColor
                };
            }
        }

        return { text: cleanText, color: null };
    }

    /**
     * Get the status text for a reputation value from a linked RollTable
     * @param {string|null} rollTableId - The RollTable ID, or null/undefined
     * @param {number} reputationValue - The current reputation value
     * @returns {string|null} The status text from the RollTable, or null if not found
     */
    static getStatusFromRollTable(rollTableId, reputationValue) {
        const detailed = this.getDetailedStatusFromRollTable(rollTableId, reputationValue);
        return detailed?.text || null;
    }

    /**
     * Get detailed status info (text and color) for a reputation value from a linked RollTable
     * @param {string|null} rollTableId - The RollTable ID, or null/undefined
     * @param {number} reputationValue - The current reputation value
     * @returns {{text: string, color: string|null}|null} The status info from the RollTable, or null if not found
     */
    static getDetailedStatusFromRollTable(rollTableId, reputationValue) {
        if (!rollTableId) return null;

        const table = game.tables.get(rollTableId);
        if (!table) return null;

        // Find the result that matches the reputation value
        // RollTable results have range [low, high] - we look for one that contains our value
        const result = table.results.find(r => {
            const low = r.range[0];
            const high = r.range[1];
            return reputationValue >= low && reputationValue <= high;
        });

        if (!result) return null;

        return this._parseRollTableText(result.name);
    }

    /**
     * Get all levels for a faction with labels and colors.
     * Uses RollTable data if available, otherwise generates labels/colors.
     * @param {object} faction - The faction object
     * @returns {Array<{value: number, label: string, color: string}>} Array of level info
     */
    static getLevelsForFaction(faction) {
        const steps = this.getFactionSteps(faction);
        const minValue = this.getMinValueForSteps(steps);
        const maxValue = this.getMaxValueForSteps(steps);
        const levels = [];

        for (let value = minValue; value <= maxValue; value++) {
            const detailed = this.getDetailedStatusFromRollTable(faction?.rollTableId, value);

            // Get label: RollTable text > default levels > generated
            let label;
            if (detailed?.text) {
                label = detailed.text;
            } else if (steps === this.DEFAULT_STEPS) {
                const levelInfo = getReputationLevels().find(l => l.value === value);
                label = levelInfo?.label || this._generateRankLabel(value, steps);
            } else {
                label = this._generateRankLabel(value, steps);
            }

            // Get color: RollTable color > auto-generated
            const color = detailed?.color || this.getRankColor(value, minValue, maxValue);

            levels.push({ value, label, color });
        }

        return levels;
    }

    /**
     * Get label and color for a reputation value, using the full fallback chain:
     * 1. RollTable (if configured) — uses text and optional color from the table
     * 2. Standard levels (only for 7-step factions) — uses default label and color
     * 3. Generated label + computed color — uses _generateRankLabel and getRankColor
     * @param {object} faction - The faction object
     * @param {number} reputationValue - The reputation value
     * @returns {{label: string, color: string}}
     */
    static _getLabelAndColor(faction, reputationValue) {
        const steps = this.getFactionSteps(faction);
        const { minValue, maxValue } = this.getFactionBounds(faction);

        // First priority: RollTable-based label/color
        const detailed = this.getDetailedStatusFromRollTable(faction?.rollTableId, reputationValue);
        if (detailed?.text) {
            return {
                label: detailed.text,
                color: detailed.color || this.getRankColor(reputationValue, minValue, maxValue)
            };
        }

        // Second priority: Standard reputation levels (for default 7-step factions)
        if (steps === this.DEFAULT_STEPS) {
            const levelInfo = getReputationLevels().find(l => l.value === reputationValue);
            if (levelInfo) {
                return {
                    label: levelInfo.label,
                    color: levelInfo.color || this.getRankColor(reputationValue, minValue, maxValue)
                };
            }
        }

        // Third priority: Generated label + computed color
        return {
            label: this._generateRankLabel(reputationValue, steps),
            color: this.getRankColor(reputationValue, minValue, maxValue)
        };
    }

    /**
     * Get the rank label for a reputation value.
     * Priority: RollTable text > default reputation levels > generated label
     * @param {object} faction - The faction object with rollTableId, steps, etc.
     * @param {number} reputationValue - The current reputation value
     * @returns {string} The rank label
     */
    static getRankLabel(faction, reputationValue) {
        return this._getLabelAndColor(faction, reputationValue).label;
    }

    /**
     * Generate a rank label for non-standard step counts
     * @param {number} value - The reputation value
     * @param {number} steps - Number of steps
     * @returns {string} Generated label
     */
    static _generateRankLabel(value, steps) {
        const minValue = this.getMinValueForSteps(steps);
        const maxValue = this.getMaxValueForSteps(steps);

        // Normalize value to 0-1 range
        const range = maxValue - minValue;
        const normalized = (value - minValue) / range;

        // Map to descriptive labels
        if (normalized <= 0.1) return game.i18n.localize("DIPLOGLASS.RankLabels.Hostile");
        if (normalized <= 0.25) return game.i18n.localize("DIPLOGLASS.RankLabels.Unfriendly");
        if (normalized <= 0.4) return game.i18n.localize("DIPLOGLASS.RankLabels.Wary");
        if (normalized <= 0.6) return game.i18n.localize("DIPLOGLASS.RankLabels.Neutral");
        if (normalized <= 0.75) return game.i18n.localize("DIPLOGLASS.RankLabels.Cordial");
        if (normalized <= 0.9) return game.i18n.localize("DIPLOGLASS.RankLabels.Friendly");
        return game.i18n.localize("DIPLOGLASS.RankLabels.Allied");
    }

    /**
     * Generate an array of RollTable result objects for a given step count.
     * Centralizes the RollTable creation logic used by config-window and reputation-window.
     * @param {number} steps - Number of reputation steps (must be odd)
     * @returns {Array<{text: string, range: number[], weight: number}>} Array of RollTable result objects
     */
    static generateRollTableResults(steps) {
        const minValue = this.getMinValueForSteps(steps);
        const maxValue = this.getMaxValueForSteps(steps);
        const results = [];
        for (let value = minValue; value <= maxValue; value++) {
            const label = this._generateRankLabel(value, steps);
            const color = this.getRankColor(value, minValue, maxValue);
            results.push({
                text: `${label}\n${color}`,
                range: [value, value],
                weight: 1
            });
        }
        return results;
    }

    /**
     * Calculate a pastel color for a reputation value based on its position
     * 0 = white, negative = pastel red gradient, positive = pastel green gradient
     * @param {number} value - The reputation value
     * @param {number} minValue - Minimum value (most negative)
     * @param {number} maxValue - Maximum value (most positive)
     * @returns {string} RGB color string
     */
    static getRankColor(value, minValue, maxValue) {
        if (value === 0) {
            // White for neutral
            return '#ffffff';
        } else if (value < 0) {
            // Pastel red gradient for negative values (white -> soft red -> deeper red)
            const intensity = Math.abs(value) / Math.abs(minValue);
            const r = 255;
            const g = Math.round(255 - (175 * intensity));  // 255 -> 80
            const b = Math.round(255 - (155 * intensity));  // 255 -> 100
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // Pastel green gradient for positive values (white -> soft green -> deeper green)
            const intensity = value / maxValue;
            const r = Math.round(255 - (175 * intensity));  // 255 -> 80
            const g = Math.round(255 - (55 * intensity));   // 255 -> 200
            const b = Math.round(255 - (175 * intensity));  // 255 -> 80
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    static async _sendReputationChangeMessage(userId, factionId, newLevel) {
        const faction = this.getFactions()[factionId];
        const user = game.users.get(userId);

        if (!faction) return;

        // Resolve label and color via the central fallback chain
        const { label: levelLabel, color: levelColor } = this._getLabelAndColor(faction, newLevel);

        const visibility = this.getChatMessageVisibility();
        let whisperTargets = [];

        switch (visibility) {
            case 'gm':
                whisperTargets = game.users.filter(u => u.isGM).map(u => u.id);
                break;
            case 'all':
                whisperTargets = [];
                break;
            case 'players':
                whisperTargets = game.users.filter(u => !u.isGM).map(u => u.id);
                break;
        }

        const reputationChanged = game.i18n.localize("DIPLOGLASS.Chat.ReputationChanged");
        const unknown = game.i18n.localize("DIPLOGLASS.Chat.Unknown");

        let messageText;
        if (this.usePerPlayerReputationForFaction(faction)) {
            messageText = game.i18n.format("DIPLOGLASS.Chat.PlayerWithFaction", {
                player: user?.name || unknown,
                faction: faction.name
            });
        } else {
            messageText = game.i18n.format("DIPLOGLASS.Chat.GroupWithFaction", {
                faction: faction.name
            });
        }

        const content = `<p><strong>${reputationChanged}</strong> ${messageText} <span style="color: ${levelColor}">${levelLabel}</span> (${newLevel})</p>`;

        await ChatMessage.create({
            content: content,
            whisper: whisperTargets.length > 0 ? whisperTargets : undefined
        });
    }

    // Export Methods

    /**
     * Export faction structures without reputation progress data.
     * Useful for West Marches campaigns where GMs share faction setups.
     * @param {string[]} [factionIds] - Optional list of faction IDs to export. Exports all if omitted.
     * @returns {object} Export data with metadata and faction structures
     */
    static exportFactions(factionIds = null) {
        const factions = this.getFactions();
        const exportFactions = {};

        const idsToExport = factionIds || Object.keys(factions);

        for (const id of idsToExport) {
            const faction = factions[id];
            if (!faction) continue;

            // Export structure only — no reputation values, no changeLog
            exportFactions[id] = {
                name: faction.name,
                steps: faction.steps ?? this.DEFAULT_STEPS,
                startAtNeutral: faction.startAtNeutral ?? true,
                usePerPlayerReputation: faction.usePerPlayerReputation ?? false,
                icon: faction.icon || null,
                // Note: journalId and rollTableId are world-specific and won't transfer
            };
        }

        return {
            format: 'diploglass-factions',
            version: 1,
            exportedAt: new Date().toISOString(),
            factionCount: Object.keys(exportFactions).length,
            factions: exportFactions
        };
    }

    /**
     * Trigger a browser download of faction export data as JSON
     * @param {string[]} [factionIds] - Optional list of faction IDs to export
     */
    static downloadExport(factionIds = null) {
        const data = this.exportFactions(factionIds);
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `diploglass-factions-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Change Log Methods

    /**
     * Add an entry to a faction's change log
     * @param {string} factionId - The faction ID
     * @param {object} entry - The log entry containing timestamp, oldValue, newValue, userId, changedBy
     */
    static async _addChangeLogEntry(factionId, entry) {
        const factions = this.getFactions();
        const faction = factions[factionId];
        if (!faction) return;

        // Initialize changeLog array if it doesn't exist
        if (!faction.changeLog) {
            faction.changeLog = [];
        }

        // Add unique ID to entry
        entry.id = foundry.utils.randomID();

        // Add entry to the beginning of the log (newest first)
        faction.changeLog.unshift(entry);

        // Prevent unbounded growth of the change log
        const MAX_CHANGELOG_ENTRIES = 100;
        if (faction.changeLog.length > MAX_CHANGELOG_ENTRIES) {
            faction.changeLog.length = MAX_CHANGELOG_ENTRIES;
        }

        // Save updated factions
        await this.setFactions(factions);
    }

    /**
     * Get the change log for a faction
     * @param {string} factionId - The faction ID
     * @returns {Array} Array of change log entries (newest first)
     */
    static getChangeLog(factionId) {
        const faction = this.getFactions()[factionId];
        return faction?.changeLog || [];
    }

    /**
     * Add a comment to an existing change log entry
     * @param {string} factionId - The faction ID
     * @param {string} entryId - The log entry ID
     * @param {string} comment - The comment text
     * @returns {Promise<boolean>} Whether the comment was added successfully
     */
    static async addCommentToLogEntry(factionId, entryId, comment) {
        const factions = this.getFactions();
        const faction = factions[factionId];
        if (!faction || !faction.changeLog) return false;

        const entry = faction.changeLog.find(e => e.id === entryId);
        if (!entry) return false;

        entry.comment = comment;
        entry.commentedBy = game.user.id;
        entry.commentedAt = Date.now();

        await this.setFactions(factions);
        return true;
    }
}
