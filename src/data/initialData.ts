import { Transaction, TagItem, CreditCard } from '../types';

export const DEFAULT_TAGS: TagItem[] = [
  // Tags para Salário
  { id: 'tag-sal-1', name: 'Salário Mensal', targetType: 'salario' },
  { id: 'tag-sal-2', name: 'Adiantamento', targetType: 'salario' },
  { id: 'tag-sal-3', name: 'Freelance / Renda Extra', targetType: 'salario' },
  { id: 'tag-sal-4', name: 'Investimentos', targetType: 'salario' },

  // Tags para Gastos
  { id: 'tag-gas-1', name: 'Moradia / Aluguel', targetType: 'gasto' },
  { id: 'tag-gas-2', name: 'Mercado / Alimentação', targetType: 'gasto' },
  { id: 'tag-gas-3', name: 'Contas (Luz / Água / Net)', targetType: 'gasto' },
  { id: 'tag-gas-4', name: 'Transporte / Gasolina', targetType: 'gasto' },
  { id: 'tag-gas-5', name: 'Saúde & Farmácia', targetType: 'gasto' },
  { id: 'tag-gas-6', name: 'Lazer & Restaurantes', targetType: 'gasto' },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // Salários de exemplo para o mês atual (Setembro 2026)
  {
    id: 'tx-sal-1',
    type: 'salario',
    name: 'Salário Empresa Principal',
    amount: 5200.0,
    tag: 'Salário Mensal',
    date: '2026-09-05',
    status: 'Recebido',
  },
  {
    id: 'tx-sal-2',
    type: 'salario',
    name: 'Projeto Freelance Design',
    amount: 1450.0,
    tag: 'Freelance / Renda Extra',
    date: '2026-09-15',
    status: 'Não Recebido',
  },

  // Gastos de exemplo
  {
    id: 'tx-gas-1',
    type: 'gasto',
    name: 'Aluguel do Apartamento',
    amount: 1800.0,
    tag: 'Moradia / Aluguel',
    date: '2026-09-10',
    status: 'Pago',
  },
  {
    id: 'tx-gas-2',
    type: 'gasto',
    name: 'Supermercado Mensal',
    amount: 920.5,
    tag: 'Mercado / Alimentação',
    date: '2026-09-08',
    status: 'Pago',
  },
  {
    id: 'tx-gas-3',
    type: 'gasto',
    name: 'Conta de Energia Elétrica',
    amount: 215.3,
    tag: 'Contas (Luz / Água / Net)',
    date: '2026-09-18',
    status: 'Não pago',
  },
  {
    id: 'tx-gas-4',
    type: 'gasto',
    name: 'Plano de Saúde',
    amount: 450.0,
    tag: 'Saúde & Farmácia',
    date: '2026-09-22',
    status: 'Não pago',
  },
  {
    id: 'tx-gas-5',
    type: 'gasto',
    name: 'Combustível & Transporte',
    amount: 380.0,
    tag: 'Transporte / Gasolina',
    date: '2026-09-25',
    status: 'Não pago',
  },
];

export const INITIAL_CARDS: CreditCard[] = [
  {
    id: 'card-1',
    name: 'Nubank Roxinho',
    currentInvoice: 1420.8,
    limit: 5000.0,
    dueDate: '2026-09-12',
    tag: 'Cartão de crédito',
    color: '#8a05be',
    closingDay: 5,
    paidThisMonth: false,
  },
  {
    id: 'card-2',
    name: 'Inter Mastercard Black',
    currentInvoice: 890.4,
    limit: 8000.0,
    dueDate: '2026-09-20',
    tag: 'Cartão de crédito',
    color: '#ff7a00',
    closingDay: 13,
    paidThisMonth: true,
  },
];
