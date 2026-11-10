/**
 * ============================================================================
 *  DASHBOARD — agrega gastos por categoria/tipo e monta os gráficos
 * ============================================================================

/**
 * Agrega os gastos de um ano inteiro por CATEGORIA (tipo).
 *
 * @param {number} ano  ex.: 2027
 * @param {string} chaveAgrupamento  'CATEGORIA' (padrão) ou outra coluna
 */
function servicoDashboard(ano, chaveAgrupamento) {
  chaveAgrupamento = chaveAgrupamento || 'CATEGORIA';
  var ss = getSS();
  var abas = listarAbasDados();
  var acumulado = {};   // categoria -> total
  var porMes = {};      // mes -> total
  var detalhe = [];     // lista de abas consideradas

  for (var i = 0; i < abas.length; i++) {
    var a = abas[i];
    if (a.tipo !== 'MENSAL') continue;          // dashboard é sobre gastos mensais
    if (a.ano !== ano) continue;
    if (a.oculta) continue;

    var sheet = ss.getSheetByName(a.aba);
    var ctx = montarContexto(a.aba);
    var cabecalhos = lerCabecalhos(sheet, ctx.headerRow, ctx.colIni, ctx.colFim);
    var ultima = Math.min(ctx.dataEnd, sheet.getLastRow());
    if (ultima < ctx.dataStart) continue;

    var c1 = columnToIndex(ctx.colIni);
    var largura = columnToIndex(ctx.colFim) - c1 + 1;
    var dados = sheet.getRange(ctx.dataStart, c1, ultima - ctx.dataStart + 1, largura).getValues();

    // índices das colunas que interessam
    var idxGrupo = indiceColuna(cabecalhos, chaveAgrupamento);
    var idxValor = indiceColuna(cabecalhos, 'VALOR');
    if (idxValor < 0) continue;

    var totalMes = 0;
    for (var r = 0; r < dados.length; r++) {
      var valor = parseFloat(dados[r][idxValor]);
      if (isNaN(valor)) continue;
      var chave = idxGrupo >= 0 ? String(dados[r][idxGrupo] || 'Sem categoria').trim() : 'Total';
      if (!chave) chave = 'Sem categoria';

      acumulado[chave] = (acumulado[chave] || 0) + valor;
      totalMes += valor;
    }

    porMes[a.mes] = (porMes[a.mes] || 0) + totalMes;
    detalhe.push({ aba: a.aba, mes: a.mes, total: totalMes });
  }

  // transforma em arrays ordenados (maior primeiro)
  var categorias = [];
  for (var cat in acumulado) {
    if (acumulado.hasOwnProperty(cat)) {
      categorias.push({ categoria: cat, total: arredondar(acumulado[cat]) });
    }
  }
  categorias.sort(function (a, b) { return b.total - a.total; });

  var meses = [];
  for (var m = 0; m < CONFIG.MESES.length; m++) {
    var sigla = CONFIG.MESES[m].sigla;
    meses.push({ mes: sigla, total: arredondar(porMes[sigla] || 0) });
  }

  var totalGeral = 0;
  for (var c = 0; c < categorias.length; c++) totalGeral += categorias[c].total;

  return {
    sucesso: true,
    ano: ano,
    chaveAgrupamento: chaveAgrupamento,
    totalGeral: arredondar(totalGeral),
    categorias: categorias,
    meses: meses,
    abasConsideradas: detalhe
  };
}

function indiceColuna(cabecalhos, titulo) {
  for (var i = 0; i < cabecalhos.length; i++) {
    if (cabecalhos[i].titulo.toUpperCase() === String(titulo).toUpperCase()) return i;
  }
  return -1;
}

function arredondar(v) { return Math.round(v * 100) / 100; }

/**
 * Cria/atualiza a aba Dashboard e desenha os gráficos.
 * Pode ser chamada pela API ou manualmente pelo editor.
 */
function atualizarAbaDashboard(ano, chaveAgrupamento) {
  var ss = getSS();
  var resumo = servicoDashboard(ano, chaveAgrupamento);
  var nomeAba = CONFIG.DASHBOARD_ABA;
  var sheet = ss.getSheetByName(nomeAba);
  if (!sheet) sheet = ss.insertSheet(nomeAba, 0);

  sheet.clear();
  sheet.getCharts().forEach(function (ch) { sheet.removeChart(ch); });

  // ---- Cabeçalho ----
  sheet.getRange('A1').setValue('DASHBOARD DE GASTOS — ' + ano).setFontWeight('bold').setFontSize(14);
  sheet.getRange('A2').setValue('Atualizado em ' + new Date().toLocaleString());

  // ---- Tabela: gastos por categoria ----
  sheet.getRange('A4').setValue('CATEGORIA').setFontWeight('bold');
  sheet.getRange('B4').setValue('TOTAL').setFontWeight('bold');
  var linhas = resumo.categorias.length;
  if (linhas > 0) {
    var dadosCat = resumo.categorias.map(function (c) { return [c.categoria, c.total]; });
    sheet.getRange(5, 1, linhas, 2).setValues(dadosCat);
    sheet.getRange(5, 2, linhas, 1).setNumberFormat('#,##0.00');
  }

  // ---- Tabela: gastos por mês ----
  sheet.getRange('D4').setValue('MÊS').setFontWeight('bold');
  sheet.getRange('E4').setValue('TOTAL').setFontWeight('bold');
  var dadosMes = resumo.meses.map(function (m) { return [m.mes, m.total]; });
  sheet.getRange(5, 4, 12, 2).setValues(dadosMes);
  sheet.getRange(5, 5, 12, 1).setNumberFormat('#,##0.00');

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(4, 90);

  // ---- Gráfico de Pizza: por categoria ----
  if (linhas > 0) {
    var faixaCat = sheet.getRange(4, 1, linhas + 1, 2);
    var pizza = sheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(faixaCat)
      .setPosition(4, 7, 0, 0)
      .setOption('title', 'Gastos por categoria (' + ano + ')')
      .setOption('pieHole', 0.4)
      .setOption('width', 520)
      .setOption('height', 360)
      .build();
    sheet.insertChart(pizza);
  }

  // ---- Gráfico de Colunas: por mês ----
  var faixaMes = sheet.getRange(4, 4, 13, 2);
  var colunas = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(faixaMes)
    .setPosition(24, 7, 0, 0)
    .setOption('title', 'Gastos por mês (' + ano + ')')
    .setOption('legend', { position: 'none' })
    .setOption('width', 520)
    .setOption('height', 360)
    .build();
  sheet.insertChart(colunas);

  return {
    sucesso: true,
    aba: nomeAba,
    ano: ano,
    totalGeral: resumo.totalGeral,
    categorias: resumo.categorias.length
  };
}
