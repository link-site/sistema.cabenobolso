export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export const MONTH_ABBR = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export const buildClampedDate = (year: number, monthIndex: number, day: number): string => {
  const maxDays = new Date(year, monthIndex + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, day), maxDays);
  const mStr = String(monthIndex + 1).padStart(2, '0');
  const dStr = String(clampedDay).padStart(2, '0');
  return `${year}-${mStr}-${dStr}`;
};

export const formatCurrency = (value: number): string => {
  if (isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const parseCurrencyInput = (value: string): number => {
  // Remove non-numeric characters except comma and dot
  const clean = value.replace(/[^\d,-]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  // handles YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export const getMonthYearString = (year: number, monthIndex: number): string => {
  return `${MONTH_NAMES[monthIndex]} de ${year}`;
};

export const parseDateMonthYear = (dateStr: string): { year: number; month: number } => {
  if (!dateStr) return { year: new Date().getFullYear(), month: new Date().getMonth() };
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // 0-indexed
    return { year: isNaN(y) ? 2026 : y, month: isNaN(m) ? 0 : m };
  }
  return { year: 2026, month: 8 };
};

export const YEARS_UP_TO_2030 = [2024, 2025, 2026, 2027, 2028, 2029, 2030] as const;

/**
 * Retorna o mês e ano ativo da fatura dos cartões de crédito.
 * Regra do sistema: No card do cartão o mês atual é sempre o mês seguinte ao mês calendário atual.
 * Exemplo: Se estamos em setembro (mês calendário 8), o mês atual da fatura do cartão é outubro (mês 9).
 */
export const getActiveCardBillingMonth = (
  baseDate: Date = new Date()
): { year: number; month: number } => {
  const calYear = baseDate.getFullYear();
  const calMonth = baseDate.getMonth(); // 0-indexed: 8 = Setembro
  const nextDate = new Date(calYear, calMonth + 1, 1);
  return {
    year: nextDate.getFullYear(),
    month: nextDate.getMonth(), // 9 = Outubro
  };
};

/**
 * Calcula o ciclo de fatura { billingYear, billingMonth } (mês 0-indexed)
 * para a data de uma compra com base no dia de fechamento do cartão (1-31).
 *
 * Regra do usuário:
 * "Todas as compras realizadas no mês até a data do fechamento entram no mesmo mês da compra
 * e compras realizadas após o fechamento entram no mês seguinte.
 * Ex: Fechamento todo dia primeiro, então de 01/09/2026 a 01/10/2026 todas as compras realizadas
 * entram no mês 10 que é o mês seguinte."
 */
export const calculateBillingCycle = (
  purchaseDateStr: string,
  closingDay: number = 1
): { billingYear: number; billingMonth: number } => {
  const parts = (purchaseDateStr || '').split('-');
  if (parts.length < 3) {
    const active = getActiveCardBillingMonth();
    return { billingYear: active.year, billingMonth: active.month };
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed: 0 = Jan, 8 = Sep
  const day = parseInt(parts[2], 10);

  const safeClosing = Math.max(1, Math.min(31, closingDay || 1));

  if (safeClosing === 1) {
    // Fechamento no dia 1:
    // Ex: compras em setembro (ex: 16/09) e até 01/10 entram na fatura do mês 10 (Outubro).
    // No dia 1 do mês M (ex: 01/10), encerra o ciclo de setembro e entra na fatura de Outubro (month).
    // Compras após o dia 1 do mês M (ex: 16/09) entram na fatura do mês seguinte M + 1 (Outubro).
    if (day <= 1) {
      return { billingYear: year, billingMonth: month };
    } else {
      const next = new Date(year, month + 1, 1);
      return { billingYear: next.getFullYear(), billingMonth: next.getMonth() };
    }
  } else {
    // Fechamento em outro dia (ex: dia 10, 15, 20):
    // Compras até o dia de fechamento entram na fatura deste mês.
    // Compras após o dia de fechamento entram na fatura do mês seguinte.
    if (day <= safeClosing) {
      return { billingYear: year, billingMonth: month };
    } else {
      const next = new Date(year, month + 1, 1);
      return { billingYear: next.getFullYear(), billingMonth: next.getMonth() };
    }
  }
};

