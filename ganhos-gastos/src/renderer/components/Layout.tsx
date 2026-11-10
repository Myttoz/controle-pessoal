import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BellRing,
  CalendarRange,
  Car,
  LayoutDashboard,
  LogOut,
  Palmtree,
  Receipt,
  RefreshCw,
  Timer,
  Trello,
  Wallet,
} from 'lucide-react';
import iconeApp from '@/assets/icon.png';
import { SeletorAno } from './SeletorAno';
import { StatusApi } from './StatusApi';
import { StatusSync } from './StatusSync';
import { Toasts } from './Toasts';
import { Botao } from './Botoes';
import { useStoreUI, type Pagina } from '@/store/storeUI';

/** Rótulo e ícone de cada página (o rótulo também aparece no cabeçalho). */
const PAGINAS: Record<Pagina, { rotulo: string; icone: LucideIcon }> = {
  dashboard: { rotulo: 'Dashboard', icone: LayoutDashboard },
  lancamentos: { rotulo: 'Lançamentos Mensais', icone: Receipt },
  kanban: { rotulo: 'Resumo Mensal', icone: Trello },
  pagamentos: { rotulo: 'Resumo Pagamentos', icone: CalendarRange },
  ganhos: { rotulo: 'Recebidos', icone: Wallet },
  horasextras: { rotulo: 'Horas Extras', icone: Timer },
  ferias: { rotulo: 'Férias', icone: Palmtree },
  manutencao: { rotulo: 'Registro Manutenção', icone: Car },
  anos: { rotulo: 'Gestão Anual', icone: CalendarRange },
  lembretes: { rotulo: 'LEMBRETES', icone: BellRing },
  sincronizacao: { rotulo: 'Sincronização e Backup', icone: RefreshCw },
};

type Destaque = 'azul' | 'ambar';

type ElementoNavegacao =
  | { tipo: 'item'; id: Pagina; destaque?: Destaque }
  | { tipo: 'separador' }
  | { tipo: 'subtitulo'; rotulo: string };

/**
 * Menu lateral agrupado.
 * A ordem alfabética é intencional (pedido do usuário).
 */
const NAVEGACAO: ElementoNavegacao[] = [
  { tipo: 'item', id: 'dashboard', destaque: 'azul' },

  { tipo: 'separador' },
  { tipo: 'subtitulo', rotulo: 'Lançamentos' },
  { tipo: 'item', id: 'ferias' },
  { tipo: 'item', id: 'horasextras' },
  { tipo: 'item', id: 'lancamentos' },
  { tipo: 'item', id: 'ganhos' },

  { tipo: 'separador' },
  { tipo: 'subtitulo', rotulo: 'Conferência' },
  { tipo: 'item', id: 'anos' },
  { tipo: 'item', id: 'kanban' },
  { tipo: 'item', id: 'pagamentos' },

  { tipo: 'separador' },
  { tipo: 'subtitulo', rotulo: 'Extras' },
  { tipo: 'item', id: 'lembretes', destaque: 'ambar' },
  { tipo: 'item', id: 'manutencao' },

  { tipo: 'separador' },
  { tipo: 'subtitulo', rotulo: 'Sistema' },
  { tipo: 'item', id: 'sincronizacao' },
];

/** Classes do botão de navegação (ativo + destaques permanentes). */
function classesNavegacao(ativo: boolean, destaque?: Destaque): string {
  const base =
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

  if (ativo) {
    if (destaque === 'ambar') {
      return `${base} bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-500/60`;
    }
    return `${base} bg-sky-600/20 text-sky-200 ring-1 ring-inset ring-sky-500/60`;
  }

  if (destaque === 'ambar') {
    return `${base} bg-amber-500/5 text-amber-300/90 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/10`;
  }
  if (destaque === 'azul') {
    return `${base} bg-sky-500/5 text-sky-300 ring-1 ring-inset ring-sky-500/25 hover:bg-sky-500/10`;
  }
  return `${base} text-slate-400 hover:bg-slate-800/70 hover:text-slate-200`;
}

interface Props {
  children: ReactNode;
  /** Nome do usuário logado (exibido no cabeçalho). */
  usuario: string;
  /** Ação de logout (limpa sessão e redireciona). */
  aoLogout: () => void;
}

/** Casca do app: navegação fixa à esquerda + topo com ano e status da API. */
export function Layout({ children, usuario, aoLogout }: Props) {
  const pagina = useStoreUI((s) => s.pagina);
  const irPara = useStoreUI((s) => s.irPara);

  return (
    <div className="flex h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* ---------- lateral ---------- */}
      <aside className="flex w-16 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 md:w-60">
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-800 px-4">
          <img
            src={iconeApp}
            alt=""
            draggable={false}
            className="h-8 w-8 shrink-0 select-none"
          />
          <span className="hidden truncate text-sm font-semibold tracking-tight md:block">
            Controle Pessoal
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 md:p-3">
          {NAVEGACAO.map((elemento, indice) => {
            if (elemento.tipo === 'separador') {
              return (
                <div
                  key={`sep-${indice}`}
                  className="mx-2 my-1 border-t border-slate-800 md:mx-3"
                  aria-hidden
                />
              );
            }

            if (elemento.tipo === 'subtitulo') {
              return (
                <p
                  key={`sub-${indice}`}
                  className="hidden px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:block"
                >
                  {elemento.rotulo}
                </p>
              );
            }

            const { rotulo, icone: Icone } = PAGINAS[elemento.id];
            const ativo = pagina === elemento.id;
            return (
              <button
                key={elemento.id}
                type="button"
                onClick={() => irPara(elemento.id)}
                title={rotulo}
                aria-current={ativo ? 'page' : undefined}
                className={classesNavegacao(ativo, elemento.destaque)}
              >
                <Icone className="h-5 w-5 shrink-0" />
                <span className="hidden md:block">{rotulo}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-slate-800 p-3 text-[11px] leading-relaxed text-slate-600">
          <StatusSync />
          <span className="hidden md:block">Dados via API Google Sheets</span>
          <span className="md:hidden">API</span>
        </div>
      </aside>

      {/* ---------- principal ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/50 px-4">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-200 sm:text-base">
              {PAGINAS[pagina].rotulo}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <StatusApi />
            <SeletorAno />
            <div className="flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-800/50 px-2 py-1 text-xs text-slate-300">
              <span>{usuario}</span>
              <Botao
                icone={LogOut}
                variante="fantasma"
                tamanho="sm"
                onClick={aoLogout}
                title="Sair"
              />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5 lg:px-7">{children}</main>
      </div>

      <Toasts />
    </div>
  );
}
