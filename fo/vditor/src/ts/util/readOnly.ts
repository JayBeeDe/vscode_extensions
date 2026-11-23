/**
 * Whether the document is only to be read (the `readOnly` option: a folder's listing in VS Code):
 * no popover to edit a link, an image or HTML, no code, math or front matter editor, no drop.
 */
export const isReadOnly = (vditor: IVditor) => !!vditor.options.readOnly;
