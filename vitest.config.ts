import { defineConfig } from 'vitest/config'
import { milliseconds } from "./src/constants.js";

export default defineConfig({
	test: {
		testTimeout: 2 * milliseconds.minute
	},
})
