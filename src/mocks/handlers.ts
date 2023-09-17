import { ResponseComposition, rest, RestContext, RestRequest } from "msw";
import { db } from "../tests/db.js";
import {
	AccessTokenData,
	CreateUserSchema,
	LoginResponse,
	LoginSchema,
	RefreshTokenResponse
} from "../tests/contracts.js";
import { randomUUID } from "node:crypto";
import { BASE_URL, REFRESH_TOKEN_HEADER, REFRESH_TOKEN_LIFETIME } from "../constants.js";
import { createAccessToken, verifyAuthentication } from "../tests/util.js";

export const getUrl = (path: string) => new URL(path, BASE_URL).toString();

export async function getUsers(req: RestRequest, res: ResponseComposition, ctx: RestContext) {
	const users = await db.selectFrom("users").selectAll().execute();

	try {
		await verifyAuthentication(req.headers);
	} catch (error) {
		return res(
			ctx.status(401),
			ctx.json({
				message: "Unauthorized"
			})
		);
	}


	return res(
		ctx.status(200),
		ctx.json(users)
	);
}

export async function createUser(req: RestRequest, res: ResponseComposition, ctx: RestContext) {
	const body = await req.json();
	const data = CreateUserSchema.parse(body);

	const [user] = await db.insertInto("users").values(data).returning("id").execute();

	return res(
		ctx.status(201),
		ctx.json({
			id: user.id
		})
	);
}

export async function getCurrentUser(req: RestRequest, res: ResponseComposition, ctx: RestContext) {
	let tokenData: AccessTokenData;
	try {
		tokenData = await verifyAuthentication(req.headers);
	} catch (error) {
		return res(
			ctx.status(401),
			ctx.json({
				message: "Unauthorized"
			})
		);
	}

	const user = await db.selectFrom("users").where("id", "=", tokenData.userId)
		.selectAll()
		.executeTakeFirst();

	if (user == null) {
		return res(
			ctx.status(404),
			ctx.json({
				message: `User with id ${tokenData.userId} not found`,
			})
		);
	}

	return res(
		ctx.status(200),
		ctx.json(user)
	);
}

export async function getUserById(req: RestRequest, res: ResponseComposition, ctx: RestContext) {
	try {
		await verifyAuthentication(req.headers);
	} catch (error) {
		return res(
			ctx.status(401),
			ctx.json({
				message: "Unauthorized"
			})
		);
	}
	const id = Number(req.params.id);

	const user = await db.selectFrom("users").where("id", "=", id)
		.selectAll()
		.executeTakeFirst();

	if (user == null) {
		return res(
			ctx.status(404),
			ctx.json({
				message: `User with id ${id} not found`,
			})
		);
	}

	return res(
		ctx.status(200),
		ctx.json(user)
	);
}

export async function updateUser(req: RestRequest, res: ResponseComposition, ctx: RestContext) {
	try {
		await verifyAuthentication(req.headers);
	} catch (error) {
		return res(
			ctx.status(401),
			ctx.json({
				message: "Unauthorized"
			})
		);
	}
	const id = Number(req.params.id);

	const body = await req.json();
	const data = CreateUserSchema.parse(body);

	const [user] = await db.updateTable("users").set(data).where("id", "=", id).returning("id").execute();

	return res(
		ctx.status(200),
		ctx.json({
			id: user.id
		})
	);
}

export async function deleteUser(req: RestRequest, res: ResponseComposition, ctx: RestContext) {
	try {
		await verifyAuthentication(req.headers);
	} catch (error) {
		return res(
			ctx.status(401),
			ctx.json({
				message: "Unauthorized"
			})
		);
	}
	const id = Number(req.params.id);

	await db.deleteFrom("users").where("id", "=", id).execute();

	return res(
		ctx.status(204)
	);
}

export async function login(req: RestRequest, res: ResponseComposition, ctx: RestContext) {
	const body = await req.json();
	const data = LoginSchema.parse(body);

	const user = await db.selectFrom("users").selectAll().where("email", "=", data.email).executeTakeFirst();

	if (user == null) {
		return res(
			ctx.status(400),
			ctx.json({
				message: "Bad credentials"
			})
		);
	}

	const tokenValue = randomUUID();
	const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME).toISOString();

	await db.insertInto("tokens").values({
		value: tokenValue,
		userId: user.id,
		expiresAt
	}).execute();

	const accessToken = createAccessToken({
		userId: user.id
	});

	const response = {
		refreshToken: tokenValue as string,
		token: accessToken,
	} satisfies LoginResponse;

	return res(
		ctx.status(200),
		ctx.json(response)
	);
}

export async function refreshToken(req: RestRequest, res: ResponseComposition, ctx: RestContext) {
	const refreshToken = req.headers.get(REFRESH_TOKEN_HEADER);

	if (refreshToken == null) {
		return res(
			ctx.status(401),
			ctx.json({
				message: "Unauthorized"
			})
		);
	}

	const token = await db.selectFrom("tokens").selectAll().where("value", "=", refreshToken).executeTakeFirst();

	if (token == null) {
		return res(
			ctx.status(401),
			ctx.json({
				message: "Unauthorized"
			})
		);
	}

	const isExpired = Date.now() > new Date(token.expiresAt).getTime();
	if (isExpired) {
		return res(
			ctx.status(401),
			ctx.json({
				message: "Unauthorized"
			})
		);
	}

	const accessToken = createAccessToken({userId: token.userId});

	return res(
		ctx.status(200),
		ctx.json({
			token: accessToken,
		} satisfies RefreshTokenResponse)
	);

}

export const handlers = [
	rest.get(getUrl("/api/users"), getUsers),
	rest.post(getUrl("/api/users"), createUser),
	rest.get(getUrl("/api/users/me"), getCurrentUser),
	rest.get(getUrl("/api/users/:id"), getUserById),
	rest.put(getUrl("/api/users/:id"), updateUser),
	rest.delete(getUrl("/api/users/:id"), deleteUser),
	rest.post(getUrl("/api/authentication/login"), login),
	rest.post(getUrl("/api/tokens/refresh"), refreshToken)
];
