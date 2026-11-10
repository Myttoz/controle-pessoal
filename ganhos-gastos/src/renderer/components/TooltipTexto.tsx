import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** Conteúdo completo exibido na "janela" flutuante. */
  texto: string;
  children: ReactNode;
  className?: string;
  /** Disparado ao clicar no texto (útil para editar inline). */
  onClick?: () => void;
}

/**
 * Texto com "janela" flutuante ao passar o mouse (tooltip portalizado).
 * Usado na coluna Observação: a célula fica com limite de largura/truncate
 * e o tooltip mostra o conteúdo inteiro sem precisar rolar a tabela.
 */
export function TooltipTexto({ texto, children, className = '', onClick }: Props) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ topo: number; esquerda: number; paraCima: boolean } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);

  const abrir = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) {
        // estimativa de altura da janela (340px de largura, ~4 linhas)
        const paraCima = rect.bottom + 140 > window.innerHeight;
        setPosicao({ topo: rect.top, esquerda: rect.left, paraCima });
      }
      setAberto(true);
    }, 250);
  };

  const fechar = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setAberto(false);
  };

  // some ao rolar ou redimensionar (a posição deixa de ser válida)
  useEffect(() => {
    if (!aberto) return;
    const aoMudar = () => setAberto(false);
    window.addEventListener('scroll', aoMudar, true);
    window.addEventListener('resize', aoMudar);
    return () => {
      window.removeEventListener('scroll', aoMudar, true);
      window.removeEventListener('resize', aoMudar);
    };
  }, [aberto]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <>
      <span
        ref={ref}
        className={className}
        onMouseEnter={abrir}
        onMouseLeave={fechar}
        onFocus={abrir}
        onBlur={fechar}
        onClick={onClick}
      >
        {children}
      </span>
      {aberto &&
        posicao &&
        createPortal(
          <div
            role="tooltip"
            style={{
              left: Math.max(8, Math.min(posicao.esquerda, window.innerWidth - 356)),
              ...(posicao.paraCima
                ? { bottom: window.innerHeight - posicao.topo + 6 }
                : { top: posicao.topo + 26 }),
            }}
            className="fixed z-50 w-[340px] max-w-[calc(100vw-16px)] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs leading-relaxed break-words whitespace-pre-wrap text-slate-200 shadow-2xl shadow-black/50"
          >
            {texto}
          </div>,
          document.body,
        )}
    </>
  );
}
