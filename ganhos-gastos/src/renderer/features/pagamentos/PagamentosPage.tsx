import { useEffect, useMemo, useState } from 'react';
import { CreditCard, RefreshCw, Wallet } from 'lucide-react';
import type { LancamentoMensal, Registro, SiglaMes, LinhaSalario } from '@/types/api-types';
import { AreaErro, Carregando, EstadoVazio } from '@/components/Estados';
import { Botao } from '@/components/Botoes';
import { MesTabs } from '@/components/MesTabs';
import { arredondar2, formatarMoeda, parseValor } from '@/lib/formatar';
import { NOMES_MESES } from '@/lib/meses';
import { resumirDivisao } from '@/lib/divisao';
import { useSnapshot } from '@/hooks/useRegistrosFiltrados';
import { useStoreAno } from '@/store/storeAno';
import { useStoreUI } from '@/store/storeUI';

const MESES: SiglaMes[] = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** Chaves de localStorage para os campos digitados pelo usuário (persistem entre recargas). */
const LS_SALDO_CAIXA = 'pg_saldoCaixa';
const LS_DESPESAS_MES_ANTERIOR = 'pg_despesasMesAnterior';

function numero(valor: number | undefined | null): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Salário total do mês (igual ao app calcula na aba Ganhos): base + 13º + férias + outros + freelance. Sem TICKET. */
function totalGanhosSalario(d: LinhaSalario): number {
  const totalSalario =
    numero(d['SALÁRIO BASE']) +
    numero(d['13º']) +
    numero(d['FÉRIAS']) +
    numero(d['FREELANCE']);
  return arredondar2(numero(d['OUTROS']) + numero(d['FREELANCE']) + totalSalario);
}

interface LinhaPagamento {
  mes: SiglaMes;
  /** Nome do mês para exibição. */
  rotulo: string;
  /** Salário do mês (aba Ganhos → Total ganhos). */
  salario: number;
  /** Despesas do mês anterior (Meu gasto real). Manual apenas para o 1º mês. */
  despesasMesAnterior: number;
  /** Se o valor acima veio de campo manual (mês 1 sem dados do ano anterior). */
  despesasMesAnteriorManual: boolean;
  /** Label do campo manual de despesas do mês anterior (varia por mês). */
  labelDespesasMesAnterior: string;
  /** Despesas da Lívia do mês atual (informativo: Dividido/2 + Livia). */
  despesasLivia: number;
  /** Restante = Salário − Despesas mês anterior. */
  restante: number;
  /** Pix gasto neste mês. */
  pixMes: number;
  /** Pix gasto no mês anterior (informativo, para repor). */
  pixMesAnterior: number;
  /** Se há lançamentos neste mês. */
  temDados: boolean;
  /** Se é o primeiro mês do ano (despesas mês anterior vêm de campo manual). */
  ehPrimeiroMes: boolean;
}

