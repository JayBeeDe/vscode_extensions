# Mermaid mindmap ⇄ XMind in the markdown editor

## Context
The `fo` extension edits Markdown (vditor webview) and XMind files (mind-elixir viewer) separately. The user wants to convert between the two from the markdown editor:
- **Mermaid → XMind**: export a ```` ```mermaid ```` `mindmap` block to a `.xmind` file.
- **XMind → Mermaid**: insert an `.xmind` file into the document as mermaid `mindmap` block(s).

Decisions: only `mindmap` diagrams (the tree maps one-to-one onto XMind topics). Import goes through a toolbar button that opens a file picker and inserts the block(s) at the cursor, one block per sheet.

## Approach
Do the conversion in the **extension host** with a pure, platform-neutral module, so it works on desktop and web and can be unit tested. Messages use the existing `handler.emit`/`handler.on` bridge.

### 1. Converter: `src/service/markdown/mermaidXmind.ts` (new)
- `parseMermaidMindmap(code): MindTree`: an indentation-based parser. It ignores the `mindmap` header, `%%` comments, `::icon(...)` lines and `:::class` suffixes. Node shapes `id[t]`, `id(t)`, `id((t))`, `id))t((`, `id)t(`, `id{{t}}`, `"`markdown`"` strings and bare text give the title. The shape is kept in a small `shape` field so a round trip can restore it. It throws a clear error when there are several roots or no root.
- `mindTreeToXmind(tree, title): Promise<Uint8Array>`: builds a Zen package with `jszip` (`content.json` with one sheet and a rootTopic/children `attached`, plus `metadata.json` and `manifest.json`). It mirrors what `writeZenPackage` in `src/react/view/xmind/xmindParser.ts:364` writes: reuse the same manifest layout and creator `foss-office`.
- `xmindToMermaid(buffer): Promise<{title, code}[]>`: uses `importXMindFile` from `@mind-elixir/import-xmind`, which already handles Zen `content.json` and XMind 8 `content.xml` through fast-xml-parser and needs no DOM. It walks `rootTopic.children.attached` (detached/floating topics are skipped). Output: `mindmap\n  root((Title))\n    child…` with titles escaped. A title containing brackets or parentheses, or spanning several lines, is quoted as `"…"`. It also applies the "number-like title" fix (`String(title)`), like `restoreXmind8Details`.
- Lost in the conversion, and to say so in the README: images, notes, markers, relationships, summaries, styles. Only titles and hierarchy are kept.

### 2. Mermaid → XMind (export button on the diagram)
- `vditor/src/ts/markdown/mermaidChrome.ts`: add a second button (codicon `export`, i18n `exportXmind`) next to `copyBtn`. Show it only when the source, obtained as in `mermaidRender.ts:52` (`data-mermaid` attr / `mermaidRenderAdapter.getCode`), matches `/^\s*mindmap\b/`. On click it calls a new vditor option `vditor.options.onMermaidExport?.({ code, format: "xmind" })`. Declare it in `vditor/src/types/index.d.ts`, like `onLinkClick`.
- `resource/markdown/index.js`: pass `onMermaidExport: (p) => handler.emit("mermaidToXmind", p.code)`.
- `src/provider/markdownEditorProvider.ts`: `.on("mermaidToXmind", …)` runs `parseMermaidMindmap` and then `mindTreeToXmind`. It opens `showSaveDialog` with the default `<mdName>-<rootTitle>.xmind` next to the md file and an `.xmind` filter, writes with `workspace.fs.writeFile`, and shows an info message with an "Open" action (`vscode.openWith`). Follow the dialog pattern in `saveContentAs` in `src/provider/handlers/commonHandler.ts:85`. Errors go to `showErrorMessage`.

### 3. XMind → Mermaid (toolbar insert)
- `resource/markdown/util.js` `getToolbar`: add an item `{ name: 'insert-xmind', tip: i18n.insertXmind, icon: codicon('type-hierarchy'), click: () => handler.emit('insertXmind') }` after `"code"`. Hide it in read-only/folder views, as the other edit items are hidden.
- `markdownEditorProvider.ts`: `.on("insertXmind", …)` opens `showOpenDialog({ filters: { XMind: ['xmind'] } })`, reads the file and calls `xmindToMermaid`. Each sheet becomes ```` ```mermaid\n<code>\n``` ````, preceded by a `**Sheet title**` line when there are several sheets. The result is sent back through the existing `handler.emit('insertImageMarkdown', md)` → `editor.insertMarkdown` (`resource/markdown/index.js:353`), or a renamed generic `insertMarkdown` event that both use.

### 4. i18n
- New keys `exportXmind` and `insertXmind`, plus host messages (`xmindExported`, `mermaidNotMindmap`, `xmindImportFailed`), in `vditor/src/js/i18n/*.js` (webview strings) and `fo/i18n/{en,fr,de,es,ja,pt,ru,zh}.json` (host strings and toolbar tips, as for `editInVscode`).

### 5. Docs
- `fo/README.md`: a short section on the feature and what is lost in the conversion.

## Critical files
- new `fo/src/service/markdown/mermaidXmind.ts`
- `fo/src/provider/markdownEditorProvider.ts`
- `fo/vditor/src/ts/markdown/mermaidChrome.ts`, `fo/vditor/src/types/index.d.ts`
- `fo/resource/markdown/index.js`, `fo/resource/markdown/util.js`
- i18n files, README

## Verification
1. Unit check of the converter: a round trip on `fo/test/xmind/Sample.xmind` (xmind → mermaid → xmind → mermaid) gives the same text the second time. A mermaid sample with every node shape parses to the expected titles and depth.
2. Build (`npm run build` in `fo/`, including the vditor bundle) and launch the Extension Development Host:
   - Add a `mindmap` block to a test md file → the export button shows (and is absent on a flowchart) → save `.xmind` → it opens in the extension's XMind viewer with the same tree. Also check it opens in XMind itself if available.
   - Use the toolbar "Insert XMind" on `test/xmind/Sample.xmind` → mermaid blocks are inserted and render. Undo removes them.
   - The web build (`extension.web.ts`) still compiles; no Node-only APIs are used in the converter.
