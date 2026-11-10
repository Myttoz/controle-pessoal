/**
 * Persistência dos DADOS LOCAIS (hora extra, férias, manutenção) em disco.
 * Mesmo padrão do cacheStore: JSON no userData, debounce e escrita atômica.
 * Estes dados NÃO passam pela API do Google Apps Script — são exclusivos do app.
 */
import { app } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { DadosLocais } from '../types/dados-locais';

const DEBOUNCE_MS = 400;

let timer: ReturnType<typeof setTimeout> | null = null;
let pendente: DadosLocais | null = null;

function caminho(): string {
  return path.join(app.getPath('userData'), 'dados-locais.json');
}

export async function carregarDadosLocais(): Promise<DadosLocais | null> {
  try {
    const texto = await fsp.readFile(caminho(), 'utf8');
    const obj = JSON.parse(texto) as DadosLocais;
    if (obj && obj.versao === 1 && typeof obj.config === 'object') return obj;
    return null;
  } catch {
    return null;
  }
}

function gravar(dados: DadosLocais): void {
  try {
    const destino = caminho();
    const tmp = `${destino}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(dados), 'utf8');
    fs.renameSync(tmp, destino);
  } catch (e) {
    console.error('[dados-locais] falha ao gravar:', e);
  }
}

export function salvarDadosLocais(dados: DadosLocais): void {
  pendente = { ...dados, salvoEm: Date.now() };
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
export function flushDadosLocais(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pendente) {
    gravar(pendente);
    pendente = null;
  }
}
