class QueueNode<T> {
	constructor(public data: T, public next: QueueNode<T> | null) {
	}
}

export type QueueEvent = "enqueue" | "dequeue" | "clear";

type ListenerMap<T> = {
	"enqueue": Set<(data: T) => void>;
	"dequeue": Set<(data: T) => void>;
	"clear": Set<() => void>;
}

export class Queue<T> {
	private cursor: number;
	private head: QueueNode<T> | null;
	private tail: QueueNode<T> | null;
	private listeners: ListenerMap<T>;

	constructor() {
		this.head = this.tail = null;
		this.cursor = 0;
		this.listeners = {
			enqueue: new Set<(data: T) => void>(),
			dequeue: new Set<(data: T) => void>(),
			clear: new Set<() => void>(),
		}
	}

	public enqueue(data: T): void {
		const node = new QueueNode(data, null);
		this.cursor += 1;

		if (!this.tail) {
			this.tail = this.head = node;
		} else {
			this.tail.next = node;
			this.tail = node;
		}

		this.emit("enqueue", data);
	}

	public dequeue(): T | null {
		if (this.head == null) {
			return null;
		}

		this.cursor -= 1;
		const node = this.head;
		this.head = this.head.next;

		node.next = null; // GC

		if (this.cursor === 0) {
			this.tail = null;
		}

		const data = node.data;

		this.emit("dequeue", data);
		return data;
	}

	public peek(): T | null {
		return this.head?.data ?? null;
	}

	public isEmpty(): boolean {
		return this.head == null;
	}

	public get size(): number {
		return this.cursor;
	}

	public clear(): void {
		this.head = null;
		this.tail = null;
		this.cursor = 0;
		this.emit("clear", null);
	}

	public off(event: QueueEvent, callback: (...args: any[]) => any): void {
		this.listeners[event].delete(callback);
	}

	public on(event: "dequeue", callback: (data: T) => void): () => void;
	public on(event: "enqueue", callback: (data: T) => void): () => void;
	public on(event: "clear", callback: () => void): () => void;

	public on(event: QueueEvent, callback: (...args: any[]) => any): () => void {
		this.listeners[event].add(callback as any);
		return () => this.off(event, callback);
	}

	private emit(event: "dequeue", data: T): void;
	private emit(event: "enqueue", data: T): void;
	private emit(event: "clear", data: null): void;
	private emit(event: QueueEvent, data: any): void {
		this.listeners[event].forEach(callback => callback(data));
	}
}
