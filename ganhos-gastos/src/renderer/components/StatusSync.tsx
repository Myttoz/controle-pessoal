import { Check, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStoreLocal } from '@/store/storeLocal';

/**
 * Indicador compacto da sincronização dos dados locais
 * (Horas Extras, Férias, Manutenção e salário).
 */
export function StatusSync() {
  const sincronizando = useStoreLocal((s) => s.sincronizando);
  const pendente = useStoreLocal((s) => s.pendente);
  const erro = useStoreLocal((s) => s.erroSync);

  if (sincronizando) {
    return (
      <span className="flex items-center gap-1.5 text-sky-300" title="Sincronizando dados locais">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden md:inline">Sincronizando…</span>
      </span>
    );
  }

  if (erro) {
    return (
      <span
        className="flex items-center gap-1.5 text-amber-300"
        title={`Sem conexão com o servidor. As alterações ficam salvas e serão enviadas depois.\n${erro}`}
      >
        <CloudOff className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Offline · pendente</span>
      </span>
    );
  }

  if (pendente) {
    return (
      <span
        className="flex items-center gap-1.5 text-amber-300"
        title="Alterações salvas neste dispositivo aguardando envio"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Pendente</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-emerald-400" title="Dados sincronizados">
      <Check className="h-3.5 w-3.5" />
      <span className="hidden md:inline">Sincronizado</span>
    </span>
  );
}
