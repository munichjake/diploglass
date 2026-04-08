/**
 * HTML utility functions for safe string handling.
 * Prevents XSS when interpolating user-controlled values into HTML.
 *
 * @module html-helpers
 */

/**
 * Escape a string for safe insertion into HTML.
 * Uses the browser's built-in text encoding via a temporary DOM element
 * to ensure all special characters (&, <, >, ", ') are properly escaped.
 *
 * @param {string} str - The raw string to escape
 * @returns {string} The HTML-safe escaped string
 */
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
