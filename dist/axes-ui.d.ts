/**
 * Showing and recording axis sources, for the settings panel.
 */
export type InputUI = import('./core.js').InputUI;
/**
 * Format an axis binding into display parts (e.g. "-mouse:y" -> ["Mouse ↕", "Inverted"])
 * @param {string} binding
 * @returns {string[]}
 */
export declare function formatAxisParts(binding: string): string[];
/**
 * Axes, shown and recorded as well as read
 * @returns {InputUI}
 */
export declare function axesUI(): InputUI;
