import { shownMermaidTheme } from "../ui/setMermaidTheme";
import { codicon } from "../util/codicon";
import { showToast } from "../ui/toast";

const MERMAID_HOST_CLASS = "vditor-mermaid-host";
const MERMAID_CHROME_CLASS = "vditor-mermaid-chrome";

const chromeMap = new WeakMap<HTMLElement, HTMLElement>();

const createMermaidChrome = () => {
    const chromeRoot = document.createElement("div");
    chromeRoot.className = MERMAID_CHROME_CLASS;
    // no tooltip over its button: not the diagram's "click to edit" (util/linkHoverTooltip.ts)
    chromeRoot.setAttribute("title", "");

    const toolbar = document.createElement("div");
    toolbar.className = "vditor-mermaid-chrome__toolbar";

    const spacer = document.createElement("div");
    spacer.className = "vditor-mermaid-chrome__spacer";
    toolbar.appendChild(spacer);

    const actions = document.createElement("div");
    actions.className = "vditor-mermaid-chrome__actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "vditor-mermaid-chrome__copy-btn";
    copyBtn.setAttribute("aria-label", window.VditorI18n.copy);
    copyBtn.innerHTML = `<span class="vditor-mermaid-chrome__copy-icon">${codicon("copy")}</span>`;
    actions.appendChild(copyBtn);

    toolbar.appendChild(actions);
    chromeRoot.appendChild(toolbar);

    return { chromeRoot, copyBtn };
};

export const ensureMermaidHost = (mermaidElement: HTMLElement) => {
    const parent = mermaidElement.parentElement;
    if (parent?.classList.contains(MERMAID_HOST_CLASS)) {
        return parent;
    }

    const host = document.createElement("div");
    host.className = MERMAID_HOST_CLASS;
    if (parent) {
        parent.insertBefore(host, mermaidElement);
        host.appendChild(mermaidElement);
    }
    return host;
};

export const ensureMermaidChrome = (vditor: IVditor, mermaidElement: HTMLElement) => {
    const host = ensureMermaidHost(mermaidElement);
    host.setAttribute("data-mermaid-theme", shownMermaidTheme(vditor));
    if (chromeMap.has(host)) {
        return;
    }

    const created = createMermaidChrome();
    chromeMap.set(host, created.chromeRoot);
    host.insertBefore(created.chromeRoot, host.firstChild);

    created.copyBtn.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    created.copyBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        copyText(diagramSource(host, mermaidElement)).then(() => {
            const icon = created.copyBtn.querySelector(".codicon");
            if (icon) {
                icon.className = "codicon codicon-check";
                setTimeout(() => { icon.className = "codicon codicon-copy"; }, 1500);
            }
        }, () => {
            showToast(vditor, window.VditorI18n.copyFailed, 1000, "error");
        });
    });
};

/**
 * The diagram's Mermaid code: its block's, as written in the markdown (edited or not), else the
 * code it was drawn from (mermaidRender.ts keeps it in data-mermaid)
 */
const diagramSource = (host: HTMLElement, mermaidElement: HTMLElement) => {
    const block = host.closest("[data-type='code-block']");
    const code = block?.querySelector("pre:not(.vditor-wysiwyg__preview):not(.vditor-ir__preview) > code.language-mermaid");
    return (code?.textContent || mermaidElement.getAttribute("data-mermaid") || "").replace(/\n$/, "");
};

/** Text put on the clipboard; refused when there is none, or the clipboard refuses it */
export const copyText = async (text: string) => {
    if (!text) {
        throw new Error("no code");
    }
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) {
            throw new Error("copy refused");
        }
    }
};

export const removeMermaidChrome = (host: HTMLElement) => {
    const chromeRoot = chromeMap.get(host);
    if (!chromeRoot) {
        return;
    }
    chromeRoot.remove();
    chromeMap.delete(host);
};

export const isInsideMermaidChrome = (target: EventTarget | Node | null) => {
    if (!target) {
        return false;
    }
    const node = target instanceof Element ? target : (target as Node).parentElement;
    return !!node?.closest(`.${MERMAID_CHROME_CLASS}`);
};
