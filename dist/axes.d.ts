/**
 * Axes: continuous input read every frame, from mouse movement ("mouse:x"), sticks and triggers
 * ("pad:rx", "pad:lt") or a pair of keys ("keys:a/d"). A leading "-" inverts a source. Showing
 * and recording them is keybinds/axes-ui.
 */
export type Input = import('./core.js').Input;
export type AxisDef = import('./core.js').AxisDef;
export type AxisValue = import('./core.js').AxisValue;
export type ParsedKey = import('./keys.js').ParsedKey;
/** @typedef {import('./core.js').Input} Input */
/** @typedef {import('./core.js').AxisDef} AxisDef */
/** @typedef {import('./core.js').AxisValue} AxisValue */
/** @typedef {import('./keys.js').ParsedKey} ParsedKey */
export declare const PAD_AXES: string[];
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
 * Where an axis's value comes from: mouse movement, a stick or trigger, or a pair of keys
 * (the first pushes toward -1, the second toward 1). `invert` flips it.
 * @typedef {{ kind: 'mouse' | 'pad', source: string, invert: boolean }
 *   | { kind: 'keys', neg: ParsedKey, pos: ParsedKey, invert: boolean }} ParsedAxis
 */
/**
 * Parse an axis binding: "mouse:x", "pad:rx", "keys:a/d", with a leading "-" to invert
 * @param {string} binding
 * @param {import("./keys.js").KeySyntax[]} [syntax] - For key pairs, as for keys()
 * @returns {ParsedAxis}
 * @throws {Error} if the binding is invalid
 */
export declare function parseAxis(binding: string, syntax?: import("./keys.js").KeySyntax[]): ParsedAxis;
/**
 * Normalized form of an axis binding, without its inversion
 * @param {ParsedAxis} parsed
 * @returns {string}
 */
export declare function axisToLookup(parsed: ParsedAxis): string;
export declare const hasPads: () => boolean;
/**
 * Axes, read with `axis(id)` on what keybinds() returns
 * @param {...import("./keys.js").KeySyntax} syntax - For key pairs, as for keys()
 * @returns {Input}
 */
export declare function axes(...syntax: import("./keys.js").KeySyntax[]): Input;
