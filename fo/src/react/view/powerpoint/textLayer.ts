/**
 * Selectable text over the slide canvas, as in the PDF viewer: pptxviewjs has no text API, so the
 * text it draws with the canvas's fillText is recorded during a render, then laid out as
 * transparent spans at the same place, with the same font and transform. Chart labels are drawn
 * through another canvas and are not recorded.
 */

interface TextRun {
    text: string;
    font: string;
    /** the context transform (canvas pixels) when the text was drawn */
    matrix: DOMMatrix;
    /** the text box in the run's own coordinates: left, top of the font box, baseline */
    x: number;
    y: number;
    baseline: number;
    width: number;
    height: number;
}

export interface TextRecorder {
    start(): void;
    stop(): TextRun[];
}

const recorders = new WeakMap<HTMLCanvasElement, TextRecorder>();

/** Records what the canvas's own fillText draws between start() and stop(); its drawing is unchanged. */
export function textRecorder(canvas: HTMLCanvasElement): TextRecorder | null {
    const existing = recorders.get(canvas);
    if (existing) return existing;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const nativeFillText = context.fillText;
    let runs: TextRun[] | null = null;
    context.fillText = function (this: CanvasRenderingContext2D, ...args: Parameters<CanvasRenderingContext2D['fillText']>) {
        const [text, x, y, maxWidth] = args;
        if (runs && typeof text === 'string' && text.trim() && Number.isFinite(x) && Number.isFinite(y)) {
            try {
                runs.push(measureRun(this, text, x, y, typeof maxWidth === 'number' ? maxWidth : undefined));
            } catch {
                // the text is still drawn, just not selectable
            }
        }
        return nativeFillText.apply(this, args);
    };
    const recorder: TextRecorder = {
        start() { runs = []; },
        stop() {
            const recorded = runs ?? [];
            runs = null;
            return recorded;
        },
    };
    recorders.set(canvas, recorder);
    return recorder;
}

function measureRun(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number): TextRun {
    const metrics = context.measureText(text);
    let width = metrics.width;
    if (maxWidth !== undefined && maxWidth > 0 && maxWidth < width) width = maxWidth;
    const rtl = context.direction === 'rtl';
    const align = context.textAlign;
    let left = x;
    if (align === 'center') left -= width / 2;
    else if (align === 'right' || (align === 'end' && !rtl) || (align === 'start' && rtl)) left -= width;
    // relative to the current textBaseline, whatever it is
    const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
    return {
        text,
        font: context.font,
        matrix: context.getTransform(),
        x: left,
        y: y - ascent,
        baseline: y,
        width,
        height: ascent + descent,
    };
}

function sameMatrix(a: DOMMatrix, b: DOMMatrix): boolean {
    return Math.abs(a.a - b.a) < 1e-6 && Math.abs(a.b - b.b) < 1e-6 && Math.abs(a.c - b.c) < 1e-6
        && Math.abs(a.d - b.d) < 1e-6 && Math.abs(a.e - b.e) < 1e-3 && Math.abs(a.f - b.f) < 1e-3;
}

/**
 * Joins the pieces drawn one after another on the same line (a letter-spaced word is drawn one
 * character at a time), so that a selection copies words, not letters.
 */
function mergeRuns(runs: TextRun[]): TextRun[] {
    const merged: TextRun[] = [];
    for (const run of runs) {
        const last = merged[merged.length - 1];
        const gap = last ? run.x - (last.x + last.width) : 0;
        if (last && last.font === run.font && sameMatrix(last.matrix, run.matrix)
            && Math.abs(last.baseline - run.baseline) < 0.5 && gap > -1 && gap < run.height * 0.6) {
            const space = gap > run.height * 0.15 && !/\s$/.test(last.text) && !/^\s/.test(run.text) ? ' ' : '';
            last.text += space + run.text;
            last.width = run.x + run.width - last.x;
            continue;
        }
        merged.push({ ...run });
    }
    return merged;
}

/** Replaces the layer's text with the runs recorded for the slide drawn on `canvas`. */
export function renderTextLayer(layer: HTMLElement, canvas: HTMLCanvasElement, recorded: TextRun[]) {
    layer.replaceChildren();
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (!cssWidth || !cssHeight || !canvas.width) return;
    layer.style.width = `${cssWidth}px`;
    layer.style.height = `${cssHeight}px`;
    // canvas pixels per CSS pixel
    const ratio = canvas.width / cssWidth;

    const runs = mergeRuns(recorded);
    const spans: HTMLSpanElement[] = [];
    let previous: { run: TextRun; end: DOMPoint } | null = null;
    for (const run of runs) {
        const { a, b, c, d, e, f } = run.matrix;
        const start = run.matrix.transformPoint(new DOMPoint(run.x, run.baseline));
        if (previous) {
            // a line break between lines, a space between pieces of a line, so that a copy reads right
            const lineHeight = Math.max(run.height, previous.run.height) * Math.hypot(c, d);
            if (Math.abs(start.y - previous.end.y) > lineHeight * 0.5 || start.x < previous.end.x - lineHeight) {
                layer.append(document.createElement('br'));
            } else if (!/\s$/.test(previous.run.text)) {
                layer.append(' ');
            }
        }
        const span = document.createElement('span');
        span.textContent = run.text;
        span.style.font = run.font;
        span.style.lineHeight = `${run.height}px`;
        span.style.height = `${run.height}px`;
        span.style.transform = `matrix(${a / ratio}, ${b / ratio}, ${c / ratio}, ${d / ratio}, ${e / ratio}, ${f / ratio}) translate(${run.x}px, ${run.y}px)`;
        span.dataset.width = String(run.width);
        layer.append(span);
        spans.push(span);
        previous = { run, end: run.matrix.transformPoint(new DOMPoint(run.x + run.width, run.baseline)) };
    }
    // the DOM font can differ slightly from the canvas one: stretch each span to the drawn width
    const widths = spans.map(span => span.offsetWidth);
    spans.forEach((span, index) => {
        const drawn = Number(span.dataset.width);
        if (widths[index] > 0 && drawn > 0) span.style.transform += ` scaleX(${drawn / widths[index]})`;
    });
}

/** Ctrl+A in the slide: its text only, not the whole page. */
export function selectTextLayer(layer: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || !layer.firstChild) return;
    const range = document.createRange();
    range.selectNodeContents(layer);
    selection.removeAllRanges();
    selection.addRange(range);
}
