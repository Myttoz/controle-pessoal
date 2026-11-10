/**
 * ============================================================================
 *  DADOS LOCAIS — sincronização entre dispositivos
 * ============================================================================
 *  Cole este conteúdo em um arquivo chamado "DadosLocais.gs" no Apps Script.
 *
 *  O que são "dados locais"?
 *    São as informações que antes ficavam apenas no computador/celular:
 *      - salário bruto e KM atual (configuração);
 *      - Horas Extras (plantões);
 *      - Férias;
 *      - Manutenção do veículo.
 *
 *  Como funciona:
 *    - Tudo é gravado como um único JSON na aba "DADOS_LOCAIS" da planilha.
 *    - O JSON é dividido em partes de 45.000 caracteres para não estourar o
 *      limite de uma célula do Google Sheets.
 *    - O app envia/recebe esse JSON pelo proxy autenticado (token de sessão).
 *    - A última gravação vence (last-write-wins). Para uso pessoal em poucos
 *      dispositivos isso é suficiente; o app também permite exportar/importar
 *      um arquivo de backup.
 *
 *  Funções chamadas pelo Auth.gs (proxy):
 *    servicoLerDadosLocais()
 *    servicoSalvarDadosLocais(dados)
 */

var DADOS_LOCAIS_CABECALHOS = ['VERSAO', 'SALVO_EM', 'PARTE', 'TOTAL_PARTES', 'JSON'];
var DADOS_LOCAIS_TAMANHO_PARTE = 45000;

/** Cria a aba DADOS_LOCAIS se ainda não existir e devolve a aba. */
function garantirAbaDadosLocais() {
  var ss = getSS();
  var nome = CONFIG.DADOS_LOCAIS_ABA || 'DADOS_LOCAIS';
  var aba = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
    var cab = aba.getRange(1, 1, 1, DADOS_LOCAIS_CABECALHOS.length);
    cab.setValues([DADOS_LOCAIS_CABECALHOS]);
    cab.setFontWeight('bold').setBackground('#0b1220').setFontColor('#e2e8f0');
    aba.setFrozenRows(1);
    aba.setColumnWidth(1, 80);
    aba.setColumnWidth(2, 160);
    aba.setColumnWidth(3, 70);
    aba.setColumnWidth(4, 100);
    aba.setColumnWidth(5, 520);
  }
  return aba;
}

/**
 * Lê os dados locais da planilha.
 * Retorna { sucesso:true, dados: <DadosLocais|null>, salvoEm: <número> }.
 */
function servicoLerDadosLocais() {
  var aba = garantirAbaDadosLocais();
  var ultima = aba.getLastRow();
  if (ultima < 2) {
    return { sucesso: true, dados: null, salvoEm: 0 };
  }

  var valores = aba
    .getRange(2, 1, ultima - 1, DADOS_LOCAIS_CABECALHOS.length)
    .getValues();

  var partes = [];
  var salvoEm = 0;

  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];
    var json = String(linha[4] === null || linha[4] === undefined ? '' : linha[4]);
    if (!json) continue;

    var parte = Number(linha[2]) || (i + 1);
    partes.push({ parte: parte, json: json });

    var s = Number(linha[1]) || 0;
    if (s > salvoEm) salvoEm = s;
  }

  partes.sort(function (a, b) {
    return a.parte - b.parte;
  });

  var texto = '';
  for (var p = 0; p < partes.length; p++) texto += partes[p].json;

  if (!texto) return { sucesso: true, dados: null, salvoEm: salvoEm };

  try {
    var dados = JSON.parse(texto);
    if (!dados || dados.versao !== 1) {
      return {
        sucesso: false,
        erro: 'Dados locais com versão inválida na planilha.',
        codigo: 'JSON_INVALIDO',
      };
    }
    return {
      sucesso: true,
      dados: dados,
      salvoEm: Number(dados.salvoEm) || salvoEm,
    };
  } catch (e) {
    return {
      sucesso: false,
      erro: 'Dados locais corrompidos na planilha: ' + e.message,
      codigo: 'JSON_INVALIDO',
    };
  }
}

/**
 * Grava os dados locais na planilha (substitui o conteúdo anterior).
 * Usa LockService para evitar duas gravações simultâneas.
 */
function servicoSalvarDadosLocais(dados) {
  if (!dados || dados.versao !== 1 || typeof dados.config !== 'object') {
    return {
      sucesso: false,
      erro: 'Dados locais inválidos.',
      codigo: 'JSON_INVALIDO',
    };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return {
      sucesso: false,
      erro: 'Planilha ocupada. Tente novamente.',
      codigo: 'LOCK',
    };
  }

  try {
    var aba = garantirAbaDadosLocais();
    var salvoEm = Number(dados.salvoEm) || Date.now();

    // Cópia rasa para não alterar o objeto recebido.
    var copia = {};
    for (var k in dados) {
      if (Object.prototype.hasOwnProperty.call(dados, k)) copia[k] = dados[k];
    }
    copia.versao = 1;
    copia.salvoEm = salvoEm;

    var texto = JSON.stringify(copia);
    var partes = [];
    for (var i = 0; i < texto.length; i += DADOS_LOCAIS_TAMANHO_PARTE) {
      partes.push(texto.slice(i, i + DADOS_LOCAIS_TAMANHO_PARTE));
    }
    if (partes.length === 0) partes.push('{}');

    var ultima = aba.getLastRow();
    if (ultima >= 2) {
      aba.getRange(2, 1, ultima - 1, DADOS_LOCAIS_CABECALHOS.length).clearContent();
    }

    var linhas = [];
    for (var j = 0; j < partes.length; j++) {
      linhas.push([1, salvoEm, j + 1, partes.length, partes[j]]);
    }
    aba.getRange(2, 1, linhas.length, DADOS_LOCAIS_CABECALHOS.length).setValues(linhas);

    return {
      sucesso: true,
      salvoEm: salvoEm,
      partes: partes.length,
    };
  } catch (e) {
    return {
      sucesso: false,
      erro: 'Falha ao gravar dados locais: ' + e.message,
      codigo: 'EXCECAO',
    };
  } finally {
    lock.releaseLock();
  }
}
