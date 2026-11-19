/**
 * Generates the sample files used to test the viewers by hand (see test/README.md).
 *
 *     node test/generate-samples.mjs
 *
 * Needs `npm install` (ExcelJS, SheetJS, hyparquet-writer, pdf-lib, JSZip, iconv-lite), plus pandoc
 * (.docx, .pptx, .epub) and LibreOffice (the .pdf made from the .docx) on the PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parquetWriteBuffer } from 'hyparquet-writer';

const require = createRequire(import.meta.url);
const ExcelJS = await loadExcelJs();
const XLSX = require('xlsx');
const JSZip = require('jszip');
const iconv = require('iconv-lite');
const { PDFDocument, PageSizes, StandardFonts, rgb } = require('pdf-lib');

/** The ExcelJS fork the extension uses ships only a browser build: bundled for Node with esbuild. */
async function loadExcelJs() {
    const { build } = require('esbuild');
    const dir = mkdtempSync(join(tmpdir(), 'fo-exceljs-'));
    try {
        const outfile = join(dir, 'exceljs.cjs');
        await build({
            stdin: { contents: "module.exports = require('@cweijan/exceljs');", resolveDir: dirname(fileURLToPath(import.meta.url)) },
            bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error',
        });
        const module = require(outfile);
        return module.default ?? module;
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const testDir = dirname(fileURLToPath(import.meta.url));
const sourcesDir = join(testDir, 'sources');
const imagesDir = join(testDir, '..', 'images');

const output = (folder, name) => {
    mkdirSync(join(testDir, folder), { recursive: true });
    return join(testDir, folder, name);
};

const write = (folder, name, data) => {
    writeFileSync(output(folder, name), data);
    console.log(`  ${folder}/${name}`);
};

const run = (command, args, cwd = sourcesDir) => execFileSync(command, args, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });

/**
 * An OOXML file of another kind (template, slide show) is the same package with another content
 * type for its main part.
 */
async function withMainContentType(buffer, part, contentType) {
    const zip = await JSZip.loadAsync(buffer);
    const types = await zip.file('[Content_Types].xml').async('string');
    const pattern = new RegExp(`(<Override[^>]*PartName="${part}"[^>]*ContentType=")[^"]*(")`);
    if (!pattern.test(types)) {
        throw new Error(`no content type for ${part}`);
    }
    zip.file('[Content_Types].xml', types.replace(pattern, `$1${contentType}$2`));
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ---------------------------------------------------------------------------------------------
// Document: .docx, .dotx (pandoc), and the .pdf made from it (LibreOffice)
// ---------------------------------------------------------------------------------------------

async function documents() {
    const docx = output('document', 'Sample.docx');
    run('pandoc', ['document.md', '--resource-path=.', '-o', docx]);
    console.log('  document/Sample.docx');
    write('document', 'Template.dotx', await withMainContentType(readFileSync(docx), '/word/document.xml',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml'));

    // a separate profile, so that a running LibreOffice does not get the conversion
    const profile = mkdtempSync(join(tmpdir(), 'fo-samples-'));
    try {
        run('soffice', [`-env:UserInstallation=file://${profile}`, '--headless', '--convert-to',
            'pdf:writer_pdf_Export:{"ExportBookmarks":{"type":"boolean","value":"true"}}',
            '--outdir', profile, docx]);
        renameSync(join(profile, 'Sample.pdf'), output('pdf', 'Document.pdf'));
        console.log('  pdf/Document.pdf');
    } finally {
        rmSync(profile, { recursive: true, force: true });
    }
}

// ---------------------------------------------------------------------------------------------
// PDF: many pages of mixed sizes and orientations (pdf-lib)
// ---------------------------------------------------------------------------------------------

async function pdfPages() {
    const pdf = await PDFDocument.create();
    pdf.setTitle('foss-office PDF Pages Test');
    pdf.setAuthor('foss-office');
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const logo = await pdf.embedPng(readFileSync(join(imagesDir, 'logo.png')));
    const sizes = [
        ['A4 portrait', PageSizes.A4],
        ['A4 landscape', [PageSizes.A4[1], PageSizes.A4[0]]],
        ['Letter portrait', PageSizes.Letter],
        ['A5 portrait', PageSizes.A5],
    ];
    const pageCount = 40;
    for (let index = 0; index < pageCount; index++) {
        const [label, [width, height]] = sizes[index % sizes.length];
        const page = pdf.addPage([width, height]);
        page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: rgb(0.17, 0.49, 0.89), borderWidth: 2 });
        page.drawText(`Page ${index + 1} of ${pageCount}`, { x: 50, y: height - 80, size: 32, font: bold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(label, { x: 50, y: height - 115, size: 18, font, color: rgb(0.35, 0.35, 0.35) });
        page.drawText(`Selectable text for the selection tool, page ${index + 1}. Search for: needle${index + 1}`,
            { x: 50, y: height - 150, size: 11, font });
        if (index % 2 === 0) {
            const size = Math.min(width, height) / 3;
            page.drawImage(logo, { x: (width - size) / 2, y: (height - size) / 2 - 40, width: size, height: size });
        }
    }
    write('pdf', 'Pages.pdf', await pdf.save());
}

// ---------------------------------------------------------------------------------------------
// Presentation: .pptx (pandoc), .ppsx and .potx (other content types)
// ---------------------------------------------------------------------------------------------

async function presentations() {
    const pptx = output('presentation', 'Sample.pptx');
    run('pandoc', ['presentation.md', '--resource-path=.', '-o', pptx]);
    console.log('  presentation/Sample.pptx');
    const buffer = readFileSync(pptx);
    write('presentation', 'Slideshow.ppsx', await withMainContentType(buffer, '/ppt/presentation.xml',
        'application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml'));
    write('presentation', 'Template.potx', await withMainContentType(buffer, '/ppt/presentation.xml',
        'application/vnd.openxmlformats-officedocument.presentationml.template.main+xml'));
}

// ---------------------------------------------------------------------------------------------
// eBook: .epub (pandoc)
// ---------------------------------------------------------------------------------------------

function ebooks() {
    const epub = output('ebook', 'Sample.epub');
    run('pandoc', ['ebook.md', '--toc', '--resource-path=.', `--epub-cover-image=${join(imagesDir, 'logo.png')}`, '-o', epub]);
    console.log('  ebook/Sample.epub');
}

// ---------------------------------------------------------------------------------------------
// Spreadsheet: .xlsx, .xltx (ExcelJS), .xls, .ods (SheetJS), .csv, .tsv
// ---------------------------------------------------------------------------------------------

async function spreadsheets() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'foss-office';
    workbook.created = new Date(Date.UTC(2026, 10, 19));

    // value types and formulas
    const data = workbook.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1 }] });
    data.columns = [
        { header: 'Product', key: 'product', width: 22 },
        { header: 'Category', key: 'category', width: 14 },
        { header: 'Price', key: 'price', width: 10 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Total', key: 'total', width: 12 },
        { header: 'Released', key: 'released', width: 12 },
        { header: 'In stock', key: 'stock', width: 10 },
        { header: 'Ratio', key: 'ratio', width: 10 },
        { header: 'Link', key: 'link', width: 26 },
    ];
    const products = [
        ['Notebook', 'Paper', 3.5, 120, '2024-01-15', true, 0.42],
        ['Fountain pen', 'Writing', 24.9, 15, '2023-06-01', true, 0.08],
        ['Stapler', 'Office', 12, 0, '2022-11-30', false, 0],
        ['Café crème mug ☕', 'Kitchen', 8.75, 48, '2025-03-08', true, 0.25],
        ['日本語のノート', 'Paper', 5.2, 60, '2025-09-21', true, 0.19],
        ['Line\nbreak in cell', 'Misc', 1, 1, '2026-01-01', false, 0.01],
    ];
    products.forEach(([product, category, price, quantity, released, stock, ratio], index) => {
        const row = index + 2;
        data.addRow({
            product, category, price, quantity, stock, ratio,
            total: { formula: `C${row}*D${row}`, result: price * quantity },
            released: new Date(`${released}T00:00:00Z`),
            link: { text: 'foss-office on GitHub', hyperlink: 'https://github.com/JayBeeDe/vscode_extensions' },
        });
        // the formats go on the data cells: a column style would format the header too
        for (const [column, numFmt] of [['C', '"$"#,##0.00'], ['E', '"$"#,##0.00'], ['F', 'yyyy-mm-dd'], ['H', '0.0%']]) {
            data.getCell(`${column}${row}`).numFmt = numFmt;
        }
        data.getRow(row).alignment = { vertical: 'top', wrapText: true };
    });
    const last = products.length + 1;
    const totals = data.addRow({ product: 'Total', quantity: { formula: `SUM(D2:D${last})` }, total: { formula: `SUM(E2:E${last})` } });
    totals.font = { bold: true };
    totals.getCell('total').numFmt = '"$"#,##0.00';
    data.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    data.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B7EE2' } };
    data.getCell(`B${last + 3}`).value = 'A comment is attached to this cell';
    data.getCell(`B${last + 3}`).note = 'A cell note (comment).';
    data.getCell(`B${last + 4}`).value = 'List validation:';
    data.getCell(`C${last + 4}`).value = 'Paper';
    data.getCell(`C${last + 4}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Paper,Writing,Office,Kitchen,Misc"'] };

    // styles
    const styles = workbook.addWorksheet('Styles', { properties: { tabColor: { argb: 'FFE2732B' } } });
    styles.getColumn(1).width = 28;
    styles.getColumn(2).width = 18;
    styles.getColumn(3).width = 18;
    const styled = [
        ['Bold', { font: { bold: true } }],
        ['Italic', { font: { italic: true } }],
        ['Underline', { font: { underline: true } }],
        ['Strikethrough', { font: { strike: true } }],
        ['Red text, 14 pt', { font: { color: { argb: 'FFD32F2F' }, size: 14 } }],
        ['Serif font', { font: { name: 'Times New Roman' } }],
        ['Yellow fill', { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } } }],
        ['Thin borders', { border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } }],
        ['Thick red bottom border', { border: { bottom: { style: 'thick', color: { argb: 'FFD32F2F' } } } }],
        ['Centered', { alignment: { horizontal: 'center' } }],
        ['Right aligned', { alignment: { horizontal: 'right' } }],
        ['Wrapped text: this sentence is long enough to wrap inside its cell', { alignment: { wrapText: true, vertical: 'top' } }],
    ];
    // number formats, on numbers
    const formats = [
        ['Currency after the number', 1234.5, '#,##0.00 €'],
        ['Currency before the number', 1234.5, '"$"#,##0.00'],
        ['Thousands separator', 1234567, '#,##0'],
        ['Scientific', 0.000123, '0.00E+00'],
        ['Fraction', 0.75, '# ?/?'],
        ['Date and time', new Date(Date.UTC(2026, 10, 19, 14, 30)), 'dd/mm/yyyy hh:mm'],
        ['Negative in red', -42, '#,##0;[Red]-#,##0'],
    ];
    styles.getColumn(5).width = 28;
    styles.getColumn(6).width = 18;
    formats.forEach(([label, value, numFmt], index) => {
        styles.getCell(index + 1, 5).value = label;
        styles.getCell(index + 1, 6).value = value;
        styles.getCell(index + 1, 6).numFmt = numFmt;
    });
    styled.forEach(([text, style], index) => {
        const cell = styles.getCell(index + 1, 1);
        cell.value = text;
        Object.assign(cell, style);
    });
    styles.getCell('B1').value = 'Merged B1:C3';
    styles.mergeCells('B1:C3');
    styles.getCell('B1').alignment = { horizontal: 'center', vertical: 'middle' };
    styles.getCell('B1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } };
    styles.getRow(12).height = 45;

    // many rows, for scrolling and performance
    const large = workbook.addWorksheet('Large');
    const columns = 20;
    large.addRow(Array.from({ length: columns }, (_, column) => `Column ${column + 1}`)).font = { bold: true };
    for (let row = 1; row <= 2000; row++) {
        large.addRow(Array.from({ length: columns }, (_, column) => (column === 0 ? `Row ${row}` : row * (column + 1))));
    }

    workbook.addWorksheet('Empty');

    const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
    write('spreadsheet', 'Sample.xlsx', xlsx);
    write('spreadsheet', 'Template.xltx', await withMainContentType(xlsx, '/xl/workbook.xml',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml'));

    // the SheetJS formats keep the values and number formats, not the styles
    const sheetJs = XLSX.read(xlsx, { type: 'buffer', cellNF: true });
    // the large sheet stays in the .xlsx: SheetJS's .ods of it weighs several megabytes
    delete sheetJs.Sheets.Large;
    sheetJs.SheetNames = sheetJs.SheetNames.filter((name) => name !== 'Large');
    write('spreadsheet', 'Sample.xls', XLSX.write(sheetJs, { type: 'buffer', bookType: 'biff8' }));
    write('spreadsheet', 'Sample.ods', XLSX.write(sheetJs, { type: 'buffer', bookType: 'ods' }));

    // CSV: quoting, encodings, delimiters, line ends
    const csvRows = [
        ['id', 'name', 'city', 'amount', 'note'],
        ['1', 'Alice', 'Paris', '1250.50', 'plain'],
        ['2', 'Bob, Jr.', 'Lyon', '-42', '"comma" in the name, quotes in the note'],
        ['3', 'Chloé', 'Montréal', '0', 'line\nbreak inside a quoted field'],
        ['4', '', 'Zürich', '', 'empty cells'],
        ['5', '王小明', '北京', '3.14159', 'Chinese characters'],
        ['6', 'Émile', 'Besançon', '1e6', 'café, crème, œuf, €'],
    ];
    const quote = (field, delimiter) => (/["\n\r]/.test(field) || field.includes(delimiter) ? `"${field.replace(/"/g, '""')}"` : field);
    const toCsv = (rows, delimiter, eol) => rows.map((row) => row.map((field) => quote(field, delimiter)).join(delimiter)).join(eol) + eol;

    write('spreadsheet', 'comma-utf8.csv', toCsv(csvRows, ',', '\n'));
    write('spreadsheet', 'semicolon-bom-crlf.csv', '﻿' + toCsv(csvRows.map((row) => row.map((field) => (/^-?\d+\.\d+$/.test(field) ? field.replace('.', ',') : field))), ';', '\r\n'));
    // Windows-1252 has no Chinese characters
    const western = csvRows.filter((row) => !/[一-鿿]/.test(row.join('')));
    write('spreadsheet', 'comma-windows1252.csv', iconv.encode(toCsv(western, ',', '\r\n'), 'win1252'));
    write('spreadsheet', 'comma-gbk.csv', iconv.encode(toCsv([
        ['编号', '姓名', '城市', '金额'],
        ['1', '王小明', '北京', '1250.50'],
        ['2', '李华', '上海', '-42'],
        ['3', '张伟', '广州', '0'],
    ], ',', '\n'), 'gbk'));
    write('spreadsheet', 'tab.tsv', csvRows.map((row) => row.map((field) => quote(field, '\t')).join('\t')).join('\n') + '\n');
    write('spreadsheet', 'single-column.csv', 'value\nfirst\nsecond\n\nafter a blank line\n');
}

