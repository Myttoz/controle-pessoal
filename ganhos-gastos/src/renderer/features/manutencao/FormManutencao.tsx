import { useState } from 'react';
import type { RegistroManutencao } from '@/types/dados-locais';
import { Botao } from '@/components/Botoes';
import { Campo, Entrada, Selecao } from '@/components/Campos';
import { Modal } from '@/components/Modal';
import { parseValor } from '@/lib/formatar';
import { avaliarManutencao, hojeISO, PRESETS_REVISAO } from '@/lib/calculos';
import { useStoreLocal } from '@/store/storeLocal';

interface Estado {
  descricao: string;
  data: string;
  km: string;
  valor: string;
  mecanico: string;
  lojaPecas: string;
  observacao: string;
  intervaloDataMeses: string;
  intervaloKm: string;
}

function paraEstado(r?: RegistroManutencao | null): Estado {
  if (!r) {
    return {
      descricao: '',
      data: hojeISO(),
      km: '',
      valor: '',
      mecanico: '',
      lojaPecas: '',
      observacao: '',
      intervaloDataMeses: '6',
      intervaloKm: '10000',
    };
  }
  return {
    descricao: r.descricao,
    data: r.data,
    km: r.km != null ? String(r.km) : '',
    valor: String(r.valor ?? ''),
    mecanico: r.mecanico ?? '',
    lojaPecas: r.lojaPecas ?? '',
    observacao: r.observacao ?? '',
    intervaloDataMeses: String(r.intervaloDataMeses ?? 0),
    intervaloKm: r.intervaloKm != null ? String(r.intervaloKm) : '',
  };
}

interface Props {
  registro?: RegistroManutencao | null;
  aoFechar: () => void;
}

