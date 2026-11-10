/**
 * ============================================================================
 *  LEMBRETES — planilha + e-mail + Google Agenda
 * ============================================================================
 *  Cole este conteúdo em um arquivo chamado "Lembretes.gs" no Apps Script.
 *
 *  Como funciona:
 *    - Os lembretes ficam na aba "LEMBRETES" da planilha (criada sozinha).
 *    - O app lê/grava via API (proxy autenticado).
 *    - Um gatilho diário (padrão 08:00) roda "enviarLembretes" nos servidores
 *      do Google, mesmo com o app fechado:
 *        * envia e-mail (MailApp) para o campo EMAIL;
 *        * cria um evento de dia inteiro na Google Agenda do dono do script.
 *
 *  IMPORTANTE (autorizações):
 *    - Na primeira execução o Google pedirá permissão de Gmail e Agenda.
 *    - O fuso do projeto precisa estar correto (ex.: America/Sao_Paulo) para
 *      o horário do gatilho sair certo.
 *
 *  Funções para rodar UMA VEZ pelo editor:
 *    configurarLembretes()  → cria a aba e instala o gatilho diário.
 */

var LEMBRETES_CABECALHOS = [
  'ID',
  'TITULO',
  'DATA_CRIACAO',
  'DATA_LEMBRETE',
  'EMAIL',
  'WHATSAPP',
  'MENSAGEM',
  'ENVIADO_EMAIL',
  'ENVIADO_WHATSAPP',
  'EVENTO_ID',
  'STATUS',
  'ENVIADO_EM',
  'ERRO',
];

/** Cria a aba LEMBRETES se ainda não existir e devolve a aba. */
function garantirAbaLembretes() {
  var ss = getSS();
  var aba = ss.getSheetByName(CONFIG.LEMBRETES_ABA);
  if (!aba) {
    aba = ss.insertSheet(CONFIG.LEMBRETES_ABA);
    var cab = aba.getRange(1, 1, 1, LEMBRETES_CABECALHOS.length);
    cab.setValues([LEMBRETES_CABECALHOS]);
    cab.setFontWeight('bold').setBackground('#0b1220').setFontColor('#e2e8f0');
    aba.setFrozenRows(1);
    aba.setColumnWidths(1, LEMBRETES_CABECALHOS.length, 140);
    aba.setColumnWidth(1, 190); // ID
    aba.setColumnWidth(2, 220); // TITULO
    aba.setColumnWidth(7, 340); // MENSAGEM
  }
  return aba;
}

/** Lê todas as linhas da aba e devolve objetos com os nomes das colunas. */
function lerLembretes() {
  var aba = garantirAbaLembretes();
  var ultima = aba.getLastRow();
  if (ultima < 2) return [];

  var valores = aba
    .getRange(2, 1, ultima - 1, LEMBRETES_CABECALHOS.length)
    .getValues();
  var lista = [];

  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];
    if (!String(linha[0] === null || linha[0] === undefined ? '' : linha[0]).trim()) continue;
    var obj = { _linha: i + 2 };
    for (var c = 0; c < LEMBRETES_CABECALHOS.length; c++) {
      obj[LEMBRETES_CABECALHOS[c]] = linha[c];
    }
    lista.push(obj);
  }
  return lista;
}

/** Lista os lembretes no formato que o app entende. */
function servicoListarLembretes() {
  var lista = lerLembretes();
  var saida = [];
  for (var i = 0; i < lista.length; i++) {
    var l = lista[i];
    saida.push({
      id: String(l.ID || ''),
      titulo: String(l.TITULO || ''),
      dataCriacao: formatarDataHoraISO(l.DATA_CRIACAO),
      dataLembrete: formatarDataISO(l.DATA_LEMBRETE),
      email: String(l.EMAIL || ''),
      whatsapp: String(l.WHATSAPP || ''),
      mensagem: String(l.MENSAGEM || ''),
      enviadoEmail: String(l.ENVIADO_EMAIL || '').toUpperCase() === 'SIM',
      enviadoWhatsapp: String(l.ENVIADO_WHATSAPP || '').toUpperCase() === 'SIM',
      eventoId: String(l.EVENTO_ID || ''),
      status: String(l.STATUS || 'PENDENTE').toUpperCase(),
      enviadoEm: formatarDataHoraISO(l.ENVIADO_EM),
      erro: String(l.ERRO || ''),
      linha: l._linha,
    });
  }
  return { sucesso: true, lembretes: saida };
}

