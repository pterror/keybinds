/**
 * Release bindings: "k:up", "middle:up", "a:up" run when the key or button comes up.
 */
/**
 * Release bindings, for keybinds({ releases: releases() }). A command whose own press ran always
 * gets its release (a hold can't be left open); other release bindings run as usual until one
 * takes the event.
 * @returns {import('./core.js').Phase}
 */
export declare function releases(): import('./core.js').Phase;
