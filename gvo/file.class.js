const fs = require("fs").promises;

class File {
    constructor(path, cwd = "/") {
        this.cwd = cwd;
        this.path = path;
        this.exists = false;
        this.type = null;
        this.lineStart = null;
        this.lineStop = null;
    }

    async init() {
        let stats;
        try {
            stats = await fs.stat(this.path);
        } catch (error) {
            try {
                stats = await fs.stat(this.cwd + this.path);
                this.path = this.cwd + this.path;
            } catch (error) {
                throw new Error(`File or directory does not exist neither at path ${this.path} nor at path ${this.cwd}${this.path}`);
            }
        }
        this.exists = true;
        if (stats.isFile()) {
            this.type = "file";
        } else if (stats.isDirectory()) {
            this.type = "directory";
        }
        if (!this.type) {
            throw new Error(`Unknown file type at path: ${this.path}`);
        }
    }
}

module.exports = { File };