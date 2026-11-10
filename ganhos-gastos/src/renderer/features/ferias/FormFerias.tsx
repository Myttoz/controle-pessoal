import { useMemo, useState } from 'react';
import type { RegistroFerias } from '@/types/dados-locais';
import { Botao } from '@/components/Botoes';
import { Campo, Entrada, Selecao } from '@/components/Campos';
import { Modal } from '@/components/Modal';
import { formatarMoeda, hojeISO } from '@/lib/formatar';
import {
  DIAS_FERIAS_PERIODO,
  MAX_DIAS_VENDIDOS,
  addDias,
  calcularFerias,
  periodoAquisitivoDe,
} from '@/lib/calculos';
import { useStoreLocal } from '@/store/storeLocal';

interface Estado {
  inicio: string;
  diasRetirados: number;
  diasVendidos: number;
  observacao: string;
}

/** Máximo de dias vendidos para uma quantidade de dias gozados. */
function maxVendidosPara(diasRetirados: number): number {
  return Math.min(MAX_DIAS_VENDIDOS, Math.max(0, DIAS_FERIAS_PERIODO - diasRetirados));
}

function paraEstado(r?: RegistroFerias | null): Estado {
  if (!r) {
    const inicio = hojeISO();
    return { inicio, diasRetirados: 30, diasVendidos: 0, observacao: '' };
  }
  return {
    inicio: r.inicio,
    diasRetirados: r.diasRetirados,
    // Corrige registros antigos que tenham mais dias vendidos do que o permitido.
    diasVendidos: Math.min(r.diasVendidos, maxVendidosPara(r.diasRetirados)),
    observacao: r.observacao ?? '',
  };
}

/** Dias vendidos padrão: diferença até 30, limitada ao teto legal de 10. */
function abonoPadrao(diasRetirados: number): number {
  return maxVendidosPara(diasRetirados);
}

interface Props {
  registro?: RegistroFerias | null;
  aoFechar: () => void;
}

