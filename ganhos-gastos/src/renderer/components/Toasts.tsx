import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useStoreUI, type ToastUI } from '@/store/storeUI';

const ICONES: Record<ToastUI['tipo'], typeof CheckCircle2> = {
  sucesso: CheckCircle2,
  erro: AlertCircle,
  info: Info,
};

const CORES: Record<ToastUI['tipo'], string> = {
  sucesso: 'border-emerald-700/60 text-emerald-300',
  erro: 'border-rose-700/60 text-rose-200',
  info: 'border-sky-700/60 text-sky-200',
};

/** Toasts globais (canto inferior direito) — erros de API, confirmações de escrita. */
export function Toasts() {
  const toasts = useStoreUI((s) => s.toasts);
  const remover = useStoreUI((s) => s.removerToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => {
        const Icone = ICONES[toast.tipo];
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-slate-900 px-3.5 py-3 shadow-xl shadow-black/40 animate-toast-in ${CORES[toast.tipo]}`}
          >
            <Icone className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-sm leading-snug text-slate-200">{toast.texto}</p>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => remover(toast.id)}
              className="rounded p-0.5 text-slate-500 transition hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
