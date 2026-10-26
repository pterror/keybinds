/**
 * Gamepad buttons: bindings like "a", "rt" or "start:up". Gamepad buttons take no modifiers.
 */
export type Input = import('./core.js').Input;
export type Press = import('./core.js').Press;
/**
 * Format a gamepad binding into display parts (e.g. "rt:up" -> ["RT", "Release"])
 * @param {string} binding
 * @returns {string[]}
 */
export declare function formatGamepadParts(binding: string): string[];
/**
 * Gamepad buttons. Gamepads have no events for their buttons, so they're read every frame, but
 * only while a command has a gamepad binding and a pad is connected.
 * @returns {Input}
 */
export declare function gamepad(): Input;
