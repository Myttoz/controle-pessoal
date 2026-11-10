/**
 * Preload — ponte segura entre o renderer e o processo main.
 * Nada de Node no renderer: só a API exposta abaixo via contextBridge.
 */
import { contextBridge, ipcRenderer } from 'electron';
import type {
  ApiElectron,
  CachePersistido,
  DadosLocais,
  PayloadEscrita,
  PayloadLogin,
  PayloadVerificar,
} from '@/types/api-electron';

const api: ApiElectron = {
  janela: {
    minimizar: () => ipcRenderer.invoke('janela:minimizar'),
    maximizar: () => ipcRenderer.invoke('janela:maximizar'),
    fechar: () => ipcRenderer.invoke('janela:fechar'),
    estado: () => ipcRenderer.invoke('janela:estado'),
    aoMudarMaximizado: (callback) => {
      const ouvinte = (_evento: Electron.IpcRendererEvent, maximizada: boolean) =>
        callback(maximizada);
      ipcRenderer.on('janela:maximizada', ouvinte);
      return () => ipcRenderer.removeListener('janela:maximizada', ouvinte);
    },
  },

  getAbas: () => ipcRenderer.invoke('api:abas'),
  getAno: (ano: number) => ipcRenderer.invoke('api:ano', ano),
  getDashboard: (ano: number, agrupar?: string) =>
    ipcRenderer.invoke('api:dashboard', ano, agrupar),
  getListas: () => ipcRenderer.invoke('api:listas'),
  listar: (aba: string, tabela?: 'ganhos' | 'gastos') =>
    ipcRenderer.invoke('api:listar', aba, tabela),

  escrita: (payload: PayloadEscrita) => ipcRenderer.invoke('api:escrita', payload),

  login: (payload: PayloadLogin) => ipcRenderer.invoke('api:login', payload),
  verificar: (payload: PayloadVerificar) => ipcRenderer.invoke('api:verificar', payload),
  proxy: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('api:proxy', payload),

  cacheCarregar: () => ipcRenderer.invoke('cache:carregar'),
  cacheSalvar: (cache: CachePersistido) => ipcRenderer.invoke('cache:salvar', cache),

  localCarregar: () => ipcRenderer.invoke('local:carregar'),
  localSalvar: (dados: DadosLocais) => ipcRenderer.invoke('local:salvar', dados),

  configResumo: () => ipcRenderer.invoke('config:resumo'),
};

contextBridge.exposeInMainWorld('api', api);
