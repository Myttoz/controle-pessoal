import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';

/** Loading — usado apenas na primeira abertura sem cache ou ao trocar de ano sem dados. */
export function Carregando({ texto = 'Carregando dados da API…' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
      <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
      <p className="text-sm">{texto}</p>
    </div>
  );
}

/** Skeleton sutil para áreas que já têm cache sendo revalidado. */
export function Skeleton({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="space-y-2 animate-pulse" aria-hidden>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="h-10 rounded-lg bg-slate-800/70" />
      ))}
    </div>
  );
}

export function EstadoVazio({
  icone: Icone = Inbox,
  titulo,
  descricao,
  acao,
}: {
  icone?: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-14 text-center">
      <Icone className="h-9 w-9 text-slate-600" />
      <p className="font-medium text-slate-300">{titulo}</p>
      {descricao && <p className="max-w-md text-sm text-slate-500">{descricao}</p>}
      {acao && <div className="mt-1">{acao}</div>}
    </div>
  );
}

export function AreaErro({
  mensagem,
  aoTentar,
}: {
  mensagem: string;
  aoTentar?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-900/60 bg-rose-950/30 px-6 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-rose-400" />
      <p className="max-w-lg text-sm text-rose-200">{mensagem}</p>
      {aoTentar && (
        <button
          type="button"
          onClick={aoTentar}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-700"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
