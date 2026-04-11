"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const pg_1 = require("pg");
async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is required to run migrations');
    }
    const sql = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'database', 'migrations', '001_p1_base.sql'), 'utf8');
    const client = new pg_1.Client({ connectionString });
    await client.connect();
    try {
        await client.query(sql);
    }
    finally {
        await client.end();
    }
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
