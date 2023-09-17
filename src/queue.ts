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
	private cursor = 0;
	private node: QueueNode<T> | null = null;
	private subscribers = new Set<(action: QueueAction<T>) => void>();

	public subscribe(callback: (action: QueueAction<T>) => void): () => void {
		this.subscribers.add(callback);
		return () => this.unsubscribe(callback);
	}

	private unsubscribe(callback: (action: QueueAction<T>) => void) {
		this.subscribers.delete(callback);
	}

	public push(data: T): void {
		if (this.node == null) {
			this.node = new QueueNode<T>(data, null);
		} else if (this.node.next == null) {
			this.node.next = new QueueNode<T>(data, null);
		} else {
			this.append(data);
		}
		this.cursor += 1;
		this.subscribers.forEach(callback => callback({
			type: "push",
			data: data,
		}));
	}

	public pop(): T | null {
		if (this.node == null) {
			return null;
		}

		const data = this.node.data;
		this.cursor -= 1;

		this.node = this.node?.next;

		this.subscribers.forEach(callback => callback({
			type: "pop",
			data: data,
		}));
		return data;

	}

	public peek(): T | null {
		if (this.node == null) {
			return null;
		}

		return this.node.data;
	}

	public isEmpty(): boolean {
		return this.node == null;
	}

	public get size(): number {
		return this.cursor;
	}

	public clear(): void {
		this.node = null;
		this.cursor = 0;
		this.subscribers.forEach(callback => callback({
			type: "clear",
			data: null,
		}));
	}

	private append(data: T): void {
		let current = this.node;
		if (!current) {
			this.node = new QueueNode<T>(data, null);
			return;
		}
		while (current?.next !== null) {
			current = current.next;
		}

		current.next = new QueueNode<T>(data, null);
		return;
	}
}
