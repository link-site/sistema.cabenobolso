import { Transaction, CreditCard, CardPurchase } from '../types';
import { MONTH_NAMES, formatCurrency, parseDateMonthYear } from './formatters';
import { isCardTransaction, getCardInvoiceForMonthYear } from './creditCardSync';

export interface FinanceDataSnapshot {
  transactions: Transaction[];
  cards: CreditCard[];
  cardPurchases: CardPurchase[];
  userName?: string;
}

export interface QueryResult {
  text: string;
  matchedIntent: string;
  details?: Record<string, any>;
}

// Mapeamento de nomes de meses em português e variações
const MONTH_MAP: Record<string, number> = {
  janeiro: 0,
  jan: 0,
  fevereiro: 1,
  fev: 1,
  março: 2,
  marco: 2,
  mar: 2,
  abril: 3,
  abr: 3,
  maio: 4,
  mai: 4,
  junho: 5,
  jun: 5,
  julho: 6,
  jul: 6,
  agosto: 7,
  ago: 7,
  setembro: 8,
  set: 8,
  outubro: 9,
  out: 9,
  novembro: 10,
  nov: 10,
  dezembro: 11,
  dez: 11,
};

/**
 * Normaliza texto para busca (minúsculas, sem acentos gráficos)
 */
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Extrai o mês e ano mencionados em uma frase em linguagem natural.
 * Se nenhum mês for especificado, retorna o mês atual (ou próximo se solicitado).
 */
export function extractMonthAndYearFromText(text: string): { month: number; year: number; foundExplicitMonth: boolean } {
  const norm = normalizeText(text);
  const current = new Date();
  let year = current.getFullYear();
  let month = current.getMonth();
  let foundExplicitMonth = false;

  // Busca ano de 4 dígitos entre 2024 e 2035
  const yearMatch = norm.match(/\b(202[4-9]|203[0-5])\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // Busca menção de mês por extenso ou abreviação
  for (const [key, val] of Object.entries(MONTH_MAP)) {
    // Garante que é uma palavra isolada
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(norm)) {
      month = val;
      foundExplicitMonth = true;
      break;
    }
  }

  // Busca padrão numérico "mês 11" ou "mes 11" ou "/11"
  if (!foundExplicitMonth) {
    const numMonthMatch = norm.match(/\bm[eê]s\s*([0-9]{1,2})\b/i) || norm.match(/\/([0-9]{2})\b/);
    if (numMonthMatch) {
      const parsed = parseInt(numMonthMatch[1], 10);
      if (parsed >= 1 && parsed <= 12) {
        month = parsed - 1;
        foundExplicitMonth = true;
      }
    }
  }

  // Busca termos relativos "proximo mes", "mes que vem", "mes seguinte"
  if (!foundExplicitMonth) {
    if (norm.includes('proximo mes') || norm.includes('mes que vem') || norm.includes('mes seguinte')) {
      month = current.getMonth() + 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      foundExplicitMonth = true;
    } else if (norm.includes('mes passado') || norm.includes('mes anterior')) {
      month = current.getMonth() - 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      foundExplicitMonth = true;
    }
  }

  return { month, year, foundExplicitMonth };
}

/**
 * Calcula o resumo detalhado do orçamento para determinado mês e ano
 */
