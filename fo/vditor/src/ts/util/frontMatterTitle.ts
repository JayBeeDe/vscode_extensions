/**
 * The front matter's `title:` key (markdownlint's `front_matter_title`): with a value, it is the
 * document's top-level heading, so no `#` heading may be added (MD025); without one, it is removed
 * on save (markdownlint would count it all the same).
 */

// any case, as markdownlint matches it (`Title:` too)
const TITLE_KEY_RE = /^"?title"?[ \t]*:(.*)$/i;
const EMPTY_VALUE_RE = /^(?:""|''|~|null)?$/;

/** The line of the top-level `title:` key and whether it has a value (on its line or under it). */
const findTitle = (yaml: string) => {
    const lines = yaml.split("\n");
    const index = lines.findIndex((line) => TITLE_KEY_RE.test(line));
    if (index < 0) {
        return null;
    }
    const value = (TITLE_KEY_RE.exec(lines[index])?.[1] ?? "").trim();
    // `title:` then indented lines: a value written under the key (a list, a block)
    const valueBelow = /^[ \t]+\S/.test(lines[index + 1] ?? "");
    return {lines, index, empty: EMPTY_VALUE_RE.test(value) && !valueBelow};
};

/** null without a `title:` key; whether it has a value otherwise. */
export const frontMatterTitleState = (yaml: string): "value" | "empty" | null => {
    const title = findTitle(yaml);
    return title ? (title.empty ? "empty" : "value") : null;
};

/** The YAML without its empty `title:` key. */
export const removeEmptyFrontMatterTitle = (yaml: string) => {
    const title = findTitle(yaml);
    if (!title?.empty) {
        return yaml;
    }
    title.lines.splice(title.index, 1);
    return title.lines.join("\n");
};

/** Whether the editor's front matter has a `title:` with a value. */
export const hasFrontMatterTitle = (editorElement: Element | null | undefined) => {
    const code = editorElement?.querySelector(
        ":scope > [data-type='yaml-front-matter'] code[data-type='yaml-front-matter']");
    return !!code && frontMatterTitleState(code.textContent || "") === "value";
};
