/**
 * ============================================================================
 *  AUTENTICAÇÃO E PROXY — App "Controle Pessoal" (Ganhos & Gastos)
 * ============================================================================
 *  Cole este conteúdo em um arquivo chamado Auth.gs no Apps Script.
 *
 *  IMPORTANTE: todas as funções abaixo retornam objetos JS PUROS.
 *  O embrulho JSON (json()) é feito UMA única vez no doPost de Api.gs.
 *  (Retornar json()/erro() aqui dentro causava duplo embrulho e a resposta
 *   virava "{}" — bug confirmado em testes.)
 */

var TOKEN_EXPIRACAO_MS = 24 * 60 * 60 * 1000; // 24 horas
var CHAVE_TOKEN = 'TOKEN_SESSAO_USUARIO';

/**
 * Login na aba "Usuarios" da planilha.
 * Retorna { sucesso:true, token, usuario, nome } ou { sucesso:false, erro, codigo }.
 */
function funcaoLogin(usuario, senha) {
  if (!usuario || !senha) {
    return { sucesso: false, erro: 'Informe usuário e senha.', codigo: 'CREDENCIAIS_INVALIDAS' };
  }
  var ss = getSS();
  var aba = ss.getSheetByName('Usuarios');
  if (!aba) {
    return { sucesso: false, erro: 'Aba "Usuarios" não encontrada na planilha.', codigo: 'CONFIG_INVALIDA' };
  }
  var dados = aba.getDataRange().getValues();
  var cabecalho = dados[0];
  for (var i = 1; i < dados.length; i++) {
    var linha = {};
    for (var j = 0; j < cabecalho.length; j++) {
      linha[cabecalho[j]] = dados[i][j];
    }
    if (linha.USUARIO === usuario && linha.SENHA === senha && linha.ATIVO === 'SIM') {
      var token = gerarToken();
      salvarToken(token, usuario);
      return { sucesso: true, token: token, usuario: usuario, nome: linha.NOME || usuario };
    }
  }
  return { sucesso: false, erro: 'Usuário ou senha inválidos.', codigo: 'CREDENCIAIS_INVALIDAS' };
}

/**
 * Valida um token de sessão (usado na abertura do app).
 */
function funcaoVerificar(token) {
  if (!token) return { sucesso: false, codigo: 'TOKEN_INVALIDO' };
  var info = lerToken(token);
  if (!info) return { sucesso: false, codigo: 'TOKEN_INVALIDO' };
  return { sucesso: true, usuario: info.usuario };
}

/**
 * Proxy autenticado: valida o token e despacha para a ação real.
 * A API_KEY é injetada aqui — o front nunca vê a chave.
 *
 * corpo: { token, acao_real, ...demais parâmetros da ação }
 */
function funcaoProxy(corpo) {
  if (!corpo || !corpo.token) {
    return { sucesso: false, erro: 'Token não informado.', codigo: 'TOKEN_INVALIDO' };
  }
  var info = lerToken(corpo.token);
  if (!info) {
    return { sucesso: false, erro: 'Token inválido ou expirado. Faça login novamente.', codigo: 'TOKEN_INVALIDO' };
  }

  var acaoReal = corpo.acao_real;
  var params = {};
  for (var k in corpo) {
    if (k !== 'token' && k !== 'acao_real' && k !== 'acao') params[k] = corpo[k];
  }
  params.chave = CONFIG.API_KEY; // injeta a chave secreta — o front NÃO vê isso

  switch (acaoReal) {
    case 'ano':
      return servicoAnoCompleto(parseInt(params.ano, 10));

    case 'abas':
      return { sucesso: true, abas: listarAbasDados() };

    case 'listas':
      return { sucesso: true, listas: CONFIG.LISTAS };

    case 'listar':
      return servicoListar(params.aba, { tipoTabela: params.tabela });

    case 'cabecalhos':
      return servicoCabecalhos(params.aba, params.tabela);

    case 'adicionar':
      return servicoAdicionar(params.aba, params.dados, { tipoTabela: params.tabela });

    case 'editar':
      return servicoEditar(params.aba, parseInt(params.linha, 10), params.dados, { tipoTabela: params.tabela });

    case 'remover':
      return servicoRemover(params.aba, parseInt(params.linha, 10), { tipoTabela: params.tabela });

    case 'criarAno':
      return servicoCriarAno(parseInt(params.ano, 10), { sobrescrever: !!params.sobrescrever });

    case 'atualizarDashboard':
      return atualizarAbaDashboard(parseInt(params.ano, 10), params.agrupar);

    case 'dashboard':
      return servicoDashboard(parseInt(params.ano, 10), params.agrupar);

    // ---------- lembretes ----------
    case 'lembretes':
      return servicoListarLembretes();

    case 'statusLembretes':
      return statusLembretes();

    case 'adicionarLembrete':
      return servicoAdicionarLembrete(params.dados);

    case 'editarLembrete':
      return servicoEditarLembrete(params.id, params.dados);

    case 'removerLembrete':
      return servicoRemoverLembrete(params.id);

    case 'testarLembrete':
      return testarLembrete(params.id);

    case 'instalarLembretes':
      return instalarGatilhoLembretes();

    // ---------- dados locais (sincronização entre dispositivos) ----------
    case 'dadosLocais':
      return servicoLerDadosLocais();

    case 'salvarDadosLocais':
      return servicoSalvarDadosLocais(params.dados);

    default:
      return { sucesso: false, erro: 'Ação real desconhecida: ' + acaoReal, codigo: 'ACAO_INVALIDA' };
  }
}

// ---------------------------------------------------------------------------
//  Tokens de sessão (Script Properties)
// ---------------------------------------------------------------------------

function gerarToken() {
  return 'tk_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

function salvarToken(token, usuario) {
  var props = PropertiesService.getScriptProperties();
  var chave = CHAVE_TOKEN + '_' + token;
  props.setProperty(chave, JSON.stringify({
    usuario: usuario,
    exp: new Date().getTime() + TOKEN_EXPIRACAO_MS
  }));
}

function lerToken(token) {
  var props = PropertiesService.getScriptProperties();
  var chave = CHAVE_TOKEN + '_' + token;
  var txt = props.getProperty(chave);
  if (!txt) return null;
  var info = JSON.parse(txt);
  if (new Date().getTime() > info.exp) {
    props.deleteProperty(chave);
    return null;
  }
  return info;
}
