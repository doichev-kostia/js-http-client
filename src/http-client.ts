// async queue ✅
// refresh and access token ✅
// logging
// error enrichment
// request cancellation + if the response from the refresh endpoint is 401, then cancel all requests with auth token


import ky, { KyResponse, type Options } from "ky";
import { milliseconds, REFRESH_TOKEN_HEADER } from "./constants.js";
import { Queue, QueueAction } from "./queue.js";
import { RefreshTokenResponse } from "./tests/contracts.js";
import { TestLogger } from "./tests/logger.js";

type Input = string | URL | Request;
type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "HEAD" | "DELETE" | "OPTIONS" | "TRACE";

export type HttpClientRequest = {
	method: RequestMethod;
	url: Input;
	options?: Options,
	resolve: (value: KyResponse) => void;
	reject: (reason?: any) => void;
}

export interface Storage {
	set accessToken(value: string | null);

	set refreshToken(value: string | null);

	get accessToken(): string | null;

	get refreshToken(): string | null;

	getTokenExpiration(): number | undefined; // seconds
}

export class HttpClient {
	private queue: Queue<HttpClientRequest>;
	private readonly api: typeof ky;
	private storage: Storage;
	private isExecuting = false;

	constructor(storage: Storage, queue: Queue<HttpClientRequest>, options?: Options) {
		this.storage = storage;
		this.queue = queue;
		this.api = ky.create(options ?? {});
		this.queue.subscribe(this.subscriber.bind(this));
	}

	public async get<T>(url: Input, options?: Options): Promise<T> {
		const response = await new Promise<KyResponse>((resolve, reject) => {
			this.queue.push({
				method: "GET",
				url,
				options,
				resolve,
				reject,
			});
		});

		const data = await response.json<T>();
		return data;
	}

	public async post<T>(url: Input, options?: Options): Promise<T> {
		const response = await new Promise<KyResponse>((resolve, reject) => {
			this.queue.push({
				method: "POST",
				url,
				options,
				resolve,
				reject,
			});
		});

		const data = await response.json<T>();
		return data;
	}

	public async put<T>(url: Input, options?: Options): Promise<T> {
		const response = await new Promise<KyResponse>((resolve, reject) => {
			this.queue.push({
				method: "PUT",
				url,
				options,
				resolve,
				reject,
			});
		});

		const data = await response.json<T>();
		return data;
	}

	public async patch<T>(url: Input, options?: Options): Promise<T> {
		const response = await new Promise<KyResponse>((resolve, reject) => {
			this.queue.push({
				method: "PATCH",
				url,
				options,
				resolve,
				reject,
			});
		});

		const data = await response.json<T>();
		return data;
	}

	public async delete<T>(url: Input, options?: Options): Promise<T> {
		const response = await new Promise<KyResponse>((resolve, reject) => {
			this.queue.push({
				method: "DELETE",
				url,
				options,
				resolve,
				reject,
			});
		});

		const data = await response.json<T>();
		return data;
	}

	public request(url: Input, options?: Options): Promise<KyResponse> {
		return new Promise((resolve, reject) => {
			this.queue.push({
				method: "GET",
				url,
				options,
				resolve,
				reject,
			});
		});
	}


	private subscriber(action: QueueAction<HttpClientRequest>) {
		if (this.isExecuting || action.type !== "push") {
			return;
		}

		this.isExecuting = true;
		void this.run();
	}

	private async run() {
		while (!this.queue.isEmpty()) {
			const item = this.queue.pop();

			if (item == null) {
				return;
			}

			const hasAccessToken = this.storage.accessToken != null;
			if (hasAccessToken && this.shouldRefreshToken()) {
				await this.refreshToken();
			}

			this.executeRequest(item).then(item.resolve, item.reject);
		}
		this.isExecuting = false;
	}

	private executeRequest(item: HttpClientRequest) {
		const {method, options, url} = item;

		const headers = this.constructHeaders(this.getAuthHeaders());


		return this.api(url, {
			method,
			...options,
			headers
		});
	}

	private async refreshToken() {
		const url = "tokens/refresh";
		const headers = this.constructHeaders(this.getAuthHeaders());

		const response = await this.api.post(url, {
			headers
		});

		const data = await response.json<RefreshTokenResponse>();

		this.storage.accessToken = data.token;
	}

	private constructHeaders(headersInit?: HeadersInit, kyHeadersInit?: HeadersInit | Record<string, string | undefined>) {
		const headers = new Headers(headersInit);
		if (kyHeadersInit == null) {
			return headers;
		}

		if (kyHeadersInit instanceof Headers) {
			for (const [key, value] of kyHeadersInit) {
				headers.set(key, value);
			}
		} else if (Array.isArray(kyHeadersInit)) {
			for (const [key, value] of kyHeadersInit) {
				headers.set(key, value);
			}
		} else {
			for (const key of Object.keys(kyHeadersInit)) {
				const value = kyHeadersInit[key];
				if (value) {
					headers.set(key, value);
				}
			}
		}
		return headers;
	}

	private getAuthHeaders(): Headers {
		const headers = new Headers();
		if (this.storage.accessToken != null) {
			headers.set("Authorization", `Bearer ${this.storage.accessToken}`);
		}
		if (this.storage.refreshToken != null) {
			headers.set(REFRESH_TOKEN_HEADER, this.storage.refreshToken);
		}

		return headers;
	}

	private shouldRefreshToken() {
		const expiration = (this.storage.getTokenExpiration() ?? 0) * milliseconds.second;
		const buffer = 10 * milliseconds.second;
		const now = Date.now();
		const isExpired = now + buffer > expiration;
		return isExpired;
	}
}
