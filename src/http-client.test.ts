import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpClient, HttpClientRequest } from "./http-client.js";
import { db } from "./tests/db.js";
import { Storage } from "./tests/storage.js";
import { Queue } from "./queue.js";
import { server } from "./mocks/server.js";
import { CreateUser, LoginResponse, User } from "./tests/contracts.js";
import { BASE_URL } from "./constants.js";
import { Options } from "ky";
import { createAccessToken } from "./tests/util.js";
import { getUrl, refreshToken } from "./mocks/handlers.js";
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
		const queue = new Queue<HttpClientRequest>();

		const client = new HttpClient(storage, queue, clientOptions);

		const response = await client.post<{ id: string }>("users", {
			json: {
				name: "test 123",
				email: "test123@gmail.com",
			} satisfies CreateUser
		});
		expect(response.id).toBeDefined();
	});

	it("should make a request with auth token", async () => {
		const storage = new Storage();
		const queue = new Queue<HttpClientRequest>();

		const client = new HttpClient(storage, queue, clientOptions);

		const response = await client.post<LoginResponse>("authentication/login", {
			json: {
				email: testUser.email,
			}
		});

		expect(response.token).toBeDefined();
		expect(response.refreshToken).toBeDefined();

		storage.accessToken = response.token;
		storage.refreshToken = response.refreshToken;

		const user = await client.get<User>("users/me");

		expect(user.id).toBe(testUser.id);
	});

	it("should refresh the token in case it's expired", async () => {
		const storage = new Storage();
		const queue = new Queue<HttpClientRequest>();

		const client = new HttpClient(storage, queue, clientOptions);

		const response = await client.post<LoginResponse>("authentication/login", {
			json: {
				email: testUser.email,
			}
		});

		const expiredToken = createAccessToken({userId: testUser.id}, 0);

		storage.refreshToken = response.refreshToken;
		storage.accessToken = expiredToken;

		const promise = new Promise((resolve, reject) => {
			server.use(
				rest.post(getUrl("/api/tokens/refresh"), (req, res, ctx) => {
					resolve(true);
					return refreshToken(req, res, ctx);
				})
			);
		});

		await client.get<User>("users/me");

		const res = await promise;
		expect(res).toBe(true);
		expect(storage.accessToken).not.toBe(expiredToken);
	});


	it("should be able to make multiple requests", async () => {
		const storage = new Storage();
		const queue = new Queue<HttpClientRequest>();

		const client = new HttpClient(storage, queue, clientOptions);

		const response = await client.post<LoginResponse>("authentication/login", {
			json: {
				email: testUser.email,
			}
		});

		const expiredToken = createAccessToken({userId: testUser.id}, 0);

		storage.refreshToken = response.refreshToken;
		storage.accessToken = response.token;

		const promise = new Promise((resolve, reject) => {
			server.use(
				rest.post(getUrl("/api/tokens/refresh"), (req, res, ctx) => {
					resolve(true);
					return refreshToken(req, res, ctx);
				})
			);
		});

		queue.subscribe((action) => {
			if (action.type !== "pop") {
				return;
			}

			const headers = action.data?.options?.headers;

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
			client.get<User>("users/me", {
				headers: {
					"x-order": "1"
				},
			}),
			client.get<User>("users/me", {
					headers: {
						"x-order": "2"
					},
				},
			),
			client.get<User>("users/me", {
				headers: {
					"x-order": "3",
				}
			}),
		];


		await Promise.all(requests);
		expect(storage.accessToken).not.toBe(expiredToken);
		await expect(promise).resolves.toBe(true);
	});
});