/** Cria um lembrete. */
function servicoAdicionarLembrete(dados) {
  dados = dados || {};
  var dataLembrete = String(dados.dataLembrete || '').trim();
  var mensagem = String(dados.mensagem || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataLembrete)) {
    return {
      sucesso: false,
      erro: 'Informe a data do lembrete (formato AAAA-MM-DD).',
      codigo: 'PARAMETRO_AUSENTE',
    };
  }
  if (!mensagem) {
    return {
      sucesso: false,
      erro: 'Informe a mensagem do lembrete.',
      codigo: 'PARAMETRO_AUSENTE',
    };
  }

  var aba = garantirAbaLembretes();
  var id = 'lem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  var agora = new Date();

  var linha = [
    id,
    String(dados.titulo || 'Lembrete').trim() || 'Lembrete',
    agora,
    parseDataLembrete(dataLembrete),
    String(dados.email || '').trim(),
    String(dados.whatsapp || '').trim(),
    mensagem,
    'NAO',
    'NAO',
    '',
    'PENDENTE',
    '',
    '',
  ];

  aba.appendRow(linha);

  return {
    sucesso: true,
    lembrete: {
      id: id,
      titulo: String(linha[1]),
      dataCriacao: formatarDataHoraISO(agora),
      dataLembrete: dataLembrete,
      email: String(linha[4]),
      whatsapp: String(linha[5]),
      mensagem: mensagem,
      enviadoEmail: false,
      enviadoWhatsapp: false,
      eventoId: '',
      status: 'PENDENTE',
      enviadoEm: '',
      erro: '',
    },
  };
}

/** Edita um lembrete existente (pelo ID). */
function servicoEditarLembrete(id, dados) {
  dados = dados || {};
  var aba = garantirAbaLembretes();
  var alvo = acharLembretePorId(id);
  if (!alvo) {
    return { sucesso: false, erro: 'Lembrete não encontrado.', codigo: 'NAO_ENCONTRADO' };
  }

  var dataLembrete = String(
    dados.dataLembrete !== undefined ? dados.dataLembrete : formatarDataISO(alvo.DATA_LEMBRETE),
  ).trim();
  var mensagem = String(dados.mensagem !== undefined ? dados.mensagem : alvo.MENSAGEM).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataLembrete)) {
    return {
      sucesso: false,
      erro: 'Informe a data do lembrete (formato AAAA-MM-DD).',
      codigo: 'PARAMETRO_AUSENTE',
    };
  }
  if (!mensagem) {
    return { sucesso: false, erro: 'Informe a mensagem do lembrete.', codigo: 'PARAMETRO_AUSENTE' };
  }

  var titulo = String(dados.titulo !== undefined ? dados.titulo : alvo.TITULO).trim() || 'Lembrete';
  var email = String(dados.email !== undefined ? dados.email : alvo.EMAIL).trim();
  var whatsapp = String(dados.whatsapp !== undefined ? dados.whatsapp : alvo.WHATSAPP).trim();

  // Se o conteúdo/data mudou, o envio anterior deixa de valer:
  // apaga o evento antigo (se houver) e volta para PENDENTE.
  var mudouConteudo =
    formatarDataISO(alvo.DATA_LEMBRETE) !== dataLembrete ||
    String(alvo.MENSAGEM || '') !== mensagem ||
    String(alvo.TITULO || '') !== titulo ||
    String(alvo.EMAIL || '') !== email;

  var eventoId = String(alvo.EVENTO_ID || '');
  if (mudouConteudo && eventoId) {
    try {
      var evento = CalendarApp.getEventById(eventoId);
      if (evento) evento.deleteEvent();
    } catch (e) {
      // se não conseguir apagar, segue — o novo evento será criado
    }
    eventoId = '';
  }

  var linha = [
    String(alvo.ID),
    titulo,
    alvo.DATA_CRIACAO,
    parseDataLembrete(dataLembrete),
    email,
    whatsapp,
    mensagem,
    mudouConteudo ? 'NAO' : String(alvo.ENVIADO_EMAIL || 'NAO'),
    String(alvo.ENVIADO_WHATSAPP || 'NAO'),
    eventoId,
    mudouConteudo ? 'PENDENTE' : String(alvo.STATUS || 'PENDENTE'),
    mudouConteudo ? '' : alvo.ENVIADO_EM || '',
    mudouConteudo ? '' : alvo.ERRO || '',
  ];

  aba.getRange(alvo._linha, 1, 1, linha.length).setValues([linha]);

  return {
    sucesso: true,
    lembrete: {
      id: String(alvo.ID),
      titulo: titulo,
      dataCriacao: formatarDataHoraISO(alvo.DATA_CRIACAO),
      dataLembrete: dataLembrete,
      email: email,
      whatsapp: whatsapp,
      mensagem: mensagem,
      enviadoEmail: linha[7] === 'SIM',
      enviadoWhatsapp: linha[8] === 'SIM',
      eventoId: eventoId,
      status: linha[10],
      enviadoEm: formatarDataHoraISO(linha[11]),
      erro: String(linha[12] || ''),
    },
  };
}

