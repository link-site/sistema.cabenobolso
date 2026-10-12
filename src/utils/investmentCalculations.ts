import { Transaction, CreditCard, CardPurchase } from '../types';
import { parseDateMonthYear } from './formatters';
import { isCardTransaction, getCardInvoiceForMonthYear } from './creditCardSync';
import { MARKET_BENCHMARKS } from './investmentData';

export interface BudgetFinancialSnapshot {
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  monthlySurplus: number; // Income - Expenses (sobra líquida)
  savingsRatePercentage: number; // (monthlySurplus / totalIncome) * 100
  isDeficit: boolean;
  essentialNeeds: number; // 50% target
  wantsAndLifestyle: number; // 30% target
  idealInvestments: number; // 20% target
  recommendedEmergencyFund: {
    months3: number;
    months6: number;
    months12: number;
  };
  monthsToReachEmergencyFund6Months: number;
}

/**
 * Calcula o diagnóstico financeiro completo de receitas e despesas para simulação
 */
export function calculateBudgetFinancialSnapshot(
  transactions: Transaction[],
  cards: CreditCard[] = [],
  cardPurchases: CardPurchase[] = [],
  targetYear: number,
  targetMonth: number
): BudgetFinancialSnapshot {
  // Transações do mês
  const monthTransactions = transactions.filter((tx) => {
    const { year, month } = parseDateMonthYear(tx.date);
    return year === targetYear && month === targetMonth;
  });

  const totalIncome = monthTransactions
    .filter((tx) => tx.type === 'salario')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  let totalExpenses = monthTransactions
    .filter((tx) => tx.type === 'gasto')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Considerar faturas dos cartões
  cards.forEach((card) => {
    const hasCardTx = monthTransactions.some((tx) => isCardTransaction(tx, card));
    if (!hasCardTx) {
      const invoice = getCardInvoiceForMonthYear(card, cardPurchases, targetYear, targetMonth);
      if (invoice > 0) {
        totalExpenses += invoice;
      }
    }
  });

  const monthlySurplus = totalIncome - totalExpenses;
  const isDeficit = monthlySurplus < 0;
  const savingsRatePercentage = totalIncome > 0 ? (monthlySurplus / totalIncome) * 100 : 0;

  // Régua 50 / 30 / 20 baseada na renda
  const essentialNeeds = totalIncome * 0.50;
  const wantsAndLifestyle = totalIncome * 0.30;
  const idealInvestments = totalIncome * 0.20;

  // Reserva de Emergência baseada nas despesas mensais reais (ou base de R$ 1000 se 0)
  const baseExpenseForEmergency = totalExpenses > 0 ? totalExpenses : 2000;
  const emergencyFund3 = baseExpenseForEmergency * 3;
  const emergencyFund6 = baseExpenseForEmergency * 6;
  const emergencyFund12 = baseExpenseForEmergency * 12;

  let monthsToReach6 = 0;
  if (monthlySurplus > 0) {
    monthsToReach6 = Math.ceil(emergencyFund6 / monthlySurplus);
  }

  return {
    year: targetYear,
    month: targetMonth,
    totalIncome,
    totalExpenses,
    monthlySurplus,
    savingsRatePercentage: Math.max(0, savingsRatePercentage),
    isDeficit,
    essentialNeeds,
    wantsAndLifestyle,
    idealInvestments,
    recommendedEmergencyFund: {
      months3: emergencyFund3,
      months6: emergencyFund6,
      months12: emergencyFund12,
    },
    monthsToReachEmergencyFund6Months: monthsToReach6,
  };
}

export interface SimulationResult {
  months: number;
  years: number;
  totalInvested: number;
  totalInterest: number;
  finalTotal: number;
  monthlyPassiveIncomeEstimate: number; // Renda passiva mensal futura
  realGainAboveInflation: number; // Ganho real acima do IPCA
  gainMultiplier: number; // finalTotal / totalInvested
}

/**
 * Calcula a projeção de juros compostos com aportes mensais
 * Fórmula padrão do mercado:
 * VF = P * (1 + i)^n + PMT * [((1 + i)^n - 1) / i]
 */
