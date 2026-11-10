import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import type { LinhaExtra, Registro, SiglaMes } from '@/types/api-types';
import { Botao } from '@/components/Botoes';
import { EstadoVazio } from '@/components/Estados';
import { Modal } from '@/components/Modal';
import { arredondar2, formatarData, formatarMoeda } from '@/lib/formatar';
import { useSnapshot } from '@/hooks/useRegistrosFiltrados';
import { useStoreAno } from '@/store/storeAno';
import { useStoreUI } from '@/store/storeUI';
import { FormExtra } from './FormExtra';

type Tabela = 'ganhos' | 'gastos';

const ABAS: { id: Tabela; rotulo: string }[] = [
  { id: 'ganhos', rotulo: 'Ganhos' },
  { id: 'gastos', rotulo: 'Gastos' },
];

/** Aba interna "Extras": duas tabelas (ganhos/gastos) com CRUD completo. */
export function ExtrasArea() {
  const snapshot = useSnapshot();
  const ano = useStoreAno((s) => s.anoSelecionado);
  const removerExtra = useStoreAno((s) => s.removerExtra);

  const abaExtras = useStoreUI((s) => s.abaExtras);
  const setAbaExtras = useStoreUI((s) => s.setAbaExtras);
  const mesPadrao = useStoreUI((s) => s.mes);

  const [modal, setModal] = useState<
    { modo: 'novo' } | { modo: 'editar'; registro: Registro<LinhaExtra> }
  | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Registro<LinhaExtra> | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const extras = snapshot?.extras ?? null;
  const registros = extras ? extras[abaExtras] : [];

  const total = useMemo(
    () => arredondar2(registros.reduce((soma, r) => soma + (Number(r.dados.VALOR) || 0), 0)),
    [registros],
  );

  const confirmarExclusao = async () => {
    if (!paraExcluir || ano == null || !extras) return;
    setExcluindo(true);
    await removerExtra(ano, abaExtras, paraExcluir.linha);
    setExcluindo(false);
    setParaExcluir(null);
  };

  if (!snapshot) return null;

  if (!extras) {
    return (
      <EstadoVazio
        icone={Wallet}
        titulo={`A aba de extras do ano ${snapshot.ano} não existe`}
        descricao="Crie o ano na Gestão Anual para gerar a aba 'Extras'."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* abas internas + novo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {ABAS.map(({ id, rotulo }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAbaExtras(id)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                abaExtras === id
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {rotulo}
              <span className="ml-1.5 text-xs text-slate-400">{extras[id].length}</span>
            </button>
          ))}
        </div>

        <Botao
          variante="primario"
          icone={Plus}
          onClick={() => setModal({ modo: 'novo' })}
        >
          Novo extra de {abaExtras}
        </Botao>
      </div>

      {registros.length === 0 ? (
        <EstadoVazio
          titulo={`Sem extras de ${abaExtras} em ${snapshot.ano}`}
          descricao="Os registros desta tabela aparecem aqui."
          acao={
            <Botao variante="primario" icone={Plus} onClick={() => setModal({ modo: 'novo' })}>
              Adicionar registro
            </Botao>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Mês</th>
                  <th className="px-4 py-2.5 font-semibold">Categoria</th>
                  <th className="px-4 py-2.5 font-semibold">Descrição</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Valor</th>
                  <th className="px-4 py-2.5 font-semibold">Data</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((registro) => (
                  <tr
                    key={registro.linha}
                    className="border-b border-slate-800/70 transition hover:bg-slate-800/25"
                  >
                    <td className="px-4 py-2.5 font-semibold text-slate-300">{registro.dados['MÊS']}</td>
                    <td className="px-4 py-2.5 text-slate-300">{registro.dados.CATEGORIA}</td>
                    <td className="max-w-[320px] truncate px-4 py-2.5 text-slate-200" title={registro.dados.DESCRIÇÃO}>
                      {registro.dados.DESCRIÇÃO}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-100">
                      {formatarMoeda(registro.dados.VALOR)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-400">{formatarData(registro.dados.DATA)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Editar registro"
                          aria-label="Editar registro"
                          onClick={() => setModal({ modo: 'editar', registro })}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700/60 hover:text-sky-300"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Excluir registro"
                          aria-label="Excluir registro"
                          onClick={() => setParaExcluir(registro)}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-900/50 hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950/50 text-sm">
                  <td className="px-4 py-2.5 text-slate-500" colSpan={3}>
                    {registros.length} registro(s) em {extras.aba}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-300">
                    {formatarMoeda(total)}
                  </td>
                  <td className="px-4 py-2.5" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* modal criar/editar */}
      {modal && (
        <FormExtra
          tabela={abaExtras}
          registro={modal.modo === 'editar' ? modal.registro : null}
          mesPadrao={mesPadrao as SiglaMes}
          aoFechar={() => setModal(null)}
        />
      )}

      {/* confirmação de exclusão */}
      <Modal
        aberto={paraExcluir !== null}
        titulo="Excluir registro de extra"
        aoFechar={() => setParaExcluir(null)}
        largura="max-w-md"
        rodape={
          <>
            <Botao onClick={() => setParaExcluir(null)} disabled={excluindo}>
              Cancelar
            </Botao>
            <Botao variante="perigo" icone={Trash2} carregando={excluindo} onClick={() => void confirmarExclusao()}>
              Excluir
            </Botao>
          </>
        }
      >
        {paraExcluir && (
          <p className="text-sm text-slate-300">
            Remover <strong className="text-slate-100">{paraExcluir.dados.DESCRIÇÃO}</strong> (
            {formatarMoeda(paraExcluir.dados.VALOR)}) da tabela de {abaExtras}?
          </p>
        )}
      </Modal>
    </div>
  );
}
