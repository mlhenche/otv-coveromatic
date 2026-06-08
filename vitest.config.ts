import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environmentMatchGlobs: [
            ['src/lib/html-parser.test.ts', 'jsdom'],
        ],
    },
});
