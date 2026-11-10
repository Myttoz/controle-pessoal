import { useEffect, useMemo, useState } from 'react';
import { Car, Pencil, Plus, Trash2 } from 'lucide-react';
import type { RegistroManutencao } from '@/types/dados-locais';
import { Botao } from '@/components/Botoes';
import { Campo, Entrada } from '@/components/Campos';
import { EstadoVazio } from '@/components/Estados';
import { Modal } from '@/components/Modal';
import { ThOrdenavel, type DirecaoOrdem } from '@/components/ThOrdenavel';
import { formatarData, formatarMoeda, parseValor } from '@/lib/formatar';
import { avaliarManutencao, type StatusManutencao } from '@/lib/calculos';
import { useStoreLocal } from '@/store/storeLocal';
import { FormManutencao } from './FormManutencao';

/** Colunas ordenáveis da tabela. */
type CampoManut = 'descricao' | 'data' | 'valor' | 'mecanico' | 'lojaPecas' | 'proximaData' | 'status';

interface OrdemManut {
  campo: CampoManut;
  direcao: DirecaoOrdem;
}

interface LinhaTabela {
  registro: RegistroManutencao;
  proximaData: string | null;
  proximoKm: number | null;
  status: StatusManutencao;
}

const ORDEM_STATUS: Record<StatusManutencao, number> = { URGENTE: 0, PROXIMO: 1, OK: 2 };

/** Comparação de texto com vazios sempre no fim. */
function cmpTexto(a: string | undefined, b: string | undefined): number {
  const va = (a ?? '').trim();
  const vb = (b ?? '').trim();
  if (!va && !vb) return 0;
  if (!va) return 1;
  if (!vb) return -1;
  return va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' });
}

function comparar(campo: CampoManut, a: LinhaTabela, b: LinhaTabela): number {
  switch (campo) {
    case 'descricao':
      return cmpTexto(a.registro.descricao, b.registro.descricao);
    case 'data':
      return a.registro.data.localeCompare(b.registro.data);
    case 'valor':
      return (a.registro.valor || 0) - (b.registro.valor || 0);
    case 'mecanico':
      return cmpTexto(a.registro.mecanico, b.registro.mecanico);
    case 'lojaPecas':
      return cmpTexto(a.registro.lojaPecas, b.registro.lojaPecas);
    case 'proximaData':
      if (!a.proximaData && !b.proximaData) return 0;
      if (!a.proximaData) return 1;
      if (!b.proximaData) return -1;
      return a.proximaData.localeCompare(b.proximaData);
    case 'status':
      return ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status];
  }
}

function unicos(valores: (string | undefined)[]): string[] {
  return [...new Set(valores.filter((v): v is string => !!v && v.trim() !== ''))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  );
}

