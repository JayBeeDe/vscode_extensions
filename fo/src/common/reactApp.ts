import axios from 'axios';
import * as vscode from 'vscode';
import { extensionResource, getExtensionUri, readExtensionText } from './extensionResource';
import { getEpubSettings } from '@/provider/epubSettings';
import { getPresentationClockFormat } from '@/provider/presentationSettings';
import { getDocumentGoogleFonts, getDocumentTheme, getEpubTheme, getTheme } from './theme';
import { withLoadingOverlay } from './loadingStatus';

interface ViewOption {
    route: string;
    fileName?: string;
}

function escapeHtmlAttribute(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export class ReactApp {

    private static context: vscode.ExtensionContext;
    private static webviewUri: vscode.Uri;
    public static IS_DEV = false;
    private static readonly DEV_SERVER_URL = 'http://127.0.0.1:5739';

    public static init(context: vscode.ExtensionContext) {
        this.context = context;
        this.webviewUri = extensionResource(context, 'out', 'webview');
        this.IS_DEV = context.extensionMode == vscode.ExtensionMode.Development;
    }

    public static async view(webview: vscode.Webview, uri: vscode.Uri, option: ViewOption) {
        // in Development mode, use the Vite dev server (`npm run dev`) when it is running, the built webview otherwise
        const devHtml = this.IS_DEV ? await this.readDevServerContent() : undefined;
        const html = withLoadingOverlay(devHtml ?? await readExtensionText(this.context, 'out', 'webview', 'index.html'), uri);
        const configs = JSON.stringify({
            ...option,
            language: vscode.env.language,
            theme: getTheme(),
            epubTheme: getEpubTheme(),
            epubSettings: getEpubSettings(),
            presentationClockFormat: getPresentationClockFormat(),
            documentTheme: getDocumentTheme(),
            documentGoogleFonts: getDocumentGoogleFonts(),
        });
        // the configs go into a quoted attribute: escape them, and use a replacer function so `$` patterns are not expanded
        webview.html = this.buildPath(html, webview, devHtml !== undefined)
            .replace(`{{configs}}`, () => escapeHtmlAttribute(configs));
    }

    private static async readDevServerContent(): Promise<string | undefined> {
        const devServerUrl = this.DEV_SERVER_URL;
        try {
            const data: string = (await axios.get(`${devServerUrl}/index.html`, { transformResponse: [], timeout: 1000 })).data;
            return data.replace(/(["'])\/(?=(?:@|src\/|index\.html\?))/g, `$1${devServerUrl}/`);
        } catch {
            return undefined;
        }
    }

    private static buildPath(data: string, webview: vscode.Webview, useDevServer: boolean): string {
        const baseUrl = useDevServer ? this.DEV_SERVER_URL : webview.asWebviewUri(this.webviewUri).toString();
        return data.replace('<base href="/">', () => `<base href="${escapeHtmlAttribute(baseUrl)}/">`);
    }

    public static getExtensionUri(): vscode.Uri {
        return getExtensionUri(this.context);
    }

}