export function FormFerias({ registro, aoFechar }: Props) {
  const [estado, setEstado] = useState<Estado>(() => paraEstado(registro));
  const [erros, setErros] = useState<Partial<Record<keyof Estado, string>>>({});
  const [enviando, setEnviando] = useState(false);

  const salarioBruto = useStoreLocal((s) => s.dados.config.salarioBruto);
  const adicionar = useStoreLocal((s) => s.adicionarFerias);
  const editar = useStoreLocal((s) => s.editarFerias);

  const modoEdicao = !!registro;

  const fim = useMemo(() => addDias(estado.inicio, estado.diasRetirados), [estado.inicio, estado.diasRetirados]);
  const periodo = useMemo(() => periodoAquisitivoDe(estado.inicio), [estado.inicio]);
  const calc = useMemo(
    () => calcularFerias(estado.diasRetirados, estado.diasVendidos, salarioBruto),
    [estado.diasRetirados, estado.diasVendidos, salarioBruto],
  );

  const alterar = (campo: keyof Estado, valor: string | number) => {
    setEstado((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
  };

  const enviar = () => {
    const novos: Partial<Record<keyof Estado, string>> = {};
    if (!estado.inicio) novos.inicio = 'Informe a data de início.';
    if (salarioBruto <= 0) novos.inicio = 'Informe o salário bruto no painel acima.';
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    const payload = {
      periodo,
      inicio: estado.inicio,
      fim,
      diasRetirados: estado.diasRetirados,
      diasVendidos: estado.diasVendidos,
      observacao: estado.observacao.trim(),
    };

    setEnviando(true);
    if (modoEdicao) editar(registro.id, payload);
    else adicionar(payload);
    setEnviando(false);
    aoFechar();
  };

  const excedente = Math.max(0, DIAS_FERIAS_PERIODO - estado.diasRetirados - estado.diasVendidos);
  // Não faz sentido gozar 30 dias e vender 10: o abono máximo cai conforme os dias gozados.
  const maxVendidos = maxVendidosPara(estado.diasRetirados);

  return (
    <Modal
      aberto
      titulo={modoEdicao ? 'Editar férias' : 'Nova retirada de férias'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao variante="primario" carregando={enviando} onClick={enviar}>
            {modoEdicao ? 'Salvar' : 'Adicionar'}
          </Botao>
        </>
      }
    >
      <div className="mb-4 rounded-lg border border-sky-900/50 bg-sky-950/20 px-3 py-2 text-sm text-sky-200">
        Período aquisitivo: <strong>{periodo || '—'}</strong>
        <span className="ml-2 text-xs text-sky-400/70">(fixo Abril → Abril, calculado pela data de início)</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Data de início *">
          <Entrada type="date" value={estado.inicio} onChange={(e) => alterar('inicio', e.target.value)} />
          {erros.inicio && <span className="mt-1 block text-xs text-rose-400">{erros.inicio}</span>}
        </Campo>

        <Campo rotulo="Data de fim" dica="Calculada: início + dias retirados">
          <Entrada value={fim ? formatarDataBR(fim) : ''} readOnly className="!bg-slate-950/60 text-slate-400" />
        </Campo>

        <Campo rotulo="Dias de férias retirados *">
          <Selecao
            value={String(estado.diasRetirados)}
            onChange={(e) => {
              const dias = Number(e.target.value);
              setEstado((atual) => ({ ...atual, diasRetirados: dias, diasVendidos: abonoPadrao(dias) }));
              setErros((atual) => ({ ...atual, diasRetirados: undefined }));
            }}
          >
            <option value="30">30 dias (integral)</option>
            <option value="20">20 dias (10 vendidos)</option>
            <option value="15">15 dias</option>
          </Selecao>
        </Campo>

        <Campo rotulo="Dias vendidos (abono)" dica={`Máx. ${MAX_DIAS_VENDIDOS} por lei`}>
          <Selecao value={String(estado.diasVendidos)} onChange={(e) => alterar('diasVendidos', Number(e.target.value))}>
            {Array.from({ length: maxVendidos + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i} {i === 1 ? 'dia' : 'dias'}
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo rotulo="Observação" className="sm:col-span-2">
          <Entrada value={estado.observacao} onChange={(e) => alterar('observacao', e.target.value)} placeholder="Ex.: Retornei dia 03/08 — segunda-feira" />
        </Campo>
      </div>

      {/* prévia do cálculo */}
      <div className="mt-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Férias gozadas (+1/3)</p>
          <p className="text-lg font-semibold text-slate-100">{formatarMoeda(calc.valorFerias)}</p>
          <p className="text-xs text-slate-500">
            {estado.diasRetirados} dias · {formatarMoeda(calc.baseFerias)} + 1/3{' '}
            {formatarMoeda(calc.tercoFerias)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Abono vendidos (+1/3)</p>
          <p className="text-lg font-semibold text-slate-100">{formatarMoeda(calc.valorAbono)}</p>
          <p className="text-xs text-slate-500">
            {estado.diasVendidos} dias · {formatarMoeda(calc.baseAbono)} + 1/3{' '}
            {formatarMoeda(calc.tercoAbono)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Total a receber</p>
          <p className="text-lg font-semibold text-emerald-300">{formatarMoeda(calc.total)}</p>
          <p className="text-xs text-slate-500">Diária {formatarMoeda(calc.diaria)}</p>
        </div>
      </div>

      {excedente > 0 && (
        <p className="mt-2 text-xs text-amber-400">
          {excedente} {excedente === 1 ? 'dia restante não é vendido' : 'dias restantes não são vendidos'} (o abono é limitado a{' '}
          {MAX_DIAS_VENDIDOS} dias) — apenas não são gozados.
        </p>
      )}

      {salarioBruto <= 0 && (
        <p className="mt-3 text-xs text-amber-400">
          Informe o salário bruto no painel de configuração para que os valores sejam calculados.
        </p>
      )}
    </Modal>
  );
}

function formatarDataBR(iso: string): string {
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}
