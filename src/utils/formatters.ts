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
 * Calculates the billing cycle { billingYear, billingMonth } (0-indexed month)
 * for a purchase date based on the credit card's closing day (1-31).
 *
 * - If closingDay === 1:
 *   Purchases in month M up to 01 of month M+1 belong to month M (e.g. 01/09 to 01/10 belong to September).
 *   On day 1 of month M (e.g. 01/10), it closes month M-1 (September).
 *   Purchases from 02/10 to 01/11 belong to October.
 * - If closingDay > 1 (e.g. 10, 15, 20, 25):
 *   Purchases in month M on day <= closingDay belong to month M.
 *   Purchases in month M on day > closingDay belong to month M + 1.
 */
export const calculateBillingCycle = (
  purchaseDateStr: string,
  closingDay: number = 1
): { billingYear: number; billingMonth: number } => {
  const parts = (purchaseDateStr || '').split('-');
  if (parts.length < 3) {
    const now = new Date();
    return { billingYear: now.getFullYear(), billingMonth: now.getMonth() };
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed: 0 = Jan, 8 = Sep
  const day = parseInt(parts[2], 10);

  const safeClosing = Math.max(1, Math.min(31, closingDay || 1));

  if (safeClosing === 1) {
    // User cycle example: "estamos no mês de setembro, ciclo começou 01/09 e termina 01/10"
    // Purchases on day 1 of month M (e.g. 01/10) belong to the cycle of month M-1 (September).
    // Purchases on days 2..31 of month M belong to month M.
    if (day === 1) {
      const prev = new Date(year, month - 1, 1);
      return { billingYear: prev.getFullYear(), billingMonth: prev.getMonth() };
    } else {
      return { billingYear: year, billingMonth: month };
    }
  } else {
    // Standard credit card cutoff:
    // If purchase day <= closing day, it belongs to the current month's invoice.
    // If purchase day > closing day, invoice is closed, it belongs to next month's invoice.
    if (day <= safeClosing) {
      return { billingYear: year, billingMonth: month };
    } else {
      const next = new Date(year, month + 1, 1);
      return { billingYear: next.getFullYear(), billingMonth: next.getMonth() };
    }
  }
};

