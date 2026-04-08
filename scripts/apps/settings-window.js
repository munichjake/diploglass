import { MODULE_ID, getReputationLevels } from "../config.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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

        const levels = getReputationLevels();

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

        try {
            await game.settings.set(MODULE_ID, 'usePerPlayerReputation', data.usePerPlayerReputation ?? false);
            await game.settings.set(MODULE_ID, 'postChatMessages', data.postChatMessages ?? false);
            await game.settings.set(MODULE_ID, 'chatMessageVisibility', data.chatMessageVisibility);
            await game.settings.set(MODULE_ID, 'startAtNeutral', data.startAtNeutral ?? false);

            ui.notifications.info(game.i18n.localize("DIPLOGLASS.Settings.SettingsSaved"));
        } catch (error) {
            console.error('DiploGlass | Failed to save settings:', error);
            ui.notifications.error(game.i18n.localize("DIPLOGLASS.ErrorSavingSettings") || "Failed to save settings");
        }
    }
}
