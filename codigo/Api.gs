/**
 * ============================================================================
 *  API WEB APP — roteador (doGet / doPost)
 *  App "Controle Pessoal" (Ganhos & Gastos)
 * ============================================================================
 *  O app externo chama a URL do web app. As operações de LEITURA vão por GET
 *  e as de ESCRITA (criar/editar/remover) por POST via ação "proxy"
 *  (autenticada por token — o Apps Script injeta a API_KEY nos bastidores).
 *
 *  Todas as respostas são JSON no formato:
 *      { sucesso: true,  ... }
 *      { sucesso: false, erro: '...', codigo: '...' }
 *
 *  ATENÇÃO: as funções de Auth.gs retornam objetos JS PUROS.
 *  O embrulho JSON (json()) acontece UMA única vez, aqui no doPost.
 */

/**
 * ------------------------------- GET ---------------------------------------
 * Parâmetros aceitos (via ?chave=valor):
 *
 *   acao=listar      &aba=JAN 27           [&tabela=ganhos|gastos]
 *   acao=registros   &ano=2027&mes=JAN     (atalho: monta o nome da aba)
 *   acao=dashboard   &ano=2027             [&agrupar=CATEGORIA]
 *   acao=abas                              (lista todas as abas de dados)
 *   acao=cabecalhos  &aba=JAN 27           (só os cabeçalhos)
 *   acao=listas                             (listas suspensas p/ o app)
 *   acao=ano         &ano=2027             (snapshot completo do ano)
 *   acao=lembretes                          (lista os lembretes)
 *   acao=statusLembretes                    (gatilho/fuso/cota de e-mail)
 *   acao=dadosLocais                        (Horas Extras, Férias, Manutenção)
 *   acao=teste                              (verifica se a API está viva)
 *
 *  Opcional: &chave=SUA_API_KEY  (se CONFIG.API_KEY estiver preenchido)
 */
function doGet(e) {
  try {
    if (!autenticar(e)) return erro('Não autorizado. Informe a chave correta.', 'NAO_AUTORIZADO');

    var p = e.parameter || {};
    switch (p.acao) {

      case 'listar':
        if (!p.aba) return erro('Informe o parâmetro "aba".', 'PARAMETRO_AUSENTE');
        return json(servicoListar(p.aba, { tipoTabela: p.tabela }));

      case 'registros':
        if (!p.ano) return erro('Informe o parâmetro "ano".', 'PARAMETRO_AUSENTE');
        return json(servicoListar(montarNomeAba(p.ano, p.mes), {}));

      case 'ano':
        // SNAPSHOT completo do ano numa chamada só (12 meses + salário +
        // extras + resumo). É o endpoint que deixa o app fluido.
        if (!p.ano) return erro('Informe o parâmetro "ano".', 'PARAMETRO_AUSENTE');
        return json(servicoAnoCompleto(parseInt(p.ano, 10)));

      case 'dashboard':
        if (!p.ano) return erro('Informe o parâmetro "ano".', 'PARAMETRO_AUSENTE');
        return json(servicoDashboard(parseInt(p.ano, 10), p.agrupar));

      case 'abas':
        return json({ sucesso: true, abas: listarAbasDados() });

      case 'cabecalhos':
        if (!p.aba) return erro('Informe o parâmetro "aba".', 'PARAMETRO_AUSENTE');
        return json(servicoCabecalhos(p.aba, p.tabela));

      case 'listas':
        return json({ sucesso: true, listas: CONFIG.LISTAS });

      case 'lembretes':
        return json(servicoListarLembretes());

      case 'statusLembretes':
        return json(statusLembretes());

      case 'dadosLocais':
        // Sincronização dos dados que antes ficavam só no dispositivo
        // (Horas Extras, Férias, Manutenção e configuração).
        return json(servicoLerDadosLocais());

      case 'teste':
        return json({ sucesso: true, mensagem: 'API funcionando.', momento: new Date().toISOString() });

      default:
        return erro('Ação GET desconhecida ou ausente. Veja o README.', 'ACAO_INVALIDA');
    }
  } catch (err) {
    return erro('Falha na API: ' + err.message, 'EXCECAO');
  }
}

/**
 * ------------------------------- POST --------------------------------------
 * Corpo JSON:
 *
 *   { "acao": "login",     "usuario": "...", "senha": "..." }
 *   { "acao": "verificar", "token": "tk_..." }
 *   { "acao": "proxy",     "token": "tk_...", "acao_real": "ano", "ano": 2027 }
 *
 *  login / verificar / proxy NÃO exigem a API_KEY no corpo:
 *  eles validam o TOKEN de sessão (login/proxy) internamente.
 *
 *  Qualquer outro POST (adicionar/editar/remover/criarAno/...) exige
 *  "chave": "SUA_API_KEY" — uso direto da API, sem sessão.
 */
