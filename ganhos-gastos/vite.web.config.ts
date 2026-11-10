/**
 * Configuração de build da VERSÃO WEB (GitHub Pages).
 *
 * Diferenças em relação ao vite.config.ts (desktop):
 *  - NÃO inclui o plugin do Electron (main/preload);
 *  - gera tudo em dist-web;
 *  - `base: './'` funciona tanto em https://usuario.github.io/repo/ quanto
 *    em qualquer subpasta.
 */
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const RAIZ = process.cwd();
const SRC = path.resolve(RAIZ, 'src');
const RENDERER = path.resolve(SRC, 'renderer');
const TIPOS = path.resolve(SRC, 'types');

const ALIAS: { find: RegExp | string; replacement: string }[] = [
  { find: /^@\/types\//, replacement: `${TIPOS}/` },
  { find: '@', replacement: RENDERER },
];

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: ALIAS },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
  },
});
