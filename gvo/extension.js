const { File } = require("./file.class");
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

    // Command to open the url in the browser
    let openCommand = vscode.commands.registerCommand(`${GVO}.openUrl`, (uri) => {
        handleCommand(uri, (data) => {
            vscode.env.openExternal(vscode.Uri.parse(data.url));
        });
    });

    // Command to copy the url to the clipboard
    let copyCommand = vscode.commands.registerCommand(`${GVO}.copyUrl`, (uri) => {
        handleCommand(uri, (data) => {
            vscode.env.clipboard.writeText(data.link).then(() => {
                vscode.window.showInformationMessage(vscode.workspace.getConfiguration().get(`${GVO}.copyLinkType`) + " " + MSG.COPY_URL_OPEN, MSG.COPY_URL_OPEN_LINK)
                    .then(selection => {
                        if (selection === MSG.COPY_URL_OPEN_LINK) {
                            vscode.env.openExternal(vscode.Uri.parse(data.url));
                        }
                    });
            });
        });
    });

    context.subscriptions.push(openCommand);
    context.subscriptions.push(copyCommand);
}

function handleCommand(uri, action) {
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
        if (editor && !editor.selection.isEmpty && editor.document.uri.fsPath === file.path) {
            file.lineStart = editor.selection.start.line + 1;
            file.lineStop = editor.selection.end.line + 1;
        }
        console.log(`Processing existing ${file.type} ${file.path}...`);
        handleFile(file, action);
    })();
}

function handleFile(file, action) {
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

        data = handleUrlData(action, remoteUrl, commit, branch, file.path.substring(repoPath.length + 1), file.lineStart, file.lineStop);
    })();
}

function handleUrlData(action, remoteUrl, commit, branch, filePath, lineStart, lineStop) {

    const [baseUrl, repoPath, repoType] = transformUrlFromProvider(remoteUrl);
    console.log(`${remoteUrl} has been transformed to baseUrl=${baseUrl}, repoPath=${repoPath}, repoType=${repoType}`);

    let branchOrCommit = branch;
    if (!branch || branch === "HEAD" || vscode.workspace.getConfiguration().get(`${GVO}.forceCommitHash`)) {
        branchOrCommit = commit;
        console.log(`Fallback override to commit`);
    }
    let lines = 0;
    if (lineStart) {
        lines = 1;
        if (lineStop) {
            lines += lineStop - lineStart;
        }
        console.log(`${lines} line(s) involved`);
    }

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
        line: lineStart, // 144
        lines: lines, // 17
        lineStart: lineStart, // 132
        lineStop: lineStop, // 148
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

function transformUrlFromProvider(url) {
    for (const item of vscode.workspace.getConfiguration().get(`${GVO}.providers`)) {
        let searchRegex = new RegExp(item.remoteUrl);
        if (searchRegex.test(url)) {
            return [url.replace(searchRegex, item.baseUrl), url.replace(searchRegex, item.repoPath), item.repoType];
        }
    }
    return [url, "GitHub"];
}

function deactivate() { }

module.exports = {
    activate,
    deactivate,
};
