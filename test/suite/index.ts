import * as fs from 'fs';
import * as path from 'path';
import Mocha = require('mocha');

function findTestFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findTestFiles(fullPath));
        } else if (entry.name.endsWith('.test.js')) {
            results.push(fullPath);
        }
    }
    return results;
}

export function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', color: true });
    const suiteRoot = path.resolve(__dirname);

    for (const f of findTestFiles(suiteRoot)) {
        mocha.addFile(f);
    }

    return new Promise<void>((resolve, reject) => {
        try {
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err: unknown) {
            reject(err instanceof Error ? err : new Error(String(err)));
        }
    });
}
