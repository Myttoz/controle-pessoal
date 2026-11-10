/**
 * Ponte única entre o renderer e a API.
 *
 * - No Electron, `window.api` é injetado pelo preload (IPC).
 * - No navegador, não existe `window.api`; usamos o adaptador `fetch`.
 *
 * Todo o restante do renderer importa `api` daqui — assim a mesma base de
 * código roda no desktop e na web sem `if (window.api)` espalhado.
 */
import type { ApiElectron } from '@/types/api-electron';
import { criarApiWeb } from './apiWeb';

const apiElectron =
  typeof window !== 'undefined'
    ? (window as unknown as { api?: ApiElectron }).api
    : undefined;

/** `true` quando está rodando dentro do Electron. */
export const ehDesktop = !!apiElectron;

export const api: ApiElectron = apiElectron ?? criarApiWeb();
