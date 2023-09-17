import Database from "better-sqlite3";
import { FileMigrationProvider, Generated, Kysely, Migrator, SqliteDialect } from "kysely";
import path from "node:path";
import fs from "node:fs";
import { TestLogger } from "./logger.js";

const filename = path.resolve("db/test.sqlite");

await fs.promises.writeFile(filename, "");

const dialect = new SqliteDialect({
	database: new Database(filename, {
		verbose: (message, ...args) => {
			TestLogger.debug(message as string, {args});
		}
	}),

	onCreateConnection: (connection) => {
		TestLogger.info(`Connected to ${filename}`);
		return Promise.resolve();
	}
});

export interface UsersTable {
	id: Generated<number>;
	name: string;
	email: string;
}

export interface TokensTable {
	id: Generated<number>;
	value: string;
	userId: number;
	expiresAt: string;
}

export interface DatabaseSchema {
	users: UsersTable;
	tokens: TokensTable;
}

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const db = new Kysely<DatabaseSchema>({dialect, log: ["query", "error"]});

const migrator = new Migrator({
	db,
	provider: new FileMigrationProvider({
		fs: fs.promises,
		path,
		migrationFolder: path.join(__dirname, "./migrations")
	})
});

const {error, results} = await migrator.migrateToLatest();

results?.forEach((it) => {
	if (it.status === "Success") {
		TestLogger.info(`migration "${it.migrationName}" was executed successfully`);
	} else if (it.status === "Error") {
		TestLogger.error(`failed to execute migration "${it.migrationName}"`, it);
	}
});

if (error) {
	TestLogger.error(error, "failed to migrate");
	process.exit(1);
}
