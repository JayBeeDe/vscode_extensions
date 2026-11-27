import {isInsideCodeBlockChrome, isInsideCodeMirror} from "../codeBlock/codeMirrorManager";
import {clearBlockMarkerTop, syncBlockMarkerTop} from "./blockMarker";
import {hasClosestByHeadings} from "./hasClosestByHeadings";
import {resolveAdjacentElementFromRange} from "./rangeAdjacentElement";
import {getEditorRange, selectIsEditor} from "./selection";

const ACTIVE_CLASS = "vditor-heading--active";

const isEditorAreaFocused = (vditor: IVditor) => {
    const activeElement = document.activeElement;
    if (!activeElement) {
        return false;
    }
    const editorElement = vditor[vditor.currentMode].element;
    if (editorElement.isEqualNode(activeElement) || editorElement.contains(activeElement)) {
        return true;
    }
    const editorRoot = editorElement.parentElement;
    if (editorRoot?.contains(activeElement)) {
        return true;
    }
    return isInsideCodeMirror(activeElement) || isInsideCodeBlockChrome(activeElement);
};

export const clearActiveHeadingMarker = (vditor: IVditor) => {
    if (vditor.currentMode !== "wysiwyg" && vditor.currentMode !== "ir") {
        return;
    }
    const editorElement = vditor[vditor.currentMode].element;
    for (const item of editorElement.querySelectorAll(`.${ACTIVE_CLASS}`)) {
        clearBlockMarkerTop(item as HTMLElement);
        item.classList.remove(ACTIVE_CLASS);
    }
};

/**
 * The HTML block (or the front matter) whose editor is open, its </> (---) marker shown meanwhile
 * (the editor takes the focus)
 */
const EDITING_CLASS = "vditor-html-block--editing";

export const markEditedHtmlBlock = (vditor: IVditor, block: HTMLElement | null) => {
    if (vditor.currentMode !== "wysiwyg" && vditor.currentMode !== "ir") {
        return;
    }
    for (const item of vditor[vditor.currentMode].element.querySelectorAll(`.${EDITING_CLASS}`)) {
        item.classList.remove(EDITING_CLASS);
    }
    const type = block?.getAttribute("data-type");
    if (type === "html-block" || type === "yaml-front-matter") {
        block.classList.add(EDITING_CLASS);
    }
};

export const updateActiveHeadingMarker = (vditor: IVditor) => {
    if (vditor.currentMode !== "wysiwyg" && vditor.currentMode !== "ir") {
        return;
    }
    // the HTML editor closed by any way: no block is edited any more
    const popover = vditor[vditor.currentMode].popover;
    if (popover.style.display === "none" || !popover.classList.contains("vditor-panel--html-inline")) {
        markEditedHtmlBlock(vditor, null);
    }
    const editorElement = vditor[vditor.currentMode].element;
    if (!selectIsEditor(editorElement) || !isEditorAreaFocused(vditor)) {
        clearActiveHeadingMarker(vditor);
        return;
    }

    const range = getEditorRange(vditor);
    let typeElement = range.startContainer as HTMLElement;
    if (range.startContainer.nodeType === 3) {
        typeElement = range.startContainer.parentElement;
    }

    const headingElement = hasClosestByHeadings(typeElement) as HTMLElement | false;
    const currentActive = editorElement.querySelector(`.${ACTIVE_CLASS}`) as HTMLElement | null;
    if (headingElement && editorElement.contains(headingElement) && headingElement.parentElement === editorElement) {
        if (currentActive === headingElement) {
            return;
        }
        clearActiveHeadingMarker(vditor);
        headingElement.classList.add(ACTIVE_CLASS);
        syncBlockMarkerTop(headingElement);
        return;
    }
    // an HTML block takes no caret: a click on it puts the caret beside it (as for Alt+Enter)
    const htmlBlock = resolveAdjacentElementFromRange(range, () => null, htmlBlockOf);
    if (htmlBlock && htmlBlock.parentElement === editorElement) {
        if (currentActive === htmlBlock) {
            return;
        }
        clearActiveHeadingMarker(vditor);
        htmlBlock.classList.add(ACTIVE_CLASS);
        return;
    }
    if (currentActive) {
        clearActiveHeadingMarker(vditor);
    }
};

const htmlBlockOf = (node: Node | null): HTMLElement | null =>
    node?.nodeType === 1 && (node as HTMLElement).getAttribute("data-type") === "html-block"
        && (node as HTMLElement).getAttribute("contenteditable") === "false" ? node as HTMLElement : null;
