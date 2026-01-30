
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export class Store {
    path: string;
    data: any;

    constructor(opts: { name: string, defaults?: any }) {
        const userDataPath = app.getPath('userData');
        this.path = path.join(userDataPath, opts.name + '.json');
        this.data = parseDataFile(this.path, opts.defaults || {});
    }

    get(key: string) {
        return this.data[key];
    }

    set(key: string, val: any) {
        this.data[key] = val;
        try {
            fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error("Failed to write settings", e);
        }
    }

    getAll() {
        return this.data;
    }
}

function parseDataFile(filePath: string, defaults: any) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath).toString());
        }
        return defaults;
    } catch (error) {
        return defaults;
    }
}
