/**
 * ============================================================================
 *  NOVO ANO — gera todas as abas de um ano a partir dos modelos ocultos
 * ============================================================================
 *  Abas criadas:  Anual YYYY · Salário YYYY · Extras YYYY · JAN YY ... DEZ YY
 *
 *  IMPORTANTE: a cópia dos modelos traz as fórmulas apontando para o ano de
 *  origem. Depois de copiar, ajustamos os nomes das abas nas fórmulas para o
 *  novo ano. É isso que deixa tudo dinâmico.
 */

/**
 * Cria o conjunto completo de abas de um ano.
 *
 * @param {number} ano  ex.: 2028
 * @param {object} opcoes  { sobrescrever: false }
 */
function servicoCriarAno(ano, opcoes) {
  opcoes = opcoes || {};
  ano = parseInt(ano, 10);
  if (!ano || ano < 2000 || ano > 2100) {
    return { sucesso: false, erro: 'Ano inválido. Use um número entre 2000 e 2100.', codigo: 'ANO_INVALIDO' };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
    return { sucesso: false, erro: 'Planilha ocupada. Tente novamente.', codigo: 'LOCK' };
  }

  try {
    var ss = getSS();
    var yy = String(ano).slice(-2);
    var criadas = [];
    var puladas = [];

    // 1) Modelo Mensal → 12 abas de mês
    var modeloMensal = ss.getSheetByName(CONFIG.MODELOS.mensal);
    if (!modeloMensal) {
      return { sucesso: false, erro: 'Modelo não encontrado: ' + CONFIG.MODELOS.mensal, codigo: 'MODELO_AUSENTE' };
    }
    for (var i = 0; i < CONFIG.MESES.length; i++) {
      var nomeMes = CONFIG.MESES[i].abrev + ' ' + yy;
      if (ss.getSheetByName(nomeMes)) {
        puladas.push(nomeMes);
        continue;
      }
      var nova = modeloMensal.copyTo(ss);
      nova.setName(nomeMes);
      nova.showSheet();
      // ajusta a fórmula do SALÁRIO RECEBIDO (A5) para apontar ao novo Salário
      ajustarFormulaMes(nova, ano, CONFIG.MESES[i]);
      // limpa os dados de exemplo, mantém cabeçalhos e fórmulas
      limparDadosExemplo(nova, CONFIG.TIPOS.MENSAL);
      criadas.push(nomeMes);
    }

    // 2) Modelo Salário → Salário YYYY
    var modeloSal = ss.getSheetByName(CONFIG.MODELOS.salario);
    if (modeloSal && !ss.getSheetByName('Salário ' + ano)) {
      var novaSal = modeloSal.copyTo(ss);
      novaSal.setName('Salário ' + ano);
      novaSal.showSheet();
      ajustarFormulaSalario(novaSal, ano);
      limparDadosExemplo(novaSal, CONFIG.TIPOS.SALARIO);
      criadas.push('Salário ' + ano);
    } else if (ss.getSheetByName('Salário ' + ano)) {
      puladas.push('Salário ' + ano);
    }

    // 3) Modelo Extras → Extras YYYY
    var modeloExt = ss.getSheetByName(CONFIG.MODELOS.extras);
    if (modeloExt && !ss.getSheetByName('Extras ' + ano)) {
      var novaExt = modeloExt.copyTo(ss);
      novaExt.setName('Extras ' + ano);
      novaExt.showSheet();
      ajustarFormulasExtras(novaExt, ano);
      limparDadosExemplo(novaExt, CONFIG.TIPOS.EXTRAS);
      criadas.push('Extras ' + ano);
    } else if (ss.getSheetByName('Extras ' + ano)) {
      puladas.push('Extras ' + ano);
    }

    // 4) Modelo Anual → Anual YYYY
    var modeloAno = ss.getSheetByName(CONFIG.MODELOS.anual);
    if (modeloAno && !ss.getSheetByName('Anual ' + ano)) {
      var novaAno = modeloAno.copyTo(ss);
      novaAno.setName('Anual ' + ano);
      novaAno.showSheet();
      ajustarFormulaAnual(novaAno, ano, yy);
      limparDadosExemplo(novaAno, CONFIG.TIPOS.ANUAL);
      criadas.push('Anual ' + ano);
    } else if (ss.getSheetByName('Anual ' + ano)) {
      puladas.push('Anual ' + ano);
    }

    return {
      sucesso: true,
      ano: ano,
      criadas: criadas,
      puladasJaExistiam: puladas,
      aviso: puladas.length ? 'Algumas abas já existiam e foram mantidas.' : null
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ajusta as fórmulas de uma aba de mês recém-copiada para o novo ano.
 * A fórmula A5 lê o total recebido do Salário.
 */
function ajustarFormulaMes(sheet, ano, mes) {
  var linhaSalario = 4 + CONFIG.MESES.indexOf(mes);   // JAN=4, FEV=5...
  sheet.getRange('A5').setFormula("='Salário " + ano + "'!J" + linhaSalario);
}

/**
 * Ajusta as fórmulas da aba Salário (colunas I, J, K).
 * I = FREELANCE (lê os ganhos extras do próprio ano)
 * J = TOTAL SALÁRIO = base + 13º + férias + freelance
 * K = TOTAL GANHOS  = outros + ticket + freelance + total salário
 */
function ajustarFormulaSalario(sheet, ano) {
  for (var i = 0; i < 12; i++) {
    var linha = 4 + i;
    sheet.getRange('I' + linha)
      .setFormula("=SUMIF('Extras " + ano + "'!A:A,A" + linha + ",'Extras " + ano + "'!D:D)");
    sheet.getRange('J' + linha).setFormula('=SUM(B' + linha + ':D' + linha + ',I' + linha + ')');
    sheet.getRange('K' + linha).setFormula('=G' + linha + '+H' + linha + '+I' + linha + '+J' + linha + ')');
  }
  // Linha de TOTAL ANO (17)
  for (var c = 2; c <= 11; c++) {
    var L = indexToColumn(c);
    sheet.getRange(L + '17').setFormula('=SUM(' + L + '4:' + L + '15)');
  }
}

/**
 * Ajusta as fórmulas da aba Extras (totais mensais G/H e P/Q).
 */
function ajustarFormulasExtras(sheet, ano) {
  // Ganhos (A:E) → totais em G:H
  for (var i = 0; i < 12; i++) {
    var linha = 2 + i;
    var sigla = CONFIG.MESES[i].sigla;
    sheet.getRange('H' + linha).setFormula('=SUMIF(A:A,"' + sigla + '",D:D)');
    // Gastos (J:N) → totais em P:Q
    sheet.getRange('Q' + linha).setFormula('=SUMIF(J:J,"' + sigla + '",M:M)');
  }
}

/**
 * Ajusta as fórmulas da aba Anual para apontar às abas do novo ano.
 * É aqui que o ano de fato se torna dinâmico.
 */
function ajustarFormulaAnual(sheet, ano, yy) {
  var linhaMesRef = 5;   // na aba Anual, meses começam na linha 5

  for (var i = 0; i < CONFIG.MESES.length; i++) {
    var abrev = CONFIG.MESES[i].abrev;
    var abaMes = abrev + ' ' + yy;
    var linha = linhaMesRef + i;
    var linhaSalario = 4 + i;

    // B: TOTAL LANÇADO
    sheet.getRange('B' + linha).setFormula("=IFERROR('" + abaMes + "'!$B$5,0)");
    // C: TOTAL LIVIA (base Lívia somada no mês)
    sheet.getRange('C' + linha).setFormula("=IFERROR('" + abaMes + "'!$G$5,0)");
    // D: MEU GASTO REAL
    sheet.getRange('D' + linha).setFormula('=B' + linha + '-C' + linha);
    // E: TOTAL RECEBIDO (vem do Salário)
    sheet.getRange('E' + linha).setFormula("=IFERROR('Salário " + ano + "'!$K$" + linhaSalario + ",0)");
    // F: RESULTADO
    sheet.getRange('F' + linha).setFormula('=E' + linha + '-D' + linha);
  }

  // G: ACUMULADO — soma encadeada
  sheet.getRange('G' + linhaMesRef).setFormula('=F' + linhaMesRef);
  for (var j = 1; j < 12; j++) {
    var l = linhaMesRef + j;
    sheet.getRange('G' + l).setFormula('=G' + (l - 1) + '+F' + l);
  }

  // Linha de totais (18)
  sheet.getRange('B18').setFormula('=SUM(B5:B16)');
  sheet.getRange('D18').setFormula('=SUM(D5:D16)');
  sheet.getRange('E18').setFormula('=SUM(E5:E16)');
  sheet.getRange('F18').setFormula('=SUM(F5:F16)');
  sheet.getRange('G18').setFormula('=G16');
}

/**
 * Limpa apenas as células de DADOS (linhas de lançamento), preservando
 * cabeçalhos, fórmulas de resumo e formatação.
 */
function limparDadosExemplo(sheet, tipoConfig) {
  if (!tipoConfig.editable) return;

  if (tipoConfig.tabelas) {
    // Extras: limpa os dois blocos de lançamento
    for (var t = 0; t < tipoConfig.tabelas.length; t++) {
      var tb = tipoConfig.tabelas[t];
      var c1 = columnToIndex(tb.colIni);
      var c2 = columnToIndex(tb.colFim);
      sheet.getRange(tb.dataStart, c1, tb.dataEnd - tb.dataStart + 1, c2 - c1 + 1).clearContent();
    }
    return;
  }

  // Mensal / Salário: limpa apenas as colunas de DIGITAÇÃO.
  // Colunas protegidas (fórmulas como I/J/K do Salário) são preservadas.
  var ultima = ultimaColunaNumericaDoTipo(tipoConfig);
  var protegidas = tipoConfig.colunasProtegidas || [];
  var qtdLinhas = tipoConfig.dataEnd - tipoConfig.dataStart + 1;

  for (var c = 1; c <= ultima; c++) {
    var letra = indexToColumn(c);
    if (protegidas.indexOf(letra) >= 0) continue;   // não toca em fórmula
    sheet.getRange(tipoConfig.dataStart, c, qtdLinhas, 1).clearContent();
  }
}

/**
 * Devolve a ÚLTIMA coluna como NÚMERO (para usar com getRange).
 * Salário usa A..L (12) · Mensal e Anual usam A..H (8).
 */
function ultimaColunaNumericaDoTipo(tipoConfig) {
  if (tipoConfig.headerRow === 3) return 12;   // Salário (linha de cabeçalho 3)
  return 8;
}
