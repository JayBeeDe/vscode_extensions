// Takes the README screenshots again (fo/images/screenshot-*.png), as listed in screenshots.json:
// each sample file opened in a VS Code of its own (a throwaway profile per theme), the viewer
// waited for, the steps played, then the viewer area captured at 1280x760.
//
//   npm run screenshots [-- <name|name-profile>…] [--update] [--threshold <percent>]
//
// Without --update, the new images only go to fo/sandbox/screenshots/out/, each one compared with
// the one in fo/images/. With --update, those differing from it (identical pixels below the
// threshold, 99.95% by default, out of the areas the job ignores, such as a clock) replace it.
//
// screenshots.json: `profiles` (VS Code settings per theme, `extends` another, `cacdhc` loads the
// repository's theme), and `screenshots`, each with its `name`, sample `file` (relative to fo/),
// `profiles`, and optionally: `image` (default screenshot-<name>-<profile>.png), `steps` in the
// viewer ({"click": [x, y]}, {"key": "ArrowRight"}, {"type": "text"}, each with a "wait" in ms),
// `ready` (a selector to wait for in the viewer), `ignore` (areas [x, y, width, height] left out of
// the comparison), `openFolder`, `keepLayout` (side bar and panel left as they are) and `clip` +
// `box` (a part of the workbench instead of the viewer, with a yellow box around the elements).
//
// Needs Linux with an X server or XWayland, `code`, `xdotool` and `python3`. The VS Code windows
// open on the desktop while it runs: leave the mouse and keyboard alone.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FO = path.resolve(HERE, '..');
const IMAGES = path.join(FO, 'images');
const WORK = path.join(FO, 'sandbox', 'screenshots');
const OUT = path.join(WORK, 'out');
const PORT = 9333;
const WIDTH = 1280;
const HEIGHT = 760;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// VERBOSE=1: each stage printed
const trace = (message) => { if (process.env.VERBOSE) console.error(`  ${message}`); };

// what every profile shares: VS Code reduced to the editor, nothing popping up over it
const BASE_SETTINGS = {
    'workbench.startupEditor': 'none',
    'security.workspace.trust.enabled': false,
    'update.mode': 'none',
    'extensions.autoUpdate': false,
    'extensions.autoCheckUpdates': false,
    'telemetry.telemetryLevel': 'off',
    'workbench.tips.enabled': false,
    'workbench.enableExperiments': false,
    'workbench.activityBar.location': 'hidden',
    'workbench.statusBar.visible': false,
    'workbench.editor.showTabs': 'none',
    'breadcrumbs.enabled': false,
    'window.menuBarVisibility': 'hidden',
    'window.commandCenter': false,
    'workbench.layoutControl.enabled': false,
    'window.titleBarStyle': 'custom',
    'workbench.sideBar.location': 'left',
    'explorer.openEditors.visible': 0,
    'chat.commandCenter.enabled': false,
    'chat.disableAIFeatures': true,
    'workbench.secondarySideBar.defaultVisibility': 'hidden',
    'notifications.doNotDisturbMode': true,
    'git.enabled': false,
    'editor.minimap.enabled': false,
    'window.autoDetectHighContrast': false,
    'window.autoDetectColorScheme': false,
    // the editors are never saved: a stray key press doesn't outlive the run
    'files.hotExit': 'off',
};

// ---- arguments
const argv = process.argv.slice(2);
const update = argv.includes('--update');
const thresholdAt = argv.indexOf('--threshold');
const threshold = thresholdAt >= 0 ? Number(argv[thresholdAt + 1]) : 99.95;
const wanted = argv.filter((a, i) => !a.startsWith('--') && !(thresholdAt >= 0 && i === thresholdAt + 1));

const config = JSON.parse(fs.readFileSync(path.join(HERE, 'screenshots.json'), 'utf8'));
const jobs = config.screenshots.flatMap((shot) => shot.profiles.map((profile) => ({
    ...shot,
    profile,
    image: shot.image ?? `screenshot-${shot.name}-${profile}.png`,
}))).filter((job) => !wanted.length || wanted.includes(job.name) || wanted.includes(`${job.name}-${job.profile}`));
if (!jobs.length) {
    console.error(`nothing matches ${wanted.join(' ')}: names are ${config.screenshots.map((s) => s.name).join(', ')} (or name-profile, e.g. markdown-dark)`);
    process.exit(1);
}

