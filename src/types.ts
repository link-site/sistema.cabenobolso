export type MenuTab = 'dashboard' | 'orcamento' | 'cartoes' | 'relatorios';

export type TransactionType = 'salario' | 'gasto';

export type SalaryStatus = 'Não Recebido' | 'Recebido';
export type ExpenseStatus = 'Não pago' | 'Pago';

export interface Transaction {
  id: string;
  type: TransactionType;
  name: string;
  amount: number; // in Reais, e.g. 1500.50
  tag: string;
  date: string; // YYYY-MM-DD
  status: SalaryStatus | ExpenseStatus;
  notes?: string;
}

export interface TagItem {
  id: string;
  name: string;
  targetType: TransactionType; // 'salario' or 'gasto'
}

export interface CreditCard {
  id: string;
  name: string;
  currentInvoice: number; // Valor da fatura
  limit: number; // Limite do cartão
  dueDate: string; // Day of month or YYYY-MM-DD
  tag: string; // Always "Cartão de crédito"
  color?: string;
  closingDay?: number;
  paidThisMonth?: boolean;
}

export type SortField = 'name' | 'amount' | 'tag' | 'date';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface AuthorizedEmail {
  id: string; // Normalized lowercase email
  email: string;
  role: 'admin' | 'user';
  addedBy: string;
  createdAt: string;
  notes?: string;
}

export const MASTER_ADMIN_EMAIL = 'sousaleidiane242025@gmail.com';
