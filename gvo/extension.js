const { File, Package } = require("./file.class");
const { Git } = require("./cmd.class");
const { GVO, URL_TEMPLATES, LINK_TEMPLATES, MSG } = require("./extension.constants.js");
const nunjucks = require("nunjucks");
const path = require("path");
const vscode = require("vscode");
nunjucks.configure({ autoescape: true });

function activate(context) {
    if (!context.globalState.get(`${GVO}.firstActivation`, false)) {
        context.globalState.update(`${GVO}.firstActivation`, true).then(() => {
            // to avoid application restart need upon installation
            vscode.commands.executeCommand("workbench.action.reloadWindow");
        });
    }
    let packageObj;
    (async () => {
        packageObj = new Package(path.join(__dirname, "package.json"));
        try {
            await packageObj.init(); // Initialize the file
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
            return; // Exit on error
        }
        packageObj.getDefaultConfiguration(`${GVO}.providers`)
            .then((defaultProviders) => {

                // get default configuration from package json file because that's the only way to get default configuration
                console.log("Updating defaultProviders...", defaultProviders);
                context.globalState.update(`${GVO}.defaultProviders`, defaultProviders);
                // save it for later to not have to retrieve it at each command run
            })
            .catch((error) => {
                vscode.window.showErrorMessage(error.message);
            });
    })();

    // Command to open the url in the browser
    let openCommand = vscode.commands.registerCommand(`${GVO}.openUrl`, (uri) => {
        handleCommand(context, uri, (data) => {
            vscode.env.openExternal(vscode.Uri.parse(data.url));
        });
    });

    // Command to copy the url to the clipboard
    let copyCommand = vscode.commands.registerCommand(`${GVO}.copyUrl`, (uri) => {
        handleCommand(context, uri, (data) => {
            vscode.env.clipboard.writeText(data.link).then(() => {
                if (vscode.workspace.getConfiguration().get(`${GVO}.copyLinkNotify`)) {
                    vscode.window.showInformationMessage(vscode.workspace.getConfiguration().get(`${GVO}.copyLinkType`) + " " + MSG.COPY_URL_OPEN, MSG.COPY_URL_OPEN_LINK)
                        .then(selection => {
                            if (selection === MSG.COPY_URL_OPEN_LINK) {
                                vscode.env.openExternal(vscode.Uri.parse(data.url));
                            }
                        });
                } else {
                    console.log(vscode.workspace.getConfiguration().get(`${GVO}.copyLinkType`) + " " + MSG.COPY_URL_OPEN);
                }
            });
        });
    });

    context.subscriptions.push(openCommand);
    context.subscriptions.push(copyCommand);
}

function handleCommand(context, uri, action) {
    const editor = vscode.window.activeTextEditor;
    filePath = uri ? uri.fsPath : editor.document.uri.fsPath;
    if (!filePath) {
        vscode.window.showErrorMessage(MSG.NO_FILE);
        return;
    }
    let file;
    (async () => {
        file = new File(filePath);
        try {
            await file.init();
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
            return;
        }
        if (editor && editor.document.uri.fsPath === file.path) {
            if (editor.selection.isEmpty && !vscode.workspace.getConfiguration().get(`${GVO}.strictLineSelection`)) {
                const lines = editor.selections.map(selection => selection.active.line + 1);
                // GitHub doesn't support discontinuous intervals, or we should generate multiple links ?
                if (lines.length == 1) {
                    file.lines = [lines[0]];
                } else if (lines.length > 1) {
                    file.lines = [lines[0], lines[lines.length - 1]];
                }
            }
            else if (!editor.selection.isEmpty) {
                if (editor.selection.start.line === editor.selection.end.line) {
                    file.lines = [editor.selection.start.line + 1];
                } else {
                    file.lines = [editor.selection.start.line + 1, editor.selection.end.line + 1];
                }
            }
        }
        console.log(`Processing existing ${file.type} ${file.path}...`);
        handleFile(context, action, file);
    })();
}

