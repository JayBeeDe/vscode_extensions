import {LanguageDescription} from "@codemirror/language";
import { languages } from "@codemirror/language-data";

interface CodeMirrorLanguageEntry {
    canonical: string;
    terms: string[];
}

type LanguageHintData = IHintData & {
    current?: boolean;
};

/** Extra language aliases on top of @codemirror/language-data */
const EXTRA_LANGUAGE_ALIASES: Record<string, string[]> = {
    Shell: ["bash", "sh", "zsh", "shell", "shellscript", "console", "terminal"],
};

const COMMON_CODE_MIRROR_LANGUAGES = new Set([
    "Angular Template",
    "C",
    "C++",
    "C#",
    "Clojure",
    "CMake",
    "CoffeeScript",
    "CSS",
    "Dart",
    "diff",
    "Dockerfile",
    "Erlang",
    "F#",
    "Go",
    "Groovy",
    "Haskell",
    "HTML",
    "HTTP",
    "Java",
    "JavaScript",
    "Jinja",
    "JSON",
    "JSON-LD",
    "JSX",
    "Kotlin",
    "LaTeX",
    "LESS",
    "Lua",
    "Markdown",
    "MariaDB SQL",
    "MS SQL",
    "MySQL",
    "Nginx",
    "Objective-C",
    "Objective-C++",
    "Perl",
    "PHP",
    "PLSQL",
    "PostgreSQL",
    "PowerShell",
    "Properties files",
    "ProtoBuf",
    "Python",
    "R",
    "Ruby",
    "Rust",
    "Sass",
    "Scala",
    "SCSS",
    "Shell",
    "SQL",
    "SQLite",
    "Swift",
    "TOML",
    "TSX",
    "TypeScript",
    "VB.NET",
    "Verilog",
    "Vue",
    "WebAssembly",
    "XML",
    "YAML",
]);

const codeMirrorLanguages = languages.filter((language) => COMMON_CODE_MIRROR_LANGUAGES.has(language.name));

/**
 * The blocks drawn rather than highlighted (codeMirrorManager.ts, SPECIAL_LANGUAGES), not CodeMirror
 * languages: listed by their label, their fence and class written in lower case
 */
const DRAWN_LANGUAGES: Record<string, string> = {
    Math: "math",
    Mermaid: "mermaid",
};

const buildLanguageEntries = (): CodeMirrorLanguageEntry[] => {
    const entries: CodeMirrorLanguageEntry[] = [];
    for (const language of codeMirrorLanguages) {
        const terms = new Set<string>([language.name, ...language.alias]);
        const extra = EXTRA_LANGUAGE_ALIASES[language.name];
        if (extra) {
            for (const alias of extra) {
                terms.add(alias);
            }
        }
        entries.push({
            canonical: language.name,
            terms: [...terms],
        });
    }
    for (const [label, name] of Object.entries(DRAWN_LANGUAGES)) {
        entries.push({canonical: label, terms: [label, name]});
    }
    return entries;
};

const CODE_MIRROR_LANGUAGE_ENTRIES: CodeMirrorLanguageEntry[] = buildLanguageEntries();

export const getPlainTextLanguageLabel = (): string =>
    window.VditorI18n?.plaintext;

const PLAIN_TEXT_LANGUAGE_TERMS = ["plain text", "plaintext", "plain", "text"];

export const toCodeBlockLanguageName = (displayName: string): string => {
    if (displayName === getPlainTextLanguageLabel() || displayName === "Plain Text") {
        return "";
    }
    if (DRAWN_LANGUAGES[displayName]) {
        return DRAWN_LANGUAGES[displayName];
    }
    return displayName;
};

/** VS Code languageId / vscode-editor-data mode → alias recognized by CodeMirror */
const VSCODE_EDITOR_MODE_ALIASES: Record<string, string> = {
    typescriptreact: "tsx",
    javascriptreact: "jsx",
    shellscript: "shell",
    shell: "shell",
    bash: "shell",
    zsh: "shell",
    sh: "shell",
    csharp: "csharp",
    cs: "csharp",
    fsharp: "fsharp",
    fs: "fsharp",
    vb: "vb",
    objectivec: "objective-c",
    "objective-c": "objective-c",
    objectivecpp: "objective-cpp",
    "objective-cpp": "objective-cpp",
    cpp: "cpp",
    "c++": "cpp",
    cuda: "cuda",
    "cuda-cpp": "cuda",
    jsonc: "json",
    json5: "json",
    dockercompose: "yaml",
    "dockercompose-yaml": "yaml",
    jupyter: "python",
    pip: "pip",
    "pip-requirements": "pip",
    plaintext: "",
    text: "",
    restructuredtext: "rst",
    rst: "rst",
    tex: "latex",
    "vue-html": "vue",
    "vue-postcss": "vue",
    wgsl: "wgsl",
    hlsl: "hlsl",
    glsl: "glsl",
    shaderlab: "hlsl",
    scminput: "scheme",
    handlebars: "handlebars",
    hbs: "handlebars",
    gradle: "groovy",
    npm: "json",
    "ignore": "ignore",
    dotenv: "shell",
    properties: "properties",
    "gradle-kotlin-dsl": "kotlin",
};

