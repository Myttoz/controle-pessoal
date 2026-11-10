/**
 * ============================================================================
 *  CONFIGURAÇÃO CENTRAL
 * ============================================================================
 *  Todos os "segredos" de nomes e layouts da planilha estão aqui.
 *  Se um dia você renomear uma aba ou mudar uma coluna, ajuste SOMENTE este
 *  arquivo. Nenhum outro precisa ser alterado.
 */

var CONFIG = {

  // ---------------------------------------------------------------------------
  // TIPOS DE ABA
  // ---------------------------------------------------------------------------
  // Cada tipo é identificado por um "pattern" (padrão de nome). O script usa
  // isso para saber o que é uma aba de mês, o que é Salário, o que é Anual...
  //
  //  headerRow : linha onde estão os cabeçalhos (1ª linha = 1)
  //  dataStart : primeira linha com dados de lançamento
  //  dataEnd   : última linha reservada para dados
  //  keyCol    : coluna-chave (usada como identificador quando não há nº de linha)
  //  editable  : false = somente leitura (é uma aba de cálculo)
  // ---------------------------------------------------------------------------
  TIPOS: {

    MENSAL: {
      pattern: /^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ) (\d{2})$/i,
      label: 'Mensal',
      headerRow: 6,
      dataStart: 7,
      dataEnd: 106,
      keyCol: 'A',          // CATEGORIA
      valueCol: 'B',        // VALOR
      editable: true,
      // Colunas que são "fórmula/cálculo" e NUNCA devem ser alteradas pelo app
      colunasProtegidas: []
    },

    SALARIO: {
      pattern: /^Salário (\d{4})$/i,
      label: 'Salário',
      headerRow: 3,
      dataStart: 4,
      dataEnd: 15,          // JAN..DEZ (12 linhas fixas)
      keyCol: 'A',          // MÊS
      editable: true,
      colunasProtegidas: ['I', 'J', 'K']  // TOTAL SALÁRIO, TOTAL GANHOS e FREELANCE são fórmulas
    },

    EXTRAS: {
      pattern: /^Extras (\d{4})$/i,
      label: 'Extras',
      // Aba tem DUAS tabelas lado a lado. Definimos cada "bloco".
      headerRow: 3,
      tabelas: [
        {
          nome: 'ganhos',            // ganhos/freelance recebidos
          colIni: 'A', colFim: 'E',  // MÊS, CATEGORIA, DESCRIÇÃO, VALOR, DATA
          dataStart: 4,
          dataEnd: 40
        },
        {
          nome: 'gastos',            // gastos extras
          colIni: 'J', colFim: 'N',  // MÊS, CATEGORIA, DESCRIÇÃO, VALOR, DATA
          dataStart: 4,
          dataEnd: 40
        }
      ],
      editable: true,
      colunasProtegidas: []
    },

    ANUAL: {
      pattern: /^Anual (\d{4})$/i,
      label: 'Anual',
      headerRow: 4,
      dataStart: 5,
      dataEnd: 16,          // JAN..DEZ
      keyCol: 'A',          // MÊS
      editable: false,      // é uma aba de cálculo — somente leitura
      colunasProtegidas: ['B', 'C', 'D', 'E', 'F', 'G']
    }
  },

  // ---------------------------------------------------------------------------
  // NOMES DOS MODELOS OCULTOS (usados para gerar um novo ano)
  // ---------------------------------------------------------------------------
  MODELOS: {
    anual:   'Modelo Anual Atualizado',
    salario: 'Modelo Salário Atualizado',
    extras:  'Modelo Extra Atualizado',
    mensal:  'Modelo Mensal Atualizado'
  },

  // ---------------------------------------------------------------------------
  // MESES
  // ---------------------------------------------------------------------------
  // abrev = como o mês aparece no NOME da aba ("JAN 27")
  // sigla = como aparece na coluna MÊS dentro de Salário/Anual/Extras
  // extenso = nome por extenso (usado em Extras coluna MÊS)
  // ---------------------------------------------------------------------------
  MESES: [
    { abrev: 'JAN', sigla: 'JAN', extenso: 'JANEIRO'   },
    { abrev: 'FEV', sigla: 'FEV', extenso: 'FEVEREIRO' },
    { abrev: 'MAR', sigla: 'MAR', extenso: 'MARÇO'     },
    { abrev: 'ABR', sigla: 'ABR', extenso: 'ABRIL'     },
    { abrev: 'MAI', sigla: 'MAI', extenso: 'MAIO'      },
    { abrev: 'JUN', sigla: 'JUN', extenso: 'JUNHO'     },
    { abrev: 'JUL', sigla: 'JUL', extenso: 'JULHO'     },
    { abrev: 'AGO', sigla: 'AGO', extenso: 'AGOSTO'    },
    { abrev: 'SET', sigla: 'SET', extenso: 'SETEMBRO'  },
    { abrev: 'OUT', sigla: 'OUT', extenso: 'OUTUBRO'   },
    { abrev: 'NOV', sigla: 'NOV', extenso: 'NOVEMBRO'  },
    { abrev: 'DEZ', sigla: 'DEZ', extenso: 'DEZEMBRO'  }
  ],

  // ---------------------------------------------------------------------------
  // LISTAS SUSPENSAS (valores permitidos nas validações de dados)
  // Mantenha em sincronia com as validações da planilha.
  // ---------------------------------------------------------------------------
  LISTAS: {
    CATEGORIA: [
      'Moradia/Contas', 'Mercado', 'Compra Conjunta', 'Compra Pessoal',
      'Transporte', 'Alimentação', 'Saúde', 'Lazer', 'Assinaturas',
      'Pix/Saldo', 'Outros'
    ],
    'FORMA DE PGTO': [
      'XP', 'NU', 'BB', 'MP', 'MPC', 'Boleto', 'Pix',
      'Dinheiro', 'Folha PGT', 'Livia PG'
    ],
    TIPO: [
      'Fatura futura', 'PIX', 'Boleto', 'Folha de pagamento'
    ],
    'QUEM PAGA': [
      'Eu', 'Livia', 'Dividido 50/50'
    ],
    MES_EXTRAS: [
      'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
      'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
    ]
  },

  // ---------------------------------------------------------------------------
  // SEGURANÇA DA API
  // ---------------------------------------------------------------------------
  // Coloque um token forte aqui e Configure abaixo (ver README).
  // Se deixar em branco (''), a API fica ABERTA (não recomendado em produção).
  API_KEY: '',

  // ---------------------------------------------------------------------------
  // DASHBOARD
  // ---------------------------------------------------------------------------
  DASHBOARD_ABA: 'Dashboard',

  // ---------------------------------------------------------------------------
  // LEMBRETES
  // ---------------------------------------------------------------------------
  // Nome da aba onde os lembretes ficam guardados e hora do envio diário
  // (0–23, no fuso do projeto — ex.: America/Sao_Paulo).
  LEMBRETES_ABA: 'LEMBRETES',
  LEMBRETES_HORA: 8,

  // ---------------------------------------------------------------------------
  // DADOS LOCAIS (sincronização entre web, Linux e Windows)
  // ---------------------------------------------------------------------------
  // Aba onde o JSON com Horas Extras, Férias, Manutenção e configuração
  // (salário bruto / KM) fica guardado. Criada automaticamente.
  DADOS_LOCAIS_ABA: 'DADOS_LOCAIS'
};
