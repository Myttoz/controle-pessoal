/**
 * ============================================================================
 *  SERVIÇO — operações CRUD sobre as abas de dados
 * ============================================================================
 *  Cada função recebe o "contexto" (aba + tipo interpretado) e devolve dados
 *  simples, prontos para virar JSON.
 */

/**
 * Lê os registros de uma aba de dados.
 *
 * @param {string} nomeAba  nome exato da aba (ex.: "JAN 27")
 * @param {object} opcoes   { tipoTabela: 'ganhos'|'gastos' } — só para Extras
 */
function servicoListar(nomeAba, opcoes) {
  opcoes = opcoes || {};
  var ctx = montarContexto(nomeAba, opcoes.tipoTabela);
  var sheet = getSS().getSheetByName(nomeAba);

  var cabecalhos = lerCabecalhos(sheet, ctx.headerRow, ctx.colIni, ctx.colFim);
  var ultima = Math.min(ctx.dataEnd, sheet.getLastRow());
  var linhas = [];

  if (ultima >= ctx.dataStart) {
    var c1 = columnToIndex(ctx.colIni);
    var c2 = columnToIndex(ctx.colFim);
    var dados = sheet.getRange(ctx.dataStart, c1, ultima - ctx.dataStart + 1, c2 - c1 + 1).getValues();

    for (var i = 0; i < dados.length; i++) {
      var numeroLinha = ctx.dataStart + i;
      var registro = montarRegistro(cabecalhos, dados[i]);
      // linha vazia → ignora
      if (registro._vazio) continue;
      linhas.push({ linha: numeroLinha, dados: registro });
    }
  }

  return {
    sucesso: true,
    aba: nomeAba,
    tipo: ctx.tipo,
    cabecalhos: cabecalhos.map(function (c) { return c.titulo; }),
    total: linhas.length,
    registros: linhas
  };
}

/**
 * Retorna um SNAPSHOT completo de um ano numa ÚNICA chamada:
 * lançamentos dos 12 meses + salário + extras + resumo do dashboard.
 *
 * Por que existe: o app externo não precisa fazer 12 requisições.
 * Uma chamada só = app fluido, sem "carregando" ao trocar de aba.
 */
function servicoAnoCompleto(ano) {
  ano = parseInt(ano, 10);
  var yy = String(ano).slice(-2);
  var ss = getSS();
  var meses = {};
  var faltando = [];

  for (var i = 0; i < CONFIG.MESES.length; i++) {
    var sigla = CONFIG.MESES[i].sigla;
    var nomeAba = sigla + ' ' + yy;

    if (!ss.getSheetByName(nomeAba)) {
      meses[sigla] = null;            // mês ainda não existe
      faltando.push(nomeAba);
      continue;
    }

    var res = servicoListar(nomeAba);
    var total = 0;
    for (var r = 0; r < res.registros.length; r++) {
      var v = parseFloat(res.registros[r].dados.VALOR);
      if (!isNaN(v)) total += v;
    }
    meses[sigla] = {
      aba: nomeAba,
      registros: res.registros,
      totalLancado: arredondar(total)
    };
  }

  // Salário do ano (12 linhas)
  var salario = null;
  var abaSal = 'Salário ' + ano;
  if (ss.getSheetByName(abaSal)) {
    salario = { aba: abaSal, registros: servicoListar(abaSal).registros };
  }

  // Extras do ano (duas tabelas: ganhos e gastos)
  var extras = null;
  var abaExt = 'Extras ' + ano;
  if (ss.getSheetByName(abaExt)) {
    extras = {
      aba: abaExt,
      ganhos: servicoListar(abaExt, { tipoTabela: 'ganhos' }).registros,
      gastos: servicoListar(abaExt, { tipoTabela: 'gastos' }).registros
    };
  }

  return {
    sucesso: true,
    ano: ano,
    meses: meses,
    mesesFaltando: faltando,
    salario: salario,
    extras: extras,
    resumo: servicoDashboard(ano)   // agregado pronto (categorias, meses, total)
  };
}

/**
 * Monta um objeto de registro a partir de uma linha da planilha.
 * Acrescenta "_vazio" para saber se a linha está em branco.
 */
