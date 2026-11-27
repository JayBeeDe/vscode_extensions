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
 * - A foldable callout's marker (`> [!NOTE]- Note`, `+`): Lute reads it as the title's start,
 *   shown, and writes `> [!NOTE] - Note`. It is taken off the header before Lute reads it, kept
 *   on the callout, and written back after `]`.
 * - A callout's icon written as a shortcode (`> [!TIP] :rocket: Launch`): Lute writes the emoji.
 *   The shortcode is kept on the callout and written back in the emoji's place.
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
/** A foldable callout's marker, `-` or `+` */
const FOLD = "data-callout-fold";
/** A callout's icon written as a shortcode, `:rocket:` */
const ICON = "data-callout-icon-shortcode";
const ICON_SHORTCODE_RE = /^\s*(:[\w+-]+:)(?=\s|$)/;
const CALLOUT_HEADER_RE = /^(\s*(?:>\s?)+\[![^\]\s]+\])([+-]?)(.*)$/;

interface CalloutHeader {
    /** a title (or an icon) written after `[!TYPE]` */
    titled: boolean;
    /** the fold marker, "" for none */
    fold: string;
    /** the icon's shortcode, "" for none */
    icon: string;
}

/** Each callout header of `markdown`, in order */
const calloutHeaders = (markdown: string) => {
    const headers: CalloutHeader[] = [];
    mapTextLines(markdown, (text) => {
        const match = CALLOUT_HEADER_RE.exec(text);
        if (match) {
            headers.push({titled: !!match[3].trim(), fold: match[2], icon: ICON_SHORTCODE_RE.exec(match[3])?.[1] ?? ""});
        }
        return text;
    });
    return headers;
};

/** The headers without their fold marker, which Lute would read as the title's start */
const withoutFoldMarkers = (markdown: string) => mapTextLines(markdown, (text) => text.replace(CALLOUT_HEADER_RE,
    (_match, start: string, _fold: string, rest: string) => start + rest));

/**
 * The headers of Lute's Markdown given back the fold markers and icon shortcodes of `headers` (in
 * order, when the counts match): the shortcode in the place of the emoji Lute writes.
 */
const withCalloutMarks = (markdown: string, headers: CalloutHeader[]) => {
    if (!headers.some((header) => header.fold || header.icon) || calloutHeaders(markdown).length !== headers.length) {
        return markdown;
    }
    let index = 0;
    return mapTextLines(markdown, (text) => text.replace(CALLOUT_HEADER_RE,
        (_match, start: string, fold: string, rest: string) => {
            const header = headers[index];
            index += 1;
            const icon = header.icon && !rest.trimStart().startsWith(header.icon)
                ? rest.replace(/^(\s+)\S+/, `$1${header.icon}`) : rest;
            return start + (fold || header.fold) + icon;
        }));
};

const parse = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template;
};

const callouts = (root: ParentNode) => Array.from(root.querySelectorAll("[data-type='callout']"));

/** The headers the callouts of the editor's DOM keep (its HTML) */
const headersOf = (html: string): CalloutHeader[] => (![TITLED, FOLD, ICON].some((mark) => html.includes(mark)) ? []
    : callouts(parse(html).content).map((callout) => ({
        titled: callout.hasAttribute(TITLED),
        fold: callout.getAttribute(FOLD) || "",
        icon: callout.getAttribute(ICON) || "",
    })));

/** The callouts of `html` given what `headers` says of them, in order (left as they are when counts differ) */
const markCallouts = (html: string, headers: CalloutHeader[]) => {
    if (!headers.some((header) => header.titled || header.fold || header.icon)) {
        return html;
    }
    const template = parse(html);
    const found = callouts(template.content);
    if (found.length !== headers.length) {
        return html;
    }
    found.forEach((callout, index) => {
        if (headers[index].titled) {
            callout.setAttribute(TITLED, "1");
        }
        if (headers[index].fold) {
            callout.setAttribute(FOLD, headers[index].fold);
        }
        if (headers[index].icon) {
            callout.setAttribute(ICON, headers[index].icon);
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
        return markCallouts(render(withoutFoldMarkers(escapeListItemIds(markdown))), calloutHeaders(markdown));
    };
    const toMarkdown = (render: (html: string) => string) => (html: string) =>
        withCalloutMarks(writeTitles(unescapeListItemIds(render(unIconTitledCallouts(html, lute))), titles), headersOf(html));
    // a block re-read as it is typed: its callouts keep their marks (title, fold marker, icon)
    const fromDOM = (render: (html: string) => string) => (html: string) =>
        markCallouts(render(unIconTitledCallouts(html, lute)), headersOf(html));
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
