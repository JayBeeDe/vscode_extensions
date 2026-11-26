import * as vscode from 'vscode';
import { i18n } from '@/common/global';

/**
 * A local folder shown in the Markdown editor, as a read-only virtual Markdown file: its
 * subfolders, then its files, each a link, followed by the folder's README when it has one
 * (README.md, else README.markdown, else a plain text README).
 *
 * The virtual file is `<folder>/<folder name>.md` on its own scheme, the folder's scheme kept in
 * the query: its links and images, the README's too, resolve against the real folder.
 */
export const FOLDER_VIEW_SCHEME = 'foss-office-folder';

/** The README shown under the listing: the first of these the folder has, case aside */
const READMES: { pattern: RegExp, markdown: boolean }[] = [
    { pattern: /^readme\.md$/i, markdown: true },
    { pattern: /^readme\.markdown$/i, markdown: true },
    // no extension: plain text, shown as written
    { pattern: /^readme$/i, markdown: false },
];
const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

/** The virtual file showing `folder`. */
export function folderViewUri(folder: vscode.Uri): vscode.Uri {
    const path = folder.path.replace(/\/+$/, '');
    const name = path.slice(path.lastIndexOf('/') + 1) || folder.authority || 'root';
    return vscode.Uri.from({
        scheme: FOLDER_VIEW_SCHEME,
        authority: folder.authority,
        path: `${path}/${name}.md`,
        query: folder.scheme,
    });
}

/** The folder a virtual file shows, or undefined for any other document. */
export function folderOfView(uri: vscode.Uri): vscode.Uri | undefined {
    if (uri.scheme !== FOLDER_VIEW_SCHEME) {
        return undefined;
    }
    return vscode.Uri.from({
        scheme: uri.query || 'file',
        authority: uri.authority,
        path: uri.path.slice(0, uri.path.lastIndexOf('/')) || '/',
    });
}

/** A folder's name, as its listing and its loading message show it */
export function folderName(folder: vscode.Uri): string {
    return folder.path.replace(/\/+$/, '').split('/').pop() || folder.authority || '/';
}

export async function isFolder(uri: vscode.Uri): Promise<boolean> {
    try {
        return ((await vscode.workspace.fs.stat(uri)).type & vscode.FileType.Directory) !== 0;
    } catch {
        return false;
    }
}

/**
 * Opens something in the place of the folder view `replacing`, as a file browser does: in its
 * group, its tab closed after. Without `replacing` (a link in a Markdown file), a tab of its own.
 */
export async function openInPlaceOf(
    replacing: vscode.Uri | undefined,
    open: (viewColumn: vscode.ViewColumn | undefined) => Thenable<unknown>,
    opened?: vscode.Uri,
) {
    const current = replacing && vscode.window.tabGroups.all.flatMap(group => group.tabs)
        .find(tab => tab.input instanceof vscode.TabInputCustom && tab.input.uri.toString() === replacing.toString());
    await open(current?.group.viewColumn);
    // a link to the folder shown keeps its tab
    if (current && replacing!.toString() !== opened?.toString()) {
        try {
            await vscode.window.tabGroups.close(current);
        } catch {
            // already closed
        }
    }
}

/** Shows `folder` in the Markdown editor, in the place of the folder view `replacing` if any. */
export function openFolderView(folder: vscode.Uri, replacing?: vscode.Uri, previous?: vscode.Uri) {
    const target = folder.with({ path: folder.path.replace(/(.)\/+$/, '$1'), query: '', fragment: '' });
    const view = folderViewUri(target);
    if (previous && folderViewUri(previous).toString() !== view.toString()) {
        previousFolders.set(view.toString(), previous);
    } else {
        previousFolders.delete(view.toString());
    }
    // the page is written anew, with its "Previous" link or without, even when it was opened before
    folderViewChanged?.fire(view);
    return openInPlaceOf(replacing, viewColumn => vscode.commands.executeCommand(
        'vscode.openWith', view, 'foss-office.markdownViewer', { preview: false, viewColumn },
    ), view);
}

