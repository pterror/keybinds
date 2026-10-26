/**
 * Axes: continuous input read every frame, from mouse movement ("mouse:x"), sticks and triggers
 * ("pad:rx", "pad:lt") or a pair of keys ("keys:a/d"). A leading "-" inverts a source.
 */
export type Input = import('./core.js').Input;
export type AxisDef = import('./core.js').AxisDef;
export type AxisValue = import('./core.js').AxisValue;
export type ParsedKey = import('./keys.js').ParsedKey;
export type ParsedAxis = {
    kind: 'mouse' | 'pad';
    source: string;
    invert: boolean;
} | {
    kind: 'keys';
    neg: ParsedKey;
    pos: ParsedKey;
    invert: boolean;
};
/**
 * Format an axis binding into display parts (e.g. "-mouse:y" -> ["Mouse ↕", "Inverted"])
 * @param {string} binding
 * @returns {string[]}
 */
export declare function formatAxisParts(binding: string): string[];
/**
 * Axes, read with `axis(id)` on what keybinds() returns
 * @returns {Input}
 */
export declare function axes(): Input;