export function PagamentosPage() {
  const snapshot = useSnapshot();
  const carregando = useStoreAno((s) => s.carregando);
  const erro = useStoreAno((s) => s.erro);
  const revalidar = useStoreAno((s) => s.revalidar);
  const ano = useStoreAno((s) => s.anoSelecionado);
  const mes = useStoreUI((s) => s.mes);
  const setMes = useStoreUI((s) => s.setMes);

  // ---- campos digitados pelo usuário, persistidos em localStorage ----
  const [saldoCaixaTexto, setSaldoCaixaTexto] = useState(localStorage.getItem(LS_SALDO_CAIXA) ?? '');
  const [despesasMesAnteriorTexto, setDespesasMesAnteriorTexto] = useState(
    localStorage.getItem(LS_DESPESAS_MES_ANTERIOR) ?? '',
  );

  const saldoCaixa = parseValor(saldoCaixaTexto) || 0;
  const despesasMesAnteriorValor = parseValor(despesasMesAnteriorTexto) || 0;

  useEffect(() => {
    if (saldoCaixaTexto !== '') localStorage.setItem(LS_SALDO_CAIXA, saldoCaixaTexto);
    if (despesasMesAnteriorTexto !== '')
      localStorage.setItem(LS_DESPESAS_MES_ANTERIOR, despesasMesAnteriorTexto);
  }, [saldoCaixaTexto, despesasMesAnteriorTexto]);

  if (carregando && !snapshot) {
    return <Carregando texto="Carregando dados de pagamentos…" />;
  }

  if (!snapshot) {
    if (erro) {
      return <AreaErro mensagem={erro} aoTentar={() => void revalidar()} />;
    }
    return (
      <EstadoVazio
        icone={Wallet}
        titulo="Sem dados carregados"
        descricao="Selecione um ano válido ou atualize a conexão com a API."
      />
    );
  }

  const salarioSnapshot = snapshot.salario;

  /** Salário Total Ganhos por mês (aba Ganhos: SALÁRIO BASE + 13º + FÉRIAS + OUTROS + FREELANCE, sem TICKET). */
  const salarioPorMes = useMemo(() => {
    const mapa = new Map<SiglaMes, number>();
    if (salarioSnapshot) {
      for (const r of salarioSnapshot.registros) {
        const m = r.dados['MÊS'];
        mapa.set(m, arredondar2((mapa.get(m) ?? 0) + totalGanhosSalario(r.dados)));
      }
    }
    return mapa;
  }, [salarioSnapshot]);

  /** Linhas do resumo mensal — uma por mês do ano selecionado. */
  const linhas = useMemo<LinhaPagamento[]>(() => {
    const resultado: LinhaPagamento[] = [];
    let divisaoAnterior: ReturnType<typeof resumirDivisao> | null = null;
    let pixAnterior = 0;

    for (const m of MESES) {
      const mesSnapshot = snapshot.meses[m];
      const registros: Registro<LancamentoMensal>[] = mesSnapshot?.registros ?? [];
      const temDados = registros.length > 0;
      const divisao = resumirDivisao(registros);
      const salarioMes = arredondar2(salarioPorMes.get(m) ?? 0);

      const pixMes = arredondar2(
        registros.reduce(
          (soma, r) =>
            // Na planilha, os PIX são lançados com FORMA DE PGTO = 'MP'
            // (Mercado Pago). O rodapé soma tudo que tiver MP.
            soma + (r.dados['FORMA DE PGTO'] === 'MP' ? Number(r.dados.VALOR) || 0 : 0),
          0,
        ),
      );

      const ehPrimeiroMes = !divisaoAnterior;
      const mesIndex = MESES.indexOf(m);
      const mesAnteriorSigla = MESES[mesIndex - 1];
      const mesAnteriorNome = ehPrimeiroMes
        ? 'Dezembro (ano anterior)'
        : NOMES_MESES[mesAnteriorSigla] ?? '';

      // Label do campo manual varia por mês:
      // JAN → "DESPESAS DEZEMBRO (mês anterior — não está na planilha)"
      // FEV → "DESPESAS MÊS JANEIRO", MAR → "DESPESAS MÊS FEVEREIRO", etc.
      const labelDespesasMesAnterior = ehPrimeiroMes
        ? 'Despesas dezembro (mês anterior — não está na planilha)'
        : `Despesas mês ${mesAnteriorNome}`;

      let despesasMesAnterior = 0;
      let despesasMesAnteriorManual = false;

      if (ehPrimeiroMes) {
        // 1º mês do ano: não há dados do mês anterior na planilha → campo manual
        despesasMesAnterior = despesasMesAnteriorValor;
        despesasMesAnteriorManual = despesasMesAnteriorValor > 0;
      } else {
        despesasMesAnterior = divisaoAnterior!.totalReal;
      }

      const restante = arredondar2(salarioMes - despesasMesAnterior);

      resultado.push({
        mes: m,
        rotulo: NOMES_MESES[m] ?? m,
        salario: salarioMes,
        despesasMesAnterior,
        despesasMesAnteriorManual,
        labelDespesasMesAnterior,
        despesasLivia: arredondar2(divisao.receboLivia),
        restante,
        pixMes,
        pixMesAnterior: pixAnterior,
        temDados,
        ehPrimeiroMes,
      });

      divisaoAnterior = divisao;
      pixAnterior = pixMes;
    }

    return resultado;
  }, [snapshot, salarioPorMes, despesasMesAnteriorValor]);

  // Pix do mês selecionado (para a área informativa de reposição)
  const mesAtualSnapshot = snapshot.meses[mes];
  const registrosMes = mesAtualSnapshot?.registros ?? [];
  const pixMesSelecionado = arredondar2(
    registrosMes.reduce(
      (soma, r) => soma + (r.dados['FORMA DE PGTO'] === 'MP' ? Number(r.dados.VALOR) || 0 : 0),
      0,
    ),
  );
  const linhaMesSelecionado = linhas.find((l) => l.mes === mes);
  const restanteMesSelecionado = linhaMesSelecionado?.restante ?? 0;
  const saldoMesSelecionado =
    linhaMesSelecionado && saldoCaixaTexto !== ''
      ? arredondar2(saldoCaixa + restanteMesSelecionado)
      : null;

  return (
    <div className="space-y-5">
      {/* ---------- cabeçalho com seletor de mês ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MesTabs meses={snapshot.meses} selecionado={mes} aoSelecionar={setMes} />
        <p className="text-xs text-slate-500">
          Salário do mês − Despesas do mês anterior = Restante · Saldo = Caixa (digitado) + Restante
        </p>
      </div>

      {!ano ? (
        <EstadoVazio
          icone={Wallet}
          titulo="Nenhum ano selecionado"
          descricao="Vá em Gestão Anual e selecione um ano."
        />
      ) : (
        <>
          {/* ---------- campos de entrada do usuário ---------- */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Saldo em caixa (antes do salário)
                </label>
                <input
                  type="text"
                  value={saldoCaixaTexto}
                  onChange={(e) => setSaldoCaixaTexto(e.target.value.replace(/[^0-9,.-]/g, ''))}
                  placeholder="Ex.: 10.000,00"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-sky-500"
                />
                <p className="text-[10px] text-slate-600">
                  O que você tem no banco <strong>antes</strong> do salário cair. Usado no Saldo de cada mês.
                </p>
              </div>

              {linhaMesSelecionado?.ehPrimeiroMes ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {linhaMesSelecionado.labelDespesasMesAnterior}
                  </label>
                  <input
                    type="text"
                    value={despesasMesAnteriorTexto}
                    onChange={(e) =>
                      setDespesasMesAnteriorTexto(e.target.value.replace(/[^0-9,.-]/g, ''))
                    }
                    placeholder="Ex.: 3.200,00"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-sky-500"
                  />
                  <p className="text-[10px] text-slate-600">
                    Meu gasto real de dezembro/2026. Só usado na linha de janeiro (1º mês do ano).
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {linhaMesSelecionado?.labelDespesasMesAnterior ?? 'Despesas mês anterior'}
                  </label>
                  <span className="text-lg font-semibold tabular-nums text-slate-100">
                    {formatarMoeda(linhaMesSelecionado?.despesasMesAnterior ?? 0)}
                  </span>
                  <p className="text-[10px] text-slate-600">
                    Buscado automaticamente do mês anterior (Meu gasto real).
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Salário do mês (aba Ganhos)
                </label>
                <span className="text-lg font-semibold tabular-nums text-slate-100">
                  {formatarMoeda(linhaMesSelecionado?.salario ?? 0)}
                </span>
                <p className="text-[10px] text-slate-600">
                  Total ganhos do mês {mes} (base + 13º + férias + outros + freelance).
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Restante do mês {mes}
                </label>
                <span className="text-lg font-semibold tabular-nums text-emerald-300">
                  {formatarMoeda(restanteMesSelecionado)}
                </span>
                <p className="text-[10px] text-slate-600">
                  Salário − despesas do mês anterior.
                </p>
              </div>

              {saldoMesSelecionado != null && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Saldo do mês {mes}
                  </label>
                  <span className="text-lg font-semibold tabular-nums text-emerald-300">
                    {formatarMoeda(saldoMesSelecionado)}
                  </span>
                  <p className="text-[10px] text-slate-600">
                    Caixa (digitado) + Restante.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ---------- tabela resumo mensal (sem coluna Saldo acumulado) ---------- */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 font-semibold">Mês</th>
                    <th className="px-3 py-3 text-right font-semibold">Salário mês</th>
                    <th className="px-3 py-3 text-right font-semibold" title="Despesas do mês anterior (Meu gasto real)">
                      Despesas mês ant.
                    </th>
                    <th className="px-3 py-3 text-right font-semibold" title="Dividido 50/50 ÷ 2 + Livia do mês — informativo">
                      Despesas Livia
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">Restante</th>
                    <th className="px-3 py-3 text-right font-semibold" title="Saldo em caixa (digitado) + Restante">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => {
                    const temSalario = linha.salario > 0;
                    const podeCalcular = temSalario && (linha.temDados || linha.despesasMesAnteriorManual);
                    return (
                      <tr
                        key={linha.mes}
                        className={`border-b border-slate-800/70 transition hover:bg-slate-800/25 ${
                          linha.mes === mes ? 'bg-slate-800/30' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <span className={`font-semibold ${linha.mes === mes ? 'text-sky-300' : 'text-slate-200'}`}>
                            {linha.rotulo}
                          </span>
                          {!linha.temDados && <span className="ml-1.5 text-xs text-slate-600">sem lançamentos</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {temSalario ? formatarMoeda(linha.salario) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {podeCalcular || linha.despesasMesAnteriorManual
                            ? formatarMoeda(linha.despesasMesAnterior)
                            : '—'}
                          {linha.despesasMesAnteriorManual && !linha.temDados ? (
                            <span className="ml-1 text-[10px] text-amber-400" title="Valor digitado manualmente">
                              *
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                          {linha.temDados ? formatarMoeda(linha.despesasLivia) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                          {podeCalcular
                            ? formatarMoeda(linha.restante)
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                          {podeCalcular && saldoCaixaTexto !== ''
                            ? formatarMoeda(arredondar2(saldoCaixa + linha.restante))
                            : '—'}
                          {(saldoCaixaTexto === '' || !podeCalcular) && podeCalcular ? (
                            <span className="ml-1 text-[10px] text-amber-400" title="Digite o saldo em caixa acima">
                              *
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {linhas.length > 0 && (
                  <tfoot className="bg-slate-950/50 text-sm font-semibold">
                    <tr>
                      <td className="px-4 py-2.5 text-slate-500">Total ano</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                        {formatarMoeda(
                          arredondar2(linhas.reduce((s, l) => s + l.salario, 0)),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                        {formatarMoeda(
                          arredondar2(linhas.reduce((s, l) => s + l.despesasMesAnterior, 0)),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                        {formatarMoeda(
                          arredondar2(linhas.reduce((s, l) => s + l.despesasLivia, 0)),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-300">
                        {formatarMoeda(
                          arredondar2(linhas.reduce((s, l) => s + l.restante, 0)),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-300">
                        {saldoCaixaTexto !== ''
                          ? formatarMoeda(
                            arredondar2(saldoCaixa * 12 + linhas.reduce((s, l) => s + l.restante, 0)),
                          )
                          : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {/* ------- Pix no rodapé (mês atual e anterior) ------- */}
            <div className="border-t border-slate-800 bg-slate-900/40 px-4 py-3">
              <div className="flex flex-wrap items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                    Pix mês atual ({mes})
                  </span>
                  <span className="text-slate-200 tabular-nums font-semibold">
                    {formatarMoeda(pixMesSelecionado)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                    Pix mês anterior
                  </span>
                  <span className="text-slate-200 tabular-nums font-semibold">
                    {formatarMoeda(linhaMesSelecionado?.pixMesAnterior ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                    Total pix ano
                  </span>
                  <span className="text-amber-400 tabular-nums font-semibold">
                    {formatarMoeda(
                      arredondar2(
                        linhas.reduce((s, l) => s + l.pixMes, 0),
                      ),
                    )}
                  </span>
                </div>
              </div>
            </div>
            {saldoCaixaTexto === '' && (
              <p className="border-t border-slate-800 px-4 py-2.5 text-xs text-amber-400">
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                Digite o <strong>saldo em caixa</strong> acima para ver o <strong>Saldo</strong> do mês selecionado.
              </p>
            )}
            {linhaMesSelecionado?.ehPrimeiroMes && despesasMesAnteriorValor === 0 && (
              <p className="border-t border-slate-800 px-4 py-2.5 text-xs text-amber-400">
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                Informe as <strong>despesas de dezembro</strong> (mês anterior) para calcular o restante de janeiro.
              </p>
            )}
          </section>

          {/* ---------- área informativa do Pix ---------- */}
          <section className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-4">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-300">Pix do mês anterior — reposição</h3>
                <p className="text-xs text-slate-400">
                  Os gastos com <strong>Pix</strong> já entram no "Meu gasto real" do mês anterior e, por
                  consequência, já estão descontados do <strong>Restante</strong>. Esta área só mostra quanto
                  você tirou via Pix para saber quanto precisa repor do caixa guardado.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Pix neste mês ({mes})</p>
                    <p className="text-slate-200 tabular-nums">{formatarMoeda(pixMesSelecionado)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Pix mês anterior</p>
                    <p className="text-slate-200 tabular-nums">{formatarMoeda(linhaMesSelecionado?.pixMesAnterior ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Disponível para pix (restante)</p>
                    <p className="text-emerald-300 tabular-nums">{formatarMoeda(restanteMesSelecionado)}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Botao icone={RefreshCw} onClick={() => void revalidar()} tamanho="sm">
              Atualizar
            </Botao>
            <span className="text-xs text-slate-600">
              Salário vem da aba Ganhos (Total ganhos) · Despesas vêm de Lançamentos (Meu gasto real)
            </span>
          </div>
        </>
      )}
    </div>
  );
}
