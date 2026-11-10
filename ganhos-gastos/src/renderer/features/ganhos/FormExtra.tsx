import { useState } from 'react';
import type { LinhaExtra, Registro, SiglaMes } from '@/types/api-types';
import { Botao } from '@/components/Botoes';
import { Campo, Entrada, Selecao } from '@/components/Campos';
import { Modal } from '@/components/Modal';
import { mesAtual } from '@/lib/meses';
import { parseValor } from '@/lib/formatar';
import { useOpcoes, useOpcoesMes } from '@/hooks/useOpcoes';
import { useStoreAno } from '@/store/storeAno';

type Tabela = 'ganhos' | 'gastos';

interface EstadoForm {
  mes: string;
  categoria: string;
  descricao: string;
  valor: string;
  data: string;
}

function paraEstado(dados?: LinhaExtra, mesPadrao?: string): EstadoForm {
  return {
    mes: dados?.['MÊS'] ?? mesPadrao ?? '',
    categoria: dados?.CATEGORIA ?? '',
    descricao: dados?.DESCRIÇÃO ?? '',
    valor: dados ? String(dados.VALOR ?? '') : '',
    data: dados?.DATA ?? '',
  };
}

/**
 * Formulário da aba Extras (ganhos OU gastos).
 * Sempre envia o campo "tabela" junto da escrita.
 */
export function FormExtra({
  tabela,
  registro,
  mesPadrao,
  aoFechar,
}: {
  tabela: Tabela;
  registro?: Registro<LinhaExtra> | null;
  /** Mês sugerido para um registro novo (seletor de mês da página). */
  mesPadrao: SiglaMes;
  aoFechar: () => void;
}) {
  const [estado, setEstado] = useState<EstadoForm>(() => paraEstado(registro?.dados, mesPadrao));
  const [erros, setErros] = useState<Partial<Record<keyof EstadoForm, string>>>({});
  const [enviando, setEnviando] = useState(false);

  const adicionarExtra = useStoreAno((s) => s.adicionarExtra);
  const editarExtra = useStoreAno((s) => s.editarExtra);
  const ano = useStoreAno((s) => s.anoSelecionado);

  const opcoesMes = useOpcoesMes();
  const opcoesCategoria = useOpcoes('CATEGORIA');

  const alterar = (campo: keyof EstadoForm, valor: string) => {
    setEstado((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
  };

  const enviar = async () => {
    const novosErros: Partial<Record<keyof EstadoForm, string>> = {};
    if (!estado.mes) novosErros.mes = 'Informe o mês.';
    if (!estado.categoria.trim()) novosErros.categoria = 'Informe a categoria.';
    if (!estado.descricao.trim()) novosErros.descricao = 'Informe a descrição.';
    const valor = parseValor(estado.valor);
    if (!Number.isFinite(valor)) novosErros.valor = 'Valor numérico obrigatório.';
    else if (valor <= 0) novosErros.valor = 'O valor deve ser maior que zero.';

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0 || ano == null) return;

    const dados: LinhaExtra = {
      'MÊS': estado.mes as SiglaMes,
      CATEGORIA: estado.categoria.trim(),
      DESCRIÇÃO: estado.descricao.trim(),
      VALOR: Math.round(valor * 100) / 100,
      DATA: estado.data,
    };

    setEnviando(true);
    const ok =
      registro != null
        ? await editarExtra(ano, tabela, registro.linha, dados)
        : await adicionarExtra(ano, tabela, dados);
    setEnviando(false);
    if (ok) aoFechar();
  };

  const tituloBase = tabela === 'ganhos' ? 'ganhos' : 'gastos';

  return (
    <Modal
      aberto
      titulo={`${registro ? 'Editar' : 'Novo'} extra de ${tituloBase}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao variante="primario" carregando={enviando} onClick={() => void enviar()}>
            {registro ? 'Salvar' : 'Adicionar'}
          </Botao>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Mês *">
          <Selecao value={estado.mes} onChange={(e) => alterar('mes', e.target.value)}>
            <option value="">Selecione…</option>
            {opcoesMes.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </Selecao>
          {erros.mes && <span className="mt-1 block text-xs text-rose-400">{erros.mes}</span>}
        </Campo>

        <Campo rotulo="Valor * (R$)">
          <Entrada
            value={estado.valor}
            onChange={(e) => alterar('valor', e.target.value)}
            placeholder="1.234,56"
            inputMode="decimal"
            autoFocus
          />
          {erros.valor && <span className="mt-1 block text-xs text-rose-400">{erros.valor}</span>}
        </Campo>

        <Campo rotulo="Categoria *">
          <Entrada
            value={estado.categoria}
            onChange={(e) => alterar('categoria', e.target.value)}
            list="extra-categorias"
            placeholder="Ex.: Manutenção"
          />
          <datalist id="extra-categorias">
            {opcoesCategoria.map((op) => (
              <option key={op} value={op} />
            ))}
          </datalist>
          {erros.categoria && (
            <span className="mt-1 block text-xs text-rose-400">{erros.categoria}</span>
          )}
        </Campo>

        <Campo rotulo="Data">
          <Entrada
            type="date"
            value={estado.data}
            onChange={(e) => alterar('data', e.target.value)}
          />
        </Campo>

        <Campo rotulo="Descrição *" className="sm:col-span-2">
          <Entrada
            value={estado.descricao}
            onChange={(e) => alterar('descricao', e.target.value)}
            placeholder="Ex.: Site para cliente"
          />
          {erros.descricao && (
            <span className="mt-1 block text-xs text-rose-400">{erros.descricao}</span>
          )}
        </Campo>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        O mês é obrigatório para que os totais da planilha (SUMIF) continuem corretos.
        Padrão sugerido: <strong>{mesAtual()}</strong>.
      </p>
    </Modal>
  );
}
