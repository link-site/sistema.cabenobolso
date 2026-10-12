export interface AllocationItem {
  id: string;
  name: string;
  category: string;
  percentage: number;
  color: string;
  description: string;
  examples: string[];
}

export type InvestmentLevelKey = 'conservador' | 'moderado' | 'arrojado';

export interface InvestmentLevelProfile {
  key: InvestmentLevelKey;
  levelNumber: 1 | 2 | 3;
  name: string;
  tagline: string;
  annualReturn: number; // Em percentual, ex: 10.75 para 10.75%
  monthlyReturnEstimate: number; // Em percentual, ex: 0.85%
  risk: 'Muito Baixo' | 'Moderado' | 'Arrojado';
  riskBadgeColor: string;
  horizon: string;
  minHorizonYears: number;
  fgcProtected: boolean;
  idealFor: string;
  allocations: AllocationItem[];
  keyStrategies: string[];
  recommendedAssets: {
    symbolOrName: string;
    type: string;
    description: string;
    badge?: string;
  }[];
}

export const MARKET_BENCHMARKS = {
  selicRate: 10.75, // Taxa Selic meta atual a.a.
  cdiRate: 10.65, // Taxa CDI atual a.a.
  poupancaRate: 6.80, // Poupança atual (TR + 0.5% a.m.)
  ipcaInflation: 4.20, // Inflação IPCA projetada média a.a.
};

