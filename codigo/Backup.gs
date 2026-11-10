/**
 * ============================================================================
 *  BACKUP — modelo vazio + cópia automática a cada 15 dias
 * ============================================================================
 *  Execute UMA VEZ pelo editor do Apps Script (use o seletor de funções no topo):
 *
 *    passo4_criarPlanilhaModelo()   → cria "Planilha_modelo" (estrutura pronta, SEM dados)
 *    passo5_instalarBackup15dias()  → instala o backup automático no Google
 *
 *  O backup roda NO SERVIDOR do Google — não depende de nenhum PC ligado.
 *  Mantém no máximo 2 cópias na mesma pasta da planilha:
 *      "<nome> copia"          → cópia atual (a mais recente)
 *      "<nome> copia anterior" → a anterior, usada de reserva
 *
 *  IMPORTANTE: nada aqui altera a planilha que você usa no dia a dia.
 *  O passo4 trabalha numa CÓPIA; o passo5 só cria gatilho + cópia de segurança.
 */

/** Intervalo entre backups (dias). */
var INTERVALO_BACKUP_DIAS = 15;
/** Chave onde guardamos a data do último backup (Script Properties). */
var CHAVE_ULTIMO_BACKUP = 'ULTIMO_BACKUP_MS';
/** Nome do arquivo modelo. */
var NOME_PLANILHA_MODELO = 'Planilha_modelo';

/**
 * Mostra um alerta na UI quando disponível (execução pelo editor).
 * Se não houver interface (ex.: trigger/gatilho), grava no Logger e segue.
 */
function alerta(mensagem) {
  try {
    SpreadsheetApp.getUi().alert(mensagem);
  } catch (e) {
    Logger.log('[ALERTA] ' + mensagem);
  }
}

/**
 * ----------------------------------------------------------------------------
 * PASSO 4 — Cria a "Planilha_modelo": sua planilha, com TODOS os dados zerados.
 * ----------------------------------------------------------------------------
 * Preserva: cabeçalhos, fórmulas, formatação, dropdowns/validações e as
 * abas modelo ocultas (usadas para gerar novos anos).
 * Zera: lançamentos dos meses, salário, extras e o conteúdo do Dashboard.
 */
function passo4_criarPlanilhaModelo() {
  var ss = getSS();
  var origem = DriveApp.getFileById(ss.getId());
  var pasta = pastaDaPlanilha(origem);

  var existente = buscarNaPasta(pasta, NOME_PLANILHA_MODELO);
  if (existente) {
    var msg =
      'Já existe uma planilha chamada "' +
      NOME_PLANILHA_MODELO +
      '" nesta pasta.\n\n' +
      'Se quiser gerar uma nova, exclua (ou renomeie) a antiga no Drive\n' +
      'e rode o passo4 de novo.\n\n' +
      'Existente: ' +
      existente.getUrl();
    alerta(msg);
    return;
  }

  // 1) Cópia da planilha atual (mesma estrutura, mesmo visual)
  var arquivoCopia = origem.makeCopy(NOME_PLANILHA_MODELO);
  moverParaPasta(arquivoCopia, pasta);
  var copia = SpreadsheetApp.openById(arquivoCopia.getId());

  // 2) Zera os dados de todas as abas de dados, preservando fórmulas
  var abas = copia.getSheets();
  var limpas = [];
  for (var i = 0; i < abas.length; i++) {
    var info = identificarTipo(abas[i].getName());
    if (!info) continue;                      // abas modelo ocultas e outras: intocadas
    limparDadosExemplo(abas[i], info.config); // reaproveita a rotina segura do AnoNovo.gs
    limpas.push(abas[i].getName());
  }

  // 3) Zera o conteúdo do Dashboard da cópia (mantém os gráficos, que passam
  //    a mostrar zeros). Usamos clearContents local — NUNCA atualizarAbaDashboard,
  //    pois essa rotina grava na planilha ORIGINAL via getSS().
  var dash = copia.getSheetByName(CONFIG.DASHBOARD_ABA);
  if (dash) {
    dash.clearContents();
    dash.getRange('A1').setValue('DASHBOARD — MODELO VAZIO (sem dados)').setFontWeight('bold');
  }

  var msg =
    'Planilha_modelo criada com sucesso!\n\n' +
    'Abas zeradas: ' + limpas.join(', ') + '\n' +
    'Preservados: fórmulas, formatação, dropdowns e abas modelo ocultas.\n\n' +
    'Abra para conferir:\n' + arquivoCopia.getUrl() +
    '\n\nObservação: se a cópia abrir pedindo para "editar", não é preciso' +
    ' configurar script nenhum nela — pode ignorar.';
  alerta(msg);
}

/**
 * ----------------------------------------------------------------------------
 * PASSO 5 — Instala o backup automático (copia a cada 15 dias, às 3h).
 * ----------------------------------------------------------------------------
 * Na própria execução já cria o PRIMEIRO backup, para você não ficar sem
 * nada de reserva até o vencimento.
 */
