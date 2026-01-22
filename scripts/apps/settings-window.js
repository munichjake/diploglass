const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Module ID constant - duplicated to avoid circular dependency with config.js
const MODULE_ID = 'diploglass';

/**
 * Settings window for the Diplomatic Ties module.
 * Accessible from Module Settings menu entry.
 */
export class SettingsWindow extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: "diploglass-settings",
        tag: "form",
        window: {
            title: "DIPLOGLASS.Settings.AdvancedSettings",
            icon: "fas fa-cog",
            resizable: true
        },
        position: {
            width: 500,
            height: 520
        },
        classes: ["fr-window", "fr-settings-window"],
        form: {
            handler: SettingsWindow.prototype._onSubmit,
            closeOnSubmit: true
        }
    };

    static PARTS = {
        form: {
            template: "modules/diploglass/templates/module-settings.html"
        }
    };

    async _prepareContext(options) {
        const usePerPlayerReputation = game.settings.get(MODULE_ID, 'usePerPlayerReputation');
        const postChatMessages = game.settings.get(MODULE_ID, 'postChatMessages');
        const chatMessageVisibility = game.settings.get(MODULE_ID, 'chatMessageVisibility');
        const startAtNeutral = game.settings.get(MODULE_ID, 'startAtNeutral');

        // Get reputation levels from the tracker (avoids circular dependency)
        const levels = window.FactionReputationTracker?.getReputationLevels() || [];

        return {
            usePerPlayerReputation,
            postChatMessages,
            chatMessageVisibility,
            startAtNeutral,
            visibilityOptions: [
                { value: 'gm', label: 'DIPLOGLASS.Settings.GMOnly', selected: chatMessageVisibility === 'gm' },
                { value: 'all', label: 'DIPLOGLASS.Settings.AllPlayers', selected: chatMessageVisibility === 'all' },
                { value: 'players', label: 'DIPLOGLASS.Settings.PlayersOnly', selected: chatMessageVisibility === 'players' }
            ],
            levels: levels
        };
    }

    async _onSubmit(event, form, formData) {
        const data = formData.object;

        await game.settings.set(MODULE_ID, 'usePerPlayerReputation', data.usePerPlayerReputation ?? false);
        await game.settings.set(MODULE_ID, 'postChatMessages', data.postChatMessages ?? false);
        await game.settings.set(MODULE_ID, 'chatMessageVisibility', data.chatMessageVisibility);
        await game.settings.set(MODULE_ID, 'startAtNeutral', data.startAtNeutral ?? false);

        ui.notifications.info(game.i18n.localize("DIPLOGLASS.Settings.SettingsSaved"));
    }
}
