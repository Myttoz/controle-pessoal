import { AlertCircle, RefreshCw, Wifi } from 'lucide-react';
import { useStoreAno } from '@/store/storeAno';

function hora(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Indicador global de conexão com a API (5.11).
 * Nunca bloqueia a UI: mostra "sincronizando", "sincronizado" ou "erro".
 */
export function StatusApi() {
  const revalidacoes = useStoreAno((s) => s.revalidacoes);
  const escritas = useStoreAno((s) => s.escritasPendentes);
  const erro = useStoreAno((s) => s.erro);
  const anoSelecionado = useStoreAno((s) => s.anoSelecionado);
  const atualizadoEm = useStoreAno((s) => s.atualizadoEm);
  const revalidar = useStoreAno((s) => s.revalidar);

  const sincronizando = revalidacoes > 0 || escritas > 0;
  const ultima = anoSelecionado != null ? atualizadoEm[anoSelecionado] : undefined;

  const conteudo = (() => {
    if (sincronizando) {
      return (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
          <span className="text-amber-300">Sincronizando…</span>
        </>
      );
    }
    if (erro) {
      return (
        <>
          <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
          <span className="text-rose-300">Sem conexão</span>
        </>
      );
    }
    return (
      <>
        <Wifi className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-emerald-300">
          Sincronizado{ultima ? ` · ${hora(ultima)}` : ''}
        </span>
      </>
    );
  })();

  return (
    <div className="flex items-center gap-2">
      <span
        title={erro ?? 'Status da API'}
        className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs"
      >
        {conteudo}
      </span>
      <button
        type="button"
        onClick={() => void revalidar()}
        disabled={sincronizando}
        title="Atualizar dados do ano agora (revalidação em segundo plano)"
        aria-label="Atualizar dados"
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
