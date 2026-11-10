/**
 * Persistência do cache em disco (JSON no diretório de dados do usuário).
 * O renderer manda salvar o cache; aqui gravamos de forma assíncrona e
 * debounce, com escrita atômica (tmp + rename) para não corromper o arquivo.
 */
import { app } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { CachePersistido } from '../types/api-electron';

const DEBOUNCE_MS = 600;

let timer: ReturnType<typeof setTimeout> | null = null;
let pendente: CachePersistido | null = null;

function caminhoCache(): string {
  return path.join(app.getPath('userData'), 'cache-ganhos-gastos.json');
}

export async function carregarCache(): Promise<CachePersistido | null> {
  try {
    const texto = await fsp.readFile(caminhoCache(), 'utf8');
    const obj = JSON.parse(texto) as CachePersistido;
    if (obj && obj.versao === 1 && typeof obj.snapshots === 'object') return obj;
    return null;
  } catch {
    return null;
  }
}

function gravar(cache: CachePersistido): void {
  try {
    const destino = caminhoCache();
    const tmp = `${destino}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache), 'utf8');
    fs.renameSync(tmp, destino);
  } catch (e) {
    console.error('[cache] falha ao gravar:', e);
  }
}

export function salvarCache(cache: CachePersistido): void {
  pendente = cache;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (pendente) {
      gravar(pendente);
      pendente = null;
    }
  }, DEBOUNCE_MS);
}

/** Grava imediatamente o que estiver pendente (antes de fechar o app). */
export function flushCache(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pendente) {
    gravar(pendente);
    pendente = null;
  }
}
