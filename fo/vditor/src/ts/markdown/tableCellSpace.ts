/**
 * Lute bug: rendering the editor's DOM, it drops the whitespace that ends a table cell's first
 * text when markup follows it. "| x [a](u) |" shows "x<a>", and saving writes "| x[a](u) |".
 * Its HTML renderer (Md2HTML) keeps that whitespace, and so does the DOM the editor had before
 * a re-render: each cell's first text gets its whitespace back from that reference, the cells
 * matched in order (a different count, as with an HTML block holding a table: left as is).
 */

const CELLS = "td, th";

/** A cell's first text, when an inline element (not a line break) follows it */
const firstTextBeforeMarkup = (cell: Element): Text | null => {
    const first = cell.firstChild;
    const next = first?.nextSibling;
    if (first?.nodeType !== Node.TEXT_NODE || next?.nodeType !== Node.ELEMENT_NODE || (next as Element).tagName === "BR") {
        return null;
    }
    return first as Text;
};

const parseHTML = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content;
};

/** Per cell, in order: the whitespace ending its first text before markup, else "" */
const cellSpaces = (root: ParentNode): string[] =>
    Array.from(root.querySelectorAll(CELLS)).map((cell) =>
        /\s+$/.exec(firstTextBeforeMarkup(cell)?.textContent ?? "")?.[0] ?? "");

const hasCells = (html: string) => /<t[dh][\s>]/.test(html);

/** `html` with the whitespace of `spaces` back, re-serialized only when a cell lacked it */
const restoreCellSpaces = (html: string, spaces: string[]): string => {
    if (!spaces.some(Boolean)) {
        return html;
    }
    const content = parseHTML(html);
    const cells = content.querySelectorAll(CELLS);
    if (cells.length !== spaces.length) {
        return html;
    }
    let changed = false;
    cells.forEach((cell, index) => {
        const text = firstTextBeforeMarkup(cell);
        if (spaces[index] && text && !/\s$/.test(text.data)) {
            text.data += spaces[index];
            changed = true;
        }
    });
    if (!changed) {
        return html;
    }
    const container = document.createElement("div");
    container.append(content);
    return container.innerHTML;
};

/** Makes `lute`'s editor renderings keep the whitespace before markup in table cells. */
export const keepTableCellSpaces = (lute: Lute) => {
    // Markdown in: the HTML renderer is the reference
    const fromMarkdown = (render: (markdown: string) => string) => (markdown: string) => {
        const html = render(markdown);
        return hasCells(html) ? restoreCellSpaces(html, cellSpaces(parseHTML(lute.Md2HTML(markdown)))) : html;
    };
    // the editor's DOM in (typing, a mode switch, a paste): that DOM is the reference
    const fromDOM = (render: (html: string) => string) => (input: string) => {
        const html = render(input);
        return hasCells(html) && hasCells(input) ? restoreCellSpaces(html, cellSpaces(parseHTML(input))) : html;
    };
    lute.Md2VditorDOM = fromMarkdown(lute.Md2VditorDOM.bind(lute));
    lute.Md2VditorIRDOM = fromMarkdown(lute.Md2VditorIRDOM.bind(lute));
    lute.SpinVditorDOM = fromDOM(lute.SpinVditorDOM.bind(lute));
    lute.SpinVditorIRDOM = fromDOM(lute.SpinVditorIRDOM.bind(lute));
    lute.HTML2VditorDOM = fromDOM(lute.HTML2VditorDOM.bind(lute));
    lute.HTML2VditorIRDOM = fromDOM(lute.HTML2VditorIRDOM.bind(lute));
    return lute;
};