/** Remove um lembrete (e o evento da agenda, se existir). */
function servicoRemoverLembrete(id) {
  var aba = garantirAbaLembretes();
  var alvo = acharLembretePorId(id);
  if (!alvo) {
    return { sucesso: false, erro: 'Lembrete não encontrado.', codigo: 'NAO_ENCONTRADO' };
  }

  var eventoId = String(alvo.EVENTO_ID || '');
  if (eventoId) {
    try {
      var evento = CalendarApp.getEventById(eventoId);
      if (evento) evento.deleteEvent();
    } catch (e) {
      // segue com a remoção da linha mesmo se o evento já não existir
    }
  }

  aba.deleteRow(alvo._linha);
  return { sucesso: true, removido: true, id: String(id) };
}

/**
 * GATILHO DIÁRIO — envia os lembretes do dia.
 * Roda nos servidores do Google, mesmo com o app fechado.
 */
function enviarLembretes() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { sucesso: false, erro: 'Planilha ocupada. Tente novamente.', codigo: 'LOCK' };
  }

  try {
    garantirAbaLembretes();
    var lista = lerLembretes();
    var hojeStr = formatarDataISO(new Date());
    var enviados = 0;
    var eventos = 0;
    var erros = 0;

    for (var i = 0; i < lista.length; i++) {
      var l = lista[i];
      var status = String(l.STATUS || 'PENDENTE').toUpperCase();
      if (status === 'CANCELADO' || status === 'ENVIADO') continue;

      var dataLembrete = formatarDataISO(l.DATA_LEMBRETE);
      if (!dataLembrete || dataLembrete > hojeStr) continue; // ainda não chegou o dia

      var email = String(l.EMAIL || '').trim();
      var enviadoEmail = String(l.ENVIADO_EMAIL || '').toUpperCase() === 'SIM';
      var eventoId = String(l.EVENTO_ID || '').trim();
      var erro = String(l.ERRO || '');
      var emailOk = !email || enviadoEmail;

      // ---- e-mail ----
      if (email && !enviadoEmail) {
        try {
          MailApp.sendEmail({
            to: email,
            subject: 'Lembrete: ' + (String(l.TITULO || '').trim() || 'Controle Pessoal'),
            body: montarCorpoLembrete(l),
          });
          enviadoEmail = true;
          emailOk = true;
          enviados++;
        } catch (e) {
          erro = 'E-mail: ' + e.message;
          erros++;
        }
      }

      // ---- Google Agenda ----
      if (!eventoId) {
        try {
          var evento = CalendarApp.getDefaultCalendar().createAllDayEvent(
            String(l.TITULO || '').trim() || 'Lembrete',
            parseDataLembrete(l.DATA_LEMBRETE),
            { description: String(l.MENSAGEM || '') },
          );
          eventoId = evento.getId();
          eventos++;
        } catch (e) {
          erro = (erro ? erro + ' | ' : '') + 'Agenda: ' + e.message;
          erros++;
        }
      }

      var concluido = emailOk && !!eventoId;
      var linha = [
        String(l.ID),
        String(l.TITULO || ''),
        l.DATA_CRIACAO,
        parseDataLembrete(l.DATA_LEMBRETE),
        String(l.EMAIL || ''),
        String(l.WHATSAPP || ''),
        String(l.MENSAGEM || ''),
        enviadoEmail ? 'SIM' : 'NAO',
        String(l.ENVIADO_WHATSAPP || 'NAO'),
        eventoId,
        concluido ? 'ENVIADO' : 'PENDENTE',
        concluido ? new Date() : l.ENVIADO_EM || '',
        erro,
      ];
      getSS()
        .getSheetByName(CONFIG.LEMBRETES_ABA)
        .getRange(l._linha, 1, 1, linha.length)
        .setValues([linha]);
    }

    return {
      sucesso: true,
      hoje: hojeStr,
      enviados: enviados,
      eventos: eventos,
      erros: erros,
    };
  } finally {
    lock.releaseLock();
  }
}

