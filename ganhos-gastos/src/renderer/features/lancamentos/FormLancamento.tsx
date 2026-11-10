import { useState } from 'react';
import type { LancamentoMensal, Registro } from '@/types/api-types';
import { Botao } from '@/components/Botoes';
import { Campo, Entrada, Selecao } from '@/components/Campos';
import { Modal } from '@/components/Modal';
import { parseValor } from '@/lib/formatar';
import { useOpcoes } from '@/hooks/useOpcoes';
import { useStoreAno } from '@/store/storeAno';

interface EstadoForm {
  categoria: string;
  valor: string;
  descricao: string;
  forma: string;
  tipo: string;
  quem: string;
  data: string;
  observacao: string;
}

type Erros = Partial<Record<keyof EstadoForm, string>>;

function paraEstado(dados?: LancamentoMensal): EstadoForm {
  return {
    categoria: dados?.CATEGORIA ?? '',
    valor: dados ? String(dados.VALOR ?? '') : '',
    descricao: dados?.DESCRIÇÃO ?? '',
    forma: dados?.['FORMA DE PGTO'] ?? '',
    tipo: dados?.TIPO ?? '',
    quem: dados?.['QUEM PAGA'] ?? '',
    data: dados?.DATA ?? '',
    observacao: dados?.OBSERVAÇÃO ?? '',
  };
}

function validar(estado: EstadoForm): Erros {
  const erros: Erros = {};
  if (!estado.categoria) erros.categoria = 'Selecione a categoria.';
  const valor = parseValor(estado.valor);
  if (!Number.isFinite(valor)) erros.valor = 'Informe um valor numérico.';
  else if (valor <= 0) erros.valor = 'O valor deve ser maior que zero.';
  if (!estado.descricao.trim()) erros.descricao = 'Informe a descrição.';
  if (!estado.forma) erros.forma = 'Selecione a forma de pagamento.';
  if (!estado.tipo) erros.tipo = 'Selecione o tipo.';
  if (!estado.quem) erros.quem = 'Selecione quem paga.';
  return erros;
}

interface Props {
  /** Aba mensal exata ("JAN 27"). */
  aba: string;
  /** Presente = modo edição; ausente = modo novo. */
  registro?: Registro<LancamentoMensal> | null;
  aoFechar: () => void;
}

export function FormLancamento({ aba, registro, aoFechar }: Props) {
  const [estado, setEstado] = useState<EstadoForm>(() => paraEstado(registro?.dados));
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  const adicionarLancamento = useStoreAno((s) => s.adicionarLancamento);
  const editarLancamento = useStoreAno((s) => s.editarLancamento);
  const ano = useStoreAno((s) => s.anoSelecionado);

  const opcoesCategoria = useOpcoes('CATEGORIA');
  const opcoesForma = useOpcoes('FORMA DE PGTO');
  const opcoesTipo = useOpcoes('TIPO');
  const opcoesQuem = useOpcoes('QUEM PAGA');

  const modoEdicao = !!registro;

  const alterar = (campo: keyof EstadoForm, valor: string) => {
    setEstado((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
  };

  const enviar = async () => {
    const validacao = validar(estado);
    setErros(validacao);
    if (Object.keys(validacao).length > 0 || ano == null) return;
    if (modoEdicao && registro === null) return;

    const dados: LancamentoMensal = {
      CATEGORIA: estado.categoria as LancamentoMensal['CATEGORIA'],
      VALOR: arredondarValor(parseValor(estado.valor)),
      DESCRIÇÃO: estado.descricao.trim(),
      'FORMA DE PGTO': estado.forma as LancamentoMensal['FORMA DE PGTO'],
      TIPO: estado.tipo as LancamentoMensal['TIPO'],
      'QUEM PAGA': estado.quem as LancamentoMensal['QUEM PAGA'],
      DATA: estado.data,
      OBSERVAÇÃO: estado.observacao.trim(),
    };

    setEnviando(true);
    const ok =
      registro !== null && registro !== undefined
        ? await editarLancamento(ano, aba, registro.linha, dados)
        : await adicionarLancamento(ano, aba, dados);
    setEnviando(false);

    if (ok) aoFechar();
  };

  return (
    <Modal
      aberto
      titulo={modoEdicao ? `Editar lançamento · ${aba}` : `Novo lançamento · ${aba}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao variante="primario" carregando={enviando} onClick={() => void enviar()}>
            {modoEdicao ? 'Salvar alterações' : 'Adicionar'}
          </Botao>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Categoria *">
          <Selecao
            value={estado.categoria}
            onChange={(e) => alterar('categoria', e.target.value)}
          >
            <option value="">Selecione…</option>
            {opcoesCategoria.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </Selecao>
          {erros.categoria && <span className="mt-1 block text-xs text-rose-400">{erros.categoria}</span>}
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

        <Campo rotulo="Descrição *" className="sm:col-span-2">
          <Entrada
            value={estado.descricao}
            onChange={(e) => alterar('descricao', e.target.value)}
            placeholder="Ex.: Conta de energia"
          />
          {erros.descricao && (
            <span className="mt-1 block text-xs text-rose-400">{erros.descricao}</span>
          )}
        </Campo>

        <Campo rotulo="Forma de pgto *">
          <Selecao value={estado.forma} onChange={(e) => alterar('forma', e.target.value)}>
            <option value="">Selecione…</option>
            {opcoesForma.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </Selecao>
          {erros.forma && <span className="mt-1 block text-xs text-rose-400">{erros.forma}</span>}
        </Campo>

        <Campo rotulo="Tipo *">
          <Selecao value={estado.tipo} onChange={(e) => alterar('tipo', e.target.value)}>
            <option value="">Selecione…</option>
            {opcoesTipo.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </Selecao>
          {erros.tipo && <span className="mt-1 block text-xs text-rose-400">{erros.tipo}</span>}
        </Campo>

        <Campo rotulo="Quem paga *">
          <Selecao value={estado.quem} onChange={(e) => alterar('quem', e.target.value)}>
            <option value="">Selecione…</option>
            {opcoesQuem.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </Selecao>
          {erros.quem && <span className="mt-1 block text-xs text-rose-400">{erros.quem}</span>}
        </Campo>

        <Campo rotulo="Data" dica="Opcional — formato AAAA-MM-DD">
          <Entrada type="date" value={estado.data} onChange={(e) => alterar('data', e.target.value)} />
        </Campo>

        <Campo rotulo="Observação" className="sm:col-span-2">
          <Entrada
            value={estado.observacao}
            onChange={(e) => alterar('observacao', e.target.value)}
            placeholder="Opcional"
          />
        </Campo>
      </div>
    </Modal>
  );
}

function arredondarValor(valor: number): number {
  return Math.round(valor * 100) / 100;
}
