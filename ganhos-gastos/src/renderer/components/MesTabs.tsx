import type { MesSnapshot, SiglaMes } from '@/types/api-types';
import { NOMES_MESES, SIGLAS } from '@/lib/meses';

interface Props {
  meses: Partial<Record<SiglaMes, MesSnapshot | null>>;
  selecionado: SiglaMes;
  aoSelecionar: (mes: SiglaMes) => void;
}

/**
 * Seletor de mês (JAN..DEZ). Mesmo componente em Lançamentos e Kanban.
 * Botões: ponto indicando mês com lançamentos; aba inexistente fica esmaecida.
 */
export function MesTabs({ meses, selecionado, aoSelecionar }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SIGLAS.map((sigla) => {
        const snapshot = meses[sigla];
        const ativo = sigla === selecionado;
        const temAba = snapshot != null;
        const temDados = !!snapshot && snapshot.registros.length > 0;
        return (
          <button
            key={sigla}
            type="button"
            onClick={() => aoSelecionar(sigla)}
            title={`${NOMES_MESES[sigla]}${temAba ? '' : ' — aba não existe neste ano'}`}
            className={`relative rounded-lg px-2.5 py-1.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              ativo
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-900/40'
                : temAba
                  ? 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/80'
                  : 'bg-slate-900/60 text-slate-600 hover:bg-slate-800/60'
            }`}
          >
            {sigla}
            {temDados && !ativo && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}
