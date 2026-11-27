import {ensureMathCopyButton} from "../markdown/mathCopyButton";
import {isMacPlatform} from "./compatibility";

/** As long as the browser waits before its own tooltips */
const SHOW_DELAY = 500;

/**
 * The markdown link under the pointer, [text](url "tooltip"): its URL and its own tooltip. Not a
 * reference link, nor a link in rendered HTML (that one has its own tooltip, wysiwyg/index.ts).
 */
const resolveLink = (vditor: IVditor, target: EventTarget | null) => {
    if (!(target instanceof Element)) {
        return null;
    }
    if (vditor.currentMode === "wysiwyg") {
        const link = target.closest("a") as HTMLAnchorElement | null;
        if (!link || !link.getAttribute("href") ||
            link.closest("[data-type='html-inline'], [data-type='html-block']")) {
            return null;
        }
        return {element: link as HTMLElement, url: link.getAttribute("href"), title: link.getAttribute("title") || ""};
    }
    if (vditor.currentMode === "ir") {
        const link = target.closest("[data-type='a']") as HTMLElement | null;
        const url = link?.querySelector(":scope > .vditor-ir__marker--link")?.textContent?.trim();
        if (!link || !url) {
            return null;
        }
        const title = unquoteTitle(link.querySelector(":scope > .vditor-ir__marker--title")?.textContent || "");
        return {element: link, url, title};
    }
    return null;
};

