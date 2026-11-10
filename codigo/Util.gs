/**
 * ============================================================================
 *  UTILITÁRIOS
 * ============================================================================
 *  Funções auxiliares usadas por todo o resto do código.
 */

/**
 * Retorna a planilha ativa (o arquivo onde o script está anexado).
 * Em web app "Execute as: Me", getActive() pode falhar, por isso guardamos
 * o ID numa propriedade do script na primeira execução manual.
 */
function getSS() {
  var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
    return ss;
  }
  throw new Error('Planilha não encontrada. Execute uma vez pela planilha para registrar o ID.');
}

/**
 * Identifica o TIPO de uma aba pelo nome dela.
 * Retorna { tipo: 'MENSAL', ... } ou null se não for uma aba de dados.
 */
function identificarTipo(nomeAba) {
  var tipos = CONFIG.TIPOS;
  for (var chave in tipos) {
    if (tipos.hasOwnProperty(chave)) {
      var t = tipos[chave];
      if (t.pattern.test(nomeAba)) {
        var m = nomeAba.match(t.pattern);
        var info = { tipo: chave, config: t, aba: nomeAba };
        // extrai ano e mês quando existirem no padrão
        if (m[1]) {
          if (chave === 'MENSAL') {
            info.mes = m[1].toUpperCase();
            info.ano = 2000 + parseInt(m[2], 10);
          } else {
            info.ano = parseInt(m[1], 10);
          }
        }
        return info;
      }
    }
  }
  return null;
}

/**
 * Lista todas as abas de dados da planilha, já interpretadas.
 */
function listarAbasDados() {
  var ss = getSS();
  var abas = ss.getSheets();
  var resultado = [];
  for (var i = 0; i < abas.length; i++) {
    var nome = abas[i].getName();
    var info = identificarTipo(nome);
    if (info) {
      resultado.push({
        aba: nome,
        tipo: info.tipo,
        label: info.config.label,
        ano: info.ano || null,
        mes: info.mes || null,
        oculta: abas[i].isSheetHidden(),
        indice: i
      });
    }
  }
  return resultado;
}

/**
 * Lê a linha de cabeçalho de uma aba e devolve um array de colunas.
 * Cada item: { col: 'A', titulo: 'CATEGORIA' }
 */
function lerCabecalhos(sheet, headerRow, colIni, colFim) {
  var c1 = columnToIndex(colIni);
  var c2 = columnToIndex(colFim || colIni);
  var range = sheet.getRange(headerRow, c1, 1, c2 - c1 + 1);
  var valores = range.getValues()[0];
  var cabecalhos = [];
  for (var i = 0; i < valores.length; i++) {
    cabecalhos.push({
      col: indexToColumn(c1 + i),
      titulo: String(valores[i]).trim()
    });
  }
  return cabecalhos;
}

/**
 * Converte letra de coluna ('A','B',...'AA') para número (1,2,...).
 */
function columnToIndex(col) {
  var num = 0;
  col = String(col).toUpperCase();
  for (var i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64);
  }
  return num;
}

/**
 * Converte número de coluna para letra.
 */
function indexToColumn(num) {
  var s = '';
  while (num > 0) {
    var resto = (num - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

/**
 * Monta a resposta JSON para o web app.
 */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Resposta de erro padronizada.
 */
function erro(mensagem, codigo) {
  return json({
    sucesso: false,
    erro: mensagem,
    codigo: codigo || 'ERRO_DESCONHECIDO'
  });
}

/**
 * Sanitiza o valor vindo do app externo antes de gravar na planilha.
 */
function sanitizarValor(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') {
    v = v.trim();
    // transforma "1.234,56" em número, se for o caso
    if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(v)) {
      return parseFloat(v.replace(/\./g, '').replace(',', '.'));
    }
    if (/^-?\d+,\d+$/.test(v)) {
      return parseFloat(v.replace(',', '.'));
    }
  }
  return v;
}
