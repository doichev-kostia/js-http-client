import * as crypto from "node:crypto";

type UUID = `${string}-${string}-${string}-${string}-${string}`;

export function randomUUID(): UUID {
	if (typeof window === "undefined") {
		return crypto.randomUUID();
	} else {
		return window.crypto.randomUUID();
	}
}
