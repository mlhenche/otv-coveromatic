import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
    plugins: [react(), viteSingleFile()],
    build: {
        outDir: 'plugin',
        target: 'esnext',
        assetsInlineLimit: 100000000,
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false,
        brotliSize: false,
        emptyOutDir: false, // Don't wipe the plugin directory because code.js is there
        rollupOptions: {
            input: {
                ui: path.resolve(__dirname, 'index.html'),
            }
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/ui')
        }
    }
});
