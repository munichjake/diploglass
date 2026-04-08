/**
 * Pure utility functions for reputation bar rendering and value formatting.
 * These functions have no dependency on any UI class and can be used
 * anywhere reputation data needs to be visualised or displayed.
 *
 * @module reputation-helpers
 */

/**
 * Generate bar segments for a reputation bar.
 * Each segment represents one discrete reputation value between min and max,
 * with a colour that smoothly transitions from red (negative) through grey
 * (neutral) to green (positive).
 *
 * @param {number} steps   - Total number of steps on the scale (unused in
 *                           calculation but kept for API consistency)
 * @param {number} min     - Minimum reputation value (negative)
 * @param {number} max     - Maximum reputation value (positive)
 * @param {number} current - The faction's current reputation value
 * @returns {Array<{value: number, color: string, isCurrent: boolean, isFilled: boolean}>}
 */
export function generateBarSegments(steps, min, max, current) {
    const segments = [];

    for (let value = min; value <= max; value++) {
        let color;
        if (value < 0) {
            const intensity = Math.abs(value) / Math.abs(min);
            const r = Math.round(139 + (116 * intensity));
            const g = Math.round(69 - (69 * intensity));
            const b = Math.round(69 - (69 * intensity));
            color = `rgb(${r}, ${g}, ${b})`;
        } else if (value === 0) {
            color = '#6c757d';
        } else {
            const intensity = value / max;
            const r = Math.round(40 - (40 * intensity));
            const g = Math.round(167 + (88 * intensity));
            const b = Math.round(69 - (69 * intensity));
            color = `rgb(${r}, ${g}, ${b})`;
        }

        segments.push({
            value: value,
            color: color,
            isCurrent: value === current,
            isFilled: value <= current
        });
    }

    return segments;
}

/**
 * Determine the CSS pill class based on a reputation value's position
 * within the min/max range.
 *
 * @param {number} value    - The current reputation value
 * @param {number} minValue - Minimum reputation value on the scale
 * @param {number} maxValue - Maximum reputation value on the scale
 * @returns {'bad'|'warn'|'neutral'|'good'|'ally'} CSS class name for the pill
 */
export function getPillClass(value, minValue, maxValue) {
    if (value <= minValue) return 'bad';
    if (value < -1) return 'warn';
    if (value === 0 || value === -1 || value === 1) return 'neutral';
    if (value >= maxValue) return 'ally';
    if (value > 1) return 'good';
    return 'neutral';
}

/**
 * Format a numeric reputation value for display, prefixing positive
 * values with a "+" sign.
 *
 * @param {number} value - The reputation value to format
 * @returns {string} Formatted string, e.g. "+3" or "-2" or "0"
 */
export function formatDisplayValue(value) {
    return value > 0 ? `+${value}` : `${value}`;
}
