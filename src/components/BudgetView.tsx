import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Tag as TagIcon,
  CreditCard as CreditCardIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  Pencil,
} from 'lucide-react';
import {
  Transaction,
  TagItem,
  CreditCard,
  CardPurchase,
  SortField,
  SortDirection,
  TransactionType,
} from '../types';
import {
  formatCurrency,
  formatDateDisplay,
  MONTH_NAMES,
  parseDateMonthYear,
} from '../utils/formatters';
import {
  isCardTransaction,
  findCardTransactionForMonth,
  getCardInvoiceForMonthYear,
} from '../utils/creditCardSync';
import { AddTransactionModal } from './AddTransactionModal';
import { AddTagModal } from './AddTagModal';
import { ShowCreditCardsModal } from './ShowCreditCardsModal';

interface BudgetViewProps {
  transactions: Transaction[];
  tags: TagItem[];
  cards: CreditCard[];
  cardPurchases?: CardPurchase[];
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
  onAddTransactionsBatch?: (txs: Omit<Transaction, 'id'>[]) => void;
  onUpdateTransaction?: (id: string, updated: Partial<Transaction>) => void;
  onUpdateTransactionWithReplication?: (
    id: string,
    updated: Omit<Transaction, 'id'>,
    replicateMonths: { year: number; month: number }[],
    originalName?: string
  ) => void;
  onDeleteTransaction: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onAddTag: (name: string, targetType: TransactionType) => void;
  onDeleteTag: (id: string) => void;
  onOpenAddCardModal: () => void;
  onNavigateToCardsTab: () => void;
  onToggleCardPaid: (id: string) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  transactions,
  tags,
  cards,
  cardPurchases = [],
  onAddTransaction,
  onAddTransactionsBatch,
  onUpdateTransaction,
  onUpdateTransactionWithReplication,
  onDeleteTransaction,
  onToggleStatus,
  onAddTag,
  onDeleteTag,
  onOpenAddCardModal,
  onNavigateToCardsTab,
  onToggleCardPaid,
}) => {
  // Current month state (defaults to September 2026 as per environment metadata or current date)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // 8 is September (0-indexed)
  const [viewAllMonths, setViewAllMonths] = useState<boolean>(false);

  // Sorting state (default: date descending)
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modals state
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionModalType, setTransactionModalType] = useState<TransactionType>('salario');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isShowCardsModalOpen, setIsShowCardsModalOpen] = useState(false);

  // Month navigation helpers (up to 2035)
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      if (selectedYear > 2020) {
        setSelectedYear((y) => y - 1);
        setSelectedMonth(11);
      }
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      if (selectedYear < 2035) {
        setSelectedYear((y) => y + 1);
        setSelectedMonth(0);
      }
    } else {
      // capped at 2035
      if (selectedYear < 2035 || selectedMonth < 11) {
        setSelectedMonth((m) => m + 1);
      }
    }
  };

  // Generate Year range up to 2035
  const yearsList = useMemo(() => {
    const years: number[] = [];
    for (let y = 2024; y <= 2035; y++) {
      years.push(y);
    }
    return years;
  }, []);

  // Filter transactions for current selected month & year
  const filteredTransactions = useMemo(() => {
    if (viewAllMonths) return transactions;
    return transactions.filter((tx) => {
      const { year, month } = parseDateMonthYear(tx.date);
      return year === selectedYear && month === selectedMonth;
    });
  }, [transactions, selectedYear, selectedMonth, viewAllMonths]);

  // Separate salaries and expenses
  const salaries = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.type === 'salario');
  }, [filteredTransactions]);

  const expenses = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.type === 'gasto');
  }, [filteredTransactions]);

  // Totals calculations
  const totalSalario = useMemo(() => {
    return salaries.reduce((acc, curr) => acc + curr.amount, 0);
  }, [salaries]);

  const totalGastos = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses]);

  // Disponível vs Ultrapassou logic:
  // "Ter os campos; Salario, Gastos e Disponível/ Ultrapassou(Quando o nome 'Disponível' ficará visível, quando o valor estiver menor que o valor do campo salario, já para o nome 'ultrapassou' ficará quando o valor for maior que o valor do campo salario."
  const isOverBudget = totalGastos > totalSalario;
  const budgetDifference = Math.abs(totalSalario - totalGastos);

  // Sincronização automática com a tela de movimentações do mês:
  // Sempre que o valor do cartão for atualizado pelo menu Cartão (ou compras/parcelas adicionadas/editadas),
  // se o cartão estiver incluído nas movimentações deste mês, o valor é atualizado automaticamente.
  useEffect(() => {
    if (!onUpdateTransaction || cards.length === 0) return;

    cards.forEach((card) => {
      const existingTx = findCardTransactionForMonth(
        transactions,
        card,
        selectedYear,
        selectedMonth
      );
      if (existingTx) {
        const expectedInvoice = getCardInvoiceForMonthYear(
          card,
          cardPurchases,
          selectedYear,
          selectedMonth
        );
        const needsAmountUpdate = Math.abs(existingTx.amount - expectedInvoice) > 0.001;
        const needsCardId = existingTx.cardId !== card.id;

        if (needsAmountUpdate || needsCardId) {
          onUpdateTransaction(existingTx.id, {
            amount: expectedInvoice > 0 ? expectedInvoice : 0,
            cardId: card.id,
          });
        }
      }
    });
  }, [cards, cardPurchases, selectedYear, selectedMonth, transactions, onUpdateTransaction]);

  // Sorting function helper
  const sortItems = (items: Transaction[]) => {
    return [...items].sort((a, b) => {
      let res = 0;
      if (sortField === 'name') {
        res = a.name.localeCompare(b.name, 'pt-BR');
      } else if (sortField === 'amount') {
        res = a.amount - b.amount;
      } else if (sortField === 'tag') {
        res = a.tag.localeCompare(b.tag, 'pt-BR');
      } else if (sortField === 'date') {
        res = new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return sortDirection === 'asc' ? res : -res;
    });
  };

  // Rule: "organização a lista de movimentação sempre com os itens lançar salario em cima e depois lançar gastos."
  const sortedSalaries = useMemo(() => sortItems(salaries), [salaries, sortField, sortDirection]);
  const sortedExpenses = useMemo(() => sortItems(expenses), [expenses, sortField, sortDirection]);

  // Handle column sort click (excluding Status)
  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#00ff7f]" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#00ff7f]" />
    );
  };

  const openAddSalary = () => {
    setEditingTransaction(null);
    setTransactionModalType('salario');
    setIsTransactionModalOpen(true);
  };

  const openAddExpense = () => {
    setEditingTransaction(null);
    setTransactionModalType('gasto');
    setIsTransactionModalOpen(true);
  };

  const openEditTransaction = (item: Transaction) => {
    setEditingTransaction(item);
    setTransactionModalType(item.type);
    setIsTransactionModalOpen(true);
  };

  // Default date string for modal based on currently selected month
  const currentMonthDateString = useMemo(() => {
    const mStr = (selectedMonth + 1).toString().padStart(2, '0');
    return `${selectedYear}-${mStr}-15`;
  }, [selectedYear, selectedMonth]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Month Navigation Header up to 2035 */}
      <div className="bg-[#0e0e11] border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00ff7f]/10 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Período Orçamentário
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white capitalize">
                {MONTH_NAMES[selectedMonth]} <span className="text-[#00ff7f]">{selectedYear}</span>
              </h2>
            </div>
          </div>

          {/* Month Stepper & Year Picker (Up to 2035) */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              id="btn-prev-month"
              onClick={handlePrevMonth}
              disabled={selectedYear === 2020 && selectedMonth === 0}
              className="p-2 rounded-xl bg-[#18181b] border border-zinc-700 hover:border-[#00ff7f] text-zinc-300 hover:text-white transition-all disabled:opacity-40 disabled:hover:border-zinc-700"
              title="Mês Anterior (Esquerda)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Quick Month Selector */}
            <select
              id="select-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-[#18181b] border border-zinc-700 hover:border-[#00ff7f] focus:border-[#00ff7f] focus:outline-none text-white text-xs sm:text-sm font-semibold rounded-xl px-3 py-2 cursor-pointer transition-colors"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>
                  {m}
                </option>
              ))}
            </select>

            {/* Quick Year Selector up to 2035 */}
            <select
              id="select-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-[#18181b] border border-zinc-700 hover:border-[#00ff7f] focus:border-[#00ff7f] focus:outline-none text-white text-xs sm:text-sm font-semibold rounded-xl px-3 py-2 cursor-pointer transition-colors"
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>
                  {y} {y === 2035 ? '(Limite 2035)' : ''}
                </option>
              ))}
            </select>

            <button
              id="btn-next-month"
              onClick={handleNextMonth}
              disabled={selectedYear === 2035 && selectedMonth === 11}
              className="p-2 rounded-xl bg-[#18181b] border border-zinc-700 hover:border-[#00ff7f] text-zinc-300 hover:text-white transition-all disabled:opacity-40 disabled:hover:border-zinc-700"
              title="Próximo Mês (Direita)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Toggle view all months option */}
            <button
              onClick={() => setViewAllMonths((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                viewAllMonths
                  ? 'bg-[#00ff7f]/20 border-[#00ff7f] text-[#00ff7f]'
                  : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {viewAllMonths ? 'Mostrando Todos' : 'Ver Todos'}
            </button>
          </div>
        </div>
      </div>

      {/* TOP SUMMARY CARDS: Salario, Gastos, Disponível / Ultrapassou */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Salário */}
        <div
          id="card-summary-salario"
          className="bg-[#0f1410] border border-emerald-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:border-emerald-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Salário Total do Mês
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#00ff7f]/15 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f]">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black font-mono-num text-[#00ff7f]">
              {formatCurrency(totalSalario)}
            </span>
            <span className="block text-xs text-zinc-400 mt-1">
              {salaries.length} recebimento(s) cadastrado(s)
            </span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-[#00ff7f]/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card Gastos */}
        <div
          id="card-summary-gastos"
          className="bg-[#140e10] border border-rose-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:border-rose-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Gastos Totais do Mês
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black font-mono-num text-rose-400">
              {formatCurrency(totalGastos)}
            </span>
            <span className="block text-xs text-zinc-400 mt-1">
              {expenses.length} despesa(s) cadastrada(s)
            </span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card Disponível / Ultrapassou */}
        {/* Requirement: "Disponível ficará visível quando o valor estiver menor que o valor do campo salario, já para o nome ultrapassou ficará quando o valor for maior que o valor do campo salario." */}
        <div
          id="card-summary-status"
          className={`border rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all ${
            isOverBudget
              ? 'bg-[#1a0f12] border-rose-500 text-rose-400 shadow-rose-950/40'
              : 'bg-[#0a150e] border-[#00ff7f] text-[#00ff7f] shadow-[#00ff7f]/10 neon-glow-green'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                isOverBudget
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                  : 'bg-[#00ff7f]/20 border-[#00ff7f] text-[#00ff7f]'
              }`}
            >
              {isOverBudget ? 'Ultrapassou' : 'Disponível'}
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                isOverBudget
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                  : 'bg-[#00ff7f]/20 border-[#00ff7f] text-[#00ff7f]'
              }`}
            >
              {isOverBudget ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono-num">
                {formatCurrency(budgetDifference)}
              </span>
            </div>
            <span className="block text-xs mt-1 opacity-80">
              {isOverBudget
                ? `Atenção: Gastos superaram o salário em ${formatCurrency(budgetDifference)}`
                : `Excelente: Saldo livre para guardar ou investir`}
            </span>
          </div>
          <div
            className={`absolute -bottom-6 -right-6 w-28 h-28 rounded-full blur-2xl pointer-events-none ${
              isOverBudget ? 'bg-rose-500/10' : 'bg-[#00ff7f]/15'
            }`}
          />
        </div>
      </div>

      {/* ACTION BUTTONS ROW */}
      {/*
        Requirements:
        - Ter um botão " Add Cartão de Credito" Mostrar os cartões cadastrado no menu cartão de credito.
        - Ter um botão "Lançar Salario"
        - Ter um botão "Lançar Gastos"
        - Ter um botão "+Tag"
      */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#0f0f13] border border-zinc-800">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Add Cartão de Credito */}
          <button
            id="btn-add-cartao-credito"
            onClick={() => setIsShowCardsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a1a24] hover:bg-[#222230] border border-violet-500/40 hover:border-violet-400 text-violet-300 hover:text-white text-xs sm:text-sm font-bold transition-all shadow-md"
            title="Mostrar cartões cadastrados no menu cartão de crédito"
          >
            <CreditCardIcon className="w-4 h-4 text-violet-400" />
            <span>Add Cartão de Crédito</span>
            <span className="ml-1 px-1.5 py-0.5 rounded bg-violet-500/20 text-[10px] text-violet-300">
              {cards.length}
            </span>
          </button>

          {/* Botão Lançar Salario */}
          <button
            id="btn-lancar-salario"
            onClick={openAddSalary}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#00ff7f]/20 hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Lançar Salário</span>
          </button>

          {/* Botão Lançar Gastos */}
          <button
            id="btn-lancar-gastos"
            onClick={openAddExpense}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-lg shadow-rose-500/20 hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Lançar Gastos</span>
          </button>

          {/* Botão +Tag */}
          <button
            id="btn-adicionar-tag"
            onClick={() => setIsTagModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#18181b] hover:bg-zinc-800 border border-zinc-700 hover:border-[#00ff7f] text-zinc-300 hover:text-[#00ff7f] text-xs sm:text-sm font-bold transition-all"
          >
            <TagIcon className="w-4 h-4" />
            <span>+Tag</span>
          </button>
        </div>

        {/* Note on Credit Cards */}
        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
          <span>Use <strong className="text-violet-300">"Add Cartão de Crédito"</strong> para incluir faturas nas movimentações deste mês</span>
        </div>
      </div>

      {/* TABLE / LIST OF TRANSACTIONS */}
      {/*
        Requirements:
        - "ordem em listas, ter os campos; Status, Nome, valor, tag e data, ao clica em cada campo ter a função de organizar com base no campo, menos o campos Status."
        - "organização a lista de movimentação sempre com os itens lançar salario em cima e depois lançar gastos."
        - "os itens salario na lista será na cor verde, e os itens gastos na cor vermelha."
        - "No campo Status; Não Recebido\ Recebido para os itens salários, ter função ao clicar trocar de nome. já para os itens gastos será "Não pago" e "Pago" e ter a mesma função."
      */}
      <div className="bg-[#0b0b0e] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#00ff7f]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Movimentações do Mês (Salários em Cima, Gastos Abaixo)
            </h3>
          </div>
          <span className="text-xs text-zinc-500">
            Total: {filteredTransactions.length} registro(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#121217] border-b border-zinc-800 text-[11px] uppercase font-bold text-zinc-400 tracking-wider select-none">
                {/* Status Column (NOT SORTABLE) */}
                <th className="py-3.5 px-4 w-40">
                  <span>Status</span>
                  <span className="text-[9px] text-zinc-500 font-normal block">
                    (Clique para alternar)
                  </span>
                </th>

                {/* Nome Column (Sortable) */}
                <th
                  onClick={() => handleSortClick('name')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nome</span>
                    {getSortIcon('name')}
                  </div>
                </th>

                {/* Valor Column (Sortable) */}
                <th
                  onClick={() => handleSortClick('amount')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Valor</span>
                    {getSortIcon('amount')}
                  </div>
                </th>

                {/* Tag Column (Sortable) */}
                <th
                  onClick={() => handleSortClick('tag')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Tag</span>
                    {getSortIcon('tag')}
                  </div>
                </th>

                {/* Data Column (Sortable) */}
                <th
                  onClick={() => handleSortClick('date')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Data</span>
                    {getSortIcon('date')}
                  </div>
                </th>

                {/* Actions */}
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800/60 text-xs sm:text-sm">
              {/* SECTION 1: SALARIES ALWAYS ON TOP */}
              {sortedSalaries.length > 0 && (
                <tr className="bg-emerald-950/20 border-y border-emerald-500/20">
                  <td
                    colSpan={6}
                    className="py-2 px-4 text-[11px] font-extrabold uppercase tracking-wider text-[#00ff7f] flex items-center gap-2"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Lançar Salário ({sortedSalaries.length}) — Itens Verdes
                  </td>
                </tr>
              )}

              {sortedSalaries.map((item) => (
                <tr
                  key={item.id}
                  id={`row-salary-${item.id}`}
                  className="bg-[#0b130e]/40 hover:bg-[#0e1c14] transition-colors text-[#00ff7f]"
                >
                  {/* Status Toggle (Não Recebido / Recebido) */}
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => onToggleStatus(item.id)}
                      title="Clique para alternar status do salário"
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer shadow-sm ${
                        item.status === 'Recebido'
                          ? 'bg-[#00ff7f]/20 border-[#00ff7f] text-[#00ff7f] hover:bg-[#00ff7f]/30'
                          : 'bg-amber-500/15 border-amber-500/50 text-amber-300 hover:bg-amber-500/25'
                      }`}
                    >
                      {item.status === 'Recebido' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff7f]" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      <span>{item.status}</span>
                    </button>
                  </td>

                  {/* Nome */}
                  <td className="py-3 px-4 font-semibold text-white">
                    {item.name}
                  </td>

                  {/* Valor (em Verde) */}
                  <td className="py-3 px-4 font-bold font-mono-num text-[#00ff7f]">
                    +{formatCurrency(item.amount)}
                  </td>

                  {/* Tag */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                      <TagIcon className="w-3 h-3" />
                      {item.tag}
                    </span>
                  </td>

                  {/* Data */}
                  <td className="py-3 px-4 text-zinc-300 font-mono-num">
                    {formatDateDisplay(item.date)}
                  </td>

                  {/* Ações */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditTransaction(item)}
                        title="Editar salário"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-[#00ff7f] hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(item.id)}
                        title="Excluir salário"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* SECTION 2: EXPENSES ALWAYS BELOW */}
              {sortedExpenses.length > 0 && (
                <tr className="bg-rose-950/20 border-y border-rose-500/20">
                  <td
                    colSpan={6}
                    className="py-2 px-4 text-[11px] font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-2"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    Lançar Gastos ({sortedExpenses.length}) — Itens Vermelhos
                  </td>
                </tr>
              )}

              {sortedExpenses.map((item) => (
                <tr
                  key={item.id}
                  id={`row-expense-${item.id}`}
                  className="bg-[#140b0e]/40 hover:bg-[#1f0f14] transition-colors text-rose-400"
                >
                  {/* Status Toggle (Não pago / Pago) */}
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => onToggleStatus(item.id)}
                      title="Clique para alternar status do gasto"
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer shadow-sm ${
                        item.status === 'Pago'
                          ? 'bg-[#00ff7f]/20 border-[#00ff7f] text-[#00ff7f] hover:bg-[#00ff7f]/30'
                          : 'bg-rose-500/20 border-rose-500 text-rose-300 hover:bg-rose-500/30'
                      }`}
                    >
                      {item.status === 'Pago' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff7f]" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>{item.status}</span>
                    </button>
                  </td>

                  {/* Nome */}
                  <td className="py-3 px-4 font-semibold text-white">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{item.name}</span>
                      {cards.some((c) => isCardTransaction(item, c)) && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30"
                          title="Sincronizado automaticamente com o menu Cartões de Crédito"
                        >
                          <CreditCardIcon className="w-3 h-3 text-[#00ff7f]" />
                          <span>Fatura Vinculada</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Valor (em Vermelho) */}
                  <td className="py-3 px-4 font-bold font-mono-num text-rose-400">
                    -{formatCurrency(item.amount)}
                  </td>

                  {/* Tag */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs font-medium">
                      <TagIcon className="w-3 h-3" />
                      {item.tag}
                    </span>
                  </td>

                  {/* Data */}
                  <td className="py-3 px-4 text-zinc-300 font-mono-num">
                    {formatDateDisplay(item.date)}
                  </td>

                  {/* Ações */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditTransaction(item)}
                        title="Editar gasto"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(item.id)}
                        title="Excluir gasto"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Empty state */}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-zinc-500">
                    <p className="text-sm font-medium">
                      Nenhuma movimentação cadastrada para {MONTH_NAMES[selectedMonth]} de{' '}
                      {selectedYear}.
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Use os botões "Lançar Salário" ou "Lançar Gastos" acima para começar!
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      <AddTransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setEditingTransaction(null);
        }}
        type={transactionModalType}
        tags={tags}
        currentDateDefault={currentMonthDateString}
        editingTransaction={editingTransaction}
        onSave={onAddTransaction}
        onSaveBatch={onAddTransactionsBatch || ((txs) => txs.forEach(onAddTransaction))}
        onUpdate={onUpdateTransaction}
        onUpdateWithReplication={onUpdateTransactionWithReplication}
      />

      <AddTagModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        tags={tags}
        onAddTag={onAddTag}
        onDeleteTag={onDeleteTag}
      />

      <ShowCreditCardsModal
        isOpen={isShowCardsModalOpen}
        onClose={() => setIsShowCardsModalOpen(false)}
        cards={cards}
        cardPurchases={cardPurchases}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        transactions={transactions}
        onNavigateToCards={onNavigateToCardsTab}
        onOpenAddNewCard={onOpenAddCardModal}
        onTogglePaid={onToggleCardPaid}
        onIncludeCardInBudget={(card, amount, dueDateStr) => {
          const existing = findCardTransactionForMonth(
            transactions,
            card,
            selectedYear,
            selectedMonth
          );
          if (existing && onUpdateTransaction) {
            onUpdateTransaction(existing.id, {
              name: `Fatura ${card.name}`,
              amount: amount > 0 ? amount : 0,
              date: dueDateStr,
              tag: 'Cartão de crédito',
              cardId: card.id,
              status: card.paidThisMonth ? 'Pago' : 'Não pago',
            });
          } else {
            onAddTransaction({
              type: 'gasto',
              name: `Fatura ${card.name}`,
              amount: amount > 0 ? amount : 0,
              tag: 'Cartão de crédito',
              date: dueDateStr,
              cardId: card.id,
              status: card.paidThisMonth ? 'Pago' : 'Não pago',
              notes: `Fatura importada do cartão ${card.name} para ${MONTH_NAMES[selectedMonth]} de ${selectedYear}`,
            });
          }
        }}
      />
    </div>
  );
};