export const normalizePasteFenceLanguage = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return "";
    }
    const vscodeKey = trimmed.toLowerCase();
    const mapped = VSCODE_EDITOR_MODE_ALIASES[vscodeKey];
    const candidate = mapped !== undefined ? mapped : trimmed;
    if (!candidate) {
        return "";
    }
    const resolved = resolveCodeMirrorLanguageName(candidate);
    return resolved.toLowerCase();
};

export const resolveCodeMirrorLanguageName = (languageName: string): string => {
    const normalized = toCodeBlockLanguageName(languageName.trim());
    if (!normalized) {
        return "";
    }
    const lower = normalized.toLowerCase();
    for (const entry of CODE_MIRROR_LANGUAGE_ENTRIES) {
        if (entry.canonical.toLowerCase() === lower) {
            return entry.canonical;
        }
        for (const term of entry.terms) {
            if (term.toLowerCase() === lower) {
                return entry.canonical;
            }
        }
    }
    return normalized;
};

export const isSameCodeMirrorLanguage = (languageName: string, candidateName: string): boolean =>
    resolveCodeMirrorLanguageName(languageName).toLowerCase() ===
    resolveCodeMirrorLanguageName(candidateName).toLowerCase();

const plainTextMatchesQuery = (query: string): boolean => {
    const lower = query.trim().toLowerCase();
    if (!lower) {
        return true;
    }
    const label = getPlainTextLanguageLabel().toLowerCase();
    if (label.includes(lower)) {
        return true;
    }
    for (const term of PLAIN_TEXT_LANGUAGE_TERMS) {
        if (term.includes(lower) || lower.includes(term)) {
            return true;
        }
    }
    return false;
};

export const buildCodeMirrorLanguageMap = (): Record<string, LanguageDescription> => {
    const map: Record<string, LanguageDescription> = {};
    for (const language of codeMirrorLanguages) {
        map[language.name.toLowerCase()] = language;
        for (const alias of language.alias) {
            map[alias.toLowerCase()] = language;
        }
        const extra = EXTRA_LANGUAGE_ALIASES[language.name];
        if (extra) {
            for (const alias of extra) {
                map[alias.toLowerCase()] = language;
            }
        }
    }
    return map;
};

/**
 * The languages are always listed alphabetically, plain text (no language) first: in the code
 * block's language list and in the suggestions after ``` alike
 */
const compareLanguageNames = (a: string, b: string) => {
    const plainText = getPlainTextLanguageLabel();
    if (a === plainText || b === plainText) {
        return a === plainText ? (b === plainText ? 0 : -1) : 1;
    }
    return a.localeCompare(b, undefined, {sensitivity: "base"});
};

const sortLanguageNamesAlphabetically = (names: string[]) => [...names].sort(compareLanguageNames);

const sortHintDataAlphabetically = (items: IHintData[]) =>
    items.sort((a, b) => compareLanguageNames(a.value, b.value));

export const getAllCodeMirrorLanguageNames = (): string[] => {
    const names: string[] = [getPlainTextLanguageLabel()];
    for (const entry of CODE_MIRROR_LANGUAGE_ENTRIES) {
        names.push(entry.canonical);
    }
    return sortLanguageNamesAlphabetically(names);
};

export const filterCodeMirrorLanguageNames = (query: string): string[] => {
    const lower = query.trim().toLowerCase();
    const all = getAllCodeMirrorLanguageNames();
    if (!lower) {
        return all;
    }
    const matched = new Set<string>();
    if (plainTextMatchesQuery(lower)) {
        matched.add(getPlainTextLanguageLabel());
    }
    for (const entry of CODE_MIRROR_LANGUAGE_ENTRIES) {
        for (const term of entry.terms) {
            if (term.toLowerCase().includes(lower)) {
                matched.add(entry.canonical);
                break;
            }
        }
    }
    return sortLanguageNamesAlphabetically([...matched]);
};

export const matchCodeMirrorLanguages = (key: string, currentLanguage = ""): IHintData[] => {
    const matchLangData: LanguageHintData[] = [];
    const lower = key.toLowerCase();
    const addLanguage = (html: string, value: string) => {
        matchLangData.push({
            html,
            value,
            current: isSameCodeMirrorLanguage(currentLanguage, value),
        });
    };
    if (plainTextMatchesQuery(lower)) {
        addLanguage(getPlainTextLanguageLabel(), getPlainTextLanguageLabel());
    }
    for (const entry of CODE_MIRROR_LANGUAGE_ENTRIES) {
        let matched = false;
        for (const term of entry.terms) {
            if (term.toLowerCase().indexOf(lower) > -1) {
                matched = true;
                break;
            }
        }
        if (matched) {
            addLanguage(entry.canonical, entry.canonical);
        }
    }
    return sortHintDataAlphabetically(matchLangData);
};
