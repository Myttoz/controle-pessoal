import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';

const ESTILOS: Record<Variante, string> = {
  primario:
    'bg-sky-600 text-white hover:bg-sky-500 disabled:bg-sky-900 disabled:text-slate-500',
  secundario:
    'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 disabled:opacity-50',
  fantasma:
    'bg-transparent text-slate-300 hover:bg-slate-800/80 disabled:opacity-50',
  perigo:
    'bg-rose-900/70 text-rose-100 border border-rose-800 hover:bg-rose-800 disabled:opacity-50',
};

const TAMANHOS = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
} as const;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: keyof typeof TAMANHOS;
  icone?: LucideIcon;
  carregando?: boolean;
  children?: ReactNode;
}

export function Botao({
  variante = 'secundario',
  tamanho = 'md',
  icone: Icone,
  carregando = false,
  children,
  className = '',
  disabled,
  ...props
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed ${ESTILOS[variante]} ${TAMANHOS[tamanho]} ${className}`}
      {...props}
    >
      {carregando ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        Icone && <Icone className="h-4 w-4" />
      )}
      {children}
    </button>
  );
}
