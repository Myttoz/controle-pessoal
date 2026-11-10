/**
 * ============================================================================
 *  MIGRAÇÃO ÚNICA — renomeia os valores da coluna TIPO
 * ============================================================================
 *  O que faz:
 *    - Em TODAS as abas mensais (JAN 27 … DEZ 27, de qualquer ano) e no
 *      modelo oculto "Modelo Mensal Atualizado":
 *        "Pix / saldo atual"  →  "PIX"
 *        "Boleto / débito"    →  "Boleto"
 *    - Atualiza a validação (dropdown) da coluna TIPO para a lista nova.
 *
 *  O que NÃO faz:
 *    - Não altera nenhuma outra coluna, cabeçalho ou aba.
 *    - Não mexe em FORMA DE PGTO, CATEGORIA, etc.
 *
 *  COMO RODAR (uma única vez):
 *    1. Cole este arquivo no Apps Script como "Migracao.gs".
 *    2. Confirme que o Config.gs já tem a lista TIPO nova:
 *         ['Fatura futura', 'PIX', 'Boleto', 'Folha de pagamento']
 *    3. No editor, selecione a função "migrarTipos" e clique em Executar.
 *    4. Autorize se o Google pedir. Veja o resumo no "Registro de execução".
 */

function migrarTipos() {
  var ss = getSS();
  var mapa = {
    'pix / saldo atual': 'PIX',
    'pix/saldo atual': 'PIX',
    'pix / saldo': 'PIX',
    'pix/saldo': 'PIX',
    'boleto / debito': 'Boleto',
    'boleto/debito': 'Boleto',
  };
  var novaLista = CONFIG.LISTAS.TIPO;
  var resumo = [];
  var abas = ss.getSheets();

  for (var i = 0; i < abas.length; i++) {
    var sheet = abas[i];
    var nome = sheet.getName();
    var ehModelo = nome === CONFIG.MODELOS.mensal;
    if (!ehModelo && !CONFIG.TIPOS.MENSAL.pattern.test(nome)) continue;

    var alvo = acharColunaTipoMigracao(sheet);
    if (!alvo) {
      resumo.push(nome + ': coluna TIPO não encontrada (pulada)');
      continue;
    }

    var cfg = CONFIG.TIPOS.MENSAL;
    var ini = cfg.dataStart;
    var fim = cfg.dataEnd;
    var range = sheet.getRange(ini, alvo.col, fim - ini + 1, 1);
    var valores = range.getValues();
    var alterados = 0;

    for (var r = 0; r < valores.length; r++) {
      var original = String(valores[r][0] === null || valores[r][0] === undefined ? '' : valores[r][0]).trim();
      if (!original) continue;
      var chave = normalizarParaMigracao(original);
      if (mapa[chave]) {
        valores[r][0] = mapa[chave];
        alterados++;
      }
    }

    if (alterados > 0) range.setValues(valores);

    // Atualiza o dropdown da coluna TIPO (linhas de dados).
    var regra = SpreadsheetApp.newDataValidation()
      .requireValueInList(novaLista, true)
      .setAllowInvalid(true)
      .build();
    range.setDataValidation(regra);

    resumo.push(nome + ': ' + alterados + ' valor(es) alterado(s)');
  }

  var mensagem = 'Migração TIPO concluída:\n' + resumo.join('\n');
  Logger.log(mensagem);
  try {
    SpreadsheetApp.getUi().alert(mensagem);
  } catch (e) {
    // Sem UI (execução via API/gatilho): o resumo fica no Logger.
  }
  return { sucesso: true, resumo: resumo };
}

/** Procura a coluna TIPO pelo cabeçalho (linha configurada + fallback). */
function acharColunaTipoMigracao(sheet) {
  var cfg = CONFIG.TIPOS.MENSAL;
  var cab = lerCabecalhos(sheet, cfg.headerRow, 'A', 'H');
  for (var c = 0; c < cab.length; c++) {
    if (normalizarParaMigracao(cab[c].titulo) === 'tipo') {
      return { col: c + 1, headerRow: cfg.headerRow };
    }
  }
  // Fallback: varre as 10 primeiras linhas (modelos podem variar).
  for (var r = 1; r <= 10; r++) {
    var valores = sheet.getRange(r, 1, 1, 10).getValues()[0];
    for (var i = 0; i < valores.length; i++) {
      if (normalizarParaMigracao(valores[i]) === 'tipo') {
        return { col: i + 1, headerRow: r };
      }
    }
  }
  return null;
}

/** Minúsculas, sem acentos e com espaços normalizados. */
function normalizarParaMigracao(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
