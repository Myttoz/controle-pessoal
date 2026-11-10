import type { ApiElectron } from '../../types/api-electron';

declare global {
  interface Window {
    /** Exposta pelo preload via contextBridge. */
    api: ApiElectron;
  }
}

export {};
