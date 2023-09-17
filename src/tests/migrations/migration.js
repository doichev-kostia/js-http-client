import { Kysely } from "kysely";

/**
 * @param {Kysely<any>} db
 */
export async function up(db) {
	await db.schema.createTable("users")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("email", "text", (col) => col.notNull().unique())
		.execute();

	await db.schema.createTable("tokens")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("value", "text", (col) => col.notNull().unique())
		.addColumn("userId", "integer", (col) => col.notNull().references("users.id").onDelete("cascade"))
		.addColumn("expiresAt", "text", (col) => col.notNull())
		.execute();
}

/**
 * @param {Kysely<any>} db
 */
export async function down(db) {
	await db.schema.dropTable("tokens").execute();
	await db.schema.dropTable("users").execute();
}
