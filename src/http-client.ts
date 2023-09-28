import ky, { KyResponse, type NormalizedOptions, type Options } from "ky";
import { milliseconds, REFRESH_TOKEN_HEADER } from "./constants.js";
import { Queue, QueueAction } from "./queue.js";
import { RefreshTokenResponse } from "./tests/contracts.js";
import { z } from "zod";
import { randomUUID } from "./crypto.js";

type Input = string | URL | Request;
const requestMethods = ["GET", "POST", "PUT", "PATCH", "HEAD", "DELETE"] as const;
const requestMethodSchema = z.enum(requestMethods);
type RequestMethod = typeof requestMethods[number];

export type HttpClientQueueItem = {
	id: `${string}-${string}-${string}-${string}-${string}`,
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
	readonly #queue: Queue<HttpClientQueueItem>;
	#status: "idle" | "running" | "stopped";

	private requestMap: Map<string, HttpClientQueueItem>;
	private readonly api: typeof ky;
	private storage: Storage;

	constructor(storage: Storage, options?: Options) {
		this.storage = storage;
		this.#queue = new Queue<HttpClientQueueItem>();
		this.requestMap = new Map<string, HttpClientQueueItem>();
		this.#status = "idle";
		this.api = ky.create({
			hooks: {
				afterResponse: [this.responseHook.bind(this)],
			},
			...options,
		});
		this.#queue.subscribe(this.subscriber.bind(this));
	}

	public get status() {
		return this.#status;
	}

	private set status(value: "idle" | "running" | "stopped") {
		this.#status = value;
		if (value === "idle" && !this.#queue.isEmpty()) {
			void this.run();
		}
	}

	public subscribeToQueue(callback: (action: QueueAction<HttpClientQueueItem>) => void): () => void {
		return this.#queue.subscribe(callback);
	}

	public async get(url: Input, options?: Options): Promise<KyResponse> {
		const response = await this.enqueue("GET", url, options);

		return response;
	}

	public async post(url: Input, options?: Options): Promise<KyResponse> {
		const response = await this.enqueue("POST", url, options);

		return response;
	}

	public async put(url: Input, options?: Options): Promise<KyResponse> {
		const response = await this.enqueue("PUT", url, options);

		return response;
	}

	public async patch(url: Input, options?: Options): Promise<KyResponse> {
		const response = await this.enqueue("PATCH", url, options);

		return response;
	}

	public async delete(url: Input, options?: Options): Promise<KyResponse> {
		const response = await this.enqueue("DELETE", url, options);

		return response;
	}

	public request(url: Input, options?: Options): Promise<KyResponse> {
		const method = requestMethodSchema.parse(options?.method);

		return this.enqueue(method, url, options);
	}

	private enqueue(method: RequestMethod, url: Input, options?: Options): Promise<KyResponse> {
		return new Promise((resolve, reject) => {
			this.#queue.enqueue({
				id: randomUUID(),
				method,
				url,
				options,
				resolve,
				reject,
			});
		})
	}

	private async responseHook(request: Request, options: NormalizedOptions, response: Response): Promise<Response | void> {
		const id = request.headers.get("x-request-id");

		if (id == null) {
			return response;
		}

		const item = this.requestMap.get(id);

		if (item == null) {
			return response;
		}

		this.requestMap.delete(id);

		if (response.status !== 401) {
			return response;
		}

		if (this.storage.refreshToken == null) {
			return response;
		}

		this.status = "stopped";
		await this.refreshToken();
		this.status = "idle";
		// hijack the request and swap it with a new one
		const result = await this.enqueue(item.method, item.url, item.options)

		return result;
	}

	private async run() {
		while (!this.#queue.isEmpty()) {
			const item = this.#queue.dequeue();

			if (item == null) {
				continue;
			}

			this.requestMap.set(item.id, item);
			const hasRefreshToken = this.storage.refreshToken != null;
			if (hasRefreshToken && this.shouldRefreshAccessToken()) {
				await this.refreshToken();
			}

			this.executeRequest(item).then(item.resolve, item.reject);
		}
		this.status = "idle";
	}

	private subscriber(action: QueueAction<HttpClientQueueItem>) {
		if (this.status !== "idle" || action.type !== "push") {
			return;
		}

		this.status = "running";
		void this.run();
	}

	private async executeRequest(item: HttpClientQueueItem) {
		const {id, method, options, url} = item;

		const initialHeaders = this.getAuthHeaders();
		initialHeaders.set("x-request-id", id);
		const headers = this.constructHeaders(initialHeaders, options?.headers);


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
			headers,
			throwHttpErrors: false,
		});

		if (!response.ok) {
			await this.logout();
			return;
		}

		const data = await response.json<RefreshTokenResponse>();

		this.storage.accessToken = data.token;
	}

	private async logout(): Promise<void> {
		const url = "authentication/logout";
		const headers = this.constructHeaders(this.getAuthHeaders());

		await this.api.post(url, {
			headers,
			throwHttpErrors: false,
		});

		this.storage.accessToken = null;
		this.storage.refreshToken = null;
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

	private shouldRefreshAccessToken() {
		if (this.storage.refreshToken == null) {
			return false;
		}
		const expiration = (this.storage.getTokenExpiration() ?? 0) * milliseconds.second;
		const buffer = 10 * milliseconds.second;
		const now = Date.now();
		const isExpired = now + buffer > expiration;
		return isExpired;
	}
}