// ---- VS Code instances of this script
const running = () => { try { execSync(`pgrep -f "[u]ser-data-dir=${WORK}/profiles/"`); return true; } catch { return false; } };
/** every VS Code of this script stopped (a development one can start again when killed: until none is left for 3 s) */
const killAll = () => {
    for (let quiet = 0, i = 0; quiet < 6 && i < 60; i++) {
        if (running()) {
            quiet = 0;
            try { execSync(`pkill -f "[u]ser-data-dir=${WORK}/profiles/"`); } catch { /* gone meanwhile */ }
        } else {
            quiet += 1;
        }
        execSync('sleep 0.5');
    }
};
const portTaken = () => { try { return execSync('ss -ltn').toString().includes(`:${PORT} `); } catch { return false; } };
/** the --user-data-dir of the process listening on the debugging port */
const portOwner = () => {
    try {
        const line = execSync('ss -ltnp').toString().split('\n').find((l) => l.includes(`:${PORT} `));
        const pid = /pid=(\d+)/.exec(line)[1];
        return /--user-data-dir=(\S+)/.exec(fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' '))[1];
    } catch { return null; }
};

// ---- profiles
/**
 * every file pattern of fo's custom editors bound to its editor (package.json): in a new profile,
 * a file can otherwise open in the text editor, before the extension is ready
 */
const editorAssociations = () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(FO, 'package.json'), 'utf8'));
    const associations = {};
    for (const editor of pkg.contributes?.customEditors ?? []) {
        for (const { filenamePattern } of editor.selector ?? []) {
            if (filenamePattern && !(filenamePattern in associations)) associations[filenamePattern] = editor.viewType;
        }
    }
    return associations;
};

const profileSettings = (name) => {
    const profile = config.profiles[name];
    if (!profile) throw new Error(`unknown profile ${name}`);
    const parent = profile.extends ? profileSettings(profile.extends) : { settings: { ...BASE_SETTINGS, 'workbench.editorAssociations': editorAssociations() }, cacdhc: false };
    return { settings: { ...parent.settings, ...profile.settings }, cacdhc: profile.cacdhc ?? parent.cacdhc };
};

/**
 * A profile's folder, made anew for every screenshot: nothing remembered from an earlier run (a
 * viewer's last position, a toggled setting) changes what it shows
 */
const prepareProfile = (name) => {
    const dir = path.join(WORK, 'profiles', name);
    const { settings, cacdhc } = profileSettings(name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, 'User'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'User', 'settings.json'), JSON.stringify(settings, null, 2));
    return { dir, settings, cacdhc };
};

/**
 * A copy of the repository's cacdhc theme (the extension writes its theme file in place), with the
 * profile's accent color already applied, as its extension does on a setting change: the items it
 * updates (itemsToUpdate, read from its extension.js) set to that color.
 */
