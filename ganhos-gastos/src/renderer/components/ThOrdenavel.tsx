import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronDown, ListFilter, Search } from 'lucide-react';

export type DirecaoOrdem = 'asc' | 'desc';

interface FiltroColuna {
  /** Valores disponíveis (estilo tabela dinâmica do Excel). */
  opcoes: string[];
  /** Selecionados — vazio = todos. */
  selecionados: string[];
  aoAlternar: (valor: string) => void;
  /** Botão "Todos" do menu. */
  aoLimpar: () => void;
}

interface Props {
  rotulo: ReactNode;
  /** Direção atual desta coluna; null = sem ordenação. */
  direcao: DirecaoOrdem | null;
  /** Alterna asc → desc → sem ordenação. */
  aoOrdenar: () => void;
  /** Direção aplicada no primeiro clique (padrão 'asc'). */
  primeiraDirecao?: DirecaoOrdem;
  alinhamento?: 'left' | 'right';
  /** Classes do contentor (alinhamento, padding, largura). */
  className?: string;
  /** Habilita o menu de filtro multi-seleção. */
  filtro?: FiltroColuna;
  titulo?: string;
}

const ICONE_ORDEM: Record<DirecaoOrdem, typeof ArrowUp> = {
  asc: ArrowUp,
  desc: ArrowDown,
};

/**
 * Cabeçalho de coluna clicável (ordenação) com menu opcional de filtro
 * multi-seleção — usado nas tabelas de Lançamentos e Manutenção.
 * O menu é renderizado em portal (position: fixed) para não ser cortado
 * pelos contêineres com overflow das tabelas.
 */