export const INVESTMENT_PROFILES: Record<InvestmentLevelKey, InvestmentLevelProfile> = {
  conservador: {
    key: 'conservador',
    levelNumber: 1,
    name: 'Nível 1: Conservador',
    tagline: 'Segurança Máxima, Liquidez Imediata & Reserva de Emergência',
    annualReturn: 10.75,
    monthlyReturnEstimate: 0.85,
    risk: 'Muito Baixo',
    riskBadgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    horizon: 'Curto Prazo (0 a 2 anos)',
    minHorizonYears: 1,
    fgcProtected: true,
    idealFor: 'Quem está começando, formando a Reserva de Emergência ou prioriza tranquilidade sem oscilações.',
    allocations: [
      {
        id: 'pos_fixado_diario',
        name: 'Tesouro Selic & CDB 100% CDI',
        category: 'Pós-fixado com Liquidez Diária',
        percentage: 70,
        color: '#00ff7f',
        description: 'Dinheiro disponível para resgate a qualquer momento, rendendo 100% da Selic/CDI diariamente.',
        examples: ['Tesouro Selic 2029', 'CDB Sofisa 110% CDI', 'Caixinha Nubank / Inter 100% CDI'],
      },
      {
        id: 'renda_fixa_isenta',
        name: 'LCI & LCA Isentas de IR',
        category: 'Renda Fixa Isenta',
        percentage: 20,
        color: '#38bdf8',
        description: 'Títulos de crédito imobiliário e do agronegócio com zero Imposto de Renda para pessoa física.',
        examples: ['LCI Banco do Brasil 92% CDI', 'LCA BTG Pactual 93% CDI'],
      },
      {
        id: 'ipca_curto',
        name: 'Tesouro IPCA+ Curto',
        category: 'Proteção contra Inflação',
        percentage: 10,
        color: '#fbbf24',
        description: 'Garante rendimento acima da inflação medida pelo IPCA, preservando poder de compra.',
        examples: ['Tesouro IPCA+ 2029'],
      },
    ],
    keyStrategies: [
      'Construir a Reserva de Emergência (3 a 6 meses de gastos) antes de qualquer outro ativo.',
      'Aproveitar juros de 100% do CDI em liquidez diária sem correr risco de oscilação negativa.',
      'Garantia do Tesouro Nacional e proteção do FGC até R$ 250.000 por instituição financeira.',
    ],
    recommendedAssets: [
      {
        symbolOrName: 'Tesouro Selic 2029',
        type: 'Título Público Federal',
        description: 'O investimento mais seguro do Brasil com garantia soberana do governo.',
        badge: 'Liquidez D+0',
      },
      {
        symbolOrName: 'CDB Liquidez Diária (100% a 110% CDI)',
        type: 'Crédito Bancário (FGC)',
        description: 'Rentabilidade diária com resgate imediato para imprevistos.',
        badge: 'Protegido FGC',
      },
      {
        symbolOrName: 'LCI / LCA 90% a 94% CDI',
        type: 'Crédito Imobiliário / Agro',
        description: 'Equivale a um CDB de mais de 115% do CDI por ser 100% isento de IR.',
        badge: 'Zero Imposto',
      },
    ],
  },

  moderado: {
    key: 'moderado',
    levelNumber: 2,
    name: 'Nível 2: Moderado',
    tagline: 'Equilíbrio, Dividendos Mensais Isentos & Ganho Real',
    annualReturn: 12.50,
    monthlyReturnEstimate: 0.98,
    risk: 'Moderado',
    riskBadgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    horizon: 'Médio Prazo (2 a 5 anos)',
    minHorizonYears: 3,
    fgcProtected: true,
    idealFor: 'Quem já tem reserva de emergência e busca renda passiva pingando todo mês superando a inflação.',
    allocations: [
      {
        id: 'renda_fixa_base',
        name: 'Renda Fixa Pós-fixada & Isenta',
        category: 'Estabilidade & Caixa',
        percentage: 45,
        color: '#00ff7f',
        description: 'Colchão de segurança para compras na baixa e amortecedor de volatilidade.',
        examples: ['CDB 100% CDI', 'LCI/LCA 92% CDI', 'Tesouro Selic'],
      },
      {
        id: 'ipca_medio',
        name: 'Tesouro IPCA+ e Debêntures Incentivadas',
        category: 'Ganho Real Acima da Inflação',
        percentage: 25,
        color: '#fbbf24',
        description: 'Títulos atrelados à inflação garantindo poder de compra real e cupons semestrais.',
        examples: ['Tesouro IPCA+ 2035', 'Debêntures de Infraestrutura (Zero IR)'],
      },
      {
        id: 'fiis_renda',
        name: 'Fundos Imobiliários (FIIs)',
        category: 'Renda Passiva Mensal',
        percentage: 20,
        color: '#a855f7',
        description: 'Aluguéis de grandes galpões, shoppings e títulos de dívida pagos todo mês na sua conta.',
        examples: ['HGLG11 (Galpões)', 'XPML11 (Shoppings)', 'MXRF11 (Crédito)', 'KNCR11'],
      },
      {
        id: 'acoes_dividendos',
        name: 'Ações de Dividendos & Valor',
        category: 'Sociedade em Grandes Empresas',
        percentage: 10,
        color: '#f43f5e',
        description: 'Participação nos lucros de setores essenciais como bancos, energia e seguros.',
        examples: ['Itaú (ITUB4)', 'Banco do Brasil (BBAS3)', 'Taesa (TAEE11)', 'BB Seguridade (BBSE3)'],
      },
    ],
    keyStrategies: [
      'Reinvestir religiosamente 100% dos dividendos recebidos para acelerar a bola de neve.',
      'Diversificar em 6 a 10 ativos diferentes entre FIIs e Ações para mitigar riscos individuais.',
      'Aproveitar a isenção de Imposto de Renda nos dividendos de Fundos Imobiliários.',
    ],
    recommendedAssets: [
      {
        symbolOrName: 'HGLG11 / XPML11',
        type: 'Fundo Imobiliário Tijolo',
        description: 'Imóveis físicos de alta qualidade gerando aluguéis mensais isentos de IR.',
        badge: 'Renda Mensal',
      },
      {
        symbolOrName: 'Tesouro IPCA+ 2035',
        type: 'Título Público',
        description: 'Garante IPCA + ~6,0% ao ano de rentabilidade real.',
        badge: 'Proteção IPCA',
      },
      {
        symbolOrName: 'ITUB4 / BBAS3 / TAEE11',
        type: 'Ações de Dividendos',
        description: 'Empresas altamente lucrativas de setores perenes com distribuição constante.',
        badge: 'Dividend Yield',
      },
    ],
  },

  arrojado: {
    key: 'arrojado',
    levelNumber: 3,
    name: 'Nível 3: Arrojado',
    tagline: 'Multiplicação Patrimonial, Dólar & Independência Financeira',
    annualReturn: 15.00,
    monthlyReturnEstimate: 1.17,
    risk: 'Arrojado',
    riskBadgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    horizon: 'Longo Prazo (5 a 30 anos)',
    minHorizonYears: 5,
    fgcProtected: false,
    idealFor: 'Quem visa acumular patrimônio substancial, independência financeira (FIRE) e proteção internacional.',
    allocations: [
      {
        id: 'rf_estrategica',
        name: 'Tesouro IPCA+ Longo',
        category: 'Renda Fixa Estratégica & Marcação',
        percentage: 30,
        color: '#fbbf24',
        description: 'Possibilidade de lucros extraordinários com oscilação na curva de juros (marcação a mercado).',
        examples: ['Tesouro IPCA+ 2045', 'Tesouro RendA+ 2060'],
      },
      {
        id: 'acoes_brasil',
        name: 'Ações Brasileiras (Crescimento & Valor)',
        category: 'Renda Variável Brasil',
        percentage: 25,
        color: '#f43f5e',
        description: 'Grandes companhias e empresas com alto potencial de valorização de receita e lucros.',
        examples: ['WEG (WEGE3)', 'PRIO (PRIO3)', 'Vale (VALE3)', 'Localiza (RENT3)'],
      },
      {
        id: 'ativos_internacionais',
        name: 'Dólar & Mercado Global (S&P 500)',
        category: 'Exposição Internacional em Dólar',
        percentage: 20,
        color: '#38bdf8',
        description: 'Proteção cambial na moeda mais forte do mundo investindo nas 500 maiores empresas americanas.',
        examples: ['IVVB11 (S&P 500)', 'WRLD11 (Ações Globais)', 'BDRs de Apple, Microsoft, Google'],
      },
      {
        id: 'fiis_e_infra',
        name: 'FIIs & FI-Infra',
        category: 'Renda Passiva & Infraestrutura',
        percentage: 20,
        color: '#a855f7',
        description: 'Proventos mensais de debêntures de infraestrutura isentas de IR reinvestidos.',
        examples: ['BIDI11', 'JURO11', 'XPML11', 'KNCR11'],
      },
      {
        id: 'criptoativos',
        name: 'Bitcoin & Ativos Digitais (Ouro Digital)',
        category: 'Criptoativos Selecionados',
        percentage: 5,
        color: '#eab308',
        description: 'Fatia assimétrica de alta valorização e reserva descorrelacionada do sistema bancário tradicional.',
        examples: ['Bitcoin (BTC)', 'Ethereum (ETH)', 'ETF HASH11 / QBTC11'],
      },
    ],
    keyStrategies: [
      'Aporte mensal contínuo em Dollar-Cost-Averaging (comprar mais na baixa e na alta sem tentar adivinhar topo).',
      'Proteção internacional em Dólar para blindar o patrimônio da desvalorização do Real.',
      'Horizonte elástico de longo prazo: a volatilidade de curto prazo trabalha a favor da multiplicação.',
    ],
    recommendedAssets: [
      {
        symbolOrName: 'IVVB11 (S&P 500)',
        type: 'ETF Internacional',
        description: 'Apple, Microsoft, Nvidia, Google e Amazon cotadas em Dólar.',
        badge: 'Moeda Forte',
      },
      {
        symbolOrName: 'WEGE3 / PRIO3',
        type: 'Ações de Crescimento',
        description: 'Líderes de mercado com crescimento composto histórico invejável.',
        badge: 'Crescimento',
      },
      {
        symbolOrName: 'Bitcoin (BTC / HASH11)',
        type: 'Reserva Digital Assimétrica',
        description: 'Alocação máxima de 5% da carteira para buscar retornos exponenciais controlados.',
        badge: 'Assimetria',
      },
    ],
  },
};