const prepareCacdhc = (accent) => {
    const source = path.resolve(FO, '..', 'cacdhc');
    const copy = path.join(WORK, 'cacdhc');
    fs.rmSync(copy, { recursive: true, force: true });
    fs.cpSync(source, copy, { recursive: true, filter: (p) => !p.includes(`${path.sep}images`) });
    const code = fs.readFileSync(path.join(copy, 'extension.js'), 'utf8');
    const items = [...(/const itemsToUpdate = \[([\s\S]*?)\];/.exec(code)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    if (!items.length) throw new Error('itemsToUpdate not found in cacdhc/extension.js');
    const themeFile = path.join(copy, 'themes', 'theme.json');
    const theme = JSON.parse(fs.readFileSync(themeFile, 'utf8'));
    for (const item of items) theme.colors[item] = accent.toLowerCase();
    fs.writeFileSync(themeFile, JSON.stringify(theme, null, 4));
    return copy;
};

// ---- window size, remembered between runs (the window's borders depend on the desktop)
const sizeFile = path.join(WORK, 'window.json');
const readSize = () => { try { return JSON.parse(fs.readFileSync(sizeFile, 'utf8')); } catch { return { width: WIDTH + 10, height: HEIGHT + 36 }; } };

// ---- images, compared and boxed in the workbench page (no image library needed)
const toDataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
/** share of identical pixels (each channel within 8) out of the `ignore` areas ([x, y, width, height]), or null when the sizes differ */
const similarity = (page, a, b, ignore = []) => page.evaluate(async (urlA, urlB, areas) => {
    const load = (url) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
    const [ia, ib] = await Promise.all([load(urlA), load(urlB)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return null;
    const pixels = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const [pa, pb] = [pixels(ia), pixels(ib)];
    let same = 0;
    let counted = 0;
    for (let i = 0; i < pa.length; i += 4) {
        const x = (i / 4) % ia.width;
        const y = Math.floor(i / 4 / ia.width);
        if (areas.some(([ax, ay, aw, ah]) => x >= ax && x < ax + aw && y >= ay && y < ay + ah)) continue;
        counted++;
        if (Math.abs(pa[i] - pb[i]) <= 8 && Math.abs(pa[i + 1] - pb[i + 1]) <= 8 && Math.abs(pa[i + 2] - pb[i + 2]) <= 8) same++;
    }
    return (100 * same) / counted;
}, toDataUrl(a), toDataUrl(b), ignore);
/** a yellow box (4 px, #ffff00) drawn on a PNG, returned as a PNG */
const drawBox = async (page, png, box) => Buffer.from(await page.evaluate(async (url, [x1, y1, x2, y2]) => {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    g.strokeStyle = '#ffff00'; g.lineWidth = 4; g.strokeRect(x1 + 2, y1 + 2, x2 - x1 - 4, y2 - y1 - 4);
    return c.toDataURL('image/png').split(',')[1];
}, `data:image/png;base64,${png.toString('base64')}`, box), 'base64');

// ---- one screenshot
async function capture(job) {
    trace('stopping earlier instances');
    killAll();
    for (let i = 0; i < 20 && portTaken(); i++) await sleep(500);
    if (portTaken()) throw new Error(`port ${PORT} taken by another program`);

    const profile = prepareProfile(job.profile);
    const extensionsDir = path.join(WORK, 'extensions');
    fs.mkdirSync(extensionsDir, { recursive: true });
    const devPaths = [FO, ...(profile.cacdhc ? [prepareCacdhc(profile.settings['cacdhc.accentuationColor'])] : [])];
    const file = path.join(FO, job.file);

    const codeArgs = [
        `--user-data-dir=${profile.dir}`, `--extensions-dir=${extensionsDir}`,
        ...devPaths.map((p) => `--extensionDevelopmentPath=${p}`),
        `--remote-debugging-port=${PORT}`,
        // an X11 window, through XWayland on Wayland: one the script can size
        '--ozone-platform=x11',
        '--disable-workspace-trust',
    ];
    spawn('code', [
        ...codeArgs, '--new-window',
        // the file's folder opened (openFolder): breadcrumbs showing the file name only, not its path
        ...(job.openFolder ? [path.dirname(file)] : []), file,
    ], { detached: true, stdio: 'ignore' }).unref();

    trace('VS Code started');
    let browser;
    for (let i = 0; i < 60 && !browser; i++) {
        await sleep(1000);
        try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch { /* not up yet */ }
    }
    if (!browser) throw new Error('VS Code did not start');
    if (portOwner() !== profile.dir) throw new Error(`the VS Code on port ${PORT} is not this script's ${job.profile} one: ${portOwner()}`);
    let page;
    try {
        for (let i = 0; i < 60 && !page; i++) {
            page = (await browser.pages()).find((p) => p.url().includes('workbench'));
            if (!page) await sleep(500);
        }
        if (!page) throw new Error('no workbench page');
        trace('workbench found');
        // a new profile's welcome dialog (signing in), closed
        const dismissWelcome = async () => {
            const clicked = await page.evaluate(() => {
                const button = [...document.querySelectorAll('.monaco-button, button, a')].find((b) => /continue without signing in|skip/i.test(b.textContent || ''));
                if (!button) return false;
                button.click();
                return true;
            }).catch(() => false);
            if (clicked) { trace('welcome dialog closed'); await sleep(1000); }
        };
        for (let i = 0; i < 6; i++) { await dismissWelcome(); await sleep(500); }
        // the viewer; in a new profile, the file can open before the extension is ready (in the text
        // editor): then it's closed and opened again in the same window
        const viewerShown = () => page.waitForSelector('iframe.webview', { timeout: 20000 }).then(() => true, () => false);
        for (let i = 0; !(await viewerShown()); i++) {
            if (i === 2) throw new Error('the file never opened in its viewer');
            trace('no viewer: opening the file again');
            await page.evaluate(() => document.querySelector('.part.editor')?.focus());
            await page.keyboard.down('Control'); await page.keyboard.press('w'); await page.keyboard.up('Control');
            await sleep(1000);
            spawn('code', [...codeArgs, '--reuse-window', file], { detached: true, stdio: 'ignore' }).unref();
        }
        trace('viewer found, waiting for it to load');

        // the frames of the viewer on screen (a closed editor's can linger)
        const viewerFrames = async () => {
            for (const handle of await page.$$('iframe.webview')) {
                const box = await handle.boundingBox();
                if (!box || box.width === 0) continue;
                const outer = await handle.contentFrame();
                if (!outer) return [];
                const all = [outer];
                for (let i = 0; i < all.length; i++) all.push(...all[i].childFrames());
                return all;
            }
            return [];
        };
        // the viewer loaded: its loading screen done (src/common/loadingStatus.ts), and the job's
        // ready selector, if any, found in it (some viewers paint after their loading screen)
        const waitLoaded = async () => {
            let loaded = false;
            for (let i = 0; i < 240 && !loaded; i++) {
                const states = [];
                let ready = !job.ready;
                for (const frame of await viewerFrames()) {
                    try {
                        const state = await frame.evaluate((sel) => {
                            const overlay = document.getElementById('office-loading');
                            return { done: overlay ? overlay.classList.contains('office-loading--done') : null, ready: !!sel && !!document.querySelector(sel) };
                        }, job.ready ?? null);
                        if (state.done !== null) states.push(state.done);
                        ready ||= state.ready;
                    } catch { /* a frame going away */ }
                }
                loaded = states.length > 0 && states.every(Boolean) && ready;
                if (!loaded) await sleep(500);
            }
            if (!loaded) throw new Error(`the viewer never finished loading${job.ready ? ` (ready: ${job.ready})` : ''}`);
            await sleep(3000);
        };
        await waitLoaded();
        trace('loaded');

        // the editor alone: side bar and panel closed, each focused first so that the shortcut
        // goes to VS Code, not to the viewer (Ctrl+B is bold in the Markdown editor)
        if (!job.keepLayout) {
            for (const [part, key] of [['.part.sidebar', 'b'], ['.part.panel', 'j']]) {
                const box = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e || !e.offsetWidth || !e.offsetHeight) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height - 5 }; }, part);
                if (!box) continue;
                await page.mouse.click(box.x, box.y);
                await page.keyboard.down('Control'); await page.keyboard.press(key); await page.keyboard.up('Control');
                await sleep(500);
            }
        }

        // the window sized so that the viewer is 1280x760 (unmaximized first)
        const viewerRect = () => page.evaluate(() => {
            const r = [...document.querySelectorAll('iframe.webview')].map((f) => f.getBoundingClientRect()).find((b) => b.width > 0 && b.height > 0);
            return r && { x: r.x, y: r.y, width: r.width, height: r.height };
        });
        trace('sizing the window');
        const size = readSize();
        let rect;
        for (let i = 0; i < 4; i++) {
            const ids = execSync('xdotool search --name "Extension Development Host" || true').toString().trim().split('\n').filter(Boolean);
            if (!ids.length) throw new Error('the VS Code window was not found (xdotool)');
            for (const id of ids) execSync(`python3 "${path.join(HERE, 'xunmax.py')}" ${id} ${size.width} ${size.height}`);
            await sleep(1500);
            rect = await viewerRect();
            const dw = WIDTH - Math.round(rect.width);
            const dh = HEIGHT - Math.round(rect.height);
            if (job.clip || (!dw && !dh)) break;
            size.width += dw;
            size.height += dh;
        }
        if (!job.clip && (Math.round(rect.width) !== WIDTH || Math.round(rect.height) !== HEIGHT)) {
            throw new Error(`the viewer is ${Math.round(rect.width)}x${Math.round(rect.height)}, not ${WIDTH}x${HEIGHT}`);
        }
        if (!job.clip) fs.writeFileSync(sizeFile, JSON.stringify(size));

        // the viewer loaded again at that size (Developer: Reload Webviews): some fit their content
        // to the size they open at (the xMind editor's zoom)
        trace('reloading the viewer');
        // (the focus in the viewer can keep F1: then the title bar is clicked first, for VS Code)
        for (let i = 0; ; i++) {
            if (i) {
                const bar = await page.evaluate(() => { const b = document.querySelector('.part.titlebar').getBoundingClientRect(); return { x: b.x + b.width * 0.3, y: b.y + b.height / 2 }; });
                await page.mouse.click(bar.x, bar.y);
                await sleep(300);
            }
            await page.keyboard.press('F1');
            const opened = await page.waitForSelector('.quick-input-widget input', { visible: true, timeout: 4000 }).then(() => true, () => false);
            if (opened) break;
            if (i === 2) throw new Error('the command palette did not open');
        }
        await page.keyboard.type('Developer: Reload Webviews');
        await sleep(800);
        await page.keyboard.press('Enter');
        await sleep(2000);
        await waitLoaded();
        trace('loaded again');
        const dpr = await page.evaluate(() => window.devicePixelRatio);
        if (dpr !== 1) throw new Error(`devicePixelRatio ${dpr}: the screenshots are taken at 1`);
        await sleep(1000);

        trace(`viewer ${Math.round(rect.width)}x${Math.round(rect.height)}, steps`);
        // the steps, in the viewer (clicks relative to its top left corner)
        for (const step of job.steps ?? []) {
            if (step.click) await page.mouse.click(rect.x + step.click[0], rect.y + step.click[1]);
            if (step.key) await page.keyboard.press(step.key);
            if (step.type) await page.keyboard.type(step.type);
            await sleep(step.wait ?? 400);
        }
        await sleep(1500);
        // no blinking text caret, in VS Code or the viewer: it would differ from one run to the next
        // (not in the documents the viewer shows in frames of their own: the eBook reader lays its
        // pages out again on any change of theirs)
        for (const frame of [page.mainFrame(), ...(await viewerFrames()).filter((f) => f.url().startsWith('vscode-webview:'))]) {
            try {
                await frame.evaluate(() => {
                    const style = document.createElement('style');
                    style.textContent = '*, *::before, *::after { caret-color: transparent !important; }';
                    document.head.appendChild(style);
                });
            } catch { /* a frame going away */ }
        }
        // the mouse out of the way (no hover state)
        await page.mouse.move(rect.x + rect.width + 50, rect.y + rect.height + 50);
        await sleep(500);

        const output = path.join(OUT, job.image);
        fs.mkdirSync(OUT, { recursive: true });
        if (job.clip) {
            // a part of the workbench, from its top left corner
            const origin = await page.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.x, y: b.y }; }, job.clip.part);
            let png = Buffer.from(await page.screenshot({ clip: { ...origin, width: job.clip.width, height: job.clip.height } }));
            if (job.box) {
                // the elements of the viewer to box, 8 px around them
                let found = null;
                for (const frame of await viewerFrames()) {
                    try {
                        found = found ?? await frame.evaluate((selectors) => {
                            const rects = selectors.map((s) => document.querySelector(s)?.getBoundingClientRect()).filter(Boolean);
                            return rects.length === selectors.length ? { left: Math.min(...rects.map((b) => b.left)), top: Math.min(...rects.map((b) => b.top)), right: Math.max(...rects.map((b) => b.right)), bottom: Math.max(...rects.map((b) => b.bottom)) } : null;
                        }, job.box);
                    } catch { /* gone */ }
                }
                if (!found) throw new Error(`not found in the viewer: ${job.box.join(', ')}`);
                const box = [found.left + rect.x - origin.x - 8, found.top + rect.y - origin.y - 8, found.right + rect.x - origin.x + 8, found.bottom + rect.y - origin.y + 8].map(Math.round);
                png = await drawBox(page, png, box);
            }
            fs.writeFileSync(output, png);
        } else {
            await page.screenshot({ path: output, clip: rect });
        }

        const current = path.join(IMAGES, job.image);
        const same = fs.existsSync(current) ? await similarity(page, current, output, job.ignore) : null;
        return { output, current, same };
    } catch (e) {
        // what the window showed, for the failure's cause
        if (page) {
            fs.mkdirSync(OUT, { recursive: true });
            const shot = path.join(OUT, `failed-${job.name}-${job.profile}.png`);
            try { await page.screenshot({ path: shot }); e.message += ` (the window: ${path.relative(process.cwd(), shot)})`; } catch { /* window gone */ }
        }
        throw e;
    } finally {
        browser.disconnect();
        killAll();
    }
}

// ---- all of them
const results = [];
for (const job of jobs) {
    const label = `${job.name}-${job.profile}`;
    try {
        // a second try when the first fails (a profile's very first start can miss opening the file)
        const { output, current, same } = await capture(job).catch((e) => {
            console.log(`${label.padEnd(22)} failed once (${e.message}), trying again`);
            return capture(job);
        });
        let action = 'kept';
        if (same === null || same < threshold) {
            action = update ? 'replaced' : 'differs';
            if (update) fs.copyFileSync(output, current);
        }
        const note = same === null ? 'new or of another size' : `${same.toFixed(3)}% identical`;
        results.push(`${label.padEnd(22)} ${note.padEnd(24)} ${action}`);
        console.log(results.at(-1));
    } catch (e) {
        results.push(`${label.padEnd(22)} FAILED: ${e.message}`);
        console.log(results.at(-1));
        killAll();
    }
}
console.log(`\n${results.join('\n')}\n\nNew images in ${path.relative(process.cwd(), OUT) || '.'}${update ? '; those differing copied to images/' : '; --update copies those differing to images/'}`);
process.exit(results.some((r) => r.includes('FAILED')) ? 1 : 0);