export function FormManutencao({ registro, aoFechar }: Props) {
  const [estado, setEstado] = useState<Estado>(() => paraEstado(registro));
  const [preset, setPreset] = useState<string>('');
  const [erros, setErros] = useState<Partial<Record<keyof Estado, string>>>({});
  const [enviando, setEnviando] = useState(false);

  const kmAtual = useStoreLocal((s) => s.dados.config.kmAtual);
  const adicionar = useStoreLocal((s) => s.adicionarManutencao);
  const editar = useStoreLocal((s) => s.editarManutencao);

  const modoEdicao = !!registro;

  const alterar = (campo: keyof Estado, valor: string) => {
    setEstado((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
  };

  const aplicarPreset = (nome: string) => {
    setPreset(nome);
    const p = PRESETS_REVISAO.find((x) => x.rotulo === nome);
    if (!p) return;
    setEstado((atual) => ({
      ...atual,
      intervaloDataMeses: String(p.meses),
      intervaloKm: p.km != null ? String(p.km) : '',
    }));
  };

  // prévia do status
  const kmNum = estado.km.trim() === '' ? undefined : parseValor(estado.km);
  const intervaloKmNum = estado.intervaloKm.trim() === '' ? undefined : parseValor(estado.intervaloKm);
  const avaliacao = avaliarManutencao(
    {
      data: estado.data,
      km: kmNum,
      intervaloDataMeses: Number(estado.intervaloDataMeses) || 0,
      intervaloKm: intervaloKmNum,
    },
    kmAtual,
  );

  const enviar = () => {
    const novos: Partial<Record<keyof Estado, string>> = {};
    if (!estado.descricao.trim()) novos.descricao = 'Descreva a manutenção.';
    if (!estado.data) novos.data = 'Informe a data.';
    const valor = parseValor(estado.valor);
    if (!Number.isFinite(valor) || valor < 0) novos.valor = 'Informe o valor.';
    if (!estado.mecanico.trim()) novos.mecanico = 'Informe a mecânica/loja.';
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    const payload = {
      descricao: estado.descricao.trim(),
      data: estado.data,
      km: kmNum,
      valor: Math.round(valor * 100) / 100,
      mecanico: estado.mecanico.trim(),
      lojaPecas: estado.lojaPecas.trim() || undefined,
      observacao: estado.observacao.trim() || undefined,
      intervaloDataMeses: Number(estado.intervaloDataMeses) || 0,
      intervaloKm: intervaloKmNum,
    };

    setEnviando(true);
    if (modoEdicao) editar(registro.id, payload);
    else adicionar(payload);
    setEnviando(false);
    aoFechar();
  };

  return (
    <Modal
      aberto
      titulo={modoEdicao ? 'Editar manutenção' : 'Nova manutenção'}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Manutenção *" className="sm:col-span-2">
          <Entrada value={estado.descricao} onChange={(e) => alterar('descricao', e.target.value)} placeholder="Ex.: Troca de óleo e filtros" autoFocus />
          {erros.descricao && <span className="mt-1 block text-xs text-rose-400">{erros.descricao}</span>}
        </Campo>

        <Campo rotulo="Data *">
          <Entrada type="date" value={estado.data} onChange={(e) => alterar('data', e.target.value)} />
          {erros.data && <span className="mt-1 block text-xs text-rose-400">{erros.data}</span>}
        </Campo>

        <Campo rotulo="KM no momento" dica="Opcional">
          <Entrada value={estado.km} onChange={(e) => alterar('km', e.target.value)} inputMode="numeric" placeholder="Ex.: 122819" />
        </Campo>

        <Campo rotulo="Valor (R$) *">
          <Entrada value={estado.valor} onChange={(e) => alterar('valor', e.target.value)} inputMode="decimal" placeholder="0,00" />
          {erros.valor && <span className="mt-1 block text-xs text-rose-400">{erros.valor}</span>}
        </Campo>

        <Campo rotulo="Mecânica / loja *">
          <Entrada value={estado.mecanico} onChange={(e) => alterar('mecanico', e.target.value)} placeholder="Ex.: Bruninho" />
          {erros.mecanico && <span className="mt-1 block text-xs text-rose-400">{erros.mecanico}</span>}
        </Campo>

        <Campo rotulo="Loja de peças" dica="Se houver">
          <Entrada value={estado.lojaPecas} onChange={(e) => alterar('lojaPecas', e.target.value)} placeholder="Ex.: União Atacarejo" />
        </Campo>

        <Campo rotulo="Observação" dica="Opcional">
          <Entrada value={estado.observacao} onChange={(e) => alterar('observacao', e.target.value)} />
        </Campo>

        <Campo rotulo="Preset de revisão" className="sm:col-span-2" dica="Preenche os intervalos automaticamente">
          <Selecao value={preset} onChange={(e) => aplicarPreset(e.target.value)}>
            <option value="">Escolher manualmente…</option>
            {PRESETS_REVISAO.map((p) => (
              <option key={p.rotulo} value={p.rotulo}>
                {p.rotulo} ({p.meses}m{p.km != null ? ` / ${p.km} km` : ''})
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo rotulo="Próxima revisão (meses)">
          <Entrada value={estado.intervaloDataMeses} onChange={(e) => alterar('intervaloDataMeses', e.target.value)} inputMode="numeric" placeholder="Ex.: 6" />
        </Campo>

        <Campo rotulo="Próxima revisão (km)" dica="Opcional">
          <Entrada value={estado.intervaloKm} onChange={(e) => alterar('intervaloKm', e.target.value)} inputMode="numeric" placeholder="Ex.: 10000" />
        </Campo>
      </div>

      {/* prévia do status */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 text-sm">
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Próxima revisão (prévia)</p>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-slate-300">
            Data: <strong>{avaliacao.proximaData ? br(avaliacao.proximaData) : '—'}</strong>
          </span>
          <span className="text-slate-300">
            KM: <strong>{avaliacao.proximoKm != null ? avaliacao.proximoKm.toLocaleString('pt-BR') : '—'}</strong>
          </span>
          <BadgeStatus status={avaliacao.status} />
        </div>
        <p className="mt-2 text-xs text-slate-500">KM atual do veículo: {kmAtual > 0 ? kmAtual.toLocaleString('pt-BR') : '—'}</p>
      </div>
    </Modal>
  );
}

function BadgeStatus({ status }: { status: 'URGENTE' | 'PROXIMO' | 'OK' }) {
  const estilo =
    status === 'URGENTE'
      ? 'bg-rose-500/15 text-rose-300'
      : status === 'PROXIMO'
        ? 'bg-amber-500/15 text-amber-300'
        : 'bg-emerald-500/15 text-emerald-300';
  const rotulo = status === 'URGENTE' ? 'URGENTE' : status === 'PROXIMO' ? 'PRÓXIMO' : 'OK';
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${estilo}`}>{rotulo}</span>;
}

function br(iso: string): string {
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}
