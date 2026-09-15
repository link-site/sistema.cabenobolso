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