export function calculateBudgetForMonth(
  transactions: Transaction[],
  cards: CreditCard[],
  cardPurchases: CardPurchase[],
  year: number,
  month: number
) {
  const monthTxs = (transactions || []).filter((tx) => {
    const parsed = parseDateMonthYear(tx.date);
    return parsed.year === year && parsed.month === month;
  });

  const salaries = monthTxs.filter((tx) => tx.type === 'salario');
  const regularExpenses = monthTxs.filter((tx) => tx.type === 'gasto');

  const totalSalarios = salaries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalSalariosRecebidos = salaries
    .filter((tx) => tx.status === 'Recebido')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  let totalGastos = regularExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalGastosPagos = regularExpenses
    .filter((tx) => tx.status === 'Pago')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Faturas dos cartões de crédito para este mês
  const cardInvoicesDetails: { cardName: string; amount: number; dueDay?: number; status: string }[] = [];

  (cards || []).forEach((card) => {
    const existingTx = monthTxs.find((tx) => isCardTransaction(tx, card));
    let invoiceAmount = 0;
    let isPaid = false;

    if (existingTx) {
      invoiceAmount = Number(existingTx.amount) || 0;
      isPaid = existingTx.status === 'Pago';
    } else {
      invoiceAmount = getCardInvoiceForMonthYear(card, cardPurchases, year, month);
      // Se não havia transação no orçamento, inclui na soma total de gastos
      if (invoiceAmount > 0) {
        totalGastos += invoiceAmount;
      }
    }

    if (invoiceAmount > 0) {
      cardInvoicesDetails.push({
        cardName: card.name,
        amount: invoiceAmount,
        dueDay: card.dueDay,
        status: isPaid ? 'Pago' : 'Não Pago',
      });
    }
  });

  const isOverBudget = totalGastos > totalSalarios;
  const diferenca = Math.abs(totalSalarios - totalGastos);
  const valorDisponivel = isOverBudget ? 0 : diferenca;
  const valorUltrapassou = isOverBudget ? diferenca : 0;

  return {
    year,
    month,
    monthName: MONTH_NAMES[month],
    totalSalarios,
    totalSalariosRecebidos,
    salariesCount: salaries.length,
    salaries,
    totalGastos,
    totalGastosPagos,
    regularExpensesCount: regularExpenses.length,
    regularExpenses,
    cardInvoicesDetails,
    isOverBudget,
    valorDisponivel,
    valorUltrapassou,
  };
}

/**
 * Processador central das consultas do Telegram Bot
 */
