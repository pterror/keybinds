/**
 * Showing and recording gamepad bindings, for the settings panel, cheatsheet, palette and menus.
 */
export type InputUI = import('./core.js').InputUI;
/**
 * Format a gamepad binding into display parts (e.g. "rt:up" -> ["RT", "Release"])
 * @param {string} binding
 * @returns {string[]}
 */
export declare function formatGamepadParts(binding: string): string[];
/**
 * Gamepad buttons, shown and recorded as well as listened to. Recording is offered while a pad
 * is connected.
 * @returns {InputUI}
 */
export declare function gamepadUI(): InputUI;