function montarRegistro(cabecalhos, valores) {
  var reg = {};
  var algumValor = false;
  for (var i = 0; i < cabecalhos.length; i++) {
    var titulo = cabecalhos[i].titulo;
    if (!titulo) continue;
    var v = valores[i];
    if (v instanceof Date) v = formatarData(v);
    if (v !== '' && v !== null && v !== undefined) algumValor = true;
    reg[titulo] = v;
  }
  reg._vazio = !algumValor;
  return reg;
}

/**
 * Adiciona um registro. Grava na primeira linha vazia do bloco de dados.
 */
function servicoAdicionar(nomeAba, dados, opcoes) {
  opcoes = opcoes || {};
  var ctx = montarContexto(nomeAba, opcoes.tipoTabela);
  if (!ctx.editable) {
    return { sucesso: false, erro: 'Esta aba é somente leitura (é uma aba de cálculo).', codigo: 'SOMENTE_LEITURA' };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {
    return { sucesso: false, erro: 'Planilha ocupada. Tente novamente.', codigo: 'LOCK' };
  }

  try {
    var sheet = getSS().getSheetByName(nomeAba);
    var cabecalhos = lerCabecalhos(sheet, ctx.headerRow, ctx.colIni, ctx.colFim);
    var c1 = columnToIndex(ctx.colIni);
    var largura = columnToIndex(ctx.colFim) - c1 + 1;

    var linhaAlvo = encontrarLinhaVazia(sheet, ctx, c1, largura);
    if (linhaAlvo === -1) {
      return { sucesso: false, erro: 'Não há linhas disponíveis (bloco cheio).', codigo: 'SEM_LINHA' };
    }

    var linha = [];
    for (var i = 0; i < largura; i++) linha.push('');
    var colunasGravadas = [];

    for (var j = 0; j < cabecalhos.length; j++) {
      var titulo = cabecalhos[j].titulo;
      if (!titulo) continue;
      if (ctx.colunasProtegidas.indexOf(cabecalhos[j].col) >= 0) continue; // não sobrescreve fórmula
      if (dados.hasOwnProperty(titulo)) {
        linha[j] = sanitizarValor(dados[titulo]);
        colunasGravadas.push(titulo);
      }
    }

    sheet.getRange(linhaAlvo, c1, 1, largura).setValues([linha]);

    return {
      sucesso: true,
      aba: nomeAba,
      linha: linhaAlvo,
      gravadas: colunasGravadas,
      registro: lerRegistroPuro(sheet, cabecalhos, linhaAlvo, c1, largura)
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Edita um registro existente (identificado pelo número da linha).
 */
function servicoEditar(nomeAba, numeroLinha, dados, opcoes) {
  opcoes = opcoes || {};
  var ctx = montarContexto(nomeAba, opcoes.tipoTabela);
  if (!ctx.editable) {
    return { sucesso: false, erro: 'Esta aba é somente leitura.', codigo: 'SOMENTE_LEITURA' };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {
    return { sucesso: false, erro: 'Planilha ocupada. Tente novamente.', codigo: 'LOCK' };
  }

  try {
    var sheet = getSS().getSheetByName(nomeAba);
    if (numeroLinha < ctx.dataStart || numeroLinha > ctx.dataEnd) {
      return { sucesso: false, erro: 'Linha fora da faixa de dados.', codigo: 'LINHA_INVALIDA' };
    }
    var cabecalhos = lerCabecalhos(sheet, ctx.headerRow, ctx.colIni, ctx.colFim);
    var c1 = columnToIndex(ctx.colIni);
    var largura = columnToIndex(ctx.colFim) - c1 + 1;

    var linhaAtual = sheet.getRange(numeroLinha, c1, 1, largura).getValues()[0];
    var colunasAlteradas = [];

    for (var j = 0; j < cabecalhos.length; j++) {
      var titulo = cabecalhos[j].titulo;
      if (!titulo) continue;
      if (ctx.colunasProtegidas.indexOf(cabecalhos[j].col) >= 0) continue;
      if (dados.hasOwnProperty(titulo)) {
        linhaAtual[j] = sanitizarValor(dados[titulo]);
        colunasAlteradas.push(titulo);
      }
    }

    sheet.getRange(numeroLinha, c1, 1, largura).setValues([linhaAtual]);

    return {
      sucesso: true,
      aba: nomeAba,
      linha: numeroLinha,
      alteradas: colunasAlteradas,
      registro: lerRegistroPuro(sheet, cabecalhos, numeroLinha, c1, largura)
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Remove um registro. Limpa as células de dados (mantém a formatação).
 */
function servicoRemover(nomeAba, numeroLinha, opcoes) {
  opcoes = opcoes || {};
  var ctx = montarContexto(nomeAba, opcoes.tipoTabela);
  if (!ctx.editable) {
    return { sucesso: false, erro: 'Esta aba é somente leitura.', codigo: 'SOMENTE_LEITURA' };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {
    return { sucesso: false, erro: 'Planilha ocupada. Tente novamente.', codigo: 'LOCK' };
  }

  try {
    var sheet = getSS().getSheetByName(nomeAba);
    if (numeroLinha < ctx.dataStart || numeroLinha > ctx.dataEnd) {
      return { sucesso: false, erro: 'Linha fora da faixa de dados.', codigo: 'LINHA_INVALIDA' };
    }
    var c1 = columnToIndex(ctx.colIni);
    var largura = columnToIndex(ctx.colFim) - c1 + 1;
    sheet.getRange(numeroLinha, c1, 1, largura).clearContent();

    return { sucesso: true, aba: nomeAba, linha: numeroLinha, removido: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Monta o "contexto" (linhas, colunas, tipo) de uma aba.
 * Para Extras, o tipoTabela define qual dos dois blocos usar.
 */
function montarContexto(nomeAba, tipoTabela) {
  var info = identificarTipo(nomeAba);
  if (!info) throw new Error('Aba não reconhecida: ' + nomeAba);
  var c = info.config;

  if (info.tipo === 'EXTRAS') {
    var tabela = null;
    for (var i = 0; i < c.tabelas.length; i++) {
      if (c.tabelas[i].nome === (tipoTabela || 'ganhos')) tabela = c.tabelas[i];
    }
    if (!tabela) throw new Error('Tabela inválida para Extras. Use "ganhos" ou "gastos".');
    return {
      tipo: 'EXTRAS',
      aba: nomeAba,
      headerRow: c.headerRow,
      dataStart: tabela.dataStart,
      dataEnd: tabela.dataEnd,
      colIni: tabela.colIni,
      colFim: tabela.colFim,
      editable: c.editable,
      colunasProtegidas: c.colunasProtegidas
    };
  }

  return {
    tipo: info.tipo,
    aba: nomeAba,
    headerRow: c.headerRow,
    dataStart: c.dataStart,
    dataEnd: c.dataEnd,
    colIni: 'A',
    colFim: ultimaColunaDoTipo(info.tipo),
    editable: c.editable,
    colunasProtegidas: c.colunasProtegidas
  };
}

/**
 * Última coluna usada por cada tipo de aba (em letra).
 * MENSAL e ANUAL: A..H  |  SALARIO: A..L
 */
function ultimaColunaDoTipo(tipo) {
  var mapa = { MENSAL: 'H', ANUAL: 'H', SALARIO: 'L' };
  return mapa[tipo] || 'H';
}

/**
 * Encontra a primeira linha vazia dentro do bloco de dados.
 */
function encontrarLinhaVazia(sheet, ctx, c1, largura) {
  var ultima = Math.min(ctx.dataEnd, Math.max(sheet.getLastRow(), ctx.dataStart));
  var faixa = sheet.getRange(ctx.dataStart, c1, ultima - ctx.dataStart + 1, largura).getValues();
  for (var i = 0; i < faixa.length; i++) {
    var linha = faixa[i];
    var vazia = true;
    for (var j = 0; j < linha.length; j++) {
      if (linha[j] !== '' && linha[j] !== null) { vazia = false; break; }
    }
    if (vazia) return ctx.dataStart + i;
  }
  return -1;
}

/**
 * Relê uma linha específica e devolve o registro limpo (sem _vazio).
 */
function lerRegistroPuro(sheet, cabecalhos, linha, c1, largura) {
  var valores = sheet.getRange(linha, c1, 1, largura).getValues()[0];
  var reg = montarRegistro(cabecalhos, valores);
  delete reg._vazio;
  return reg;
}

/**
 * Formata uma data da planilha para ISO (yyyy-MM-dd).
 */
function formatarData(d) {
  var ano = d.getFullYear();
  var mes = ('0' + (d.getMonth() + 1)).slice(-2);
  var dia = ('0' + d.getDate()).slice(-2);
  return ano + '-' + mes + '-' + dia;
}