function passo5_instalarBackup15dias() {
  // Remove gatilhos antigos desta mesma função (evita duplicidade)
  var gatilhos = ScriptApp.getProjectTriggers();
  for (var i = 0; i < gatilhos.length; i++) {
    if (gatilhos[i].getHandlerFunction() === 'executarBackup15dias') {
      ScriptApp.deleteTrigger(gatilhos[i]);
    }
  }

  // Gatilho diário às 3h — a rotina só copia quando vencem os 15 dias
  ScriptApp.newTrigger('executarBackup15dias')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();

  // Primeiro backup imediato
  var primeira = fazerBackupPlanilha();
  PropertiesService.getScriptProperties()
    .setProperty(CHAVE_ULTIMO_BACKUP, String(new Date().getTime()));

  var msg =
    'Backup automático instalado!\n\n' +
    '• Primeira cópia criada agora: "' + primeira.getName() + '"\n' +
    '• Frequência: a cada ' + INTERVALO_BACKUP_DIAS + ' dias (checagem diária às 3h)\n' +
    '• Mantidas no máximo 2 cópias: "copia" e "copia anterior"\n' +
    '• Local: mesma pasta da planilha no Google Drive\n\n' +
    'Próxima cópia em ' + INTERVALO_BACKUP_DIAS + ' dias.\n' +
    'Para conferir depois, procure no Drive as cópias com esses nomes.';
  alerta(msg);
}

/**
 * ----------------------------------------------------------------------------
 * Rotina chamada pelo gatilho (não rode manualmente, a menos que queira
 * forçar um backup — aí use passo5_instalarBackup15dias de novo ou
 * execute esta direto sabendo que ela respeita o intervalo de 15 dias).
 * ----------------------------------------------------------------------------
 */
function executarBackup15dias() {
  var props = PropertiesService.getScriptProperties();
  var ultimo = parseInt(props.getProperty(CHAVE_ULTIMO_BACKUP) || '0', 10);
  var agora = new Date().getTime();

  // Ainda não venceu → não faz nada
  if (ultimo > 0 && (agora - ultimo) < INTERVALO_BACKUP_DIAS * 24 * 60 * 60 * 1000) {
    return;
  }

  // Se lançar erro aqui, a propriedade NÃO é gravada → amanhã tenta de novo
  var arquivo = fazerBackupPlanilha();
  props.setProperty(CHAVE_ULTIMO_BACKUP, String(agora));
  Logger.log('Backup criado: ' + arquivo.getName() + ' (' + arquivo.getUrl() + ')');
}

/**
 * ----------------------------------------------------------------------------
 * Cria a cópia de segurança, girando as 2 cópias mantidas:
 *   apaga "… copia anterior" velha → "… copia" vira "… copia anterior"
 *   → cria a nova "… copia".
 * ----------------------------------------------------------------------------
 * @return {File} o arquivo da cópia nova
 */
function fazerBackupPlanilha() {
  var ss = getSS();
  var origem = DriveApp.getFileById(ss.getId());
  var pasta = pastaDaPlanilha(origem);

  var nomeBase = ss.getName();
  var nomeAtual = nomeBase + ' copia';
  var nomeAntiga = nomeBase + ' copia anterior';

  // 1) descarta a "anterior" mais antiga
  var anterior = buscarNaPasta(pasta, nomeAntiga);
  if (anterior) anterior.setTrashed(true);

  // 2) a cópia vigente passa a ser a "anterior"
  var atual = buscarNaPasta(pasta, nomeAtual);
  if (atual) atual.setName(nomeAntiga);

  // 3) cópia nova de hoje
  var nova = origem.makeCopy(nomeAtual);
  moverParaPasta(nova, pasta);
  return nova;
}

// ===========================================================================
//  AUXILIARES
// ===========================================================================

/** Pasta onde a planilha mora (ou "Meu Drive" se estiver na raiz). */
function pastaDaPlanilha(arquivo) {
  var pais = arquivo.getParents();
  if (pais.hasNext()) return pais.next();
  return DriveApp.getRootFolder();
}

/** Procura planilha do Google com o nome EXATO dentro da pasta. */
function buscarNaPasta(pasta, nome) {
  var arquivos = pasta.getFilesByName(nome);
  while (arquivos.hasNext()) {
    var f = arquivos.next();
    // só planilhas do Google — nunca mexer em .xlsx ou outros arquivos soltos
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) return f;
  }
  return null;
}

/** Move um arquivo para a pasta alvo (tirando de outras, se houver). */
function moverParaPasta(arquivo, pasta) {
  var pais = arquivo.getParents();
  var jaEsta = false;
  var outras = [];
  while (pais.hasNext()) {
    var p = pais.next();
    if (p.getId() === pasta.getId()) jaEsta = true;
    else outras.push(p);
  }
  for (var i = 0; i < outras.length; i++) outras[i].removeFile(arquivo);
  if (!jaEsta) pasta.addFile(arquivo);
}
