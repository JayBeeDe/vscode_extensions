const fs = require("fs").promises;
const os = require("os");
const path = require("path");

class File {
    constructor(path, cwd = this.getRootPath()) {
        this.cwd = cwd;
        this.path = path;
        this.exists = false;
        this.type = null;
        this.lines = [];
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
    async read() {
        // read file or list file of a directory
        try {
            if (this.type === "directory") {
                return await fs.readdir(this.path);
            } else if (this.type === "file") {
                return await fs.readFile(this.path, "utf8");
            }
        } catch (error) {
            throw new Error(`Cannot read ${this.type} ${this.path}`);
        }
    }
    getRootPath() {
        if (os.platform() === "win32") {
            return path.parse(process.cwd()).root; // Typically "C:\\"
        }
        return "/"; // Linux/macOS root
    }
}

class Json extends File {
    constructor(path, cwd) {
        super(path, cwd);
    }
    async init() {
        await super.init();
        if (this.type === "directory") {
            throw new Error(`JSON type cannot be ${this.type}`);
        }
    }
    async read() {
        // read json file
        const data = await super.read();
        try {
            return JSON.parse(data);
        } catch (error) {
            throw new Error(`Cannot parse ${this.path} with JSON parser`);
        }
    }
    async get(pathKey = null) {
        // get value from a json file
        const packageData = await this.read();
        if (!pathKey) {
            return packageData;
        }
        if (!this._exists(packageData, pathKey)) {
            throw new Error(`Cannot read ${pathKey} from ${this.type} ${this.path}`);
        }
        return pathKey.split("/").reduce((obj, key) => (obj && obj[key] ? obj[key] : undefined), packageData);
    }
    _exists(data, pathKey) {
        return pathKey.split("/").every((key) => {
            if (data && data[key] !== undefined) {
                data = data[key]; // Traverse deeper
                return true;
            }
            return false;
        });
    }
}

class Package extends Json {
    constructor(path, cwd) {
        super(path, cwd);
    }
    async getDefaultConfiguration(property = null) {
        if (property === null) {
            throw new Error(`Missing setting key`);
        }
        return this.get(`contributes/configuration/properties/${property}/default`);
    }
}

module.exports = { File, Json, Package };