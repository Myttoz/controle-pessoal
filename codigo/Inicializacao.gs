/**
 * ============================================================================
 *  CONFIGURAÇÃO INICIAL — execute estas funções UMA VEZ pelo editor
 * ============================================================================
 *  No editor do Apps Script: selecione a função e clique em "Executar".
 *  Na primeira vez o Google pedirá permissões — clique em "Permitir".
 *
 *  Funções deste arquivo:        passos 1, 2 e 3 (e os testes)
 *  Funções em Backup.gs:         passo4_criarPlanilhaModelo()
 *                                passo5_instalarBackup15dias()
 */

/**
 * 1) Registra o ID da planilha no script.
 *    Rode isso ANTES de publicar o web app.
 */
function passo1_registrarPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  SpreadsheetApp.getUi().alert('Planilha registrada com sucesso!\nID: ' + ss.getId());
}

/**
 * 2) Gera um novo ano (ex.: 2028).
 *    Troque o número e rode. Cria Anual, Salário, Extras e os 12 meses.
 */
function passo2_criarAno2028() {
  var res = servicoCriarAno(2028);
  var msg = 'Abas criadas: ' + (res.criadas.join(', ') || 'nenhuma');
  if (res.puladasJaExistiam && res.puladasJaExistiam.length) {
    msg += '\nJá existiam (mantidas): ' + res.puladasJaExistiam.join(', ');
  }
  SpreadsheetApp.getUi().alert(msg);
}

/**
 * 3) Cria/atualiza a aba Dashboard com gráficos de um ano.
 *    Troque o ano conforme precisar.
 */
function passo3_gerarDashboard() {
  var res = atualizarAbaDashboard(2027);
  SpreadsheetApp.getUi().alert(
    'Dashboard gerado!\nTotal geral: ' + res.totalGeral + '\nCategoria: ' + res.categorias
  );
}

/**
 * Teste rápido: mostra as abas de dados reconhecidas.
 */
function teste_listarAbas() {
  var abas = listarAbasDados();
  var linhas = abas.map(function (a) {
    return a.aba + '  →  ' + a.label + (a.ano ? ' (' + a.ano + (a.mes ? '/' + a.mes : '') + ')' : '');
  });
  Logger.log(linhas.join('\n'));
}

/**
 * Teste de leitura de uma aba de mês.
 */
function teste_lerMes() {
  var res = servicoListar('JAN 27');
  Logger.log('Total de registros: ' + res.total);
  Logger.log(JSON.stringify(res.registros.slice(0, 3), null, 2));
}
