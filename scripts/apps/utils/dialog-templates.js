/**
 * HTML template generators for FoundryVTT Dialog instances.
 * Each function returns a complete HTML string ready to be passed
 * as the `content` option to a Foundry Dialog.
 *
 * @module dialog-templates
 */

import { escapeHtml } from './html-helpers.js';

/**
 * Build the HTML content for the "Add Faction" dialog.
 *
 * @param {Object}   options
 * @param {Array}    options.journals   - Array of journal entry documents
 *                                        (each must have `.id` and `.name`)
 * @param {Array}    options.rollTables - Array of roll table documents
 *                                        (each must have `.id` and `.name`)
 * @param {number}   options.defaultSteps - Default value for the steps input
 * @param {Function} options.i18n       - Localization function (game.i18n.localize)
 * @returns {string} HTML string for the dialog content
 */
export function createAddFactionDialogContent({ journals, rollTables, defaultSteps, i18n }) {
    // Build journal options HTML
    const journalOptions = [...journals]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(j => `<option value="${j.id}">${escapeHtml(j.name)}</option>`)
        .join('');

    // Build RollTable options HTML
    const rollTableOptions = [...rollTables]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
        .join('');

    return `
        <div class="fr-dialog-content">
            <div class="fr-dialog-form">
                <div class="fr-form-group">
                    <label>${i18n("DIPLOGLASS.Dialogs.AddFactionName")}</label>
                    <input type="text" name="name" placeholder="${i18n("DIPLOGLASS.Dialogs.AddFactionNamePlaceholder")}" required>
                </div>
                <div class="fr-form-group">
                    <label>${i18n("DIPLOGLASS.Dialogs.AddFactionJournal")}</label>
                    <div class="fr-input-row">
                        <select name="journalId">
                            <option value="">${i18n("DIPLOGLASS.NoJournal")}</option>
                            ${journalOptions}
                        </select>
                        <button type="button" class="fr-create-btn" data-create="journal" title="${i18n("DIPLOGLASS.Dialogs.CreateJournal")}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="fr-form-group">
                    <label>${i18n("DIPLOGLASS.Dialogs.AddFactionRollTable")}</label>
                    <div class="fr-input-row">
                        <select name="rollTableId">
                            <option value="">${i18n("DIPLOGLASS.NoRollTable")}</option>
                            ${rollTableOptions}
                        </select>
                        <button type="button" class="fr-create-btn" data-create="rolltable" title="${i18n("DIPLOGLASS.Dialogs.CreateRollTable")}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="fr-form-group">
                    <label>${i18n("DIPLOGLASS.Steps")}</label>
                    <input type="number" name="steps" value="${defaultSteps}" min="3" max="21" step="2">
                    <p class="fr-notes">${i18n("DIPLOGLASS.StepsHint")}</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Build the HTML content for the "Add / Edit Comment" dialog.
 *
 * @param {Object}   options
 * @param {string}   options.currentComment - Existing comment text (empty string if none)
 * @param {Function} options.i18n           - Localization function (game.i18n.localize)
 * @returns {string} HTML string for the dialog content
 */
export function createAddCommentDialogContent({ currentComment, i18n }) {
    return `
        <div class="fr-dialog-content">
            <div class="form-group">
                <label>${i18n("DIPLOGLASS.ChangeLog.AddComment")}</label>
                <textarea name="comment" rows="3" style="width:100%">${escapeHtml(currentComment)}</textarea>
            </div>
        </div>
    `;
}