// ---------------------------------------------------------------------------------------------
// Parquet (hyparquet-writer)
// ---------------------------------------------------------------------------------------------

function parquet() {
    const count = 500;
    const index = Array.from({ length: count }, (_, i) => i);
    const cities = ['Paris', 'Lyon', 'Montréal', 'Zürich', '北京', 'São Paulo', null];
    const buffer = parquetWriteBuffer({
        columnData: [
            { name: 'id', data: index.map((i) => i + 1), type: 'INT32' },
            { name: 'big_number', data: index.map((i) => BigInt(i) * 1000000007n), type: 'INT64' },
            { name: 'price', data: index.map((i) => Math.round(i * 137.31) / 100), type: 'DOUBLE' },
            // eighths: exact in a 32-bit float
            { name: 'ratio', data: index.map((i) => (i % 8) / 8), type: 'FLOAT' },
            { name: 'name', data: index.map((i) => `Item ${i + 1}`), type: 'STRING' },
            { name: 'city', data: index.map((i) => cities[i % cities.length]), type: 'STRING' },
            { name: 'active', data: index.map((i) => i % 3 !== 0), type: 'BOOLEAN' },
            { name: 'created', data: index.map((i) => new Date(Date.UTC(2026, 0, 1) + i * 3600000)), type: 'TIMESTAMP' },
            { name: 'note', data: index.map((i) => (i % 5 === 0 ? null : `note ${i}`)), type: 'STRING' },
        ],
    });
    write('parquet', 'Sample.parquet', Buffer.from(buffer));
}

