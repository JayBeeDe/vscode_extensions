import { showToast } from "../ui/toast";
import { codicon } from "../util/codicon";
import { copyText } from "./mermaidChrome";

const HOST_CLASS = "vditor-math-copy-host";
const BUTTON_CLASS = "vditor-math-copy";

/**
 * A formula's drawing gets a copy button, like a Mermaid diagram's (mermaidChrome.ts): it copies the
 * formula's LaTeX, as written in its block ($$ … $$ or ```math). Added when the pointer comes over
 * the drawing (util/linkHoverTooltip.ts), and again after the drawing is redone.
 */
export const ensureMathCopyButton = (vditor: IVditor, preview: HTMLElement, block: Element) => {
    if (preview.querySelector(`:scope > .${BUTTON_CLASS}`)) {
        return;
    }
    preview.classList.add(HOST_CLASS);
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.setAttribute("aria-label", window.VditorI18n.copy);
    // no tooltip over it, not the formula's "click to edit"
    button.setAttribute("title", "");
    button.innerHTML = `<span class="vditor-math-copy__icon">${codicon("copy")}</span>`;
    // a click on it copies, without editing the formula as a click on its drawing does
    button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const code = block.querySelector("pre:not(.vditor-wysiwyg__preview):not(.vditor-ir__preview) > code");
        copyText((code?.textContent || "").replace(/\n$/, "")).then(() => {
            const icon = button.querySelector(".codicon");
            if (icon) {
                icon.className = "codicon codicon-check";
                setTimeout(() => { icon.className = "codicon codicon-copy"; }, 1500);
            }
        }, () => {
            showToast(vditor, window.VditorI18n.copyFailed, 1000, "error");
        });
    });
    preview.appendChild(button);
};
