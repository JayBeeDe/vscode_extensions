import {disableToolbar} from "../toolbar/setToolbar";
import {hasFrontMatterTitle} from "./frontMatterTitle";

/**
 * markdownlint MD025 (one top-level heading per file): a `#` heading can't be added after an
 * existing one, nor anywhere under a front matter `title:` with a value (the top-level heading,
 * markdownlint's front_matter_title). The heading menu greys out "Heading 1", and its shortcuts
 * do nothing.
 */

const blockOf = (vditor: IVditor, node: Node | null): Element | null => {
    const editor = vditor[vditor.currentMode]?.element;
    let current: Node | null = node;
    while (current && current.parentNode !== editor) {
        current = current.parentNode;
    }
    return current && current.nodeType === 1 ? current as Element : null;
};

const isTopHeading = (element: Element) => (
    element.tagName === "H1" ||
    // the IR mode's heading being typed: "# " in a paragraph is rendered as h1 too
    (element.getAttribute("data-type") === "heading" && element.getAttribute("data-marker") === "#")
);

/**
 * Whether a top-level heading comes before the block of the caret (other than that block), the
 * front matter's title included.
 */
export const hasTopHeadingBeforeCaret = (vditor: IVditor) => {
    const editor = vditor[vditor.currentMode]?.element;
    if (hasFrontMatterTitle(editor)) {
        return true;
    }
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
        return false;
    }
    const block = blockOf(vditor, selection.getRangeAt(0).startContainer);
    if (!block) {
        return false;
    }
    for (let previous = block.previousElementSibling; previous; previous = previous.previousElementSibling) {
        if (isTopHeading(previous)) {
            return true;
        }
    }
    return false;
};

/**
 * The toolbar's "Heading 1" greyed out, before the caret is anywhere, when the front matter has a
 * title: as the file opens, and once a title is saved in the front matter's editor. (The toolbar's
 * highlighting, on each caret move, enables it again when the title is gone.)
 */
export const syncTopHeadingButton = (vditor: IVditor) => {
    if (vditor.toolbar?.elements && hasFrontMatterTitle(vditor[vditor.currentMode]?.element)) {
        disableToolbar(vditor.toolbar.elements, ["h1"]);
    }
};
