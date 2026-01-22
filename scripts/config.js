import { SettingsWindow } from "./apps/settings-window.js";

export const MODULE_ID = 'diploglass';

/**
 * Get reputation levels with localized labels.
 * Must be called after game.i18n is ready.
 * @returns {Array<{value: number, key: string, label: string, color: string}>}
 */
export function getReputationLevels() {
    return [
        { value: -3, key: 'hostile', label: game.i18n.localize("DIPLOGLASS.RankLabels.Hostile"), color: '#8B0000' },
        { value: -2, key: 'unfriendly', label: game.i18n.localize("DIPLOGLASS.RankLabels.Unfriendly"), color: '#FF4500' },
        { value: -1, key: 'neutral_neg', label: game.i18n.localize("DIPLOGLASS.RankLabels.NeutralMinus"), color: '#FFA500' },
        { value: 0, key: 'neutral', label: game.i18n.localize("DIPLOGLASS.RankLabels.Neutral"), color: '#808080' },
        { value: 1, key: 'neutral_pos', label: game.i18n.localize("DIPLOGLASS.RankLabels.NeutralPlus"), color: '#9ACD32' },
        { value: 2, key: 'friendly', label: game.i18n.localize("DIPLOGLASS.RankLabels.Friendly"), color: '#32CD32' },
        { value: 3, key: 'allied', label: game.i18n.localize("DIPLOGLASS.RankLabels.Allied"), color: '#228B22' }
    ];
}

// Legacy export for backwards compatibility - returns empty array, use getReputationLevels() instead
export const REPUTATION_LEVELS = [];

export function registerSettings() {
    game.settings.register(MODULE_ID, 'factions', {
        name: 'Fraktionen',
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'playerReputations', {
        name: 'Spieler Reputationen',
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'globalReputations', {
        name: 'Globale Reputationen',
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'usePerPlayerReputation', {
        name: 'DIPLOGLASS.Settings.UsePerPlayerReputation',
        hint: 'DIPLOGLASS.Settings.UsePerPlayerReputationHint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, 'postChatMessages', {
        name: 'DIPLOGLASS.Settings.PostChatMessages',
        hint: 'DIPLOGLASS.Settings.PostChatMessagesHint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, 'chatMessageVisibility', {
        name: 'DIPLOGLASS.Settings.ChatMessageVisibility',
        hint: 'DIPLOGLASS.Settings.ChatMessageVisibilityHint',
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'gm': 'DIPLOGLASS.Settings.GMOnly',
            'all': 'DIPLOGLASS.Settings.AllPlayers',
            'players': 'DIPLOGLASS.Settings.PlayersOnly'
        },
        default: 'gm'
    });

    game.settings.register(MODULE_ID, 'startAtNeutral', {
        name: 'DIPLOGLASS.Settings.StartAtNeutral',
        hint: 'DIPLOGLASS.Settings.StartAtNeutralHint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, 'playerAccess', {
        name: 'DIPLOGLASS.Settings.PlayerAccess',
        hint: 'DIPLOGLASS.Settings.PlayerAccessHint',
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'none': 'DIPLOGLASS.Settings.PlayerAccessNone',
            'view': 'DIPLOGLASS.Settings.PlayerAccessView',
            'edit': 'DIPLOGLASS.Settings.PlayerAccessEdit'
        },
        default: 'none'
    });

    // Register module settings menu entry
    game.settings.registerMenu(MODULE_ID, 'settingsMenu', {
        name: 'DIPLOGLASS.Settings.AdvancedSettings',
        label: 'DIPLOGLASS.Settings.Configure',
        hint: 'DIPLOGLASS.Settings.AdvancedSettingsHint',
        icon: 'fas fa-cog',
        type: SettingsWindow,
        restricted: true
    });
}