/**
 * The folder whose page each folder page replaced in its tab: its "Previous" link, in the listing's
 * first row. Only one step: following it opens that page without a "Previous" of its own
 * (markdownEditorProvider.ts), and a page opened otherwise (Browse Folder, a new tab, a Markdown
 * file's link) has none.
 */
const previousFolders = new Map<string, vscode.Uri>();
let folderViewChanged: vscode.EventEmitter<vscode.Uri> | undefined;

/** The folder a folder page's "Previous" link goes back to, if it has one */
export function previousFolderOf(view: vscode.Uri): vscode.Uri | undefined {
    return previousFolders.get(view.toString());
}

/** A link from one folder's page to another folder: relative, so that it resolves as the listing's links */
function relativeFolderHref(from: vscode.Uri, to: vscode.Uri): string | undefined {
    if (from.scheme !== to.scheme || from.authority !== to.authority) {
        return undefined;
    }
    const fromParts = from.path.split('/').filter(Boolean);
    const toParts = to.path.split('/').filter(Boolean);
    let common = 0;
    while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
        common++;
    }
    const up = '../'.repeat(fromParts.length - common);
    const down = toParts.slice(common).map(part => `${encodeURIComponent(part)}/`).join('');
    return up + down || undefined;
}

/** Link text: the characters Markdown would take for markup are escaped. */
function escapeText(text: string): string {
    return text.replace(/[\\`*_[\]<>#|~!]/g, '\\$&');
}

/** A `files.exclude` glob as a regular expression: `**`, `*`, `?`, `{a,b}` and `[...]`. */
export function globToRegExp(glob: string): RegExp {
    let source = '';
    let inGroup = false;
    for (let i = 0; i < glob.length; i++) {
        const char = glob[i];
        if (char === '*' && glob[i + 1] === '*') {
            // "**/" is any number of folders, none included; a final "**" is anything
            const slash = glob[i + 2] === '/';
            source += slash ? '(?:.*/)?' : '.*';
            i += slash ? 2 : 1;
        } else if (char === '*') {
            source += '[^/]*';
        } else if (char === '?') {
            source += '[^/]';
        } else if (char === '{') {
            source += '(?:';
            inGroup = true;
        } else if (char === '}' && inGroup) {
            source += ')';
            inGroup = false;
        } else if (char === ',' && inGroup) {
            source += '|';
        } else if (char === '[' && glob.indexOf(']', i + 2) > i) {
            const end = glob.indexOf(']', i + 2);
            const range = glob.slice(i + 1, end).replace(/\\/g, '\\\\');
            source += `[${range[0] === '!' ? `^${range.slice(1)}` : range}]`;
            i = end;
        } else {
            source += char.replace(/[.+^$()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${source}$`);
}

/**
 * Whether VS Code's Explorer hides an entry of `folder`: `files.exclude`, its globs relative to
 * the workspace folder, a `{ "when": "$(basename).ts" }` value only when that sibling exists.
 */
function excludedFilter(folder: vscode.Uri, names: Set<string>): (name: string) => boolean {
    const settings = vscode.workspace.getConfiguration('files', folder).get<Record<string, boolean | { when?: string }>>('exclude') ?? {};
    const rules = Object.entries(settings)
        .filter(([, value]) => value === true || (typeof value === 'object' && value !== null && typeof value.when === 'string'))
        .map(([glob, value]) => ({ pattern: globToRegExp(glob.replace(/^\.\//, '')), when: typeof value === 'object' ? value.when : undefined }));
    const root = vscode.workspace.getWorkspaceFolder(folder)?.uri.path.replace(/\/+$/, '');
    const base = folder.path.replace(/\/+$/, '');
    const relativeBase = root !== undefined && (base === root || base.startsWith(`${root}/`))
        ? base.slice(root.length + 1)
        : base.replace(/^\/+/, '');
    return (name) => {
        const path = relativeBase ? `${relativeBase}/${name}` : name;
        return rules.some(({ pattern, when }) => {
            if (!pattern.test(path)) {
                return false;
            }
            if (!when) {
                return true;
            }
            const dot = name.lastIndexOf('.');
            return names.has(when.replace(/\$\(basename\)/g, dot > 0 ? name.slice(0, dot) : name));
        });
    };
}

/** A link title in quotes: its quotes escaped, its lines kept (a table row can't hold a line break) */
function linkTitle(text: string): string {
    return text.replace(/[\\"]/g, '\\$&').replace(/\n/g, '&#10;');
}

/** The README the listing shows among a folder's entries: the first kind of READMES it has */
function pickReadme<T extends { name: string, type: vscode.FileType }>(entries: T[]) {
    const files = entries.filter(entry => (entry.type & vscode.FileType.File) !== 0 && (entry.type & vscode.FileType.Directory) === 0);
    return READMES.map(kind => ({ kind, entry: files.find(entry => kind.pattern.test(entry.name)) }))
        .find(({ entry }) => entry);
}

/**
 * Whether a folder's listing shows a Markdown README (README.md or README.markdown): without one,
 * its page has no headings worth an outline, and the outline sidebar stays closed
 * (markdownEditorProvider.ts). Entries hidden by files.exclude don't count, as in the listing.
 */
export async function folderHasMarkdownReadme(folder: vscode.Uri): Promise<boolean> {
    try {
        const all = await vscode.workspace.fs.readDirectory(folder);
        const isExcluded = excludedFilter(folder, new Set(all.map(([name]) => name)));
        const found = pickReadme(all.filter(([name]) => !isExcluded(name)).map(([name, type]) => ({ name, type })));
        return !!found?.kind.markdown;
    } catch {
        return false;
    }
}

async function folderMarkdown(folder: vscode.Uri, previous?: vscode.Uri): Promise<string> {
    const all = await vscode.workspace.fs.readDirectory(folder);
    // the entries the Explorer shows: .gitignore yes, .git and .DS_Store not (files.exclude)
    const isExcluded = excludedFilter(folder, new Set(all.map(([name]) => name)));
    const entries = all
        .filter(([name]) => !isExcluded(name))
        .map(([name, type]) => ({ name, type, isFolder: (type & vscode.FileType.Directory) !== 0 }))
        // subfolders first, then files, each in natural order (file2 before file10)
        .sort((a, b) => Number(b.isFolder) - Number(a.isFolder)
            || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    // "<name> directory" as the page's title, its listing under it
    const lines = [`# ${escapeText(i18n('markdown.folderTitle', { name: folderName(folder) }))}`, ''];
    // each link gets its icon from its kind, a folder's "/" or a file's extension (_folderView.less),
    // and a hover title telling what a click and a Ctrl/⌘+click do (resource/markdown/index.js)
    const key = typeof process !== 'undefined' && process.platform === 'darwin' ? '⌘' : 'Ctrl';
    const folderTitle = linkTitle(i18n('markdown.folderLinkTitle', { key }));
    const fileTitle = linkTitle(i18n('markdown.fileLinkTitle', { key }));
    const parentTitle = linkTitle(i18n('markdown.parentLinkTitle', { key }));
    const cell = (text: string, href: string, title: string) => `[${escapeText(text)}](${href} "${title}")`;
    const folders = entries.filter(entry => entry.isFolder)
        .map(entry => cell(`${entry.name}/`, `${encodeURIComponent(entry.name)}/`, folderTitle));
    const files = entries.filter(entry => !entry.isFolder)
        .map(entry => cell(entry.name, encodeURIComponent(entry.name), fileTitle));
    // no title: the folders column is headed by the parent folder's link, the files one by nothing
    const parent = folder.path.replace(/\/+$/, '') ? cell('..', '../', parentTitle) : '';
    // the files column is headed by the "Previous" link, when this page replaced another folder's
    const previousHref = previous && relativeFolderHref(folder, previous);
    const back = previousHref
        ? cell(i18n('markdown.folderPrevious'), previousHref, linkTitle(i18n('markdown.previousLinkTitle', { name: folderName(previous!) })))
        : '';
    lines.push(`| ${parent} | ${back} |`, '| --- | --- |');
    // folders on the left, files on the right, one of each per row
    for (let row = 0; row < Math.max(folders.length, files.length); row++) {
        lines.push(`| ${folders[row] ?? ''} | ${files[row] ?? ''} |`);
    }
    if (!entries.length) {
        lines.push('', `*${escapeText(i18n('markdown.folderEmpty'))}*`);
    }

    const found = pickReadme(entries);
    if (found?.entry) {
        const readme = found.entry;
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder, readme.name));
        const text = found.kind.markdown
            // its front matter would show in the middle of the page
            ? new TextDecoder().decode(bytes).replace(FRONT_MATTER, '')
            : plainTextBlock(bytes);
        if (text.trim()) {
            // the README shown here can't be edited: a warning says so, its link opens the file itself
            // (_folderView.less)
            const edit = `[${escapeText(i18n('markdown.folderEditReadme', { name: readme.name }))}](${encodeURIComponent(readme.name)})`;
            const LINK = '%LINK%';
            const notice = escapeText(i18n('markdown.folderReadmeNotice', { name: readme.name, link: LINK })).replace(LINK, edit);
            lines.push('', '---', '', `> [!WARNING] ${escapeText(i18n('markdown.folderReadmeNoticeTitle'))}`, `> ${notice}`, '', text);
        }
    }
    return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * A README without extension, shown as written: its text in a code block, which keeps its line
 * breaks and alignment (such files are written for a fixed-width font). Nothing for a binary file.
 */
function plainTextBlock(bytes: Uint8Array): string {
    if (bytes.includes(0)) {
        return '';
    }
    let text: string;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return '';
    }
    text = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    // a fence longer than any run of backticks in the text
    const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map(run => run.length));
    const fence = '`'.repeat(longest + 1);
    return `${fence}\n${text}\n${fence}`;
}

class FolderViewContentProvider implements vscode.TextDocumentContentProvider {
    readonly changed = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this.changed.event;

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const folder = folderOfView(uri);
        if (!folder) {
            return '';
        }
        try {
            return await folderMarkdown(folder, previousFolderOf(uri));
        } catch (error) {
            return `*${escapeText(i18n('markdown.folderUnreadable', { error: String(error) }))}*\n`;
        }
    }
}

export function registerFolderView(context: vscode.ExtensionContext) {
    const provider = new FolderViewContentProvider();
    folderViewChanged = provider.changed;
    context.subscriptions.push(
        provider.changed,
        vscode.workspace.registerTextDocumentContentProvider(FOLDER_VIEW_SCHEME, provider),
        vscode.commands.registerCommand(BROWSE_FOLDER_COMMAND, browseFolder),
    );
}

/** "Browse Folder": the Explorer's context menu on a folder, and the Command Palette */
export const BROWSE_FOLDER_COMMAND = 'office.markdown.browseFolder';

/**
 * Shows a folder's listing in the Markdown editor. From the Explorer: the folder right-clicked,
 * or each folder selected. From the Command Palette: the workspace folder, picked among several,
 * or one chosen in a dialog without a workspace.
 */
async function browseFolder(clicked?: vscode.Uri, selected?: vscode.Uri[]) {
    const folders = selected?.length ? selected : clicked ? [clicked] : [];
    if (folders.length === 0) {
        const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
        const folder = workspaceFolders.length === 1
            ? workspaceFolders[0].uri
            : workspaceFolders.length > 1
                ? (await vscode.window.showWorkspaceFolderPick())?.uri
                : (await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false }))?.[0];
        if (folder) {
            folders.push(folder);
        }
    }
    for (const folder of folders) {
        if (await isFolder(folder)) {
            await openFolderView(folder);
        }
    }
}