export function ThOrdenavel({
  rotulo,
  direcao,
  aoOrdenar,
  primeiraDirecao = 'asc',
  alinhamento = 'left',
  className = '',
  filtro,
  titulo,
}: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [posicao, setPosicao] = useState<{
    topo?: number;
    paraCima: boolean;
    base?: number;
    esquerda: number;
    largura: number;
    alturaMax: number;
  } | null>(null);
  const [busca, setBusca] = useState('');
  const botaoMenuRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const ativo = filtro !== undefined && filtro.selecionados.length > 0;

  useEffect(() => {
    if (!menuAberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (menuRef.current?.contains(alvo) || botaoMenuRef.current?.contains(alvo)) return;
      setMenuAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAberto(false);
    };
    const aoRolar = (e: Event) => {
      // rolagem DENTRO do próprio menu (lista de opções) não fecha — só a externa
      const alvo = e.target as Node;
      if (menuRef.current?.contains(alvo)) return;
      setMenuAberto(false);
    };
    const fechar = () => setMenuAberto(false);
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    window.addEventListener('resize', fechar);
    window.addEventListener('scroll', aoRolar, true);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('scroll', aoRolar, true);
    };
  }, [menuAberto]);

  useEffect(() => {
    if (!menuAberto) setBusca('');
  }, [menuAberto]);

  const abrirMenu = () => {
    const rect = botaoMenuRef.current?.getBoundingClientRect();
    if (rect) {
      const largura = Math.max(200, rect.width);
      const esquerda = Math.min(rect.left, window.innerWidth - largura - 8);
      // altura máxima = espaço disponível na viewport (nunca "vaza" da tela)
      const espacoAbaixo = window.innerHeight - rect.bottom - 12;
      const espacoAcima = rect.top - 12;
      const abrirParaCima = espacoAbaixo < 240 && espacoAcima > espacoAbaixo;
      const alturaMax = Math.max(
        160,
        Math.min(abrirParaCima ? espacoAcima : espacoAbaixo, 480),
      );
      setPosicao({
        topo: abrirParaCima ? undefined : rect.bottom + 4,
        paraCima: abrirParaCima,
        base: abrirParaCima ? window.innerHeight - rect.top + 4 : undefined,
        esquerda: Math.max(8, esquerda),
        largura,
        alturaMax,
      });
    }
    setMenuAberto((atual) => !atual);
  };

  const opcoes = filtro?.opcoes ?? [];
  const termo = busca.trim().toLowerCase();
  const opcoesVisiveis =
    termo.length > 0 ? opcoes.filter((op) => op.toLowerCase().includes(termo)) : opcoes;
  const mostrarBusca = opcoes.length > 12;

  const conteudo = (
    <div
      ref={menuRef}
      style={
        posicao
          ? {
              ...(posicao.paraCima
                ? { bottom: posicao.base }
                : { top: posicao.topo }),
              left: posicao.esquerda,
              minWidth: posicao.largura,
              maxHeight: posicao.alturaMax,
            }
          : { top: 0, left: 0, visibility: 'hidden' }
      }
      className="fixed z-50 flex flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50"
      role="menu"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {typeof rotulo === 'string' ? rotulo : 'Filtro'}
        </span>
        <button
          type="button"
          onClick={filtro?.aoLimpar}
          className="rounded px-1.5 py-0.5 text-[11px] font-medium text-sky-400 transition hover:bg-slate-800 hover:text-sky-300"
        >
          Todos
        </button>
      </div>

      {mostrarBusca && (
        <div className="border-b border-slate-800 px-2.5 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pl-7 pr-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {opcoesVisiveis.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-slate-500">Nenhuma opção.</p>
        )}
        {opcoesVisiveis.map((op) => {
          const marcado = filtro?.selecionados.includes(op) ?? false;
          return (
            <label
              key={op}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={marcado}
                onChange={() => filtro?.aoAlternar(op)}
                className="h-3.5 w-3.5 accent-sky-500"
              />
              <span className="truncate" title={op}>
                {op || '(vazio)'}
              </span>
            </label>
          );
        })}
      </div>

      <p className="shrink-0 border-t border-slate-800 px-3 py-1.5 text-[10px] text-slate-600">
        {filtro && filtro.selecionados.length > 0
          ? `${filtro.selecionados.length} de ${opcoes.length} selecionado(s)`
          : `${opcoes.length} opção(ões)`}
      </p>
    </div>
  );

  const alinhaDireita = alinhamento === 'right';

  return (
    <div
      className={`flex items-center gap-1 ${alinhaDireita ? 'justify-end text-right' : 'justify-start text-left'} ${className}`}
      role="columnheader"
      title={titulo}
    >
      <button
        type="button"
        onClick={aoOrdenar}
        title={
          titulo ??
          `Ordenar por ${typeof rotulo === 'string' ? rotulo.toLowerCase() : 'coluna'} (${
            direcao === 'asc'
              ? 'crescente — clique para decrescente'
              : direcao === 'desc'
                ? 'decrescente — clique para remover'
                : `${primeiraDirecao === 'desc' ? 'decrescente' : 'crescente'} — clique para ordenar`
          })`
        }
        className="group flex min-w-0 items-center gap-1 rounded px-1 py-0.5 transition hover:bg-slate-800/70"
      >
        <span className="truncate">{rotulo}</span>
        {direcao ? (
          (() => {
            const Icone = ICONE_ORDEM[direcao];
            return <Icone className="h-3.5 w-3.5 shrink-0 text-sky-400" />;
          })()
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-700 transition group-hover:text-slate-500" />
        )}
      </button>

      {filtro && (
        <button
          ref={botaoMenuRef}
          type="button"
          onClick={abrirMenu}
          aria-label={`Filtrar ${typeof rotulo === 'string' ? rotulo : ''}`}
          title="Filtrar valores"
          className={`rounded p-1 transition hover:bg-slate-800/70 ${
            ativo ? 'text-sky-400' : 'text-slate-600 hover:text-slate-400'
          }`}
        >
          <ListFilter className="h-3.5 w-3.5" />
        </button>
      )}

      {menuAberto && posicao && createPortal(conteudo, document.body)}
    </div>
  );
}