export function ManutencaoPage() {
  const dados = useStoreLocal((s) => s.dados);
  const kmAtual = dados.config.kmAtual;
  const setConfig = useStoreLocal((s) => s.setConfig);
  const remover = useStoreLocal((s) => s.removerManutencao);

  const [modal, setModal] = useState<{ modo: 'novo' } | { modo: 'editar'; registro: RegistroManutencao } | null>(null);
  const [paraExcluir, setParaExcluir] = useState<RegistroManutencao | null>(null);

  const [kmTexto, setKmTexto] = useState(kmAtual ? String(kmAtual) : '');
  const [kmErro, setKmErro] = useState<string | null>(null);
  useEffect(() => {
    setKmTexto(kmAtual ? String(kmAtual) : '');
  }, [kmAtual]);

  const [filtroStatus, setFiltroStatus] = useState<'' | StatusManutencao>('');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<OrdemManut | null>(null);
  /** Filtros multi-seleção das colunas Oficina e Peças (vazio = todos). */
  const [selecao, setSelecao] = useState<{ mecanico: string[]; lojaPecas: string[] }>({
    mecanico: [],
    lojaPecas: [],
  });

  const alternarOrdem = (campo: CampoManut, inicial: DirecaoOrdem = 'asc') => {
    setOrdem((atual) => {
      if (!atual || atual.campo !== campo) return { campo, direcao: inicial };
      // ciclo: inicial → oposta → sem ordenação
      if (atual.direcao === inicial) {
        return { campo, direcao: inicial === 'asc' ? 'desc' : 'asc' };
      }
      return null;
    });
  };

  const alternarSelecao = (campo: 'mecanico' | 'lojaPecas', valor: string) => {
    setSelecao((atual) => ({
      ...atual,
      [campo]: atual[campo].includes(valor)
        ? atual[campo].filter((v) => v !== valor)
        : [...atual[campo], valor],
    }));
  };

  // valores existentes para os menus multi-seleção
  const opcoesMecanico = useMemo(
    () => unicos(dados.manutencoes.map((r) => r.mecanico)),
    [dados.manutencoes],
  );
  const opcoesPecas = useMemo(
    () => unicos(dados.manutencoes.map((r) => r.lojaPecas)),
    [dados.manutencoes],
  );

  const linhas = useMemo<LinhaTabela[]>(() => {
    const base = dados.manutencoes.map((registro) => {
      const avaliacao = avaliarManutencao(registro, kmAtual);
      return {
        registro,
        proximaData: avaliacao.proximaData,
        proximoKm: avaliacao.proximoKm,
        status: avaliacao.status,
      };
    });
    if (!ordem) return base.sort((a, b) => b.registro.data.localeCompare(a.registro.data));
    const sinal = ordem.direcao === 'asc' ? 1 : -1;
    return base.sort((a, b) => sinal * comparar(ordem.campo, a, b));
  }, [dados.manutencoes, kmAtual, ordem]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (filtroStatus && l.status !== filtroStatus) return false;
      if (selecao.mecanico.length > 0 && !selecao.mecanico.includes(l.registro.mecanico)) return false;
      if (selecao.lojaPecas.length > 0 && !selecao.lojaPecas.includes(l.registro.lojaPecas ?? '')) {
        return false;
      }
      if (!termo) return true;
      return (
        l.registro.descricao.toLowerCase().includes(termo) ||
        l.registro.mecanico.toLowerCase().includes(termo) ||
        (l.registro.lojaPecas ?? '').toLowerCase().includes(termo) ||
        (l.registro.observacao ?? '').toLowerCase().includes(termo)
      );
    });
  }, [linhas, filtroStatus, selecao, busca]);

  const direcaoDe = (campo: CampoManut): DirecaoOrdem | null =>
    ordem?.campo === campo ? ordem.direcao : null;

  const totais = useMemo(() => {
    const urgente = linhas.filter((l) => l.status === 'URGENTE').length;
    const proximo = linhas.filter((l) => l.status === 'PROXIMO').length;
    const soma = linhas.reduce((s, l) => s + (l.registro.valor || 0), 0);
    const comData = linhas
      .filter((l) => l.proximaData)
      .map((l) => l.proximaData as string)
      .sort();
    return {
      total: soma,
      quantidade: linhas.length,
      urgente,
      proximo,
      media: linhas.length ? soma / linhas.length : 0,
      proximaGlobal: comData[0] ?? null,
    };
  }, [linhas]);

  const salvarKm = (texto: string) => {
    const limpo = texto.trim();
    if (limpo === '') {
      setKmErro(null);
      setConfig({ kmAtual: 0 });
      return;
    }
    const v = parseValor(limpo);
    if (!Number.isFinite(v) || v < 0) {
      setKmErro('Informe um número.');
      return;
    }
    setKmErro(null);
    setConfig({ kmAtual: Math.round(v) });
  };

  return (
    <div className="space-y-4">
      {/* ------- configuração: km atual ------- */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
        <Campo rotulo="KM atual do veículo" className="w-52">
          <Entrada
            value={kmTexto}
            onChange={(e) => setKmTexto(e.target.value)}
            onBlur={(e) => salvarKm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            placeholder="Ex.: 122819"
            inputMode="numeric"
          />
        </Campo>
        {kmErro && <p className="pb-1 text-sm text-rose-400">{kmErro}</p>}
        <p className="pb-1 text-xs text-slate-500">
          O status de cada manutenção é comparado com este valor (limiar de urgência: ≤ KM da próxima revisão ·
          próximo: +1.000 km).
        </p>
      </div>

      {/* ------- KPIs ------- */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi titulo="Total gasto" valor={formatarMoeda(totais.total)} tom="emerald" detalhe={`${totais.quantidade} registro(s)`} />
        <Kpi titulo="Média por serviço" valor={formatarMoeda(totais.media)} detalhe="Total ÷ serviços" />
        <Kpi titulo="Urgentes" valor={String(totais.urgente)} tom={totais.urgente > 0 ? 'rose' : 'emerald'} detalhe="Vencidos por data ou km" />
        <Kpi titulo="Próximos" valor={String(totais.proximo)} tom="amber" detalhe="≤ 30 dias ou ≤ 1.000 km" />
        <Kpi titulo="Próxima revisão" valor={totais.proximaGlobal ? formatarData(totais.proximaGlobal) : '—'} detalhe="Menor data prevista" />
      </section>

      {/* ------- controles ------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar manutenção…"
            className="w-52 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as '' | StatusManutencao)}
            className="appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            <option value="">Todos os status</option>
            <option value="URGENTE">Urgente</option>
            <option value="PROXIMO">Próximo</option>
            <option value="OK">OK</option>
          </select>
        </div>
        <Botao variante="primario" icone={Plus} onClick={() => setModal({ modo: 'novo' })}>
          Nova manutenção
        </Botao>
      </div>

      {/* ------- lista ------- */}
      {visiveis.length === 0 ? (
        <EstadoVazio
          icone={Car}
          titulo={linhas.length === 0 ? 'Nenhuma manutenção registrada' : 'Nenhum resultado com estes filtros'}
          descricao={
            linhas.length === 0
              ? 'Registre a manutenção, a data, o KM, o valor e a oficina. O app calcula a próxima revisão e o status automaticamente.'
              : 'Ajuste a busca, o filtro de status ou os filtros das colunas (ícone de filtro).'
          }
          acao={
            linhas.length === 0 ? (
              <Botao variante="primario" icone={Plus} onClick={() => setModal({ modo: 'novo' })}>
                Nova manutenção
              </Botao>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="p-0 font-semibold">
                    <ThOrdenavel
                      rotulo="Manutenção"
                      direcao={direcaoDe('descricao')}
                      aoOrdenar={() => alternarOrdem('descricao')}
                      className="px-4 py-2.5"
                    />
                  </th>
                  <th className="p-0 font-semibold">
                    <ThOrdenavel
                      rotulo="Data"
                      direcao={direcaoDe('data')}
                      primeiraDirecao="desc"
                      aoOrdenar={() => alternarOrdem('data', 'desc')}
                      className="px-3 py-2.5"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">KM</th>
                  <th className="p-0 font-semibold">
                    <ThOrdenavel
                      rotulo="Valor"
                      alinhamento="right"
                      direcao={direcaoDe('valor')}
                      aoOrdenar={() => alternarOrdem('valor')}
                      className="px-3 py-2.5"
                    />
                  </th>
                  <th className="p-0 font-semibold">
                    <ThOrdenavel
                      rotulo="Oficina"
                      direcao={direcaoDe('mecanico')}
                      aoOrdenar={() => alternarOrdem('mecanico')}
                      className="px-3 py-2.5"
                      filtro={{
                        opcoes: opcoesMecanico,
                        selecionados: selecao.mecanico,
                        aoAlternar: (v) => alternarSelecao('mecanico', v),
                        aoLimpar: () => setSelecao((s) => ({ ...s, mecanico: [] })),
                      }}
                    />
                  </th>
                  <th className="p-0 font-semibold">
                    <ThOrdenavel
                      rotulo="Peças"
                      direcao={direcaoDe('lojaPecas')}
                      aoOrdenar={() => alternarOrdem('lojaPecas')}
                      className="px-3 py-2.5"
                      filtro={{
                        opcoes: opcoesPecas,
                        selecionados: selecao.lojaPecas,
                        aoAlternar: (v) => alternarSelecao('lojaPecas', v),
                        aoLimpar: () => setSelecao((s) => ({ ...s, lojaPecas: [] })),
                      }}
                    />
                  </th>
                  <th className="p-0 font-semibold">
                    <ThOrdenavel
                      rotulo="Próx. revisão"
                      direcao={direcaoDe('proximaData')}
                      aoOrdenar={() => alternarOrdem('proximaData')}
                      className="px-3 py-2.5"
                    />
                  </th>
                  <th className="p-0 font-semibold">
                    <ThOrdenavel
                      rotulo="Status"
                      direcao={direcaoDe('status')}
                      aoOrdenar={() => alternarOrdem('status')}
                      className="px-3 py-2.5"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <tr key={l.registro.id} className="border-b border-slate-800/70 transition hover:bg-slate-800/25">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-200">{l.registro.descricao}</p>
                      {l.registro.observacao && <p className="mt-0.5 text-xs text-slate-500">{l.registro.observacao}</p>}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-300">{formatarData(l.registro.data)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                      {l.registro.km != null ? l.registro.km.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{formatarMoeda(l.registro.valor)}</td>
                    <td className="px-3 py-2.5 text-slate-400">{l.registro.mecanico}</td>
                    <td className="px-3 py-2.5 text-slate-400">{l.registro.lojaPecas || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      <span className="block tabular-nums">{l.proximaData ? formatarData(l.proximaData) : '—'}</span>
                      <span className="block tabular-nums text-slate-500">
                        {l.proximoKm != null ? `${l.proximoKm.toLocaleString('pt-BR')} km` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <BadgeStatus status={l.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Editar"
                          aria-label="Editar manutenção"
                          onClick={() => setModal({ modo: 'editar', registro: l.registro })}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700/60 hover:text-sky-300"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          aria-label="Excluir manutenção"
                          onClick={() => setParaExcluir(l.registro)}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-900/50 hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <FormManutencao registro={modal.modo === 'editar' ? modal.registro : null} aoFechar={() => setModal(null)} />}

      <Modal
        aberto={paraExcluir !== null}
        titulo="Excluir manutenção"
        aoFechar={() => setParaExcluir(null)}
        largura="max-w-md"
        rodape={
          <>
            <Botao onClick={() => setParaExcluir(null)}>Cancelar</Botao>
            <Botao
              variante="perigo"
              icone={Trash2}
              onClick={() => {
                if (paraExcluir) remover(paraExcluir.id);
                setParaExcluir(null);
              }}
            >
              Excluir
            </Botao>
          </>
        }
      >
        {paraExcluir && (
          <p className="text-sm text-slate-300">
            Remover “{paraExcluir.descricao}” de {formatarData(paraExcluir.data)}?
          </p>
        )}
      </Modal>
    </div>
  );
}

export function BadgeStatus({ status }: { status: StatusManutencao }) {
  const estilo =
    status === 'URGENTE'
      ? 'bg-rose-500/15 text-rose-300'
      : status === 'PROXIMO'
        ? 'bg-amber-500/15 text-amber-300'
        : 'bg-emerald-500/15 text-emerald-300';
  const rotulo = status === 'URGENTE' ? 'URGENTE' : status === 'PROXIMO' ? 'PRÓXIMO' : 'OK';
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${estilo}`}>{rotulo}</span>;
}

function Kpi({
  titulo,
  valor,
  detalhe,
  tom = 'sky',
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  tom?: 'sky' | 'emerald' | 'rose' | 'amber';
}) {
  const cor =
    tom === 'emerald'
      ? 'text-emerald-300'
      : tom === 'rose'
        ? 'text-rose-300'
        : tom === 'amber'
          ? 'text-amber-300'
          : 'text-slate-100';
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}
