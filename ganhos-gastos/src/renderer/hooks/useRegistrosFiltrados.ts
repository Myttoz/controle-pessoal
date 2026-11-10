import { useMemo } from 'react';
import type { LancamentoMensal, MesSnapshot, Registro, SiglaMes } from '@/types/api-types';
import { arredondar2 } from '@/lib/formatar';
import { valorFormaPgto } from '@/lib/formatar';
import { useStoreAno } from '@/store/storeAno';
import { useStoreUI, type Filtros, type FiltrosColunas, type OrdemColuna } from '@/store/storeUI';
import { useDebounced } from './useDebounced';

export interface ResultadoFiltros {
  ano: number | null;
  mes: SiglaMes;
  mesSnapshot: MesSnapshot | null;
  /** Aba exata ("JAN 27") — nula quando a aba não existe no ano. */
  aba: string | null;
  /** Registros depois da busca + filtros (memoizados). */
  registros: Registro<LancamentoMensal>[];
  /** Total do subconjunto filtrado (memoizado, recalculado só quando muda filtro/mês). */
  total: number;
  quantidade: number;
  quantidadeTotal: number;
  /** Total bruto do mês vindo da API. */
  totalDoMes: number;
}

function filtrar(
  registros: Registro<LancamentoMensal>[],
  busca: string,
  f: Filtros,
  colunas: FiltrosColunas,
): Registro<LancamentoMensal>[] {
  const termo = busca.trim().toLowerCase();
  const tem = (lista: string[] | undefined) => !!lista && lista.length > 0;
  return registros.filter(({ dados }) => {
    if (f.categoria && dados.CATEGORIA !== f.categoria) return false;
    if (f.tipo && dados.TIPO !== f.tipo) return false;
    if (f.forma && dados['FORMA DE PGTO'] !== valorFormaPgto(f.forma)) return false;
    if (f.quem && dados['QUEM PAGA'] !== f.quem) return false;
    if (f.de && (!dados.DATA || dados.DATA < f.de)) return false;
    if (f.ate && (!dados.DATA || dados.DATA > f.ate)) return false;
    // filtros multi-seleção das colunas (vazio = todos)
    if (tem(colunas.categoria) && !colunas.categoria!.includes(dados.CATEGORIA)) return false;
    if (tem(colunas.tipo) && !colunas.tipo!.includes(dados.TIPO)) return false;
    if (tem(colunas.forma) && !colunas.forma!.map(valorFormaPgto).includes(dados['FORMA DE PGTO'])) return false;
    if (tem(colunas.quem) && !colunas.quem!.includes(dados['QUEM PAGA'])) return false;
    if (tem(colunas.descricao) && !colunas.descricao!.includes(dados.DESCRIÇÃO)) return false;
    if (termo) {
      const alvo = `${dados.DESCRIÇÃO ?? ''} ${dados.CATEGORIA ?? ''} ${dados.OBSERVAÇÃO ?? ''}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });
}

function valorOrdenacao(campo: string, d: LancamentoMensal): string | number {
  switch (campo) {
    case 'data':
      return d.DATA ?? '';
    case 'valor':
      return Number(d.VALOR) || 0;
    case 'categoria':
      return d.CATEGORIA ?? '';
    case 'descricao':
      return d.DESCRIÇÃO ?? '';
    case 'forma':
      return d['FORMA DE PGTO'] ?? '';
    case 'tipo':
      return d.TIPO ?? '';
    case 'quem':
      return d['QUEM PAGA'] ?? '';
    default:
      return '';
  }
}

/** Ordena por campo; strings vazias ficam sempre no fim, independente da direção. */
function ordenar(
  registros: Registro<LancamentoMensal>[],
  ordem: OrdemColuna | null,
): Registro<LancamentoMensal>[] {
  if (!ordem) return registros;
  const sinal = ordem.direcao === 'asc' ? 1 : -1;
  return [...registros].sort((a, b) => {
    const va = valorOrdenacao(ordem.campo, a.dados);
    const vb = valorOrdenacao(ordem.campo, b.dados);
    const vazioA = va === '';
    const vazioB = vb === '';
    if (vazioA !== vazioB) return vazioA ? 1 : -1;
    if (typeof va === 'number' && typeof vb === 'number') return sinal * (va - vb);
    return sinal * String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
  });
}

/**
 * Busca e filtros aplicados SOBRE o cache local (debounce de 200ms).
 * Nenhuma requisição acontece aqui.
 */
export function useRegistrosFiltrados(): ResultadoFiltros {
  const ano = useStoreAno((s) => s.anoSelecionado);
  const snapshots = useStoreAno((s) => s.snapshots);
  const mes = useStoreUI((s) => s.mes);
  const buscaCrua = useStoreUI((s) => s.busca);
  const filtrosCruos = useStoreUI((s) => s.filtros);
  const colunasCruas = useStoreUI((s) => s.filtrosColunas);
  const ordem = useStoreUI((s) => s.ordemLancamentos);

  const busca = useDebounced(buscaCrua, 200);
  const filtros = useDebounced(filtrosCruos, 200);
  const colunas = useDebounced(colunasCruas, 200);

  const snapshot = ano != null ? snapshots[ano] : undefined;
  const mesSnapshot = snapshot?.meses[mes] ?? null;

  const resultado = useMemo(() => {
    const filtrados = mesSnapshot ? filtrar(mesSnapshot.registros, busca, filtros, colunas) : [];
    const registros = ordenar(filtrados, ordem);
    const total = arredondar2(
      registros.reduce((soma, r) => soma + (Number(r.dados.VALOR) || 0), 0),
    );
    return {
      registros,
      total,
      quantidade: registros.length,
      quantidadeTotal: mesSnapshot?.registros.length ?? 0,
      totalDoMes: mesSnapshot?.totalLancado ?? 0,
    };
  }, [mesSnapshot, busca, filtros, colunas, ordem]);

  return {
    ano,
    mes,
    mesSnapshot,
    aba: mesSnapshot?.aba ?? null,
    ...resultado,
  };
}

/** Snapshot do ano selecionado (cache — nunca busca). */
export function useSnapshot() {
  const ano = useStoreAno((s) => s.anoSelecionado);
  const snapshots = useStoreAno((s) => s.snapshots);
  return ano != null ? snapshots[ano] : undefined;
}
