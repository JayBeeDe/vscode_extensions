import {processAfterRender} from "../ir/process";
import {processCodeRender} from "../util/processCode";
import {afterRenderEvent} from "../wysiwyg/afterRenderEvent";
import {
    deactivateCodeMirrorsInScope,
    getCodeMirrorView,
    isSpecialCodeLanguage,
    renderCodeBlocksInScope,
    updateCodeMirrorLanguage,
} from "./codeMirrorManager";

const afterCodeBlockLanguageChange = (vditor: IVditor) => {
    if (vditor.currentMode === "wysiwyg") {
        afterRenderEvent(vditor);
    } else if (vditor.currentMode === "ir") {
        processAfterRender(vditor);
    }
};

/**
 * A plain code block and a diagram's (Mermaid…) are not made alike: the first one is edited in
 * CodeMirror, the second one shows its drawing under its source. A language change from one to
 * the other renders the block anew from its markdown.
 */
const rebuildCodeBlock = (vditor: IVditor, blockElement: HTMLElement, lang: string, code: string) => {
    const body = code.replace(/\n$/, "");
    // a fence longer than any line of backticks in the code
    const longest = Math.max(2, ...(body.match(/`+/g) || []).map((ticks) => ticks.length));
    const fence = "`".repeat(longest + 1);
    const markdown = `${fence}${lang}\n${body}\n${fence}`;
    const html = vditor.currentMode === "ir" ? vditor.lute.Md2VditorIRDOM(markdown) : vditor.lute.Md2VditorDOM(markdown);
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    const newBlock = template.content.firstElementChild as HTMLElement | null;
    if (!newBlock) {
        return;
    }
    deactivateCodeMirrorsInScope(vditor, blockElement);
    blockElement.replaceWith(newBlock);
    newBlock.querySelectorAll(".vditor-wysiwyg__preview, .vditor-ir__preview").forEach((preview) => {
        processCodeRender(preview as HTMLElement, vditor);
    });
    renderCodeBlocksInScope(vditor, newBlock);
    afterCodeBlockLanguageChange(vditor);
};

export const applyCodeBlockLanguageChange = (
    vditor: IVditor,
    blockElement: HTMLElement,
    languageName: string,
) => {
    const currentCode = blockElement.querySelector("pre code") as HTMLElement;
    if (!currentCode) {
        return;
    }
    const lang = languageName.trim();
    const wasDiagram = isSpecialCodeLanguage(currentCode);
    if (lang !== "") {
        currentCode.className = `language-${lang}`;
        vditor.hint.recentLanguage = lang;
    } else {
        currentCode.className = "";
        vditor.hint.recentLanguage = "";
    }
    // code becoming a diagram (Mermaid…) or the reverse: the block is built anew
    if (isSpecialCodeLanguage(currentCode) !== wasDiagram) {
        rebuildCodeBlock(vditor, blockElement, lang, getCodeMirrorView(blockElement)?.state.doc.toString()
            ?? currentCode.textContent ?? "");
        return;
    }
    if (vditor.currentMode === "wysiwyg" &&
        blockElement.lastElementChild?.classList.contains("vditor-wysiwyg__preview")) {
        blockElement.lastElementChild.innerHTML = blockElement.firstElementChild.innerHTML;
        processCodeRender(blockElement.lastElementChild as HTMLElement, vditor);
    }
    updateCodeMirrorLanguage(blockElement, lang);
    afterCodeBlockLanguageChange(vditor);
};
