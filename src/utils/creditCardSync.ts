import { CreditCard, CardPurchase, Transaction } from '../types';
import { parseDateMonthYear } from './formatters';

/**
 * Verifica com precisão se uma transação de movimentação representa a fatura de um determinado cartão de crédito.
 */
export function isCardTransaction(tx: Transaction, card: CreditCard): boolean {
  if (tx.type !== 'gasto') return false;

  // 1. Vínculo direto por ID
  if (tx.cardId && tx.cardId === card.id) {
    return true;
  }

  // 2. Se a tag for Cartão de crédito, confere o nome do cartão ou notas
  const txName = (tx.name || '').trim().toLowerCase();
  const cardName = (card.name || '').trim().toLowerCase();

  if (!cardName) return false;

  // Remove prefixos comuns como "Fatura", "Fatura Cartão", "Fatura do cartão"
  const cleanTxName = txName
    .replace(/^fatura\s+(do\s+cart[aã]o\s+|cart[aã]o\s+)?/i, '')
    .trim();

  const isTagCreditCard =
    (tx.tag || '').trim().toLowerCase() === 'cartão de crédito' ||
    (tx.tag || '').trim().toLowerCase() === 'cartao de credito';

  if (isTagCreditCard) {
    if (txName.includes(cardName) || cleanTxName === cardName || cardName.includes(cleanTxName)) {
      return true;
    }
  }

  // Confere se o nome da transação começa com "Fatura <NomeDoCartão>"
  if (txName.startsWith(`fatura ${cardName}`) || txName.startsWith(`fatura cartão ${cardName}`)) {
    return true;
  }

  // Confere nas notas se foi importada daquele cartão
  if (tx.notes && tx.notes.toLowerCase().includes(`cartão ${cardName}`)) {
    return true;
  }

  return false;
}

/**
 * Calcula o valor exato da fatura de um cartão de crédito para determinado mês e ano (mês 0-indexed: 0 = Jan, 8 = Set).
 * Se o cartão possuir compras/parcelas cadastradas, soma as parcelas com vencimento naquele mês.
 * Se o cartão ainda não possuir nenhuma compra cadastrada no sistema, utiliza o currentInvoice como valor base.
 */
export function getCardInvoiceForMonthYear(
  card: CreditCard,
  cardPurchases: CardPurchase[],
  year: number,
  month: number
): number {
  const purchasesForCard = cardPurchases.filter((p) => p.cardId === card.id);

  if (purchasesForCard.length > 0) {
    const monthPurchases = purchasesForCard.filter((p) => {
      const pDate = parseDateMonthYear(p.billingDate || p.purchaseDate);
      return pDate.year === year && pDate.month === month;
    });
    return monthPurchases.reduce((sum, item) => sum + item.installmentAmount, 0);
  }

  return card.currentInvoice || 0;
}

/**
 * Localiza a transação correspondente à fatura do cartão em um determinado mês e ano.
 */
export function findCardTransactionForMonth(
  transactions: Transaction[],
  card: CreditCard,
  year: number,
  month: number
): Transaction | undefined {
  return transactions.find((tx) => {
    const { year: txYear, month: txMonth } = parseDateMonthYear(tx.date);
    if (txYear !== year || txMonth !== month) return false;
    return isCardTransaction(tx, card);
  });
}
