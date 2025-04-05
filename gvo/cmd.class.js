const { exec } = require("child_process");
const { File } = require('./file.class');
const path = require("path");

class Cmd {
    constructor(bin, cwd) {
        this.bin = bin;
        this.cwd = cwd;
    }

    async init() {
        const binPath = await this.getBinaryPath();
        if (!binPath) {
            throw new Error(`${this.bin} not found. Did you install it ?`);
        }
        this.bin = binPath; // update with full path to binary that we have checked
        const cwdFile = new File(this.cwd);
        await cwdFile.init();
    }

    async getBinaryPath() {
        const paths = process.env.PATH.split(path.delimiter);
        paths.unshift(""); // in case gitViewOnline.gitPath setting is already the path
        for (const dirBin of paths) {
            const binFile = new File(path.join(dirBin, this.bin));
            try {
                await binFile.init();
                return binFile.path;
            } catch (error) {
                // path not found, let's try next
            }
        }
        return null;
    }

    // Generic exec function
    exec(command) {
        return new Promise((resolve, reject) => {
            exec(`"${this.bin}" ${command}`, { cwd: this.cwd }, (error, stdout) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }
}

class Git extends Cmd {
    constructor(bin, cwd = path.dirname(document.uri.fsPath)) {
        super(bin, cwd);
    }

    // Get absolute local path to git root directory
    async isGitRepo() {
        try {
            await this.exec("rev-parse --is-inside-work-tree", this.cwd);
            return true;
        } catch {
            throw new Error(`${path.basename(this.cwd)} is not part of a git repo`);
        }
    }

    // Get absolute local path to git root directory
    async getRepoRootPath() {
        return this.exec("rev-parse --show-toplevel", this.cwd);
    }

    // Get the remote url (ssh or https url that was git cloned)
    async getRemoteUrl() {
        return this.exec("remote get-url origin", this.cwd);
    }

    // Get the branch name if possible
    async getBranch() {
        try {
            return await this.exec("rev-parse --abbrev-ref HEAD", this.cwd);
        } catch (error) {
            console.error("Error fetching branch:", error.message);
            return null;
        }
    }

    // Get last commit long hash
    async getCommitHash() {
        return this.exec("rev-parse HEAD", this.cwd);
    }
}

module.exports = { Cmd, Git };