export function processTelegramQuery(
  rawQuery: string,
  data: FinanceDataSnapshot
): QueryResult {
  const query = (rawQuery || '').trim();
  const norm = normalizeText(query);
  const { transactions = [], cards = [], cardPurchases = [] } = data;

  // 1. Comando START ou AJUDA / HELP ou SAUDAÇÕES (oi, olá, bom dia, etc.)
  const isGreeting =
    norm === 'oi' ||
    norm.startsWith('oi ') ||
    norm.startsWith('oi!') ||
    norm.startsWith('oi,') ||
    norm === 'ola' ||
    norm.startsWith('ola ') ||
    norm.startsWith('ola!') ||
    norm.startsWith('ola,') ||
    norm === 'olá' ||
    norm.startsWith('olá ') ||
    norm.startsWith('olá!') ||
    norm.startsWith('olá,') ||
    norm.startsWith('/start') ||
    norm.startsWith('/help') ||
    norm.startsWith('/ajuda') ||
    norm.startsWith('/menu') ||
    norm.startsWith('/comandos') ||
    norm === 'bom dia' ||
    norm.startsWith('bom dia') ||
    norm === 'boa tarde' ||
    norm.startsWith('boa tarde') ||
    norm === 'boa noite' ||
    norm.startsWith('boa noite') ||
    norm === 'opa' ||
    norm.startsWith('opa ') ||
    norm === 'e ai' ||
    norm === 'e aí' ||
    norm.includes('como funciona') ||
    norm.includes('o que você faz') ||
    norm.includes('o que voce faz') ||
    norm === 'menu' ||
    norm === 'comandos';

  if (isGreeting) {
    const current = new Date();
    const curMonthName = MONTH_NAMES[current.getMonth()];
    const nextMonthIndex = (current.getMonth() + 1) % 12;
    const nextMonthName = MONTH_NAMES[nextMonthIndex];

    const text =
      `🤖 *Olá! Eu sou o assistente do Sistema Cabe no Bolso.*\n\n` +
      `Tenho *acesso total e em tempo real* ao seu *Menu Orçamento* e *Menu Cartões de Crédito*!\n\n` +
      `💡 *Você pode me perguntar livremente coisas como:*\n` +
      `• "Qual valor disponível no mês de novembro?"\n` +
      `• "Quanto sobrou no mês de ${curMonthName.toLowerCase()}?"\n` +
      `• "Quais os gastos de ${nextMonthName.toLowerCase()}?"\n` +
      `• "Qual o valor da fatura do cartão?"\n` +
      `• "Quais são os meus cartões de crédito?"\n` +
      `• "Quanto tenho de salário em ${curMonthName.toLowerCase()}?"\n` +
      `• "Resumo do orçamento"\n\n` +
      `📌 *Ou use os comandos rápidos:*\n` +
      `• /disponivel - Saldo livre deste mês\n` +
      `• /orcamento - Resumo do orçamento completo\n` +
      `• /cartoes - Faturas e limites de todos os cartões\n` +
      `• /salarios - Receitas cadastradas\n` +
      `• /gastos - Despesas e contas a pagar`;

    return { text, matchedIntent: 'help' };
  }

  // 2. DISPONÍVEL / SALDO / SOBRA NO ORÇAMENTO (O exemplo principal do usuário!)
  const isAskingDisponivel =
    norm.includes('disponivel') ||
    norm.includes('disponível') ||
    norm.includes('sobra') ||
    norm.includes('sobrou') ||
    norm.includes('saldo') ||
    norm.includes('livre') ||
    norm.startsWith('/disponivel');

  const { month, year, foundExplicitMonth } = extractMonthAndYearFromText(query);

  if (isAskingDisponivel) {
    const budget = calculateBudgetForMonth(transactions, cards, cardPurchases, year, month);

    let statusLine = '';
    if (budget.isOverBudget) {
      statusLine =
        `🚨 *STATUS: ULTRAPASSOU O ORÇAMENTO!*\n` +
        `⚠️ *Valor Ultrapassado:* ${formatCurrency(budget.valorUltrapassou)}\n` +
        `❌ _Seus gastos superaram seus salários neste mês._`;
    } else {
      statusLine =
        `✅ *VALOR DISPONÍVEL:* ${formatCurrency(budget.valorDisponivel)}\n` +
        `🎉 _Parabéns! Este é o valor livre disponível para investir ou poupar._`;
    }

    let cardsLine = '';
    if (budget.cardInvoicesDetails.length > 0) {
      cardsLine =
        `\n💳 *Faturas de Cartões no mês:*\n` +
        budget.cardInvoicesDetails
          .map((c) => `  • ${c.cardName}: ${formatCurrency(c.amount)} (${c.status})`)
          .join('\n');
    }

    const text =
      `📊 *Orçamento — ${budget.monthName}/${budget.year}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *Total de Salários:* ${formatCurrency(budget.totalSalarios)}\n` +
      `💸 *Total de Gastos:* ${formatCurrency(budget.totalGastos)}\n` +
      cardsLine +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      statusLine;

    return {
      text,
      matchedIntent: 'budget_disponivel',
      details: { month: budget.monthName, year: budget.year, disponivel: budget.valorDisponivel },
    };
  }

  // 3. CARTÕES DE CRÉDITO / FATURAS / LIMITES
  const isAskingCards =
    norm.includes('cartao') ||
    norm.includes('cartão') ||
    norm.includes('cartoes') ||
    norm.includes('cartões') ||
    norm.includes('fatura') ||
    norm.includes('limite') ||
    norm.startsWith('/cartoes') ||
    norm.startsWith('/fatura');

  if (isAskingCards) {
    if (cards.length === 0) {
      return {
        text: '💳 *Nenhum cartão de crédito cadastrado.* Você pode adicionar cartões no menu "Cartões de Crédito" do sistema.',
        matchedIntent: 'cards_empty',
      };
    }

    // Verifica se o usuário mencionou um cartão específico pelo nome (ex: Nubank, Atacadão, Inter)
    const specificCard = cards.find((c) => norm.includes(normalizeText(c.name)));

    if (specificCard) {
      const invoiceMonth = foundExplicitMonth ? month : new Date().getMonth();
      const invoiceYear = foundExplicitMonth ? year : new Date().getFullYear();
      const invoice = getCardInvoiceForMonthYear(specificCard, cardPurchases, invoiceYear, invoiceMonth);

      const purchasesForCard = cardPurchases.filter((p) => p.cardId === specificCard.id);
      const remainingLimit = Math.max(0, (specificCard.limit || 0) - invoice);

      let text =
        `💳 *Cartão: ${specificCard.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 *Mês de Referência:* ${MONTH_NAMES[invoiceMonth]}/${invoiceYear}\n` +
        `🧾 *Valor da Fatura:* ${formatCurrency(invoice)}\n` +
        `🎯 *Limite Total:* ${formatCurrency(specificCard.limit || 0)}\n` +
        `🟢 *Limite Disponível estimado:* ${formatCurrency(remainingLimit)}\n` +
        `📆 *Vencimento:* Dia ${specificCard.dueDay || specificCard.dueDate || 'Não definido'}\n` +
        `✂️ *Fechamento:* Dia ${specificCard.closingDay || 'Não definido'}\n`;

      if (purchasesForCard.length > 0) {
        text += `\n🛍️ *Total de compras cadastradas:* ${purchasesForCard.length}`;
        const topPurchases = purchasesForCard.slice(0, 3);
        text += '\n' + topPurchases.map((p) => `  • ${p.name}: ${formatCurrency(p.installmentAmount)} (${p.currentInstallment}/${p.installmentCount}x)`).join('\n');
      }

      return { text, matchedIntent: 'card_specific', details: { card: specificCard.name, invoice } };
    }

    // Resumo de todos os cartões cadastrados
    const invoiceMonth = foundExplicitMonth ? month : new Date().getMonth();
    const invoiceYear = foundExplicitMonth ? year : new Date().getFullYear();

    let totalAllInvoices = 0;
    const cardsListText = cards
      .map((c) => {
        const inv = getCardInvoiceForMonthYear(c, cardPurchases, invoiceYear, invoiceMonth);
        totalAllInvoices += inv;
        return (
          `💳 *${c.name}*\n` +
          `  • Fatura (${MONTH_NAMES[invoiceMonth]}): ${formatCurrency(inv)}\n` +
          `  • Limite: ${formatCurrency(c.limit || 0)} (Vence dia ${c.dueDay || c.dueDate || 'N/A'})\n`
        );
      })
      .join('\n');

    const text =
      `💳 *Seus Cartões de Crédito — ${MONTH_NAMES[invoiceMonth]}/${invoiceYear}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      cardsListText +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🧾 *Total de todas as faturas:* ${formatCurrency(totalAllInvoices)}\n\n` +
      `💡 _Para consultar um cartão específico, envie por exemplo: "Fatura do cartão ${cards[0].name}"_`;

    return { text, matchedIntent: 'cards_all', details: { totalInvoices: totalAllInvoices } };
  }

  // 4. SALÁRIOS / RECEITAS
  const isAskingSalaries =
    norm.includes('salario') ||
    norm.includes('salário') ||
    norm.includes('ganho') ||
    norm.includes('ganhos') ||
    norm.includes('receita') ||
    norm.includes('receber') ||
    norm.startsWith('/salarios');

  if (isAskingSalaries) {
    const budget = calculateBudgetForMonth(transactions, cards, cardPurchases, year, month);

    if (budget.salaries.length === 0) {
      return {
        text: `💰 *Nenhum salário cadastrado para ${budget.monthName}/${budget.year}.*\nVocê pode cadastrar no menu "Orçamento Mensal".`,
        matchedIntent: 'salaries_empty',
      };
    }

    const itemsText = budget.salaries
      .map((s) => `  • ${s.name}: ${formatCurrency(s.amount)} [${s.status}] (${s.tag})`)
      .join('\n');

    const text =
      `💰 *Salários & Receitas — ${budget.monthName}/${budget.year}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      itemsText +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💵 *Total de Salários:* ${formatCurrency(budget.totalSalarios)}\n` +
      `✅ *Já Recebido:* ${formatCurrency(budget.totalSalariosRecebidos)}`;

    return { text, matchedIntent: 'salaries_list', details: { totalSalarios: budget.totalSalarios } };
  }

  // 5. GASTOS / DESPESAS DO MÊS
  const isAskingExpenses =
    norm.includes('gasto') ||
    norm.includes('gastos') ||
    norm.includes('despesa') ||
    norm.includes('despesas') ||
    norm.includes('contas') ||
    norm.includes('pagar') ||
    norm.startsWith('/gastos');

  if (isAskingExpenses) {
    const budget = calculateBudgetForMonth(transactions, cards, cardPurchases, year, month);

    const regularList = budget.regularExpenses
      .slice(0, 8)
      .map((g) => `  • ${g.name}: ${formatCurrency(g.amount)} [${g.status}]`)
      .join('\n');

    const extra = budget.regularExpenses.length > 8 ? `\n  _... e mais ${budget.regularExpenses.length - 8} despesas._` : '';

    let cardsSection = '';
    if (budget.cardInvoicesDetails.length > 0) {
      cardsSection =
        `\n💳 *Faturas dos Cartões:* \n` +
        budget.cardInvoicesDetails.map((c) => `  • ${c.cardName}: ${formatCurrency(c.amount)}`).join('\n') +
        `\n`;
    }

    const text =
      `💸 *Gastos & Despesas — ${budget.monthName}/${budget.year}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (regularList ? `📋 *Contas Fixas & Variáveis:*\n${regularList}${extra}\n` : '') +
      cardsSection +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🧾 *Total de Gastos:* ${formatCurrency(budget.totalGastos)}\n` +
      `💰 *Total de Salários:* ${formatCurrency(budget.totalSalarios)}\n` +
      (budget.isOverBudget
        ? `⚠️ *Ultrapassou em:* ${formatCurrency(budget.valorUltrapassou)}`
        : `✅ *Disponível no mês:* ${formatCurrency(budget.valorDisponivel)}`);

    return { text, matchedIntent: 'expenses_list', details: { totalGastos: budget.totalGastos } };
  }

  // 6. ORÇAMENTO GERAL OU SE APENAS UM MÊS FOI DIGITADO (ex: "novembro", "orcamento de outubro", "/orcamento")
  if (foundExplicitMonth || norm.includes('orcamento') || norm.includes('orçamento') || norm.startsWith('/orcamento')) {
    const budget = calculateBudgetForMonth(transactions, cards, cardPurchases, year, month);

    const text =
      `📑 *Resumo do Orçamento — ${budget.monthName}/${budget.year}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *Salários:* ${formatCurrency(budget.totalSalarios)} (${budget.salariesCount} cadastrados)\n` +
      `💸 *Gastos Totais:* ${formatCurrency(budget.totalGastos)} (${budget.regularExpensesCount} despesas)\n` +
      `💳 *Cartões de Crédito:* ${budget.cardInvoicesDetails.length} com faturas no mês\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (budget.isOverBudget
        ? `🚨 *Status:* Ultrapassou em ${formatCurrency(budget.valorUltrapassou)}`
        : `✅ *Valor Disponível:* ${formatCurrency(budget.valorDisponivel)}`);

    return { text, matchedIntent: 'budget_summary', details: { month: budget.monthName, year: budget.year } };
  }

  // 7. FALLBACK INTELIGENTE: Resumo do mês atual com sugestões
  const current = new Date();
  const curBudget = calculateBudgetForMonth(transactions, cards, cardPurchases, current.getFullYear(), current.getMonth());

  const fallbackText =
    `🤔 Não compreendi exatamente a pergunta.\n\n` +
    `Aqui está o seu resumo de *${curBudget.monthName}/${curBudget.year}*:\n` +
    `• Salários: ${formatCurrency(curBudget.totalSalarios)}\n` +
    `• Gastos: ${formatCurrency(curBudget.totalGastos)}\n` +
    `• *Disponível:* ${formatCurrency(curBudget.valorDisponivel)}\n\n` +
    `💡 *Exemplos de como me perguntar:*\n` +
    `• "Qual valor disponível no mês de novembro?"\n` +
    `• "Qual a fatura do cartão Nubank?"\n` +
    `• "Quanto gastei em outubro?"\n` +
    `• Envie /ajuda para ver todos os comandos.`;

  return { text: fallbackText, matchedIntent: 'fallback' };
}
