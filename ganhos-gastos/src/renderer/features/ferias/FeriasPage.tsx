import { useMemo, useState } from 'react';
import { Palmtree, Pencil, Plus, Trash2 } from 'lucide-react';
import type { RegistroFerias } from '@/types/dados-locais';
import { Botao } from '@/components/Botoes';
import { ConfigSalario } from '@/components/ConfigSalario';
import { EstadoVazio } from '@/components/Estados';
import { Modal } from '@/components/Modal';
import { formatarMoeda } from '@/lib/formatar';
import { arred, calcularFerias, saldoPeriodo } from '@/lib/calculos';
import { useStoreLocal } from '@/store/storeLocal';
import { FormFerias } from './FormFerias';

function br(iso: string): string {
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

export function FeriasPage() {
  const dados = useStoreLocal((s) => s.dados);
  const salarioBruto = dados.config.salarioBruto;
  const remover = useStoreLocal((s) => s.removerFerias);

  const [modal, setModal] = useState<{ modo: 'novo' } | { modo: 'editar'; registro: RegistroFerias } | null>(null);
  const [paraExcluir, setParaExcluir] = useState<RegistroFerias | null>(null);

  const linhas = useMemo(() => {
    return dados.ferias
      .map((registro) => {
        const calc = calcularFerias(registro.diasRetirados, registro.diasVendidos, salarioBruto);
        const saldo = saldoPeriodo(dados.ferias, registro.periodo);
        return { registro, calc, saldo };
      })
      .sort((a, b) => b.registro.inicio.localeCompare(a.registro.inicio));
  }, [dados.ferias, salarioBruto]);

  const totalRecebido = useMemo(() => arred(linhas.reduce((s, l) => s + l.calc.total, 0)), [linhas]);

  const periodos = useMemo(() => {
    const mapa = new Map<string, { gozados: number; vendidos: number }>();
    for (const r of dados.ferias) {
      const atual = mapa.get(r.periodo) ?? { gozados: 0, vendidos: 0 };
      atual.gozados += r.diasRetirados;
      atual.vendidos += r.diasVendidos;
      mapa.set(r.periodo, atual);
    }
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [dados.ferias]);

  return (
    <div className="space-y-4">
      <ConfigSalario />

      {/* ------- KPIs ------- */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total a receber (férias + abono)</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-emerald-300">{formatarMoeda(totalRecebido)}</p>
          <p className="mt-1 text-xs text-slate-500">{linhas.length} retirada(s)</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dias gozados</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
            {linhas.reduce((s, l) => s + l.registro.diasRetirados, 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Em {periodos.length} período(s)</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dias vendidos (abono)</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
            {linhas.reduce((s, l) => s + l.registro.diasVendidos, 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Máx. 10 por período</p>
        </div>
      </section>

      {/* ------- saldo por período ------- */}
      {periodos.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Saldo por período aquisitivo</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {periodos.map(([periodo, { gozados, vendidos }]) => {
              const usados = gozados + vendidos;
              const saldo = 30 - usados;
              return (
                <div key={periodo} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-sm font-medium text-slate-200">{periodo}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {gozados} gozados + {vendidos} vendidos = {usados} de 30 dias ·{' '}
                    <span className={saldo > 0 ? 'text-amber-300' : 'text-emerald-300'}>{saldo} restantes</span>
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <span className="block h-full rounded-full bg-sky-500/80" style={{ width: `${Math.min(100, (usados / 30) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          O valor é calculado a partir do salário bruto: férias gozadas + 1/3 constitucional e abono (dias vendidos) + 1/3.
        </p>
        <Botao variante="primario" icone={Plus} onClick={() => setModal({ modo: 'novo' })}>
          Nova retirada
        </Botao>
      </div>

      {/* ------- lista ------- */}
      {linhas.length === 0 ? (
        <EstadoVazio
          icone={Palmtree}
          titulo="Nenhuma retirada de férias"
          descricao="Registre início, fim e dias retirados. O período aquisitivo (Abril → Abril) e os valores são calculados automaticamente."
          acao={
            <Botao variante="primario" icone={Plus} onClick={() => setModal({ modo: 'novo' })}>
              Nova retirada
            </Botao>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Período</th>
                  <th className="px-3 py-2.5 font-semibold">Início</th>
                  <th className="px-3 py-2.5 font-semibold">Fim</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Dias</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Vendidos</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Férias (+1/3)</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Abono (+1/3)</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.registro.id} className="border-b border-slate-800/70 transition hover:bg-slate-800/25">
                    <td className="px-4 py-2.5 text-xs text-slate-400">{l.registro.periodo}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-300">{br(l.registro.inicio)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-300">{br(l.registro.fim)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{l.registro.diasRetirados}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{l.registro.diasVendidos}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sky-300">{formatarMoeda(l.calc.valorFerias)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-violet-300">{formatarMoeda(l.calc.valorAbono)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-300">{formatarMoeda(l.calc.total)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" title="Editar" aria-label="Editar férias" onClick={() => setModal({ modo: 'editar', registro: l.registro })} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700/60 hover:text-sky-300">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" title="Excluir" aria-label="Excluir férias" onClick={() => setParaExcluir(l.registro)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-900/50 hover:text-rose-300">
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

      {modal && <FormFerias registro={modal.modo === 'editar' ? modal.registro : null} aoFechar={() => setModal(null)} />}

      <Modal aberto={paraExcluir !== null} titulo="Excluir férias" aoFechar={() => setParaExcluir(null)} largura="max-w-md" rodape={
        <>
          <Botao onClick={() => setParaExcluir(null)}>Cancelar</Botao>
          <Botao variante="perigo" icone={Trash2} onClick={() => { if (paraExcluir) remover(paraExcluir.id); setParaExcluir(null); }}>
            Excluir
          </Botao>
        </>
      }>
        {paraExcluir && (
          <p className="text-sm text-slate-300">
            Remover a retirada de {br(paraExcluir.inicio)} a {br(paraExcluir.fim)} ({paraExcluir.diasRetirados} dias)?
          </p>
        )}
      </Modal>
    </div>
  );
}
