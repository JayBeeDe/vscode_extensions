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
 * A tooltip on the markdown links, saying what a click does. It is a box of its own: the link's
 * title attribute is its tooltip in the markdown, so it is never changed for this. In WYSIWYG it
 * is only taken off while the pointer is on the link, the browser showing it too otherwise, and
 * put back before anything else happens (a key, a click, the pointer leaving), so that the
 * markdown never lacks it.
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

    const show = (link: HTMLElement, text: string) => {
        box = document.createElement("div");
        box.className = "vditor-link-hover";
        box.textContent = text;
        vditor.element.appendChild(box);
        const rect = link.getBoundingClientRect();
        const width = box.offsetWidth;
        const height = box.offsetHeight;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        const below = rect.bottom + 6;
        box.style.left = `${left}px`;
        box.style.top = `${below + height > window.innerHeight - 8 ? rect.top - height - 6 : below}px`;
    };

    editorElement.addEventListener("mouseover", (event) => {
        showIrImageTooltip(vditor, event.target);
        const link = resolveLink(vditor, event.target);
        if (link?.element === current) {
            return;
        }
        hide();
        // nothing while a mouse button is down: a drag selecting text
        if (!link || (event as MouseEvent).buttons !== 0) {
            return;
        }
        current = link.element;
        if (vditor.currentMode === "wysiwyg" && link.element.hasAttribute("title")) {
            hiddenTitle = link.element.getAttribute("title");
            link.element.removeAttribute("title");
        }
        const text = tooltipText(vditor, link.url, link.title);
        timer = window.setTimeout(() => show(link.element, text), SHOW_DELAY);
    });
    editorElement.addEventListener("mouseleave", hide);
    editorElement.addEventListener("mousedown", hide, true);
    editorElement.addEventListener("keydown", hide, true);
    editorElement.addEventListener("blur", hide);
    window.addEventListener("scroll", hide, true);
};