function doPost(e) {
  try {
    var corpo;
    try {
      corpo = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return erro('Corpo da requisição não é um JSON válido.', 'JSON_INVALIDO');
    }

    var p = corpo || {};
    var acao = p.acao;

    // login/verificar/proxy se autenticam pelo TOKEN (Auth.gs) — não pela chave.
    var semChave = (acao === 'login' || acao === 'verificar' || acao === 'proxy');
    if (!semChave && !autenticar(corpo)) {
      return erro('Não autorizado. Informe a chave correta.', 'NAO_AUTORIZADO');
    }

    switch (acao) {

      // ---------- sessão (Auth.gs) ----------
      case 'login':
        return json(funcaoLogin(p.usuario, p.senha));

      case 'verificar':
        return json(funcaoVerificar(p.token));

      case 'proxy':
        // O front envia { token, acao_real, ... }. Aqui validamos o token e
        // despachamos para a ação real com a chave já injetada.
        return json(funcaoProxy(p));

      // ---------- escrita direta (exige chave) ----------
      case 'adicionar':
        if (!p.aba) return erro('Informe "aba".', 'PARAMETRO_AUSENTE');
        if (!p.dados) return erro('Informe "dados".', 'PARAMETRO_AUSENTE');
        return json(servicoAdicionar(p.aba, p.dados, { tipoTabela: p.tabela }));

      case 'editar':
        if (!p.aba || !p.linha) return erro('Informe "aba" e "linha".', 'PARAMETRO_AUSENTE');
        if (!p.dados) return erro('Informe "dados".', 'PARAMETRO_AUSENTE');
        return json(servicoEditar(p.aba, parseInt(p.linha, 10), p.dados, { tipoTabela: p.tabela }));

      case 'remover':
        if (!p.aba || !p.linha) return erro('Informe "aba" e "linha".', 'PARAMETRO_AUSENTE');
        return json(servicoRemover(p.aba, parseInt(p.linha, 10), { tipoTabela: p.tabela }));

      case 'criarAno':
        if (!p.ano) return erro('Informe "ano".', 'PARAMETRO_AUSENTE');
        return json(servicoCriarAno(p.ano, { sobrescrever: !!p.sobrescrever }));

      case 'atualizarDashboard':
        if (!p.ano) return erro('Informe o parâmetro "ano".', 'PARAMETRO_AUSENTE');
        return json(atualizarAbaDashboard(parseInt(p.ano, 10), p.agrupar));

      // ---------- lembretes ----------
      case 'adicionarLembrete':
        return json(servicoAdicionarLembrete(p.dados));

      case 'editarLembrete':
        return json(servicoEditarLembrete(p.id, p.dados));

      case 'removerLembrete':
        return json(servicoRemoverLembrete(p.id));

      case 'testarLembrete':
        return json(testarLembrete(p.id));

      case 'instalarLembretes':
        return json(instalarGatilhoLembretes());

      // ---------- dados locais (sincronização entre dispositivos) ----------
      case 'salvarDadosLocais':
        if (!p.dados) return erro('Informe "dados".', 'PARAMETRO_AUSENTE');
        return json(servicoSalvarDadosLocais(p.dados));

      default:
        return erro('Ação POST desconhecida ou ausente. Veja o README.', 'ACAO_INVALIDA');
    }
  } catch (err) {
    return erro('Falha na API: ' + err.message, 'EXCECAO');
  }
}

/**
 * Verifica a chave de API. Se CONFIG.API_KEY estiver vazio, libera acesso.
 * No GET a chave vem em e.parameter; no POST, no corpo.
 */
function autenticar(fonte) {
  if (!CONFIG.API_KEY) return true;                 // sem chave configurada → aberto
  var informada = (fonte && (fonte.chave || (fonte.parameter && fonte.parameter.chave))) || '';
  return informada === CONFIG.API_KEY;
}

/**
 * Monta o nome da aba de mês a partir de ano+mês.
 * Ex.: montarNomeAba(2027, 'JAN') → "JAN 27"
 */
function montarNomeAba(ano, mes) {
  if (!mes) throw new Error('Informe o parâmetro "mes" (ex.: JAN).');
  var yy = String(ano).slice(-2);
  return String(mes).toUpperCase() + ' ' + yy;
}

/**
 * Devolve só os cabeçalhos de uma aba (útil para o app montar formulários).
 */
function servicoCabecalhos(nomeAba, tipoTabela) {
  var ctx = montarContexto(nomeAba, tipoTabela);
  var sheet = getSS().getSheetByName(nomeAba);
  var cab = lerCabecalhos(sheet, ctx.headerRow, ctx.colIni, ctx.colFim);
  return {
    sucesso: true,
    aba: nomeAba,
    tipo: ctx.tipo,
    colunas: cab.map(function (c) { return { coluna: c.col, titulo: c.titulo }; }),
    faixaDados: ctx.colIni + ctx.dataStart + ':' + ctx.colFim + ctx.dataEnd
  };
}

/** Serializa obj como resposta JSON com CORS liberado. */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({ 'Access-Control-Allow-Origin': '*' });
}

/** Resposta de erro padronizada. */
function erro(mensagem, codigo) {
  return json({ sucesso: false, erro: mensagem, codigo: codigo });
}
