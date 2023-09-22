class QueueNode<T> {
	constructor(public data: T, public next: QueueNode<T> | null) {
	}
}

type ActionType = "push" | "pop" | "clear";


export type QueueAction<D> = {
	type: ActionType;
	data: D | null;
}

export class Queue<T> {
	private cursor: number;
	private head: QueueNode<T> | null;
	private tail: QueueNode<T> | null;
	private subscribers = new Set<(action: QueueAction<T>) => void>();

	constructor() {
		this.head = this.tail = null;
		this.cursor = 0;
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

		this.subscribers.forEach(callback => callback({
			type: "push",
			data: data,
		}));
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

		this.subscribers.forEach(callback => callback({
			type: "pop",
			data: data,
		}));

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
		this.subscribers.forEach(callback => callback({
			type: "clear",
			data: null,
		}));
	}

	public subscribe(callback: (action: QueueAction<T>) => void): () => void {
		this.subscribers.add(callback);
		return () => this.unsubscribe(callback);
	}

	private unsubscribe(callback: (action: QueueAction<T>) => void) {
		this.subscribers.delete(callback);
	}
}
