/**
 * Create a component from its class (CommandPalette, KeybindSettings, ...).
 *
 * A custom element name stays bound to the first class defined for it, so a second copy of the
 * library on the same page (a script loaded again after a deploy, two bundles) can't use the
 * other copy's elements. Each copy gets its own name: `keybinds-<kind>` when that's free or
 * already this copy's, otherwise `keybinds-<kind>-2`, `-3`, ... Styles select components by their
 * `data-keybinds` kind, so the name doesn't matter to them.
 *
 * @template {CustomElementConstructor & { kind: string }} K
 * @param {K} cls
 * @returns {InstanceType<K>}
 */
export declare function createComponent<K extends CustomElementConstructor & {
    kind: string;
}>(cls: K): InstanceType<K>;
