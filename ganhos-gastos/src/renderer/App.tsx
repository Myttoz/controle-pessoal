import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { TitleBar } from '@/components/TitleBar';
import { Carregando } from '@/components/Estados';
import { useAtalhosGlobais } from '@/hooks/useAtalhosGlobais';
import { useStoreAno } from '@/store/storeAno';
import { useStoreLocal } from '@/store/storeLocal';
import { useStoreUI } from '@/store/storeUI';
import { useStoreAuth } from '@/store/storeAuth';
import { setTokenSessao, limparTokenSessao } from '@/services/api';
import { AnosPage } from '@/features/anos/AnosPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { FeriasPage } from '@/features/ferias/FeriasPage';
import { GanhosPage } from '@/features/ganhos/GanhosPage';
import { HorasExtrasPage } from '@/features/horasextras/HorasExtrasPage';
import { KanbanPage } from '@/features/kanban/KanbanPage';
import { LancamentosPage } from '@/features/lancamentos/LancamentosPage';
import { LembretesPage } from '@/features/lembretes/LembretesPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ManutencaoPage } from '@/features/manutencao/ManutencaoPage';
import { PagamentosPage } from '@/features/pagamentos/PagamentosPage';
import { SincronizacaoPage } from '@/features/sincronizacao/SincronizacaoPage';

export default function App() {
  const inicializar = useStoreAno((s) => s.inicializar);
  const iniciarDados = useStoreAno((s) => s.iniciarDados);
  const pronto = useStoreAno((s) => s.pronto);
  const inicializarLocal = useStoreLocal((s) => s.inicializar);
  const prontoLocal = useStoreLocal((s) => s.pronto);
  const pagina = useStoreUI((s) => s.pagina);
  const irPara = useStoreUI((s) => s.irPara);

  const { token, usuario, logout, verificar } = useStoreAuth();
  const autenticado = !!token && !!usuario;

  useAtalhosGlobais();

  // 1. Inicializa stores (cache + dados locais)
  useEffect(() => {
    void inicializar();
    void inicializarLocal();
  }, [inicializar, inicializarLocal]);

  // 2. Injeta o token no serviço de API quando houver token salvo
  useEffect(() => {
    if (token) {
      setTokenSessao(token);
    }
  }, [token]);

  // 3. Valida a sessão salva UMA vez na abertura. Se o token expirou (24h),
  //    o store faz logout e a tela de login aparece automaticamente.
  const verificouSessao = useRef(false);
  useEffect(() => {
    if (verificouSessao.current) return;
    verificouSessao.current = true;
    void verificar();
  }, [verificar]);

  // 4. Reenvia alterações pendentes quando a internet volta e a cada 30s.
  useEffect(() => {
    if (!autenticado) return;
    const tentar = () => {
      const estado = useStoreLocal.getState();
      if (estado.pendente || estado.erroSync) {
        void estado.sincronizar();
      }
    };
    window.addEventListener('online', tentar);
    const id = window.setInterval(tentar, 30_000);
    return () => {
      window.removeEventListener('online', tentar);
      window.clearInterval(id);
    };
  }, [autenticado]);

  // 5. Assim que o login acontece, busca os dados locais do servidor.
  //    (Na primeira abertura de um dispositivo novo é aqui que os dados
  //    de Horas Extras/Férias/Manutenção/salário chegam.)
  useEffect(() => {
    if (autenticado) {
      void useStoreLocal.getState().sincronizar();
    }
  }, [autenticado]);

  // 6. Após o login, carrega os anos e os lançamentos da planilha.
  useEffect(() => {
    if (autenticado) {
      void iniciarDados();
    }
  }, [autenticado, iniciarDados]);

  // 3. useMemo ANTES de qualquer return condicional — regra do React Hooks
  const paginas = useMemo(
    () => ({
      dashboard: <DashboardPage />,
      lancamentos: <LancamentosPage />,
      kanban: <KanbanPage />,
      pagamentos: <PagamentosPage />,
      ganhos: <GanhosPage />,
      horasextras: <HorasExtrasPage />,
      ferias: <FeriasPage />,
      manutencao: <ManutencaoPage />,
      anos: <AnosPage />,
      lembretes: <LembretesPage />,
      sincronizacao: <SincronizacaoPage />,
    }),
    [],
  );

  let conteudo: ReactNode;

  if (!pronto || !prontoLocal) {
    // Splash enquanto o processo main lê o cache em disco.
    conteudo = (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-600 text-white">
          <Wallet className="h-7 w-7" />
        </span>
        <p className="text-sm text-slate-400">Controle Pessoal</p>
        <Carregando texto="Abrindo…" />
      </div>
    );
  } else if (!autenticado) {
    // Não autenticado → mostra tela de login
    conteudo = <LoginPage />;
  } else {
    // Autenticado → renderiza a aplicação
    conteudo = (
      <Layout
        usuario={usuario?.usuario ?? ''}
        aoLogout={() => {
          limparTokenSessao();
          logout();
          irPara('dashboard');
        }}
      >
        {paginas[pagina as keyof typeof paginas]}
      </Layout>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950">
      <TitleBar />
      <div className="min-h-0 flex-1 overflow-hidden">{conteudo}</div>
    </div>
  );
}
