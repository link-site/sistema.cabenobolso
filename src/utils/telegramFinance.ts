import { Transaction, CreditCard, CardPurchase } from '../types';
import {
  formatCurrency,
  parseDateMonthYear,
  getNextMonthBudget,
  MONTH_NAMES,
} from './formatters';
import { isCardTransaction, getCardInvoiceForMonthYear } from './creditCardSync';

export interface TelegramBudgetSummary {
  year: number;
  month: number; // 0-indexed: 9 = Outubro, 10 = Novembro
  monthName: string;
  totalSalario: number;
  totalGastos: number;
  availableAmount: number; // Salário - Gastos
  isOverBudget: boolean;
  salariesCount: number;
  expensesCount: number;
  salariesList: Transaction[];
  expensesList: Transaction[];
}

/**
 * Calcula os valores consolidados de Disponível / Gastos / Salários do Menu Orçamento Mensal
 * para o mês seguinte ao mês atual (Regra: se estamos em Outubro, calcula o mês de Novembro).
 */
export function calculateTelegramBudgetSummary(
  transactions: Transaction[],
  cards: CreditCard[] = [],
  cardPurchases: CardPurchase[] = []
): TelegramBudgetSummary {
  // Mês seguinte conforme a regra do Menu Orçamento:
  // Se estamos em Outubro (mês calendário 9), retorna Novembro (mês 10)
  const target = getNextMonthBudget();
  const targetYear = target.year;
  const targetMonth = target.month;
  const monthName = MONTH_NAMES[targetMonth] || '';

  // Filtra as transações correspondentes ao mês e ano alvo
  const monthTransactions = transactions.filter((tx) => {
    const { year, month } = parseDateMonthYear(tx.date);
    return year === targetYear && month === targetMonth;
  });

  // Salários do mês
  const salariesList = monthTransactions.filter((tx) => tx.type === 'salario');
  const totalSalario = salariesList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Gastos do mês cadastrados em movimentações
  const expensesList = monthTransactions.filter((tx) => tx.type === 'gasto');
  let totalGastos = expensesList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Garante que as faturas dos cartões de crédito para esse mês estejam computadas nos gastos,
  // exatamente como o Menu Orçamento faz quando sincroniza os cartões
  cards.forEach((card) => {
    const hasCardTx = expensesList.some((tx) => isCardTransaction(tx, card));
    if (!hasCardTx) {
      const invoiceAmount = getCardInvoiceForMonthYear(
        card,
        cardPurchases,
        targetYear,
        targetMonth
      );
      if (invoiceAmount > 0) {
        totalGastos += invoiceAmount;
      }
    }
  });

  const isOverBudget = totalGastos > totalSalario;
  const rawDiff = totalSalario - totalGastos;
  const availableAmount = isOverBudget ? 0 : rawDiff;

  return {
    year: targetYear,
    month: targetMonth,
    monthName,
    totalSalario,
    totalGastos,
    availableAmount,
    isOverBudget,
    salariesCount: salariesList.length,
    expensesCount: expensesList.length,
    salariesList,
    expensesList,
  };
}

/**
 * Monta o texto da mensagem formatada para envio ao Telegram com os dados do Menu Orçamento.
 */
export function buildTelegramMessage(
  summary: TelegramBudgetSummary,
  customTemplate?: string
): string {
  const formattedAvailable = formatCurrency(summary.availableAmount);
  const formattedSalario = formatCurrency(summary.totalSalario);
  const formattedGastos = formatCurrency(summary.totalGastos);
  const statusLabel = summary.isOverBudget ? 'Ultrapassou' : 'Disponível';

  if (customTemplate && customTemplate.trim()) {
    return customTemplate
      .replace(/{valor}/gi, formattedAvailable)
      .replace(/{mes}/gi, summary.monthName)
      .replace(/{ano}/gi, String(summary.year))
      .replace(/{salario}/gi, formattedSalario)
      .replace(/{gastos}/gi, formattedGastos)
      .replace(/{status}/gi, statusLabel);
  }

  // Modelo padrão solicitado pelo usuário:
  // "Você tem esse valor disponivel para gastar" com os dados do Menu Orçamento Mensal
  if (summary.isOverBudget) {
    const diffUltrapassou = formatCurrency(summary.totalGastos - summary.totalSalario);
    return (
      `⚠️ *Sistema Cabe no Bolso - Orçamento Mensal*\n\n` +
      `Atenção: Os gastos do orçamento ultrapassaram os salários:\n` +
      `👉 *Ultrapassou: ${diffUltrapassou}*\n\n` +
      `───────────────────────\n` +
      `📅 *Mês de Referência:* ${summary.monthName} / ${summary.year}\n` +
      `💵 *Salário Previsto:* ${formattedSalario}\n` +
      `💸 *Gastos Previstos:* ${formattedGastos}\n` +
      `📊 *Status:* Orçamento Ultrapassado\n\n` +
      `⏰ _Notificação diária do seu controle financeiro._`
    );
  }

  return (
    `💰 *Sistema Cabe no Bolso - Orçamento Mensal*\n\n` +
    `Você tem esse valor disponivel para gastar:\n` +
    `👉 *${formattedAvailable}*\n\n` +
    `───────────────────────\n` +
    `📅 *Mês de Referência:* ${summary.monthName} / ${summary.year}\n` +
    `💵 *Salário Previsto:* ${formattedSalario}\n` +
    `💸 *Gastos Previstos:* ${formattedGastos}\n` +
    `📊 *Status do Orçamento:* Disponível (${summary.salariesCount} salários / ${summary.expensesCount} gastos)\n\n` +
    `⏰ _Notificação diária do seu controle financeiro._`
  );
}
