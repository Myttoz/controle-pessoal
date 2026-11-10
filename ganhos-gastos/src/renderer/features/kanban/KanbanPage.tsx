import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical, SquareKanban } from 'lucide-react';
import { LISTAS, type LancamentoMensal, type Registro, type TipoPagamento } from '@/types/api-types';
import { BadgeCategoria } from '@/components/BadgeCategoria';
import { AreaErro, Carregando, EstadoVazio } from '@/components/Estados';
import { MesTabs } from '@/components/MesTabs';
import { arredondar2, formatarMoeda } from '@/lib/formatar';
import { resumirDivisao } from '@/lib/divisao';
import { useRegistrosFiltrados } from '@/hooks/useRegistrosFiltrados';
import { useStoreAno } from '@/store/storeAno';
import { useStoreUI } from '@/store/storeUI';

const TIPOS: TipoPagamento[] = [...LISTAS.TIPO];

// ---------------------------------------------------------------------------
//  Quem paga — ajuda a filtrar registros da coluna Despesas Livia
// ---------------------------------------------------------------------------
function éDespesaLivia(d: LancamentoMensal): boolean {
  return d['QUEM PAGA'] === 'Dividido 50/50' || d['QUEM PAGA'] === 'Livia';
}

// ---------------------------------------------------------------------------
//  Cartão (arrastável)
// ---------------------------------------------------------------------------
function Cartao({ registro }: { registro: Registro<LancamentoMensal> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `reg-${registro.linha}`,
    data: { registro },
  });

  const d = registro.dados;
  const estilo = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...estilo, touchAction: 'none' }}
      {...listeners}
      {...attributes}
      className={`group cursor-grab select-none rounded-lg border border-slate-700/80 bg-slate-800/80 p-2.5 transition hover:border-slate-600 hover:bg-slate-800 active:cursor-grabbing ${
        isDragging ? 'z-10 opacity-40 ring-2 ring-sky-500' : ''
      }`}
      title="Arraste para outro tipo de pagamento"
    >
      <div className="flex items-start justify-between gap-2">
        <BadgeCategoria categoria={d.CATEGORIA} />
        <span className="flex items-center gap-1">
          <span className="text-sm font-semibold tabular-nums text-slate-100">
            {formatarMoeda(d.VALOR)}
          </span>
          <GripVertical className="h-3.5 w-3.5 text-slate-600 transition group-hover:text-slate-400" />
        </span>
      </div>
      <p className="mt-1.5 truncate text-sm text-slate-300" title={d.DESCRIÇÃO}>
        {d.DESCRIÇÃO || '—'}
      </p>
      <p className="mt-1 truncate text-[11px] text-slate-500">
        {d['FORMA DE PGTO']} · {d['QUEM PAGA']}
        {d.DATA ? ` · ${d.DATA.split('-').reverse().join('/')}` : ''}
      </p>
      {d.OBSERVAÇÃO && (
        <p className="mt-1 truncate text-[11px] italic text-slate-500" title={d.OBSERVAÇÃO}>
          Obs.: {d.OBSERVAÇÃO}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Coluna (soltável) — uma por TIPO
// ---------------------------------------------------------------------------
function Coluna({
  tipo,
  registros,
  destacada,
}: {
  tipo: TipoPagamento;
  registros: Registro<LancamentoMensal>[];
  destacada: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tipo });

  const total = useMemo(
    () => arredondar2(registros.reduce((soma, r) => soma + (Number(r.dados.VALOR) || 0), 0)),
    [registros],
  );

  return (
    <section
      className={`flex min-h-[280px] flex-col rounded-xl border bg-slate-900/50 transition-colors ${
        isOver ? 'border-sky-500/70 bg-sky-950/20' : destacada ? 'border-slate-700' : 'border-slate-800'
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-200">{tipo}</h3>
          <p className="text-[11px] text-slate-500">
            {registros.length} registro(s) · {formatarMoeda(total)}
          </p>
        </div>
        <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-semibold text-slate-400">
          {registros.length}
        </span>
      </header>

      <div ref={setNodeRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {registros.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-600">
            Arraste um lançamento para cá
          </p>
        )}
        {registros.map((registro) => (
          <Cartao key={registro.linha} registro={registro} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
//  Coluna "Despesas Livia" — primeiro coluna (espelho, somente leitura)
//  Mostra todos os lançamentos 'Dividido 50/50' e 'Livia'.
//  Os registros continuam aparecendo também nas colunas de TIPO.
// ---------------------------------------------------------------------------
function ColunaDespesasLivia({
  registros,
  destacada,
}: {
  registros: Registro<LancamentoMensal>[];
  destacada: boolean;
}) {
  const total = useMemo(
    () => arredondar2(registros.reduce((soma, r) => soma + (Number(r.dados.VALOR) || 0), 0)),
    [registros],
  );

  return (
    <section
      className={`flex min-h-[280px] flex-col rounded-xl border bg-slate-900/50 transition-colors ${
        destacada ? 'border-amber-500/70 bg-amber-950/20' : 'border-slate-800'
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-amber-300">Despesas Livia</h3>
          <p className="text-[11px] text-slate-500">
            {registros.length} registro(s) · {formatarMoeda(total)}
          </p>
        </div>
        <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
          {registros.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {registros.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-600">
            Sem despesas da Livia neste mês
          </p>
        )}
        {registros.map((registro) => (
          <Cartao key={registro.linha} registro={registro} />
        ))}
      </div>

      <footer className="border-t border-slate-800 px-3 py-2 bg-slate-950/40">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          Espelho — aparece também nas colunas de tipo
        </span>
      </footer>
    </section>
  );
}

// ---------------------------------------------------------------------------
//  Rodapé do quadro com os totais da divisão
// ---------------------------------------------------------------------------
function RodapeQuadro({ divisao }: { divisao: ReturnType<typeof resumirDivisao> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 border-t border-slate-800 bg-slate-900/40">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Total Gasto
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">
          {formatarMoeda(divisao.totalGasto)}
        </p>
        <p className="text-[11px] text-slate-600">Soma de todos os lançamentos</p>
      </div>
      <div
        className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-3"
        title="Total Gasto − (Dividido 50/50 ÷ 2) − Lívia"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">
          Meu gasto Real
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">
          {formatarMoeda(divisao.totalReal)}
        </p>
        <p className="text-[11px] text-slate-600">
          Eu + (Dividido 50/50 ÷ 2) − Lívia
        </p>
      </div>
      <div
        className="rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3"
        title="(Dividido 50/50 ÷ 2) + tudo que é da Lívia — o que ela me repassa"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
          Gasto Livia
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-amber-300">
          {formatarMoeda(divisao.receboLivia)}
        </p>
        <p className="text-[11px] text-slate-600">
          (Dividido 50/50 ÷ 2) + Lívia
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Página
// ---------------------------------------------------------------------------
export function KanbanPage() {
  const { ano, mes, mesSnapshot, aba } = useRegistrosFiltrados();
  const snapshot = useStoreAno((s) => (s.anoSelecionado != null ? s.snapshots[s.anoSelecionado] : undefined));
  const carregando = useStoreAno((s) => s.carregando);
  const erro = useStoreAno((s) => s.erro);
  const revalidar = useStoreAno((s) => s.revalidar);
  const editarLancamento = useStoreAno((s) => s.editarLancamento);
  const setMes = useStoreUI((s) => s.setMes);

  const [arrastando, setArrastando] = useState(false);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const registros = mesSnapshot?.registros ?? [];

  const porTipo = useMemo(() => {
    const mapa = new Map<TipoPagamento, Registro<LancamentoMensal>[]>();
    for (const tipo of TIPOS) mapa.set(tipo, []);
    for (const registro of registros) {
      const lista = mapa.get(registro.dados.TIPO);
      // registro com TIPO fora da lista cai na primeira coluna para não sumir
      (lista ?? mapa.get(TIPOS[0])!).push(registro);
    }
    return mapa;
  }, [registros]);

  // registros 'Dividido 50/50' + 'Livia' — espelho na primeira coluna (somente leitura)
  const despesasLivia = useMemo(
    () => registros.filter((r) => éDespesaLivia(r.dados)),
    [registros],
  );

  // divisão de contas com a Lívia sobre o que está visível no quadro
  const divisao = useMemo(() => resumirDivisao(registros), [registros]);

  const aoIniciar = (evento: DragStartEvent) => {
    setArrastando(!!evento.active);
  };

  const aoTerminar = (evento: DragEndEvent) => {
    setArrastando(false);
    const { active, over } = evento;
    if (!over || ano == null || !aba) return;

    const registro = active.data.current?.registro as Registro<LancamentoMensal> | undefined;
    if (!registro) return;

    const novoTipo = over.id as TipoPagamento;
    if (!TIPOS.includes(novoTipo) || novoTipo === registro.dados.TIPO) return;

    // atualização otimista: muda no cliente na hora e grava em segundo plano
    void editarLancamento(ano, aba, registro.linha, { TIPO: novoTipo });
  };

  if (!snapshot) {
    if (carregando) return <Carregando />;
    if (erro) return <AreaErro mensagem={erro} aoTentar={() => void revalidar()} />;
    return <EstadoVazio titulo="Sem dados carregados" descricao="Não foi possível carregar o ano." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MesTabs meses={snapshot.meses} selecionado={mes} aoSelecionar={setMes} />
        <p className="text-xs text-slate-500">
          Arraste os cartões entre colunas para alterar o <strong>TIPO</strong> do lançamento.
        </p>
      </div>

      {!aba ? (
        <EstadoVazio
          icone={SquareKanban}
          titulo={`A aba do mês ${mes} não existe em ${snapshot.ano}`}
          descricao="Escolha outro mês para montar o quadro de pagamentos."
        />
      ) : registros.length === 0 ? (
        <EstadoVazio
          icone={SquareKanban}
          titulo={`Sem lançamentos em ${mes}/${snapshot.ano}`}
          descricao="Os lançamentos cadastrados no mês aparecem aqui, agrupados por tipo de pagamento."
        />
      ) : (
        <>
          <DndContext sensors={sensores} collisionDetection={closestCorners} onDragStart={aoIniciar} onDragEnd={aoTerminar} onDragCancel={() => setArrastando(false)}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <ColunaDespesasLivia
                registros={despesasLivia}
                destacada={arrastando}
              />
              {TIPOS.map((tipo) => (
                <Coluna
                  key={tipo}
                  tipo={tipo}
                  registros={porTipo.get(tipo) ?? []}
                  destacada={arrastando}
                />
              ))}
            </div>
          </DndContext>

          {/* ------- rodapé do quadro com os totais ------- */}
          <RodapeQuadro divisao={divisao} />
        </>
      )}

      {erro && (
        <p className="text-xs text-amber-400">Última sincronização falhou: {erro}</p>
      )}
    </div>
  );
}
