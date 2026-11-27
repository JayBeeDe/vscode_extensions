import {defaultCallout, mapTextLines} from "./lintFormat";

/**
 * What Lute drops between the Markdown and the editor's DOM, given back by wrapping its renderers
 * (as tableCellSpace.ts does), so that every conversion keeps it: loading, a mode switch, the
 * re-rendering of a block being typed, a save, a copy.
 *
 * - A list item's Obsidian block ID (`- item ^id`): Lute reads it as nothing. It is read escaped
 *   (`\^id`, which Lute keeps as text, its backslash hidden) and written back unescaped.
 * - A reference definition's title (`[ref]: url "title"`): Lute reads the definition without it.
 *   The titles read are remembered, by label, and written back on the definition's line whenever
 *   Lute writes Markdown. They stay out of the editor's text: there, anything typed after a title
 *   would make Lute read the definitions as a paragraph. A definition read without a title forgets
 *   its label's (the file changed elsewhere).
 * - IR mode, a block's Obsidian block ID (`text ^id`): Lute keeps it in `data-block-id`, which its
 *   IR writer drops (the WYSIWYG one writes it). It is put back at the end of the block's text.
 * - A callout's title equal to its type's name (`> [!NOTE] Note`): Lute writes neither the icon
 *   nor the title when both are the type's own, as for an untitled callout (`> [!NOTE]`), which
 *   looks the same. The callouts whose title is written are marked as read, and written without
 *   their type's icon, which makes Lute write their title (an icon of their own is kept).
 */

const LIST_ITEM = String.raw`^(\s*(?:>\s?)*\s*(?:[-*+]|\d+[.)])\s+\S.*?\s)`;
const LIST_ITEM_ID_RE = new RegExp(`${LIST_ITEM}\\^([A-Za-z0-9-]+)\\s*$`);
const ESCAPED_LIST_ITEM_ID_RE = new RegExp(`${LIST_ITEM}\\\\\\^([A-Za-z0-9-]+)\\s*$`);

const escapeListItemIds = (markdown: string) => mapTextLines(markdown, (text) => text.replace(LIST_ITEM_ID_RE, "$1\\^$2"));
const unescapeListItemIds = (markdown: string) => mapTextLines(markdown, (text) => text.replace(ESCAPED_LIST_ITEM_ID_RE, "$1^$2"));

/** `[label]: destination "title"` (or `'title'`, `(title)`): the label and the title, delimiters included */
const DEFINITION_RE = /^ {0,3}\[([^\]]+)\]:[ \t]*(?:<[^>]*>|\S+)(?:[ \t]+("[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/;

const normalizeLabel = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

/** The titles of the definitions in `markdown` remembered in `titles`; one without, forgotten. */
const rememberTitles = (markdown: string, titles: Map<string, string>) => {
    mapTextLines(markdown, (text) => {
        const match = DEFINITION_RE.exec(text);
        if (match) {
            if (match[2]) {
                titles.set(normalizeLabel(match[1]), match[2]);
            } else {
                titles.delete(normalizeLabel(match[1]));
            }
        }
        return text;
    });
};

/** `markdown`'s definitions without a title given the one remembered for their label. */
const writeTitles = (markdown: string, titles: Map<string, string>) => (!titles.size ? markdown
    : mapTextLines(markdown, (text) => {
        const match = DEFINITION_RE.exec(text);
        const title = match && !match[2] && titles.get(normalizeLabel(match[1]));
        return title ? `${text.trimEnd()} ${title}` : text;
    }));

/**
 * ` ^id` at the end of an element's text: after its last text, or after the caret's `<wbr>` when
 * it comes later (Lute re-reading a block being typed), before the trailing line end.
 */
const appendBlockId = (element: Element, id: string) => {
    if ((element.textContent || "").trimEnd().endsWith(`^${id}`)) {
        return;
    }
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let last: Node | null = null;
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if ((node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) || (node as Element).tagName === "WBR") {
            last = node;
        }
    }
    if (last?.nodeType === Node.TEXT_NODE) {
        last.textContent = last.textContent.replace(/(\s*)$/, ` ^${id}$1`);
    } else if (last) {
        (last as Element).after(` ^${id}`);
    }
};

/** IR mode: each block's `data-block-id` put back at the end of its text, where Lute writes it. */
export const restoreIrBlockIds = (root: ParentNode) => {
    for (const block of Array.from(root.querySelectorAll("[data-block-id]"))) {
        appendBlockId(block, block.getAttribute("data-block-id") || "");
    }
};

/**
 * A copy ending at the end of a block with an Obsidian block ID: the copied contents (`root`,
 * the range's) don't hold the block itself when the copy is inside it, so its ID is added.
 */
export const keepBlockIdInCopy = (root: Element, range: Range) => {
    const end = range.endContainer.nodeType === Node.ELEMENT_NODE
        ? range.endContainer as Element : range.endContainer.parentElement;
    const block = end?.closest("[data-block-id]");
    const id = block?.getAttribute("data-block-id");
    if (!block || !id || root.querySelector(`[data-block-id="${CSS.escape(id)}"]`)) {
        return;
    }
    const rest = document.createRange();
    rest.setStart(range.endContainer, range.endOffset);
    rest.setEnd(block, block.childNodes.length);
    if (!rest.toString().trim()) {
        appendBlockId(root, id);
    }
};

/** A callout written with a title (`> [!NOTE] Note`): Lute's DOM doesn't say it, this does */
const TITLED = "data-callout-titled";
const CALLOUT_HEADER_RE = /^\s*(?:>\s?)+\[![^\]\s]+\][+-]?(.*)$/;

