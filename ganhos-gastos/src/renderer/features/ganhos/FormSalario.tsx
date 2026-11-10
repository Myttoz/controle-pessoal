import { useState } from 'react';
import type { DadosSalario, LinhaSalario, Registro } from '@/types/api-types';
import { Botao } from '@/components/Botoes';
import { Campo, Entrada } from '@/components/Campos';
import { Modal } from '@/components/Modal';
import { parseValor } from '@/lib/formatar';
import { useStoreAno } from '@/store/storeAno';

type CamposNumericos =
  | 'SALÁRIO BASE'
  | '13º'
  | 'FÉRIAS'
  | 'AJUDA CUSTO (info)'
  | 'HORA EXTRA (info)'
  | 'OUTROS'
  | 'TICKET';

const CAMPOS: { campo: CamposNumericos; rotulo: string; informativo?: boolean; dica?: string }[] = [
  { campo: 'SALÁRIO BASE', rotulo: 'Salário base' },
  { campo: '13º', rotulo: '13º' },
  { campo: 'FÉRIAS', rotulo: 'Férias' },
  {
    campo: 'AJUDA CUSTO (info)',
    rotulo: 'Ajuda custo (info)',
    informativo: true,
    dica: 'Coluna informativa — não entra no cálculo do salário',
  },
  {
    campo: 'HORA EXTRA (info)',
    rotulo: 'Hora extra (info)',
    informativo: true,
    dica: 'Coluna informativa — não entra no cálculo do salário',
  },
  { campo: 'OUTROS', rotulo: 'Outros' },
  {
    campo: 'TICKET',
    rotulo: 'Ticket (info)',
    informativo: true,
    dica: 'Coluna informativa — não entra no cálculo do salário',
  },
];

function paraTexto(valor: number | undefined | null): string {
  if (valor === undefined || valor === null || !Number.isFinite(Number(valor))) return '';
  return String(valor);
}

/**
 * Edição da linha do mês na aba Salário.
 * Envia SOMENTE colunas editáveis — FREELANCE, TOTAL SALÁRIO e TOTAL GANHOS
 * são calculadas e nunca saem daqui.
 */
export function FormSalario({
  registro,
  aoFechar,
}: {
  registro: Registro<LinhaSalario>;
  aoFechar: () => void;
}) {
  const [valores, setValores] = useState<Record<CamposNumericos, string>>(() => {
    const inicial = {} as Record<CamposNumericos, string>;
    for (const { campo } of CAMPOS) inicial[campo] = paraTexto(registro.dados[campo]);
    return inicial;
  });
  const [observacao, setObservacao] = useState(registro.dados.OBSERVAÇÃO ?? '');
  const [erros, setErros] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const editarSalario = useStoreAno((s) => s.editarSalario);
  const ano = useStoreAno((s) => s.anoSelecionado);

  const enviar = async () => {
    const dados: DadosSalario = {};
    for (const { campo } of CAMPOS) {
      const bruto = valores[campo].trim();
      const numero = bruto === '' ? 0 : parseValor(bruto);
      if (!Number.isFinite(numero)) {
        setErros(`"${campo}" precisa ser numérico.`);
        return;
      }
      if (numero < 0) {
        setErros(`"${campo}" não pode ser negativo.`);
        return;
      }
      dados[campo] = Math.round(numero * 100) / 100;
    }
    dados.OBSERVAÇÃO = observacao.trim();
    setErros(null);

    setEnviando(true);
    const ok = ano != null ? await editarSalario(ano, registro.linha, dados) : false;
    setEnviando(false);
    if (ok) aoFechar();
  };

  return (
    <Modal
      aberto
      titulo={`Salário · ${registro.dados['MÊS']}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao variante="primario" carregando={enviando} onClick={() => void enviar()}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map(({ campo, rotulo, informativo, dica }) => (
          <Campo
            key={campo}
            rotulo={`${rotulo}${informativo ? '' : ' (R$)'}`}
            dica={dica}
          >
            <Entrada
              value={valores[campo]}
              onChange={(e) =>
                setValores((atual) => ({ ...atual, [campo]: e.target.value }))
              }
              inputMode="decimal"
              placeholder="0"
            />
          </Campo>
        ))}

        <Campo rotulo="Observação" className="sm:col-span-2">
          <Entrada
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional"
          />
        </Campo>
      </div>

      {erros && <p className="mt-3 text-sm text-rose-400">{erros}</p>}

      <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-500">
        O <strong>TICKET</strong> é informativo: entra aqui apenas como registro e{' '}
        <strong>não participa do TOTAL SALÁRIO nem do TOTAL GANHOS</strong> (recalculados pelo app).
        A coluna <strong>FREELANCE</strong> vem calculada da planilha e também não é editada.
      </p>
    </Modal>
  );
}
