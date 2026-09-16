import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CreditCard,
  Calendar,
  CheckCircle2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Transaction, CreditCard as CreditCardType, CardPurchase } from '../types';
import {
  formatCurrency,
  MONTH_NAMES,
  parseDateMonthYear,
  formatDateDisplay,
} from '../utils/formatters';

interface DashboardViewProps {
  transactions: Transaction[];
  cards: CreditCardType[];
  cardPurchases?: CardPurchase[];
  onNavigateToMonth?: (year: number, month: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  cards,
  cardPurchases = [],
  onNavigateToMonth,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Years available up to 2035
  const yearsList = useMemo(() => {
    const list: number[] = [];
    for (let y = 2024; y <= 2035; y++) {
      list.push(y);
    }
    return list;
  }, []);

  // Filter transactions for the selected year
  const yearTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const { year } = parseDateMonthYear(t.date);
      return year === selectedYear;
    });
  }, [transactions, selectedYear]);

  // Calculations by month (0 to 11)
  const monthlyData = useMemo(() => {
    return MONTH_NAMES.map((name, monthIndex) => {
      const monthTx = yearTransactions.filter((t) => {
        const { month } = parseDateMonthYear(t.date);
        return month === monthIndex;
      });

      const salario = monthTx
        .filter((t) => t.type === 'salario')
        .reduce((sum, t) => sum + t.amount, 0);

      const gastos = monthTx
        .filter((t) => t.type === 'gasto')
        .reduce((sum, t) => sum + t.amount, 0);

      const isOver = gastos > salario;
      const overAmount = isOver ? gastos - salario : 0;
      const availableAmount = !isOver ? salario - gastos : 0;
      const balance = salario - gastos;

      return {
        monthIndex,
        name,
        salario,
        gastos,
        balance,
        isOver,
        overAmount,
        availableAmount,
        hasData: monthTx.length > 0,
      };
    });
  }, [yearTransactions]);

  // Annual Totals
  const annualSalario = useMemo(
    () => monthlyData.reduce((acc, m) => acc + m.salario, 0),
    [monthlyData]
  );
  const annualGastos = useMemo(
    () => monthlyData.reduce((acc, m) => acc + m.gastos, 0),
    [monthlyData]
  );
  const annualBalance = annualSalario - annualGastos;

  // Total que ultrapassou o orçamento no ano
  const totalOverBudget = useMemo(
    () => monthlyData.reduce((acc, m) => acc + m.overAmount, 0),
    [monthlyData]
  );

  const monthsOverBudget = useMemo(
    () => monthlyData.filter((m) => m.isOver && m.gastos > 0),
    [monthlyData]
  );

  // Cards summary
  const getCardInvoice = (c: CreditCardType) => {
    const list = cardPurchases.filter((p) => p.cardId === c.id);
    if (list.length > 0) {
      const curMonthList = list.filter((p) => {
        const { year, month } = parseDateMonthYear(p.billingDate);
        return year === 2026 && month === 8; // September 2026
      });
      return curMonthList.reduce((sum, item) => sum + item.installmentAmount, 0);
    }
    return c.currentInvoice;
  };

  const totalCardInvoices = useMemo(
    () => cards.reduce((sum, c) => sum + getCardInvoice(c), 0),
    [cards, cardPurchases]
  );
  const totalCardLimits = useMemo(
    () => cards.reduce((sum, c) => sum + c.limit, 0),
    [cards]
  );

  // Max value for bar scaling
  const maxMonthValue = useMemo(() => {
    let max = 1;
    monthlyData.forEach((m) => {
      if (m.salario > max) max = m.salario;
      if (m.gastos > max) max = m.gastos;
    });
    return max;
  }, [monthlyData]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Header & Year Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0f0f13] border border-zinc-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00ff7f] animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Dashboard Financeiro Anual
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Visão consolidada anual, valores de cada mês, orçamentos ultrapassados e faturas de cartões
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
            Ano em Análise:
          </label>
          <select
            id="select-dashboard-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-[#18181b] border border-zinc-700 hover:border-[#00ff7f] focus:border-[#00ff7f] focus:outline-none text-white text-sm font-bold rounded-xl px-4 py-2 cursor-pointer transition-colors"
          >
            {yearsList.map((y) => (
              <option key={y} value={y}>
                Ano {y} {y === 2035 ? '(Limite 2035)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 CORE DASHBOARD KPI CARDS (Valores Anual, Ultrapassou, Gastos Cartões) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Salários Anual */}
        <div className="bg-[#0f1410] border border-emerald-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Salário Anual Total
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#00ff7f]/15 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f]">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono-num text-[#00ff7f]">
              {formatCurrency(annualSalario)}
            </span>
            <span className="block text-[11px] text-zinc-400 mt-1">
              Receitas totais em {selectedYear}
            </span>
          </div>
        </div>

        {/* Total Gastos Anual */}
        <div className="bg-[#140e10] border border-rose-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Gastos Totais do Ano
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono-num text-rose-400">
              {formatCurrency(annualGastos)}
            </span>
            <span className="block text-[11px] text-zinc-400 mt-1">
              Despesas acumuladas em {selectedYear}
            </span>
          </div>
        </div>

        {/* Valor que Ultrapassou Orçamento */}
        <div
          className={`border rounded-2xl p-5 shadow-lg relative overflow-hidden ${
            totalOverBudget > 0
              ? 'bg-[#180e12] border-rose-500/50'
              : 'bg-[#0e1611] border-[#00ff7f]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                totalOverBudget > 0 ? 'text-rose-400' : 'text-[#00ff7f]'
              }`}
            >
              Ultrapassou Orçamento
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                totalOverBudget > 0
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-[#00ff7f]/15 border-[#00ff7f]/30 text-[#00ff7f]'
              }`}
            >
              {totalOverBudget > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-black font-mono-num ${
                totalOverBudget > 0 ? 'text-rose-400' : 'text-[#00ff7f]'
              }`}
            >
              {formatCurrency(totalOverBudget)}
            </span>
            <span className="block text-[11px] text-zinc-400 mt-1">
              {monthsOverBudget.length === 0
                ? 'Nenhum mês estourado!'
                : `${monthsOverBudget.length} mês(es) ultrapassaram o salário`}
            </span>
          </div>
        </div>

        {/* Gasto dos Cartões */}
        <div className="bg-[#121118] border border-violet-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
              Gasto dos Cartões
            </span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono-num text-violet-300">
              {formatCurrency(totalCardInvoices)}
            </span>
            <span className="block text-[11px] text-zinc-400 mt-1">
              Faturas ativas em {cards.length} cartão(ões)
            </span>
          </div>
        </div>
      </div>

      {/* ALERT SECTION: MESES QUE ULTRAPASSARAM O ORÇAMENTO */}
      {monthsOverBudget.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#1f0e13] border border-rose-500/40 shadow-xl">
          <div className="flex items-center gap-2 text-rose-400 mb-3">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              Atenção: Meses que Ultrapassaram o Orçamento em {selectedYear}
            </h3>
          </div>
          <p className="text-xs text-zinc-300 mb-3">
            Nos seguintes meses os gastos superaram os salários recebidos. Veja os valores que ultrapassaram:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {monthsOverBudget.map((m) => (
              <div
                key={m.monthIndex}
                className="p-3 rounded-xl bg-black/40 border border-rose-500/30 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{m.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase font-bold">
                    Estourou
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-zinc-400 block">Ultrapassou em:</span>
                  <span className="text-base font-black font-mono-num text-rose-400">
                    +{formatCurrency(m.overAmount)}
                  </span>
                </div>
                <div className="mt-1 pt-1 border-t border-zinc-800 text-[11px] text-zinc-500 flex justify-between">
                  <span>Gastos: {formatCurrency(m.gastos)}</span>
                  <span>Salário: {formatCurrency(m.salario)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VALOR DE CADA MÊS: COMPARAÇÃO MENSAL COM BARRAS VISUAIS */}
      <div className="bg-[#0b0b0e] border border-zinc-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#00ff7f]" />
              Valor de Cada Mês — {selectedYear}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Comparativo detalhado de Salário vs. Gastos em cada um dos 12 meses
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#00ff7f]" />
              <span className="text-zinc-300">Salário</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-500" />
              <span className="text-zinc-300">Gastos</span>
            </div>
          </div>
        </div>

        {/* 12 Months Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthlyData.map((m) => {
            const salPct = maxMonthValue > 0 ? (m.salario / maxMonthValue) * 100 : 0;
            const gasPct = maxMonthValue > 0 ? (m.gastos / maxMonthValue) * 100 : 0;

            return (
              <div
                key={m.monthIndex}
                className={`p-4 rounded-xl border transition-all ${
                  m.hasData
                    ? m.isOver
                      ? 'bg-[#150d10] border-rose-500/30 hover:border-rose-500/60'
                      : 'bg-[#0e1410] border-emerald-500/30 hover:border-emerald-500/60'
                    : 'bg-[#101014] border-zinc-800/80 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-white">{m.name}</h4>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      !m.hasData
                        ? 'bg-zinc-800 text-zinc-500'
                        : m.isOver
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-[#00ff7f]/20 text-[#00ff7f] border border-[#00ff7f]/40'
                    }`}
                  >
                    {!m.hasData ? 'Sem Dados' : m.isOver ? 'Ultrapassou' : 'Disponível'}
                  </span>
                </div>

                {/* Values */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Salário:</span>
                    <span className="font-bold font-mono-num text-[#00ff7f]">
                      {formatCurrency(m.salario)}
                    </span>
                  </div>
                  {/* Salário Bar */}
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#00ff7f] h-full rounded-full transition-all"
                      style={{ width: `${Math.max(2, salPct)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-zinc-400">Gastos:</span>
                    <span className="font-bold font-mono-num text-rose-400">
                      {formatCurrency(m.gastos)}
                    </span>
                  </div>
                  {/* Gastos Bar */}
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.max(2, gasPct)}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Balance / Difference */}
                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">
                    {m.isOver ? 'Ultrapassou:' : 'Disponível:'}
                  </span>
                  <span
                    className={`font-black font-mono-num ${
                      m.isOver ? 'text-rose-400' : 'text-[#00ff7f]'
                    }`}
                  >
                    {formatCurrency(m.isOver ? m.overAmount : m.availableAmount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* GASTO DOS CARTÕES DE CRÉDITO NO DASHBOARD */}
      <div className="bg-[#0b0b0e] border border-zinc-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-violet-400" />
            <h3 className="text-base font-bold text-white">
              Gasto dos Cartões de Crédito Cadastrados
            </h3>
          </div>
          <span className="text-xs text-zinc-400">
            Total Faturas: <span className="text-rose-400 font-bold font-mono-num">{formatCurrency(totalCardInvoices)}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const invoiceVal = getCardInvoice(card);
            const usage = Math.min(100, Math.round((invoiceVal / card.limit) * 100));

            return (
              <div
                key={card.id}
                className="p-4 rounded-xl bg-[#121217] border border-zinc-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: card.color || '#8a05be' }}
                      />
                      {card.name}
                    </h4>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
                      {card.tag}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xs text-zinc-400">Fatura:</span>
                    <span className="text-lg font-black font-mono-num text-rose-400">
                      {formatCurrency(invoiceVal)}
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                      <span>Uso: {usage}%</span>
                      <span>Limite: {formatCurrency(card.limit)}</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          usage > 80 ? 'bg-rose-500' : usage > 50 ? 'bg-amber-400' : 'bg-[#00ff7f]'
                        }`}
                        style={{ width: `${usage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-800 text-[11px] text-zinc-400 flex justify-between">
                  <span>Vencimento: {formatDateDisplay(card.dueDate)}</span>
                  <span className={card.paidThisMonth ? 'text-[#00ff7f]' : 'text-rose-400'}>
                    {card.paidThisMonth ? 'Fatura Paga' : 'Em Aberto'}
                  </span>
                </div>
              </div>
            );
          })}

          {cards.length === 0 && (
            <div className="col-span-full py-8 text-center text-zinc-500 text-sm">
              Nenhum cartão cadastrado. Adicione cartões no menu "Cartões de Créditos".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
