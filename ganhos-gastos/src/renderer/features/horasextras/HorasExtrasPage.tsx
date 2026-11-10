import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Pencil, Plus, Timer, Trash2 } from 'lucide-react';
import type { RegistroHoraExtra } from '@/types/dados-locais';
import { Botao } from '@/components/Botoes';
import { ConfigSalario } from '@/components/ConfigSalario';
import { EstadoVazio } from '@/components/Estados';
import { Modal } from '@/components/Modal';
import { formatarData, formatarMoeda } from '@/lib/formatar';
import { agruparPorMes, arred, calcularHoraExtra, type TotalMes } from '@/lib/calculos';
import { useStoreLocal } from '@/store/storeLocal';
import { FormHoraExtra } from './FormHoraExtra';

const ESTILOTooltip = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '10px',
  color: '#f1f5f9',
  fontSize: 13,
} as const;

const fmt = (v: unknown) => formatarMoeda(Number(v));

interface LinhaTabela {
  registro: RegistroHoraExtra;
  h100: number;
  h50: number;
  v100: number;
  v50: number;
  total: number;
}

export function HorasExtrasPage() {
  const dados = useStoreLocal((s) => s.dados);
  const salarioBruto = dados.config.salarioBruto;
  const remover = useStoreLocal((s) => s.removerHoraExtra);

  const [modal, setModal] = useState<{ modo: 'novo' } | { modo: 'editar'; registro: RegistroHoraExtra } | null>(null);
  const [paraExcluir, setParaExcluir] = useState<RegistroHoraExtra | null>(null);
  const [mesFiltro, setMesFiltro] = useState<string>('');

  // cálculo memoizado por registro
  const linhas = useMemo<LinhaTabela[]>(() => {
    return dados.horasExtras
      .map((registro) => {
        const c = calcularHoraExtra(registro, salarioBruto);
        return { registro, h100: c.horas100, h50: c.horas50, v100: arred(c.valor100), v50: arred(c.valor50), total: arred(c.total) };
      })
      .sort((a, b) => b.registro.data.localeCompare(a.registro.data));
  }, [dados.horasExtras, salarioBruto]);

  const porMes = useMemo<TotalMes[]>(
    () => agruparPorMes(dados.horasExtras, (r) => r.data, (r) => calcularHoraExtra(r, salarioBruto)),
    [dados.horasExtras, salarioBruto],
  );

  const visiveis = useMemo(
    () => (mesFiltro ? linhas.filter((l) => l.registro.data.startsWith(mesFiltro)) : linhas),
    [linhas, mesFiltro],
  );

  const totais = useMemo(() => {
    const soma = (f: (l: LinhaTabela) => number, lista: LinhaTabela[]) => arred(lista.reduce((s, l) => s + f(l), 0));
    const mesSel = mesFiltro ? visiveis : linhas;
    return {
      v100: soma((l) => l.v100, mesSel),
      v50: soma((l) => l.v50, mesSel),
      total: soma((l) => l.total, mesSel),
      h100: Math.round(mesSel.reduce((s, l) => s + l.h100, 0) * 100) / 100,
      h50: Math.round(mesSel.reduce((s, l) => s + l.h50, 0) * 100) / 100,
      quantidade: mesSel.length,
    };
  }, [visiveis, linhas, mesFiltro]);

  const dadosPizza = [
    { nome: '100% (presencial)', valor: totais.v100 },
    { nome: '50% (plantão)', valor: totais.v50 },
  ].filter((d) => d.valor > 0);

  return (
    <div className="space-y-4">
      <ConfigSalario />

      {/* ------- KPIs ------- */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo={mesFiltro ? 'Total do mês' : 'Total geral'} valor={formatarMoeda(totais.total)} tom="emerald" detalhe={`${totais.quantidade} plantão(ões)`} />
        <Kpi titulo="Ganho a 100%" valor={formatarMoeda(totais.v100)} detalhe={`${totais.h100.toFixed(2)} h`} />
        <Kpi titulo="Ganho a 50%" valor={formatarMoeda(totais.v50)} detalhe={`${totais.h50.toFixed(2)} h`} />
        <Kpi titulo="Média por plantão" valor={formatarMoeda(totais.quantidade ? totais.total / totais.quantidade : 0)} detalhe="Total ÷ plantões" />
      </section>

      {/* ------- gráficos ------- */}
      {porMes.length > 0 && (
        <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Ganhos por mês</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porMes} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip cursor={{ fill: 'rgba(56,189,248,0.08)' }} formatter={fmt} contentStyle={ESTILOTooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="valor100" name="100%" stackId="a" fill="#38bdf8" radius={[0, 0, 0, 0]} />
                <Bar dataKey="valor50" name="50%" stackId="a" fill="#a78bfa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Composição 100% × 50%</h2>
            {dadosPizza.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={dadosPizza} dataKey="valor" nameKey="nome" innerRadius={52} outerRadius={90} paddingAngle={2} stroke="#0f172a">
                    <Cell fill="#38bdf8" />
                    <Cell fill="#a78bfa" />
                  </Pie>
                  <Tooltip formatter={fmt} contentStyle={ESTILOTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-slate-500">Sem valores calculados.</p>
            )}
          </div>
        </section>
      )}

      {/* ------- controles ------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-400">Mês:</label>
          <select
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {porMes.map((m) => (
              <option key={m.chave} value={m.chave}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </div>
        <Botao variante="primario" icone={Plus} onClick={() => setModal({ modo: 'novo' })}>
          Novo plantão
        </Botao>
      </div>

      {/* ------- lista ------- */}
      {visiveis.length === 0 ? (
        <EstadoVazio
          icone={Timer}
          titulo={mesFiltro ? 'Sem plantões neste mês' : 'Nenhum plantão registrado'}
          descricao="Registre os horários de cada dia de plantão para calcular automaticamente o valor a 100% e a 50%."
          acao={
            <Botao variante="primario" icone={Plus} onClick={() => setModal({ modo: 'novo' })}>
              Novo plantão
            </Botao>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Data</th>
                  <th className="px-3 py-2.5 font-semibold">Período</th>
                  <th className="px-3 py-2.5 text-right font-semibold">H 100%</th>
                  <th className="px-3 py-2.5 text-right font-semibold">H 50%</th>
                  <th className="px-3 py-2.5 text-right font-semibold">R$ 100%</th>
                  <th className="px-3 py-2.5 text-right font-semibold">R$ 50%</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <tr key={l.registro.id} className="border-b border-slate-800/70 transition hover:bg-slate-800/25">
                    <td className="px-4 py-2.5 tabular-nums text-slate-300">{formatarData(l.registro.data)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {l.registro.chegada} → {l.registro.saidaEmpresa}
                      {l.registro.fimPlantao ? ` (+${l.registro.fimPlantao})` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{l.h100.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{l.h50.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sky-300">{formatarMoeda(l.v100)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-violet-300">{formatarMoeda(l.v50)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-300">{formatarMoeda(l.total)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" title="Editar" aria-label="Editar plantão" onClick={() => setModal({ modo: 'editar', registro: l.registro })} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700/60 hover:text-sky-300">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" title="Excluir" aria-label="Excluir plantão" onClick={() => setParaExcluir(l.registro)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-900/50 hover:text-rose-300">
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

      {modal && <FormHoraExtra registro={modal.modo === 'editar' ? modal.registro : null} aoFechar={() => setModal(null)} />}

      <Modal aberto={paraExcluir !== null} titulo="Excluir plantão" aoFechar={() => setParaExcluir(null)} largura="max-w-md" rodape={
        <>
          <Botao onClick={() => setParaExcluir(null)}>Cancelar</Botao>
          <Botao variante="perigo" icone={Trash2} onClick={() => { if (paraExcluir) remover(paraExcluir.id); setParaExcluir(null); }}>
            Excluir
          </Botao>
        </>
      }>
        {paraExcluir && <p className="text-sm text-slate-300">Remover o plantão de {formatarData(paraExcluir.data)}?</p>}
      </Modal>
    </div>
  );
}

function Kpi({ titulo, valor, detalhe, tom = 'sky' }: { titulo: string; valor: string; detalhe?: string; tom?: 'sky' | 'emerald' }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${tom === 'emerald' ? 'text-emerald-300' : 'text-slate-100'}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}