/** Envia um lembrete de teste agora (e-mail + evento de agenda). */
function testarLembrete(id) {
  var alvo = acharLembretePorId(id);
  if (!alvo) {
    return { sucesso: false, erro: 'Lembrete não encontrado.', codigo: 'NAO_ENCONTRADO' };
  }

  var partes = [];
  var email = String(alvo.EMAIL || '').trim();

  if (email) {
    try {
      MailApp.sendEmail({
        to: email,
        subject: '[TESTE] Lembrete: ' + (String(alvo.TITULO || '').trim() || 'Controle Pessoal'),
        body: montarCorpoLembrete(alvo),
      });
      partes.push('E-mail de teste enviado para ' + email + '.');
    } catch (e) {
      return {
        sucesso: false,
        erro: 'Falha ao enviar e-mail: ' + e.message,
        codigo: 'EMAIL_FALHOU',
      };
    }
  } else {
    partes.push('Sem e-mail cadastrado (teste de e-mail ignorado).');
  }

  try {
    CalendarApp.getDefaultCalendar().createAllDayEvent(
      '[TESTE] ' + (String(alvo.TITULO || '').trim() || 'Lembrete'),
      parseDataLembrete(alvo.DATA_LEMBRETE),
      { description: String(alvo.MENSAGEM || '') },
    );
    partes.push('Evento de teste criado na Google Agenda.');
  } catch (e) {
    return {
      sucesso: false,
      erro: 'Falha ao criar evento na agenda: ' + e.message,
      codigo: 'AGENDA_FALHOU',
    };
  }

  return { sucesso: true, mensagem: partes.join(' ') };
}

/** Instala (ou reinstala) o gatilho diário das 08:00. */
function instalarGatilhoLembretes() {
  garantirAbaLembretes();

  var gatilhos = ScriptApp.getProjectTriggers();
  var removidos = 0;
  for (var i = 0; i < gatilhos.length; i++) {
    if (gatilhos[i].getHandlerFunction() === 'enviarLembretes') {
      ScriptApp.deleteTrigger(gatilhos[i]);
      removidos++;
    }
  }

  var hora = CONFIG.LEMBRETES_HORA || 8;
  ScriptApp.newTrigger('enviarLembretes').timeBased().everyDays(1).atHour(hora).create();

  return {
    sucesso: true,
    mensagem: 'Envio automático ativado: todos os dias às ' + hora + 'h.',
    fuso: Session.getScriptTimeZone(),
    gatilhosAnterioresRemovidos: removidos,
  };
}

/** Diagnóstico para a tela de lembretes. */
function statusLembretes() {
  var aba = garantirAbaLembretes();
  var gatilhos = ScriptApp.getProjectTriggers();
  var ativos = 0;
  for (var i = 0; i < gatilhos.length; i++) {
    if (gatilhos[i].getHandlerFunction() === 'enviarLembretes') ativos++;
  }

  var restante = -1;
  try {
    restante = MailApp.getRemainingDailyQuota();
  } catch (e) {
    restante = -1;
  }

  return {
    sucesso: true,
    aba: aba.getName(),
    total: lerLembretes().length,
    gatilhoAtivo: ativos > 0,
    fuso: Session.getScriptTimeZone(),
    emailRestante: restante,
  };
}

/** Atalho para rodar UMA VEZ pelo editor: cria a aba e instala o gatilho. */
function configurarLembretes() {
  var res = instalarGatilhoLembretes();
  var msg =
    'LEMBRETES configurados!\n' +
    res.mensagem +
    '\nFuso: ' +
    res.fuso +
    '\n\nAutorize o Gmail/Agenda se o Google pedir.';
  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    // sem UI
  }
  return res;
}

// ---------------------------------------------------------------------------
//  Auxiliares
// ---------------------------------------------------------------------------

function acharLembretePorId(id) {
  var lista = lerLembretes();
  for (var i = 0; i < lista.length; i++) {
    if (String(lista[i].ID) === String(id)) return lista[i];
  }
  return null;
}

function montarCorpoLembrete(l) {
  var linhas = [];
  linhas.push(String(l.MENSAGEM || ''));
  linhas.push('');
  linhas.push('Data do lembrete: ' + formatarDataBR(l.DATA_LEMBRETE));
  if (String(l.TITULO || '').trim()) linhas.push('Título: ' + String(l.TITULO).trim());
  linhas.push('');
  linhas.push('— Controle Pessoal');
  return linhas.join('\n');
}

/** "2027-01-10" (ou Date) → Date local à meia-noite. */
function parseDataLembrete(valor) {
  if (valor instanceof Date) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  var texto = String(valor || '').slice(0, 10);
  var partes = texto.split('-');
  if (partes.length === 3) {
    return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  }
  return new Date();
}

/** Date/texto → "AAAA-MM-DD". */
function formatarDataISO(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var texto = String(valor).trim();
  var iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  var br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[3] + '-' + br[2] + '-' + br[1];
  return texto.slice(0, 10);
}

/** Date/texto → "AAAA-MM-DD HH:mm:ss". */
function formatarDataHoraISO(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return String(valor);
}

/** Date/texto → "DD/MM/AAAA". */
function formatarDataBR(valor) {
  var iso = formatarDataISO(valor);
  var partes = iso.split('-');
  if (partes.length === 3) return partes[2] + '/' + partes[1] + '/' + partes[0];
  return iso;
}