/** Per callout of `markdown`, in order: whether its header has a title (or an icon) written. */
const calloutTitlesWritten = (markdown: string) => {
    const written: boolean[] = [];
    mapTextLines(markdown, (text) => {
        const match = CALLOUT_HEADER_RE.exec(text);
        if (match) {
            written.push(!!match[1].trim());
        }
        return text;
    });
    return written;
};

const parse = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template;
};

const callouts = (root: ParentNode) => Array.from(root.querySelectorAll("[data-type='callout']"));

/** The callouts of `html` marked titled as `written` says, in order (left as they are when counts differ) */
const markTitledCallouts = (html: string, written: boolean[]) => {
    if (!written.some(Boolean)) {
        return html;
    }
    const template = parse(html);
    const found = callouts(template.content);
    if (found.length !== written.length) {
        return html;
    }
    found.forEach((callout, index) => {
        if (written[index]) {
            callout.setAttribute(TITLED, "1");
        }
    });
    return template.innerHTML;
};

/**
 * Titled callouts without their type's icon, so that Lute writes their title (the WYSIWYG span,
 * the IR attribute); an icon of their own is kept, Lute writing it with the title.
 */
const unIconTitledCallouts = (html: string, lute: Lute) => {
    if (!html.includes(TITLED)) {
        return html;
    }
    const template = parse(html);
    for (const callout of Array.from(template.content.querySelectorAll(`[${TITLED}]`))) {
        const icon = defaultCallout(lute, callout.getAttribute("data-subtype") || "")?.icon;
        if (!icon) {
            continue;
        }
        const span = callout.querySelector(":scope > .vditor-callout__info > .vditor-callout__icon");
        if (span?.textContent === icon) {
            span.textContent = "";
        }
        if (callout.getAttribute("data-callout-icon") === icon) {
            callout.setAttribute("data-callout-icon", "");
        }
    }
    return template.innerHTML;
};

const withIrBlockIds = (html: string) => {
    if (!html.includes("data-block-id")) {
        return html;
    }
    const template = document.createElement("template");
    template.innerHTML = html;
    restoreIrBlockIds(template.content);
    return template.innerHTML;
};

/** Makes `lute` keep list items' block IDs, definitions' titles, IR block IDs, callout titles (see above). */
export const keepWhatLuteDrops = (lute: Lute) => {
    const titles = new Map<string, string>();
    const fromMarkdown = (render: (markdown: string) => string) => (markdown: string) => {
        rememberTitles(markdown, titles);
        return markTitledCallouts(render(escapeListItemIds(markdown)), calloutTitlesWritten(markdown));
    };
    const toMarkdown = (render: (html: string) => string) => (html: string) =>
        writeTitles(unescapeListItemIds(render(unIconTitledCallouts(html, lute))), titles);
    // a block re-read as it is typed: its callouts keep their mark, and their title
    const fromDOM = (render: (html: string) => string) => (html: string) =>
        markTitledCallouts(render(unIconTitledCallouts(html, lute)),
            html.includes(TITLED) ? callouts(parse(html).content).map((callout) => callout.hasAttribute(TITLED)) : []);
    // IR re-reads the editor's DOM through its IR writer, which drops the block IDs: given back first
    const fromIrDOM = (render: (html: string) => string) => {
        const spin = fromDOM(render);
        return (html: string) => spin(withIrBlockIds(html));
    };
    lute.Md2VditorDOM = fromMarkdown(lute.Md2VditorDOM.bind(lute));
    lute.Md2VditorIRDOM = fromMarkdown(lute.Md2VditorIRDOM.bind(lute));
    lute.SpinVditorDOM = fromDOM(lute.SpinVditorDOM.bind(lute));
    lute.SpinVditorIRDOM = fromIrDOM(lute.SpinVditorIRDOM.bind(lute));
    lute.VditorDOM2Md = toMarkdown(lute.VditorDOM2Md.bind(lute));
    const irToMarkdown = toMarkdown(lute.VditorIRDOM2Md.bind(lute));
    lute.VditorIRDOM2Md = (html: string) => irToMarkdown(withIrBlockIds(html));
    return lute;
};
