import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

const RAIZ = process.cwd();
const SRC = path.resolve(RAIZ, 'src');
const RENDERER = path.resolve(SRC, 'renderer');
const TIPOS = path.resolve(SRC, 'types');

/** Aliases compartilhados por renderer, main e preload. */
const ALIAS: { find: RegExp | string; replacement: string }[] = [
  { find: /^@\/types\//, replacement: `${TIPOS}/` },
  { find: '@', replacement: RENDERER },
];

// https://vitejs.dev/config/
export default defineConfig({
  // base './' para que a build funcione carregada via file:// no Electron
  base: './',
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          resolve: { alias: ALIAS },
          build: { outDir: 'out/main' },
        },
      },
      preload: {
        input: 'src/preload/index.ts',
        vite: {
          resolve: { alias: ALIAS },
          build: {
            outDir: 'out/preload',
            rollupOptions: {
              output: { format: 'cjs', entryFileNames: '[name].js' },
            },
          },
        },
      },
    }),
  ],
  resolve: { alias: ALIAS },
  build: { outDir: 'out/renderer' },
});
