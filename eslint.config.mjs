import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

// Globales comunes de navegador / runtime moderno (fetch, timers, URL, etc.)
const browserGlobals = {
    fetch: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    console: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    Promise: 'readonly',
};

export default tseslint.config(
    {
        ignores: [
            'node_modules',
            'plugin/code.js',
            'plugin/ui.html',
            'catalog/*.json',
            'supabase',
            '**/*.test.ts',
        ],
    },

    // Reglas base para todo el TypeScript/TSX
    js.configs.recommended,
    ...tseslint.configs.recommended,

    // Deuda preexistente: reportar, no bloquear. Se limpia en la Fase 2 de código.
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-empty': 'warn',
            'no-useless-assignment': 'warn',
        },
    },

    // UI React (iframe del navegador)
    {
        files: ['src/ui/**/*.{ts,tsx}'],
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        languageOptions: {
            globals: {
                ...browserGlobals,
                window: 'readonly',
                document: 'readonly',
                parent: 'readonly',
                DOMParser: 'readonly',
                Element: 'readonly',
                HTMLElement: 'readonly',
                Image: 'readonly',
                localStorage: 'readonly',
            },
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            // Hallazgos preexistentes (p. ej. setState en efectos): reportar, no
            // bloquear. Se abordan en la Fase 2 de refactor.
            'react-hooks/set-state-in-effect': 'warn',
        },
    },

    // Backend (sandbox de Figma)
    {
        files: ['src/code.ts'],
        languageOptions: {
            globals: {
                ...browserGlobals,
                figma: 'readonly',
                __html__: 'readonly',
            },
        },
    },

    // Scripts CLI (Node, CommonJS)
    {
        files: ['scripts/**/*.js', 'catalog/**/*.js'],
        languageOptions: {
            globals: {
                ...browserGlobals,
                require: 'readonly',
                module: 'writable',
                process: 'readonly',
                __dirname: 'readonly',
            },
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },

    // Desactiva reglas que chocan con Prettier
    prettier,
);
