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
  cardId?: string; // ID do cartão de crédito quando a movimentação for uma fatura
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
  dueDay?: number; // Dia do vencimento (1 a 31)
  closingDay?: number; // Dia do fechamento (1 a 31)
  tag: string; // Always "Cartão de crédito"
  color?: string;
  paidThisMonth?: boolean;
}

export interface CardPurchase {
  id: string;
  cardId: string;
  name: string; // Nome da compra
  totalAmount: number; // Valor total da compra
  installmentAmount: number; // Valor de cada parcela
  installmentCount: number; // Total de parcelas (ex: 3)
  currentInstallment: number; // Parcela atual (ex: 1, 2, 3)
  purchaseDate: string; // Data da compra YYYY-MM-DD
  billingDate: string; // Mês/data de vencimento da parcela YYYY-MM-DD
  purchaseGroupId: string; // ID comum para agrupar todas as parcelas
  category?: string;
  notes?: string;
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
