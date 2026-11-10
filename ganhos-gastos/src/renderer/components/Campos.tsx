import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export const CLASSES_INPUT =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50';

export const CLASSES_SELECT = `${CLASSES_INPUT} appearance-none pr-8`;

interface CampoProps {
  rotulo: string;
  children: ReactNode;
  dica?: string;
  className?: string;
}

export function Campo({ rotulo, children, dica, className = '' }: CampoProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {rotulo}
      </span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-500">{dica}</span>}
    </label>
  );
}

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Entrada(props, ref) {
    return <input ref={ref} {...props} className={`${CLASSES_INPUT} ${props.className ?? ''}`} />;
  },
);

export function Selecao(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`${CLASSES_SELECT} ${props.className ?? ''}`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-500">
        ▾
      </span>
    </div>
  );
}