// ---------------------------------------------------------------------------------------------
// xMind: an XMind Zen package (content.json) with two sheets (JSZip)
// ---------------------------------------------------------------------------------------------

async function xmind() {
    let next = 0;
    const id = () => `topic-${++next}`;
    const topic = (title, extra = {}, children = []) => ({
        id: id(),
        title,
        ...extra,
        ...(children.length ? { children: { attached: children } } : {}),
    });
    const formats = ['Markdown', 'Document', 'Spreadsheet', 'Parquet', 'Presentation', 'PDF', 'eBook', 'xMind'];
    const formatTopics = formats.map((format) => topic(format, {}, [
        topic(`${format} viewer`),
        topic('Sample files', {}, [topic('Opens'), topic('Saves')]),
    ]));
    // a note, labels, a link, markers and an image on some topics
    Object.assign(formatTopics[0], {
        notes: { plain: { content: 'A note on the Markdown topic.' } },
        labels: ['editor', 'wysiwyg'],
        href: 'https://github.com/JayBeeDe/vscode_extensions',
    });
    Object.assign(formatTopics[1], { markers: [{ markerId: 'priority-1' }, { markerId: 'task-done' }] });
    Object.assign(formatTopics[7], { image: { src: 'xap:resources/xmind.png', width: 64, height: 64 } });
    formatTopics[2].children.summary = [topic('Summary of the spreadsheet topics')];
    formatTopics[2].summaries = [{ id: id(), range: '(0,1)', topicId: formatTopics[2].children.summary[0].id }];

    const root = topic('foss-office', { structureClass: 'org.xmind.ui.map.unbalanced' }, formatTopics);
    const sheets = [
        {
            id: 'sheet-1',
            class: 'sheet',
            title: 'Formats',
            rootTopic: root,
            relationships: [{ id: id(), end1Id: formatTopics[1].id, end2Id: formatTopics[3].id, title: 'both editable' }],
        },
        {
            id: 'sheet-2',
            class: 'sheet',
            title: 'Second sheet',
            rootTopic: topic('Another map', {}, [topic('Left'), topic('Right', {}, [topic('Deeper')])]),
        },
    ];

    const zip = new JSZip();
    zip.file('content.json', JSON.stringify(sheets, null, 2));
    zip.file('metadata.json', JSON.stringify({ creator: { name: 'foss-office test samples' } }));
    zip.file('manifest.json', JSON.stringify({
        'file-entries': { 'content.json': {}, 'metadata.json': {}, 'resources/xmind.png': {} },
    }));
    zip.file('resources/xmind.png', readFileSync(join(imagesDir, 'xmind.png')));
    write('xmind', 'Sample.xmind', await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

console.log('Generating the sample files in test/:');
await documents();
await pdfPages();
await presentations();
ebooks();
await spreadsheets();
parquet();
await xmind();
