import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpClient } from "./http-client.js";
import { db } from "./tests/db.js";
import { Storage } from "./tests/storage.js";
import { server } from "./mocks/server.js";
import { CreateUser, LoginResponse, User } from "./tests/contracts.js";
import { BASE_URL } from "./constants.js";
import { Options } from "ky";
import { createAccessToken } from "./tests/util.js";
import { getCurrentUser, getUrl, logout, refreshToken } from "./mocks/handlers.js";
import { rest } from "msw";

const testUser = {
	id: 1,
	name: "John Doe",
	email: "john.doe@gmail.com",
} satisfies User;

const clientOptions = {
	prefixUrl: BASE_URL,
} satisfies Options;

describe("HttpClient", () => {

	beforeAll(async () => {
		await db.insertInto("users").values([testUser]).execute();
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(async () => {
		server.close();
		await db.destroy();
	});

	it("should be able to make a simple request", async () => {
		const storage = new Storage();

		const client = new HttpClient(storage, clientOptions);

		const response = await client.post("users", {
			json: {
				name: "test 123",
				email: "test123@gmail.com",
			} satisfies CreateUser
		});

		const data = await response.json<{ id: string }>();

		expect(data.id).toBeDefined();
	});

	it("should make a request with auth token", async () => {
		const storage = new Storage();

		const client = new HttpClient(storage, clientOptions);

		const response = await client.post("authentication/login", {
			json: {
				email: testUser.email,
			}
		});

		const data = await response.json<LoginResponse>();

		expect(data.token).toBeDefined();
		expect(data.refreshToken).toBeDefined();

		storage.accessToken = data.token;
		storage.refreshToken = data.refreshToken;

		const userResponse = await client.get("users/me");
		const user = await userResponse.json<User>();

		expect(user.id).toBe(testUser.id);
	});

	it("should refresh the token in case it's expired", async () => {
		const storage = new Storage();

		const client = new HttpClient(storage, clientOptions);

		const response = await client.post("authentication/login", {
			json: {
				email: testUser.email,
			}
		});

		const data = await response.json<LoginResponse>();

		const expiredToken = createAccessToken({userId: testUser.id}, 0);

		storage.refreshToken = data.refreshToken;
		storage.accessToken = expiredToken;

		const promise = new Promise((resolve, reject) => {
			server.use(
				rest.post(getUrl("/api/tokens/refresh"), (req, res, ctx) => {
					resolve(true);
					return refreshToken(req, res, ctx);
				})
			);
		});

		await client.get("users/me");

		const res = await promise;
		expect(res).toBe(true);
		expect(storage.accessToken).not.toBe(expiredToken);
	});


	it("should be able to make multiple requests", async () => {
		const storage = new Storage();

		const client = new HttpClient(storage, clientOptions);

		const response = await client.post("authentication/login", {
			json: {
				email: testUser.email,
			}
		});

		const data = await response.json<LoginResponse>();

		const expiredToken = createAccessToken({userId: testUser.id}, 0);

		storage.refreshToken = data.refreshToken;
		storage.accessToken = data.token;

		const promise = new Promise((resolve, reject) => {
			server.use(
				rest.post(getUrl("/api/tokens/refresh"), (req, res, ctx) => {
					resolve(true);
					return refreshToken(req, res, ctx);
				})
			);
		});

		client.subscribeToQueue("dequeue", (queueItem) => {
			const headers = queueItem?.options?.headers;

			if (headers == null || Array.isArray(headers)) {
				throw new Error("Invalid headers");
			}

			let order: string;
			if (headers instanceof Headers) {
				order = headers.get("x-order") ?? "";
			} else {
				order = headers["x-order"] ?? "";
			}

			if (order === "2") {
				storage.accessToken = expiredToken;
			}
		});


		const requests = [
			client.get("users/me", {
				headers: {
					"x-order": "1"
				},
			}),
			client.get("users/me", {
					headers: {
						"x-order": "2"
					},
				},
			),
			client.get("users/me", {
				headers: {
					"x-order": "3",
				}
			}),
		];


		await Promise.all(requests);
		expect(storage.accessToken).not.toBe(expiredToken);
		await expect(promise).resolves.toBe(true);
	});

	it("should handle errors", async () => {
		const storage = new Storage();

		const client = new HttpClient(storage, clientOptions);
		const counter = {
			count: 0,
		};

		server.use(rest.get(getUrl("/api/users/me"), (req, res, ctx) => {
			counter.count += 1;
			if (counter.count === 1) {
				return res(ctx.status(401));
			} else {
				return getCurrentUser(req, res, ctx);
			}
		}));

		const response = await client.post("authentication/login", {
			json: {
				email: testUser.email,
			}
		});

		const data = await response.json<LoginResponse>();

		storage.accessToken = data.token;
		storage.refreshToken = data.refreshToken;

		const userResponse = await client.get("users/me");

		expect(userResponse.ok).toBe(true);
	});

	it("should throw an error if the token is invalid", async () => {
		const storage = new Storage();

		const client = new HttpClient(storage, clientOptions);

		await expect(client.get("users/me")).rejects.toThrowError();
	});

	it("should logout in case the token is invalid", async () => {
		server.use(rest.get(getUrl("/api/users/me"), (req, res, ctx) => {
			return res(ctx.status(401));
		}), rest.post(getUrl("/api/tokens/refresh"), (req, res, ctx) => {
			return res(ctx.status(401));
		}));

		const storage = new Storage();

		const client = new HttpClient(storage, clientOptions);

		const response = await client.post("authentication/login", {
			json: {
				email: testUser.email,
			}
		});

		const data = await response.json<LoginResponse>();

		storage.accessToken = data.token;
		storage.refreshToken = data.refreshToken;

		const promise = new Promise((resolve, reject) => {
			server.use(rest.post(getUrl("/api/authentication/logout"), (req, res, ctx) => {
				resolve(true);
				return logout(req, res, ctx);
			}))
		})

		await expect(client.get("users/me")).rejects.toThrowError();

		expect(await promise).toBe(true);

		expect(storage.accessToken).toBe(null);
		expect(storage.refreshToken).toBe(null);
	});

});