/** A title marker's text without its delimiters: "tooltip", 'tooltip' or (tooltip) */
const unquoteTitle = (text: string) => text.trim().replace(/^["'(]([\s\S]*)["')]$/, "$1");

/**
 * IR: an image's preview shows its tooltip, ![alt](src "tooltip"), as in WYSIWYG, where the
 * picture is the image itself. Only the preview gets it: the markdown is its markers' text.
 */
const showIrImageTooltip = (vditor: IVditor, target: EventTarget | null) => {
    if (vditor.currentMode !== "ir" || !(target instanceof HTMLImageElement)) {
        return;
    }
    const marker = target.closest("[data-type='img']")?.querySelector(":scope > .vditor-ir__marker--title");
    const title = marker ? unquoteTitle(marker.textContent || "") : "";
    if (title) {
        target.setAttribute("title", title);
    } else {
        target.removeAttribute("title");
    }
};

/**
 * A Mermaid diagram's or a formula's drawing says that a click on it edits its source (the block's
 * code, ```mermaid, ```math or $$ … $$). Only the drawing gets it, never written in the markdown.
 */
const showDrawnBlockTooltip = (vditor: IVditor, target: EventTarget | null) => {
    if (!(target instanceof Element)) {
        return;
    }
    const preview = target.closest(".vditor-wysiwyg__preview, .vditor-ir__preview") as HTMLElement | null;
    const block = preview?.closest("[data-type='code-block'], [data-type='math-block']");
    if (!preview || !block) {
        return;
    }
    const code = block.querySelector("pre > code");
    const isMath = block.getAttribute("data-type") === "math-block" || code?.classList.contains("language-math");
    if (isMath) {
        ensureMathCopyButton(vditor, preview, block);
    }
    const title = isMath
        ? window.VditorI18n.clickToEditMath
        : code?.classList.contains("language-mermaid") ? window.VditorI18n.clickToEditMermaid : "";
    if (title && preview.getAttribute("title") !== title) {
        preview.setAttribute("title", title);
    }
};

/**
 * What a click on the link does, shown on hover. WYSIWYG: a click follows it and Alt+click edits
 * it; IR: Ctrl/⌘+click follows it (resource/markdown/index.js). The link's own tooltip, when it
 * has one, takes the URL's place.
 */
const tooltipText = (vditor: IVditor, url: string, title: string) => {
    const i18n = window.VditorI18n;
    if (vditor.currentMode === "wysiwyg") {
        const key = isMacPlatform() ? "⌥" : "Alt";
        return (title ? i18n.linkHoverEdit : i18n.linkHoverOpenEdit)
            .replace("{tooltip}", title).replace("{url}", url).replace("{key}", key);
    }
    const key = isMacPlatform() ? "⌘" : "Ctrl";
    return (title ? i18n.linkHoverCtrlTooltip : i18n.linkHoverCtrlUrl)
        .replace("{tooltip}", title).replace("{url}", url).replace("{key}", key);
};

/**
 * A tooltip of the editor's own that the browser never shows (a title attribute would be shown by
 * the browser too): the read-only page's. Only the box shows it, the nearest tooltip winning.
 */
export const EDITOR_TOOLTIP_ATTRIBUTE = "data-vditor-tooltip";

/** Taller than this, an element's tooltip box shows by the pointer rather than under it. */
const POINTER_PLACED_MIN_HEIGHT = 48;

/**
 * The tooltips of the page, all in one box of their own, in the editor's style rather than the
 * browser's. A markdown link's says what a click does. Any other element of the page with a title
 * attribute (an image's own tooltip, rendered HTML's, the front matter's, a diagram's, a read-only
 * page's: wysiwyg/index.ts) shows that title.
 *
 * A link's or an image's title attribute is its tooltip in the markdown, so it is never changed
 * for this: in WYSIWYG it is only taken off while the pointer is on it, the browser showing it too
 * otherwise, and put back before anything else happens (a key, a click, the pointer leaving), so
 * that the markdown never lacks it.
 */
export const linkHoverTooltipEvent = (vditor: IVditor, editorElement: HTMLElement) => {
    let timer = 0;
    let box: HTMLElement | null = null;
    let current: HTMLElement | null = null;
    let hiddenTitle: string | null = null;

    const hide = () => {
        clearTimeout(timer);
        timer = 0;
        box?.remove();
        box = null;
        // (unless the link's popup gave it another one meanwhile)
        if (current && hiddenTitle !== null && !current.hasAttribute("title")) {
            current.setAttribute("title", hiddenTitle);
        }
        current = null;
        hiddenTitle = null;
    };

    /** The nearest element of the page with a tooltip; an empty title means none, as in a browser. */
    const resolveTitled = (target: EventTarget | null) => {
        if (!(target instanceof Element)) {
            return null;
        }
        const titled = target.closest(`[title], [${EDITOR_TOOLTIP_ATTRIBUTE}]`) as HTMLElement | null;
        if (!titled || !(titled === editorElement || editorElement.contains(titled))) {
            return null;
        }
        return tooltipOf(titled) ? titled : null;
    };

    const tooltipOf = (element: HTMLElement) => element.hasAttribute("title")
        ? element.getAttribute("title")
        : element.getAttribute(EDITOR_TOOLTIP_ATTRIBUTE);

    /** Its title taken off while the box shows (the browser would show it too) */
    const holdTitle = (element: HTMLElement) => {
        if (element.hasAttribute("title")) {
            hiddenTitle = element.getAttribute("title");
            element.removeAttribute("title");
        }
    };

    const show = (element: HTMLElement, text: string, pointerX: number, pointerY: number) => {
        box = document.createElement("div");
        box.className = "vditor-link-hover";
        box.textContent = text;
        vditor.element.appendChild(box);
        const rect = element.getBoundingClientRect();
        const width = box.offsetWidth;
        const height = box.offsetHeight;
        // under a link or a small element; by the pointer on a big one (an HTML block, the page)
        const byPointer = rect.height > POINTER_PLACED_MIN_HEIGHT;
        const anchorLeft = byPointer ? pointerX : rect.left;
        const anchorTop = byPointer ? pointerY - 2 : rect.top;
        const anchorBottom = byPointer ? pointerY + 18 : rect.bottom;
        const left = Math.max(8, Math.min(anchorLeft, window.innerWidth - width - 8));
        const below = anchorBottom + 6;
        box.style.left = `${left}px`;
        box.style.top = `${below + height > window.innerHeight - 8 ? anchorTop - height - 6 : below}px`;
    };

    const update = (target: EventTarget | null, buttons: number, pointerX: number, pointerY: number) => {
        const link = resolveLink(vditor, target);
        if (link?.element === current) {
            return;
        }
        if (!link && current && target instanceof Node && current.contains(target)) {
            const nearer = resolveTitled(target);
            if (!nearer || nearer === current || !current.contains(nearer)) {
                // still on it: its title given back meanwhile (wysiwyg/index.ts) is taken off again
                holdTitle(current);
                return;
            }
        }
        const element = link?.element ?? resolveTitled(target);
        hide();
        // nothing while a mouse button is down: a drag selecting text
        if (!element || buttons !== 0) {
            return;
        }
        current = element;
        let text: string;
        if (link) {
            if (vditor.currentMode === "wysiwyg") {
                holdTitle(element);
            }
            text = tooltipText(vditor, link.url, link.title);
        } else {
            text = tooltipOf(element) ?? "";
            holdTitle(element);
        }
        timer = window.setTimeout(() => show(element, text, pointerX, pointerY), SHOW_DELAY);
    };

    editorElement.addEventListener("mouseover", (event: MouseEvent) => {
        showIrImageTooltip(vditor, event.target);
        showDrawnBlockTooltip(vditor, event.target);
        const {target, buttons, clientX, clientY} = event;
        // once the editor's other listeners have set the titles they set on hover (wysiwyg/index.ts)
        window.setTimeout(() => update(target, buttons, clientX, clientY), 0);
    });
    editorElement.addEventListener("mouseleave", () => {
        // (the update of the last mouseover, if any, comes first)
        window.setTimeout(hide, 0);
    });
    editorElement.addEventListener("mousedown", hide, true);
    editorElement.addEventListener("keydown", hide, true);
    editorElement.addEventListener("blur", hide);
    window.addEventListener("scroll", hide, true);
};
