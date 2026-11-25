import { LanguageSupport } from "@codemirror/language";
import { mermaid } from "codemirror-lang-mermaid";
import { latex } from "codemirror-lang-latex";

import { buildCodeMirrorLanguageMap } from "./codeBlockLanguageHints";
import { getNginxLanguageSupport } from "./nginxLanguage";

const languageMap = buildCodeMirrorLanguageMap();

/** DOM / Lute language name → CodeMirror highlight language name */
const HIGHLIGHT_LANGUAGE_ALIASES: Record<string, string> = {
    math: "latex",
};

let mermaidLanguageSupport: LanguageSupport | undefined;

const getMermaidLanguageSupport = () => {
    if (!mermaidLanguageSupport) {
        mermaidLanguageSupport = mermaid();
    }
    return mermaidLanguageSupport;
};

const STATIC_LANGUAGE_SUPPORTS: Record<string, () => LanguageSupport> = {
    // Use codemirror-lang-latex for both highlight + completions (via language data).
    latex: () => latex({ enableAutocomplete: true, enableLinting: false }),
    mermaid: getMermaidLanguageSupport,
    nginx: getNginxLanguageSupport,
};

export const resolveCodeMirrorHighlightLanguage = (languageName: string): string => {
    const lower = languageName.trim().toLowerCase();
    return HIGHLIGHT_LANGUAGE_ALIASES[lower] ?? lower;
};

export const loadCodeMirrorHighlightLanguage = (
    languageName: string,
): Promise<LanguageSupport | undefined> => {
    const resolved = resolveCodeMirrorHighlightLanguage(languageName);
    const staticSupport = STATIC_LANGUAGE_SUPPORTS[resolved];
    if (staticSupport) {
        return Promise.resolve(staticSupport());
    }
    const language = languageMap[resolved];
    if (!language) {
        return Promise.resolve(undefined);
    }
    if (language.support) {
        return Promise.resolve(language.support);
    }
    return language.load();
};
