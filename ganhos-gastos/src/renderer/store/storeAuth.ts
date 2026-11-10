/**
 * Store de autenticação (Zustand).
 *
 * Gerencia: token de sessão, dados do usuário, estado de carregamento e erro.
 * Persiste token e usuário em localStorage para sobreviver a recargas.
 */
import { create } from 'zustand';
import type { Usuario } from '@/types/api-types';
import type { PayloadLogin, PayloadVerificar } from '@/types/api-electron';
import { setTokenSessao, limparTokenSessao, definirAoNaoAutorizado } from '@/services/api';
import { api } from '@/services/ponte';
import { useStoreUI } from './storeUI';

const TOKEN_KEY = 'gg_token';
const USUARIO_KEY = 'gg_usuario';

interface EstadoAuth {
  /** Token de sessão (vazio = não autenticado). */
  token: string;
  /** Dados do usuário logado. */
  usuario: Usuario | null;
  /** true enquanto aguarda resposta de login/verificar. */
  carregando: boolean;
  /** Último erro de autenticação. */
  erro: string | null;

  /** Tenta logar com usuário/senha. Salva localStorage e injeta token no serviço API. */
  login: (usuario: string, senha: string) => Promise<boolean>;
  /** Verifica se o token atual ainda é válido (usado na inicialização do app). */
  verificar: () => Promise<boolean>;
  /** Limpa sessão, localStorage e serviço API. */
  logout: () => void;
  /** Define token/usuario manualmente. */
  setSessao: (token: string, usuario: Usuario) => void;
  limparErro: () => void;
}

export const useStoreAuth = create<EstadoAuth>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY) ?? '',
  usuario: (() => {
    try {
      const raw = localStorage.getItem(USUARIO_KEY);
      return raw ? (JSON.parse(raw) as Usuario) : null;
    } catch {
      return null;
    }
  })(),
  carregando: false,
  erro: null,

  login: async (usuario, senha) => {
    set({ carregando: true, erro: null });
    try {
      console.log('[auth] login() iniciado para:', usuario);
      const payload: PayloadLogin = { acao: 'login', usuario, senha };
      const resposta = await api.login(payload);
      console.log('[auth] resposta do login:', resposta);

      if (!resposta.sucesso) {
        set({ erro: 'Usuário ou senha incorreto.', carregando: false });
        return false;
      }

      const { token, usuario: u } = resposta;
      const usuarioPerfil: Usuario = { usuario: u };

      // 1. Salva no localStorage
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USUARIO_KEY, JSON.stringify(usuarioPerfil));
      console.log('[auth] salvo em localStorage');

      // 2. Injeta token no serviço de API
      setTokenSessao(token);
      console.log('[auth] token injetado no serviço API');

      // 3. Atualiza estado do Zustand
      set({
        token,
        usuario: usuarioPerfil,
        carregando: false,
        erro: null,
      });
      console.log('[auth] estado Zustand atualizado');

      // NÃO chamar verificar() aqui — só na inicialização do app
      return true;
    } catch (e) {
      const mensagem =
        e instanceof Error && e.message ? e.message : 'Erro ao tentar logar.';
      console.error('[auth] erro no login:', e);
      set({ erro: mensagem, carregando: false });
      return false;
    }
  },

  verificar: async () => {
    const { token } = get();
    console.log('[auth] verificar() chamado, token presente:', !!token);
    if (!token) {
      console.log('[auth] verificar(): sem token, retornando false');
      return false;
    }
    set({ carregando: true, erro: null });
    try {
      const payload: PayloadVerificar = { acao: 'verificar', token };
      const resposta = await api.verificar(payload);
      console.log('[auth] resposta do verificar:', resposta);

      if (!resposta.sucesso) {
        console.log('[auth] verificar(): token inválido, fazendo logout');
        get().logout();
        return false;
      }
      console.log('[auth] verificar(): token válido');
      set({ carregando: false, erro: null });
      return true;
    } catch (e) {
      const mensagem =
        e instanceof Error && e.message ? e.message : 'Erro ao verificar sessão.';
      console.error('[auth] erro no verificar:', e);
      set({ erro: mensagem, carregando: false });
      return false;
    }
  },

  logout: () => {
    console.log('[auth] logout() executado');
    set({ token: '', usuario: null, carregando: false, erro: null });
    limparTokenSessao();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
  },

  setSessao: (token, usuario) => {
    set({ token, usuario, carregando: false, erro: null });
    setTokenSessao(token);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
  },

  limparErro: () => set({ erro: null }),
}));

// ---------------------------------------------------------------------------
//  Sessão expirada: qualquer resposta "TOKEN_INVALIDO"/"NAO_AUTORIZADO"
//  derruba a sessão e volta para a tela de login automaticamente.
// ---------------------------------------------------------------------------
definirAoNaoAutorizado(() => {
  const { token } = useStoreAuth.getState();
  if (!token) return;
  useStoreAuth.getState().logout();
  useStoreUI.getState().toast('erro', 'Sessão expirada. Faça login novamente.');
});
