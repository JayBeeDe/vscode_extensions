# Test Files

Sample files for testing the viewers by hand: open them in the Extension Development Host (F5)
and check what the tables below list.

| Folder                          | Viewer       | Generated |
| ------------------------------- | ------------ | --------- |
| [`markdown/`](markdown/)         | Markdown     | No, written by hand ([its README](markdown/README.md)) |
| [`document/`](document/)         | Document     | Yes |
| [`spreadsheet/`](spreadsheet/)   | Spreadsheet  | Yes |
| [`parquet/`](parquet/)           | Parquet      | Yes |
| [`presentation/`](presentation/) | Presentation | Yes |
| [`pdf/`](pdf/)                   | PDF          | Yes |
| [`ebook/`](ebook/)               | eBook        | Yes |
| [`xmind/`](xmind/)               | xMind        | Yes |

## Regenerating

```sh
node test/generate-samples.mjs
```

It needs `npm install`, plus [pandoc](https://pandoc.org/) and [LibreOffice](https://www.libreoffice.org/)
on the PATH. The `.docx`, `.pptx` and `.epub` files are made by pandoc from the Markdown in
[`sources/`](sources/): edit those, not the generated files. Every other file is built by the script
with the libraries the extension already uses (ExcelJS, SheetJS, hyparquet-writer, pdf-lib, JSZip).

## Document

| File            | What to check |
| --------------- | ------------- |
| `Sample.docx`   | Headings 1 to 3, bold/italic/strikethrough, sub- and superscript, a link, a footnote, a block quote, nested bullet and numbered lists, a table with aligned columns, an image, a code block, page breaks, Unicode (accents, Chinese, Japanese, Cyrillic, Arabic, emoji). Edit, save, reopen. |
| `Template.dotx` | The same document as a Word template: it opens in the same editor. |

## Spreadsheet

| File                     | What to check |
| ------------------------ | ------------- |
| `Sample.xlsx`            | **Data**: frozen header row, text, currency, dates, booleans, percentages, formulas (`=C2*D2`, `SUM`), hyperlinks, a cell note, a drop-down list validation, a line break in a cell. **Styles**: number formats (currency after and before the number, thousands, scientific, fraction, date and time, negatives in red), bold, italic, underline, strikethrough, colors, fonts, fills, borders, alignment, wrapped text, a merged cell, a tab color. **Large**: 2,000 rows × 20 columns, for scrolling. **Empty**: an empty sheet. |
| `Template.xltx`          | The same workbook as an Excel template. |
| `Sample.xls`, `Sample.ods` | The same workbook without the Large sheet, read with SheetJS: values and number formats, no styles. |
| `comma-utf8.csv`         | UTF-8, LF, comma: quoted fields holding commas, quotes and a line break, empty cells, Chinese characters. |
| `semicolon-bom-crlf.csv` | UTF-8 with a BOM, CRLF line ends, semicolon delimiter, decimal commas. Saving must keep the BOM and the CRLF. |
| `comma-windows1252.csv`  | Windows-1252 (accents, `€`): detected as a Western encoding, not UTF-8. |
| `comma-gbk.csv`          | GBK (Chinese): detected as GBK. |
| `tab.tsv`                | Tab separated. |
| `single-column.csv`      | One column, no delimiter, with a blank line that must stay. |

## Parquet

| File             | What to check |
| ---------------- | ------------- |
| `Sample.parquet` | 500 rows of INT32, INT64, DOUBLE, FLOAT, STRING (with Unicode), BOOLEAN and TIMESTAMP columns, with null values. Edit a cell, save, reopen. |

## Presentation

| File             | What to check |
| ---------------- | ------------- |
| `Sample.pptx`    | 7 slides, 4:3: a title slide, bullets with nesting and speaker notes, two columns, an image, a table, Unicode, a last slide. |
| `Slideshow.ppsx` | The same deck as a slide show, in 16:9: the slide fills a wide view without bands. |
| `Template.potx`  | The same deck as a template, dark: white text, bullets and numbers on a black background, the table's cells dark. Every colour is explicit (the master's background, each run, bullet and cell): a theme-based dark deck shows black text in this viewer and in LibreOffice's "automatic" colour. |

## PDF

| File           | What to check |
| -------------- | ------------- |
| `Document.pdf` | The document sample printed by LibreOffice: an outline (bookmarks) for the sidebar, links, an image, selectable text. |
| `Pages.pdf`    | 40 pages of mixed sizes (A4 portrait and landscape, Letter, A5), for the scrolling, spread and zoom settings. Search for `needle12` to find page 12. |

## eBook

| File          | What to check |
| ------------- | ------------- |
| `Sample.epub` | A cover, a table of contents with a nested section, a footnote, a link to another chapter, an image, a table, Unicode, a long chapter for pagination, the font, size and line height settings. |

## xMind

| File           | What to check |
| -------------- | ------------- |
| `Sample.xmind` | Two sheets. **Formats**: a root with 8 branches 3 levels deep, labels, a note and a link (Markdown), markers (Document), an image (xMind), a summary (Spreadsheet), a relationship between two topics (Document and Parquet). Edit, save, reopen in XMind. |
