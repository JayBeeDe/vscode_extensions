import { Handler } from '@/common/handler';
import * as vscode from 'vscode';

const CLOCK_FORMAT = 'presentation.clockFormat';

/**
 * `foss-office.presentation.clockFormat`: the pattern of the clock under the slide list, or `auto`
 * (also when empty) to follow the VS Code language. A webview only knows that language, not the
 * OS regional format.
 */
export function getPresentationClockFormat(): string {
    const value = vscode.workspace.getConfiguration('foss-office').get(CLOCK_FORMAT);
    return typeof value === 'string' && value.trim() ? value : 'auto';
}

/** Sends `presentationClockFormat` to the viewer whenever the setting changes. */
export function bindPresentationSettings(handler: Handler) {
    const subscription = vscode.workspace.onDidChangeConfiguration((change) => {
        if (change.affectsConfiguration(`foss-office.${CLOCK_FORMAT}`)) {
            handler.emit('presentationClockFormat', getPresentationClockFormat());
        }
    });
    handler.panel.onDidDispose(() => subscription.dispose());
}
