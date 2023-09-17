import { describe, expect, it } from "vitest";
import { Queue } from "./queue.js";

describe("Queue", () => {
	it("should be able to push and pop items", () => {
		const queue = new Queue<number>();
		const num = 42;

		expect(queue.isEmpty()).toBe(true);
		queue.push(num);
		expect(queue.isEmpty()).toBe(false);
		expect(queue.size).toBe(1);
		expect(queue.peek()).toBe(num);
		expect(queue.pop()).toBe(num);
		expect(queue.isEmpty()).toBe(true);
		expect(queue.size).toBe(0);
		expect(queue.peek()).toBe(null);
	})

	it("should be able to clear the queue", () => {
		const queue = new Queue<number>();
		const num = 42;

		queue.push(num);
		queue.clear();
		expect(queue.isEmpty()).toBe(true);
		expect(queue.size).toBe(0);
		expect(queue.peek()).toBe(null);
	});

	it("should be able to subscribe to queue events", () => {
		const queue = new Queue<number>();
		const num = 42;
		let events: string[] = [];

		queue.subscribe(event => {
			events.push(event.type);
		});

		queue.push(num);
		queue.pop();
		queue.clear();

		expect(events).toEqual(["push", "pop", "clear"]);
	})
})