export const MARKET_BEST_PRACTICES = [
  {
    title: 'A Regra dos 50 / 30 / 20',
    subtitle: 'A distribuição ideal do seu salário mensal',
    description:
      '50% da sua renda deve ir para necessidades essenciais (moradia, comida, contas fixas), 30% para estilo de vida e lazer, e 20% rigorosamente destinados a investimentos futuros.',
    iconName: 'PieChart',
  },
  {
    title: 'Primeiro Pague a Você Mesmo',
    subtitle: 'Não invista o que sobrar no fim do mês',
    description:
      'Assim que o salário cair na conta, separe o valor do seu aporte mensal de investimento imediatamente. Quem espera sobrar dinheiro no dia 30 quase nunca consegue investir.',
    iconName: 'Sparkles',
  },
  {
    title: 'O Poder da Reserva de Emergência',
    subtitle: 'A blindagem antes de qualquer risco',
    description:
      'Mantenha entre 3 a 6 meses do seu custo de vida mensal em aplicações com liquidez diária (Tesouro Selic ou CDB 100% CDI). Ela evita que você venda ações na baixa quando surgir um imprevisto.',
    iconName: 'ShieldCheck',
  },
  {
    title: 'Tabela Regressiva de Imposto de Renda',
    subtitle: 'Quanto mais tempo investido, menos imposto',
    description:
      'Na Renda Fixa tradicional: 22,5% (até 180 dias), 20% (até 360 dias), 17,5% (até 720 dias) e 15% (acima de 2 anos). Em LCI, LCA, CRI, CRA e FIIs o rendimento é 100% ISENTO de IR!',
    iconName: 'Receipt',
  },
  {
    title: 'Efeito Bola de Neve (Juros Compostos)',
    subtitle: 'O tempo é o maior multiplicador de riqueza',
    description:
      'No começo, seu esforço vem dos aportes do seu bolso. Com o tempo e o reinvestimento dos dividendos, os juros ganhos superam os próprios aportes mensais, gerando independência financeira.',
    iconName: 'TrendingUp',
  },
];
