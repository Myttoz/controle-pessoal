/**
 * LEMBRETES — lembretes com envio por e-mail e Google Agenda.
 *
 * O app apenas cadastra/edita os lembretes. O envio é feito por um gatilho
 * diário no Apps Script (mesmo com o app fechado). O campo WhatsApp fica
 * guardado para uso futuro — hoje não envia mensagem.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import type { DadosLembrete, Lembrete, StatusLembrete } from '@/types/api-types';
import { Botao } from '@/components/Botoes';
import { Campo, CLASSES_INPUT, Entrada } from '@/components/Campos';
import { AreaErro, Carregando, EstadoVazio } from '@/components/Estados';
import { Modal } from '@/components/Modal';
import { formatarData, hojeISO } from '@/lib/formatar';
import { useStoreLembretes } from '@/store/storeLembretes';

type FiltroStatus = 'TODOS' | StatusLembrete;

const FORM_VAZIO: DadosLembrete = {
  titulo: '',
  dataLembrete: '',
  email: '',
  whatsapp: '',
  mensagem: '',
};

const ESTILO_STATUS: Record<StatusLembrete, string> = {
  PENDENTE: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  ENVIADO: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  CANCELADO: 'bg-slate-700/30 text-slate-400 ring-slate-600/40',
};

const ROTULO_STATUS: Record<StatusLembrete, string> = {
  PENDENTE: 'Pendente',
  ENVIADO: 'Enviado',
  CANCELADO: 'Cancelado',
};

export function LembretesPage() {
  const lembretes = useStoreLembretes((s) => s.lembretes);
  const status = useStoreLembretes((s) => s.status);
  const carregado = useStoreLembretes((s) => s.carregado);
  const carregando = useStoreLembretes((s) => s.carregando);
  const salvando = useStoreLembretes((s) => s.salvando);
  const erro = useStoreLembretes((s) => s.erro);
  const carregar = useStoreLembretes((s) => s.carregar);
  const adicionar = useStoreLembretes((s) => s.adicionar);
  const editar = useStoreLembretes((s) => s.editar);
  const remover = useStoreLembretes((s) => s.remover);
  const testar = useStoreLembretes((s) => s.testar);
  const instalarGatilho = useStoreLembretes((s) => s.instalarGatilho);

  const [filtro, setFiltro] = useState<FiltroStatus>('TODOS');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Lembrete | null>(null);
  const [form, setForm] = useState<DadosLembrete>({ ...FORM_VAZIO });
  const [erroForm, setErroForm] = useState('');

  // Primeira abertura: carrega (o store evita repetir em trocas de aba).
  useEffect(() => {
    void carregar();
  }, [carregar]);

  const listaFiltrada = useMemo(() => {
    if (filtro === 'TODOS') return lembretes;
    return lembretes.filter((l) => l.status === filtro);
  }, [lembretes, filtro]);

  const contagem = useMemo(() => {
    const pendentes = lembretes.filter((l) => l.status === 'PENDENTE').length;
    const enviados = lembretes.filter((l) => l.status === 'ENVIADO').length;
    return { pendentes, enviados };
  }, [lembretes]);

  function abrirNovo() {
    setEditando(null);
    setForm({ ...FORM_VAZIO });
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEdicao(lembrete: Lembrete) {
    setEditando(lembrete);
    setForm({
      titulo: lembrete.titulo,
      dataLembrete: lembrete.dataLembrete,
      email: lembrete.email,
      whatsapp: lembrete.whatsapp,
      mensagem: lembrete.mensagem,
    });
    setErroForm('');
    setModalAberto(true);
  }

  async function salvar() {
    if (!form.dataLembrete) {
      setErroForm('Informe a data do lembrete.');
      return;
    }
    if (!form.mensagem.trim()) {
      setErroForm('Escreva a mensagem do lembrete.');
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErroForm('E-mail inválido.');
      return;
    }

    const dados: DadosLembrete = {
      titulo: form.titulo.trim() || 'Lembrete',
      dataLembrete: form.dataLembrete,
      email: form.email.trim(),
      whatsapp: form.whatsapp.trim(),
      mensagem: form.mensagem.trim(),
    };

    const ok = editando ? await editar(editando.id, dados) : await adicionar(dados);
    if (ok) setModalAberto(false);
  }

  async function excluir(lembrete: Lembrete) {
    const confirmou = window.confirm(
      `Excluir o lembrete "${lembrete.titulo}"? O evento da agenda também será removido.`,
    );
    if (confirmou) await remover(lembrete.id);
  }

  return (
    <div className="space-y-5">
      {/* ---------- cabeçalho ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-200">
            <BellRing className="h-5 w-5 text-amber-400" />
            Lembretes
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Envio automático por e-mail e criação de evento na Google Agenda. O envio
            acontece todos os dias no horário configurado, mesmo com o app fechado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Botao
            icone={RefreshCw}
            variante="secundario"
            onClick={() => void carregar(true)}
            carregando={carregando}
            title="Buscar novamente na planilha"
          >
            Atualizar
          </Botao>
          <Botao icone={Plus} variante="primario" onClick={abrirNovo}>
            Novo lembrete
          </Botao>
        </div>
      </div>

      {/* ---------- cartão de status do envio automático ---------- */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  status?.gatilhoAtivo ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-sm text-slate-300">
                Envio automático:{' '}
                <strong className={status?.gatilhoAtivo ? 'text-emerald-300' : 'text-amber-300'}>
                  {status?.gatilhoAtivo ? 'ativo' : 'desativado'}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="h-4 w-4 text-slate-500" />
              {status ? `Todos os dias · fuso ${status.fuso}` : 'Horário não consultado'}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Mail className="h-4 w-4 text-slate-500" />
              {status && status.emailRestante >= 0
                ? `Cota de e-mails hoje: ${status.emailRestante}`
                : 'Cota de e-mails indisponível'}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              {contagem.pendentes} pendente(s) · {contagem.enviados} enviado(s)
            </div>
          </div>

          {status && !status.gatilhoAtivo && (
            <Botao
              icone={Clock}
              variante="secundario"
              onClick={() => void instalarGatilho()}
              carregando={salvando}
            >
              Ativar envio automático
            </Botao>
          )}
        </div>
      </section>

      {/* ---------- filtros ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        {(['TODOS', 'PENDENTE', 'ENVIADO', 'CANCELADO'] as FiltroStatus[]).map((valor) => {
          const ativo = filtro === valor;
          const rotulo =
            valor === 'TODOS'
              ? `Todos (${lembretes.length})`
              : valor === 'PENDENTE'
                ? `Pendentes (${contagem.pendentes})`
                : valor === 'ENVIADO'
                  ? `Enviados (${contagem.enviados})`
                  : 'Cancelados';
          return (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                ativo
                  ? 'bg-sky-600/20 text-sky-200 ring-1 ring-inset ring-sky-500/50'
                  : 'bg-slate-900 text-slate-400 ring-1 ring-inset ring-slate-800 hover:text-slate-200'
              }`}
            >
              {rotulo}
            </button>
          );
        })}
      </div>

      {/* ---------- conteúdo ---------- */}
      {!carregado && carregando ? (
        <Carregando texto="Carregando lembretes…" />
      ) : erro && !carregado ? (
        <AreaErro mensagem={erro} aoTentar={() => void carregar(true)} />
      ) : lembretes.length === 0 ? (
        <EstadoVazio
          icone={BellRing}
          titulo="Nenhum lembrete cadastrado"
          descricao="Crie um lembrete para receber um e-mail e um evento na Google Agenda na data escolhida."
          acao={
            <Botao icone={Plus} variante="primario" onClick={abrirNovo}>
              Criar primeiro lembrete
            </Botao>
          }
        />
      ) : listaFiltrada.length === 0 ? (
        <EstadoVazio
          icone={BellRing}
          titulo="Nenhum lembrete neste filtro"
          descricao="Troque o filtro para ver os demais lembretes."
        />
      ) : (
        <ul className="space-y-3">
          {listaFiltrada.map((lembrete) => (
            <li
              key={lembrete.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-100">
                      {lembrete.titulo || 'Lembrete'}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${ESTILO_STATUS[lembrete.status]}`}
                    >
                      {ROTULO_STATUS[lembrete.status]}
                    </span>
                  </div>

                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatarData(lembrete.dataLembrete)}
                    </span>
                    {lembrete.email && (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {lembrete.email}
                        {lembrete.enviadoEmail ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-amber-400" />
                        )}
                      </span>
                    )}
                    {lembrete.whatsapp && (
                      <span className="inline-flex items-center gap-1.5">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {lembrete.whatsapp}
                        <span className="text-[10px] uppercase tracking-wide text-slate-600">
                          (não envia)
                        </span>
                      </span>
                    )}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                    {lembrete.mensagem}
                  </p>

                  {lembrete.erro && (
                    <p className="mt-2 text-xs text-rose-300">Erro no último envio: {lembrete.erro}</p>
                  )}
                  {lembrete.enviadoEm && (
                    <p className="mt-1 text-xs text-slate-600">
                      Enviado em {formatarData(lembrete.enviadoEm.slice(0, 10))}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Botao
                    icone={Send}
                    variante="fantasma"
                    tamanho="sm"
                    onClick={() => void testar(lembrete.id)}
                    disabled={salvando}
                    title="Enviar um teste agora (e-mail + agenda)"
                  >
                    Testar
                  </Botao>
                  <Botao
                    icone={Pencil}
                    variante="fantasma"
                    tamanho="sm"
                    onClick={() => abrirEdicao(lembrete)}
                    title="Editar"
                  />
                  <Botao
                    icone={Trash2}
                    variante="fantasma"
                    tamanho="sm"
                    onClick={() => void excluir(lembrete)}
                    disabled={salvando}
                    title="Excluir"
                    className="text-rose-300 hover:bg-rose-950/50 hover:text-rose-200"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ---------- modal de criação/edição ---------- */}
      <Modal
        aberto={modalAberto}
        titulo={editando ? 'Editar lembrete' : 'Novo lembrete'}
        aoFechar={() => setModalAberto(false)}
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setModalAberto(false)}>
              Cancelar
            </Botao>
            <Botao
              variante="primario"
              onClick={() => void salvar()}
              carregando={salvando}
            >
              {editando ? 'Salvar alterações' : 'Criar lembrete'}
            </Botao>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <Campo rotulo="Título">
            <Entrada
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex.: Pagar boleto do carro"
              maxLength={120}
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Data atual" dica="Preenchida automaticamente pelo seu computador.">
              <Entrada type="date" value={hojeISO()} readOnly disabled />
            </Campo>
            <Campo rotulo="Data lembrete">
              <Entrada
                type="date"
                value={form.dataLembrete}
                onChange={(e) => setForm({ ...form, dataLembrete: e.target.value })}
                required
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="E-mail" dica="O lembrete será enviado para este e-mail.">
              <Entrada
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="voce@exemplo.com"
              />
            </Campo>
            <Campo rotulo="WhatsApp" dica="Guardado para uso futuro; ainda não envia mensagens.">
              <Entrada
                type="tel"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </Campo>
          </div>

          <Campo rotulo="Mensagem">
            <textarea
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              placeholder="Escreva o que deve ser lembrado…"
              rows={4}
              maxLength={2000}
              required
              className={`${CLASSES_INPUT} min-h-[96px] resize-y`}
            />
          </Campo>

          {erroForm && <p className="text-sm text-rose-300">{erroForm}</p>}
        </form>
      </Modal>
    </div>
  );
}