export function calculateCompoundSimulation(
  initialAmount: number,
  monthlyContribution: number,
  annualRatePercent: number,
  months: number,
  inflationRatePercent: number = MARKET_BENCHMARKS.ipcaInflation
): SimulationResult {
  const safeInitial = Math.max(0, initialAmount || 0);
  const safeMonthly = Math.max(0, monthlyContribution || 0);
  const safeMonths = Math.max(1, months || 1);

  // Taxa mensal efetiva: (1 + i_ano)^(1/12) - 1
  const annualDecimal = annualRatePercent / 100;
  const monthlyRate = Math.pow(1 + annualDecimal, 1 / 12) - 1;

  // Valor Futuro do Aporte Inicial
  const futureInitial = safeInitial * Math.pow(1 + monthlyRate, safeMonths);

  // Valor Futuro dos Aportes Mensais
  let futureMonthlySeries = 0;
  if (monthlyRate > 0) {
    futureMonthlySeries = safeMonthly * ((Math.pow(1 + monthlyRate, safeMonths) - 1) / monthlyRate);
  } else {
    futureMonthlySeries = safeMonthly * safeMonths;
  }

  const finalTotal = futureInitial + futureMonthlySeries;
  const totalInvested = safeInitial + (safeMonthly * safeMonths);
  const totalInterest = Math.max(0, finalTotal - totalInvested);

  // Renda passiva mensal estimada gerada por esse patrimônio (à taxa de ~0.8% a.m. ou taxa mensal do perfil)
  const monthlyPassiveIncomeEstimate = finalTotal * monthlyRate;

  // Taxa real anual: ((1 + i) / (1 + ipca)) - 1
  const inflationDecimal = inflationRatePercent / 100;
  const realAnnualRate = ((1 + annualDecimal) / (1 + inflationDecimal)) - 1;
  const realGainAboveInflation = realAnnualRate * 100;

  const gainMultiplier = totalInvested > 0 ? finalTotal / totalInvested : 1;

  return {
    months: safeMonths,
    years: Number((safeMonths / 12).toFixed(1)),
    totalInvested,
    totalInterest,
    finalTotal,
    monthlyPassiveIncomeEstimate,
    realGainAboveInflation,
    gainMultiplier,
  };
}

export interface ComparativeSimulationItem {
  key: string;
  name: string;
  annualRate: number;
  finalTotal: number;
  totalInterest: number;
  totalInvested: number;
  monthlyPassiveIncome: number;
  differenceVsPoupanca: number;
}

/**
 * Compara lado a lado Poupança, Conservador, Moderado e Arrojado
 */
export function getComparativeSimulation(
  initialAmount: number,
  monthlyContribution: number,
  months: number
): {
  items: ComparativeSimulationItem[];
  poupancaResult: SimulationResult;
  conservadorResult: SimulationResult;
  moderadoResult: SimulationResult;
  arrojadoResult: SimulationResult;
} {
  const poupanca = calculateCompoundSimulation(
    initialAmount,
    monthlyContribution,
    MARKET_BENCHMARKS.poupancaRate,
    months
  );

  const conservador = calculateCompoundSimulation(
    initialAmount,
    monthlyContribution,
    10.75,
    months
  );

  const moderado = calculateCompoundSimulation(
    initialAmount,
    monthlyContribution,
    12.50,
    months
  );

  const arrojado = calculateCompoundSimulation(
    initialAmount,
    monthlyContribution,
    15.00,
    months
  );

  const items: ComparativeSimulationItem[] = [
    {
      key: 'poupanca',
      name: 'Poupança Tradicional',
      annualRate: MARKET_BENCHMARKS.poupancaRate,
      finalTotal: poupanca.finalTotal,
      totalInterest: poupanca.totalInterest,
      totalInvested: poupanca.totalInvested,
      monthlyPassiveIncome: poupanca.monthlyPassiveIncomeEstimate,
      differenceVsPoupanca: 0,
    },
    {
      key: 'conservador',
      name: 'Nível 1: Conservador',
      annualRate: 10.75,
      finalTotal: conservador.finalTotal,
      totalInterest: conservador.totalInterest,
      totalInvested: conservador.totalInvested,
      monthlyPassiveIncome: conservador.monthlyPassiveIncomeEstimate,
      differenceVsPoupanca: conservador.finalTotal - poupanca.finalTotal,
    },
    {
      key: 'moderado',
      name: 'Nível 2: Moderado',
      annualRate: 12.50,
      finalTotal: moderado.finalTotal,
      totalInterest: moderado.totalInterest,
      totalInvested: moderado.totalInvested,
      monthlyPassiveIncome: moderado.monthlyPassiveIncomeEstimate,
      differenceVsPoupanca: moderado.finalTotal - poupanca.finalTotal,
    },
    {
      key: 'arrojado',
      name: 'Nível 3: Arrojado',
      annualRate: 15.00,
      finalTotal: arrojado.finalTotal,
      totalInterest: arrojado.totalInterest,
      totalInvested: arrojado.totalInvested,
      monthlyPassiveIncome: arrojado.monthlyPassiveIncomeEstimate,
      differenceVsPoupanca: arrojado.finalTotal - poupanca.finalTotal,
    },
  ];

  return {
    items,
    poupancaResult: poupanca,
    conservadorResult: conservador,
    moderadoResult: moderado,
    arrojadoResult: arrojado,
  };
}