function handleFile(context, action, file) {
    let git;
    (async () => {
        git = new Git(vscode.workspace.getConfiguration().get(`${GVO}.gitPath`), file.type === "file" ? path.dirname(file.path) : file.path); // Create an instance of the Cmd class
        try {
            await git.init();
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
            return;
        }
        try {
            await git.isGitRepo();
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
            return;
        }
        console.log("...is a git repo!");
        const [repoPath, remoteUrl, commit, branch] = await Promise.all([
            git.getRepoRootPath(),
            git.getRemoteUrl(),
            git.getCommitHash(),
            git.getBranch()
        ]);

        data = handleUrlData(context, action, remoteUrl, commit, branch, file.path.substring(repoPath.length + 1).replace(/\\/g, "/"), file.lines);
    })();
}

function handleUrlData(context, action, remoteUrl, commit, branch, filePath, lines) {

    let baseUrl, repoPath, repoType;
    try {
        [baseUrl, repoPath, repoType] = transformUrlFromProviders(context, remoteUrl);
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
        return;
    }
    console.log(`${remoteUrl} has been transformed to baseUrl=${baseUrl}, repoPath=${repoPath}, repoType=${repoType}`);

    let branchOrCommit = branch;
    if (!branch || branch === "HEAD" || vscode.workspace.getConfiguration().get(`${GVO}.forceCommitHash`)) {
        branchOrCommit = commit;
        console.log(`Fallback override to commit`);
    }
    console.log(`${lines.length} line(s) involved`);

    let data = {
        filePath: filePath, // gvo/extension.js
        dirName: path.dirname(filePath), // gvo/
        fileName: path.basename(filePath), // extension.js
        repoPath: repoPath, // JayBeeDe/vscode_extensions
        repoDir: path.dirname(repoPath), // JayBeeDe
        repoName: path.basename(repoPath), // vscode_extensions (from remote url, not local dirname)
        repoType: repoType, // GitHub
        branchOrCommit: branchOrCommit, // depends on settings
        hashLong: commit, // cc2c997f3910a86b8f0cadd604df2f5c37dd9916
        hashShort: commit.slice(0, 7), // cc2c997
        branch: branch, // master
        line: lines.length > 0 ? lines[0] : null, // 144
        lines: lines.length, // 17
        lineStart: lines.length > 0 ? lines[0] : null, // 132
        lineStop: lines.length > 1 ? lines[lines.length - 1] : null, // 148
        baseUrl: baseUrl, // https://github.com/JayBeeDe/vscode_extensions/blob/master/gvo/extension.js#L132-L148
        title: null, // title that will not be send to jinja
        url: null, // final url
        link: null, // url and title formatted according copyLinkType setting
    };

    data.url = nunjucks.renderString(URL_TEMPLATES[data.repoType], data);
    console.log(`URL is ${data.url}`);
    data.title = nunjucks.renderString(vscode.workspace.getConfiguration().get(`${GVO}.copyLinkTitleFormat`), data);
    console.log(`Title is ${data.title}`);
    data.link = nunjucks.renderString(LINK_TEMPLATES[vscode.workspace.getConfiguration().get(`${GVO}.copyLinkType`)], data);
    console.log(`Link is ${data.link}`);

    try {
        action(data);
    } catch (error) {
        console.error("Error during action:", error);
        vscode.window.showErrorMessage(error.message);
    }
}

function transformUrlFromProviders(context, url) {
    // avoid user to need to rewrite the default setting for GitHub
    const providers = [...vscode.workspace.getConfiguration().get(`${GVO}.providers`), ...context.globalState.get(`${GVO}.defaultProviders`, [])];
    for (const item of providers) {
        let searchRegex = new RegExp(item.remoteUrl);
        if (searchRegex.test(url)) {
            return [url.replace(searchRegex, item.baseUrl), url.replace(searchRegex, item.repoPath), item.repoType];
        }
    }
    throw new Error(`${url} ${MSG.NO_PROVIDER}`);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate,
};
