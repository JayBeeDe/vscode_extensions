import { showHtmlEditorPopover } from "../htmlInline/htmlInlineEditor";
import {resolveAdjacentElementFromRange} from "../util/rangeAdjacentElement";
import {isReadOnly} from "../util/readOnly";
import {syncTopHeadingButton} from "../util/singleTitle";
import {setSelectionFocus} from "../util/selection";

/**
 * The YAML front matter (`---` … `---` at the top of the file), shown as a properties panel by
 * Lute: it opens the YAML in the HTML editor's popup, with the same keys (same look, line numbers, line
 * wrap, Alt+Enter to save, Escape to cancel), the panel drawn again from the YAML on save.
 */

const SYNC_CODE_SELECTOR = "code[data-type='yaml-front-matter']";

const getModeEditor = (vditor: IVditor) => {
    if (vditor.currentMode === "wysiwyg") {
        return vditor.wysiwyg.element;
    }
    if (vditor.currentMode === "ir") {
        return vditor.ir.element;
    }
    return null;
};

const getYamlSourceFromBlock = (blockElement: HTMLElement) => {
    const code = blockElement.querySelector(SYNC_CODE_SELECTOR) as HTMLElement | null;
    return (code?.textContent || "").trimEnd();
};

/** Lute draws the properties panel again from the YAML. */
const spinFrontMatterBlock = (vditor: IVditor, blockElement: HTMLElement) => {
    const html = vditor.currentMode === "ir"
        ? vditor.lute.SpinVditorIRDOM(blockElement.outerHTML)
        : vditor.lute.SpinVditorDOM(blockElement.outerHTML);
    blockElement.outerHTML = html;
    return getModeEditor(vditor)?.querySelector("[data-type='yaml-front-matter']") as HTMLElement | null;
};

export const showFrontMatterEditorPopover = (vditor: IVditor, blockElement: HTMLElement) => {
    if (!blockElement.isConnected || isReadOnly(vditor)) {
        return;
    }
    let block = blockElement;
    showHtmlEditorPopover(vditor, {
        anchorElement: block,
        focusElement: block,
        language: "yaml",
        getSource: () => getYamlSourceFromBlock(block),
        applySource: (yaml) => {
            const syncCode = block.querySelector(SYNC_CODE_SELECTOR) as HTMLElement | null;
            if (syncCode) {
                syncCode.textContent = yaml;
            }
            block = spinFrontMatterBlock(vditor, block) ?? block;
            // a title given: "Heading 1" greyed out at once (MD025)
            syncTopHeadingButton(vditor);
            return block;
        },
        // the YAML emptied: no front matter any more
        remove: () => block.remove(),
    });
};

const FRONT_MATTER_SELECTOR = "[data-type='yaml-front-matter']";

const isFrontMatterBlock = (node: Node | null): node is HTMLElement =>
    node?.nodeType === 1 && (node as HTMLElement).getAttribute("data-type") === "yaml-front-matter";

/**
 * A click on the properties panel, as on rendered HTML: in WYSIWYG, the text can be selected,
 * Alt+click opens the YAML and a click puts the caret after the panel (Alt+Enter there opens it);
 * in IR, a click opens it.
 */
export const handleFrontMatterEditorClick = (
    vditor: IVditor,
    event: MouseEvent & { target: HTMLElement },
): boolean => {
    const panel = event.target.closest(".vditor-properties") as HTMLElement | null;
    const blockElement = panel?.closest(FRONT_MATTER_SELECTOR) as HTMLElement | null;
    if (!blockElement || event.target.closest("a")) {
        return false;
    }
    if (vditor.currentMode === "ir" || event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        showFrontMatterEditorPopover(vditor, blockElement);
        return true;
    }
    // the panel takes no caret: it goes after it (not after a drag: the text selected stays selected)
    if (getSelection().isCollapsed) {
        const range = document.createRange();
        range.setStartAfter(blockElement);
        range.collapse(true);
        setSelectionFocus(range);
    }
    return true;
};

/** Alt+Enter beside the properties panel opens its YAML, as beside rendered HTML. */
export const handleFrontMatterAltEnter = (vditor: IVditor, range: Range): boolean => {
    const blockElement = resolveAdjacentElementFromRange(
        range,
        (currentRange) => {
            const node = currentRange.startContainer;
            const element = node.nodeType === 1 ? node as HTMLElement : node.parentElement;
            return element?.closest(FRONT_MATTER_SELECTOR) as HTMLElement | null;
        },
        (node) => isFrontMatterBlock(node) ? node : null,
    );
    if (!blockElement || isReadOnly(vditor)) {
        return false;
    }
    showFrontMatterEditorPopover(vditor, blockElement);
    return true;
};
