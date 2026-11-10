/**
 * Configuração da API lida em tempo de EXECUÇÃO no processo main.
 * A chave nunca é embutida em bundle nenhum: vem de variável de ambiente
 * ou do arquivo .env na raiz do projeto.
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

/** URL de produção (fallback caso .env não exista). */
const BASE_PADRAO =
  'https://script.google.com/macros/s/AKfycbwGtqZPUDzsPFhvEq6LItsqTqnMLDXIAYJIRl5Wp4CXAiEYQgS1gvZy3FTCWbg5NbA/exec';

function lerArquivoEnv(): Record<string, string> {
  const caminhos: string[] = [path.join(process.cwd(), '.env')];
  try {
    caminhos.push(path.join(app.getPath('userData'), '.env'));
  } catch {
    // userData indisponível antes do ready — ignora
  }

  for (const caminho of caminhos) {
    try {
      if (!fs.existsSync(caminho)) continue;
      const texto = fs.readFileSync(caminho, 'utf8');
      const saida: Record<string, string> = {};
      for (const linha of texto.split(/\r?\n/)) {
        if (linha.trim().startsWith('#')) continue;
        const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m) continue;
        let valor = m[2].trim();
        if (
          (valor.startsWith('"') && valor.endsWith('"') && valor.length >= 2) ||
          (valor.startsWith("'") && valor.endsWith("'") && valor.length >= 2)
        ) {
          valor = valor.slice(1, -1);
        }
        saida[m[1]] = valor;
      }
      return saida;
    } catch {
      // tenta o próximo caminho
    }
  }
  return {};
}

export interface ConfigApi {
  baseUrl: string;
  /** '' = API sem chave → o parâmetro é omitido. */
  chave: string;
}

let cache: ConfigApi | null = null;

export function obterConfig(): ConfigApi {
  if (!cache) {
    const arquivo = lerArquivoEnv();
    const baseUrl = (process.env.BASE_URL || arquivo.BASE_URL || BASE_PADRAO).trim();
    const chave = (process.env.API_KEY ?? arquivo.API_KEY ?? '').trim();
    cache = { baseUrl, chave };
  }
  return cache;
}
