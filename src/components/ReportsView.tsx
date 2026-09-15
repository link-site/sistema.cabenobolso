import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  Download,
  Printer,
  Calendar,
  Tag,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  Layers,
  Filter,
} from 'lucide-react';
import { Transaction, CreditCard as CreditCardType, TagItem } from '../types';
import {
  formatCurrency,
  formatDateDisplay,
  MONTH_NAMES,
  parseDateMonthYear,
} from '../utils/formatters';

interface ReportsViewProps {
  transactions: Transaction[];
  cards: CreditCardType[];
  tags: TagItem[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ transactions, cards, tags }) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const { year, month } = parseDateMonthYear(t.date);
      if (year !== selectedYear) return false;
      if (selectedMonth !== 'all' && month !== selectedMonth) return false;
      return true;
    });
  }, [transactions, selectedYear, selectedMonth]);

  // Totals
  const totalSalario = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'salario')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const totalGastos = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'gasto')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const saldoLiquido = totalSalario - totalGastos;
  const taxaPoupanca =
    totalSalario > 0 ? Math.max(0, Math.round((saldoLiquido / totalSalario) * 100)) : 0;

  // Gastos por Tag / Categoria
  const gastosByTag = useMemo(() => {
    const map: { [key: string]: { total: number; count: number } } = {};
    filteredTransactions
      .filter((t) => t.type === 'gasto')
      .forEach((t) => {
        if (!map[t.tag]) {
          map[t.tag] = { total: 0, count: 0 };
        }
        map[t.tag].total += t.amount;
        map[t.tag].count += 1;
      });

    return Object.keys(map)
      .map((tag) => ({
        tag,
        total: map[tag].total,
        count: map[tag].count,
        percent: totalGastos > 0 ? Math.round((map[tag].total / totalGastos) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions, totalGastos]);

  // Salários por Tag / Categoria
  const salariosByTag = useMemo(() => {
    const map: { [key: string]: { total: number; count: number } } = {};
    filteredTransactions
      .filter((t) => t.type === 'salario')
      .forEach((t) => {
        if (!map[t.tag]) {
          map[t.tag] = { total: 0, count: 0 };
        }
        map[t.tag].total += t.amount;
        map[t.tag].count += 1;
      });

    return Object.keys(map)
      .map((tag) => ({
        tag,
        total: map[tag].total,
        count: map[tag].count,
        percent: totalSalario > 0 ? Math.round((map[tag].total / totalSalario) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions, totalSalario]);

  // Status de Pagamento Gastos (Pago vs Não pago)
  const gastosPagos = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'gasto' && t.status === 'Pago')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const gastosNaoPagos = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'gasto' && t.status === 'Não pago')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  // Status Salários (Recebido vs Não Recebido)
  const salariosRecebidos = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'salario' && t.status === 'Recebido')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const salariosNaoRecebidos = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'salario' && t.status === 'Não Recebido')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  // Total de Faturas dos Cartões
  const totalCartoesFatura = cards.reduce((sum, c) => sum + c.currentInvoice, 0);
  const comprometimentoRendaCartao =
    totalSalario > 0 ? Math.min(100, Math.round((totalCartoesFatura / totalSalario) * 100)) : 0;

  // Export to CSV Function
  const handleExportCSV = () => {
    const headers = ['Tipo', 'Nome', 'Valor (R$)', 'Tag', 'Data', 'Status'];
    const rows = filteredTransactions.map((t) => [
      t.type === 'salario' ? 'Salario' : 'Gasto',
      `"${t.name.replace(/"/g, '""')}"`,
      t.amount.toFixed(2).replace('.', ','),
      `"${t.tag.replace(/"/g, '""')}"`,
      formatDateDisplay(t.date),
      t.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `relatorio-financeiro-cabe-no-bolso-${selectedYear}-${selectedMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn print:bg-white print:text-black">
      {/* Top Header & Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0f0f13] border border-zinc-800 shadow-xl print:border-none print:shadow-none">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f]">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white print:text-black">
              Relatórios Financeiros & Diagnóstico
            </h2>
            <p className="text-xs text-zinc-400 print:text-zinc-600">
              Análises categorizadas, balanços mensais/anuais e métricas de liquidez
            </p>
          </div>
        </div>

        {/* Filter selectors & Export buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-[#18181b] border border-zinc-700 text-white text-xs sm:text-sm font-semibold rounded-xl px-3 py-2 cursor-pointer focus:border-[#00ff7f] focus:outline-none"
          >
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2035].map((y) => (
              <option key={y} value={y}>
                Ano {y}
              </option>
            ))}
          </select>

          {/* Month Filter */}
          <select
            value={selectedMonth}
            onChange={(e) =>
              setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="bg-[#18181b] border border-zinc-700 text-white text-xs sm:text-sm font-semibold rounded-xl px-3 py-2 cursor-pointer focus:border-[#00ff7f] focus:outline-none"
          >
            <option value="all">Ano Completo (Todos os Meses)</option>
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>

          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#18181b] hover:bg-zinc-800 border border-zinc-700 hover:border-[#00ff7f] text-zinc-200 hover:text-[#00ff7f] text-xs font-bold transition-all"
            title="Exportar dados para Excel/CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#00ff7f]" />
            <span>CSV</span>
          </button>

          {/* Print Report */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black text-xs font-bold transition-all shadow-md shadow-[#00ff7f]/20"
            title="Imprimir ou Salvar em PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Relatório</span>
          </button>
        </div>
      </div>

      {/* RELATÓRIO 1: BALANÇO GERAL & SAÚDE FINANCEIRA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0e1410] border border-emerald-500/30">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
            Total Receitas (Salários)
          </span>
          <span className="text-2xl font-black font-mono-num text-[#00ff7f] block mt-1">
            {formatCurrency(totalSalario)}
          </span>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {salariosNaoRecebidos > 0
              ? `${formatCurrency(salariosRecebidos)} recebido • ${formatCurrency(salariosNaoRecebidos)} a receber`
              : '100% recebido'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#140e10] border border-rose-500/30">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">
            Total Despesas (Gastos)
          </span>
          <span className="text-2xl font-black font-mono-num text-rose-400 block mt-1">
            {formatCurrency(totalGastos)}
          </span>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {gastosNaoPagos > 0
              ? `${formatCurrency(gastosPagos)} pago • ${formatCurrency(gastosNaoPagos)} pendente`
              : '100% quitado'}
          </span>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            saldoLiquido >= 0
              ? 'bg-[#0a150e] border-[#00ff7f]/40 text-[#00ff7f]'
              : 'bg-[#180e12] border-rose-500/50 text-rose-400'
          }`}
        >
          <span className="text-xs font-bold uppercase tracking-wider block">
            {saldoLiquido >= 0 ? 'Superávit / Economia' : 'Déficit no Período'}
          </span>
          <span className="text-2xl font-black font-mono-num block mt-1">
            {formatCurrency(Math.abs(saldoLiquido))}
          </span>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {saldoLiquido >= 0 ? 'Dentro do orçamento planejado' : 'Gastos ultrapassaram os salários'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#121217] border border-zinc-800">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
            Taxa de Poupança
          </span>
          <span className="text-2xl font-black font-mono-num text-amber-300 block mt-1">
            {taxaPoupanca}%
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Porcentagem da renda líquida preservada
          </span>
        </div>
      </div>

      {/* RELATÓRIO 2 & 3: CATEGORIAS DE GASTOS vs CATEGORIAS DE SALÁRIO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gastos por Categoria */}
        <div className="p-5 rounded-2xl bg-[#0b0b0e] border border-zinc-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Relatório de Gastos por Tag / Categoria
            </h3>
            <span className="text-xs text-rose-400 font-bold font-mono-num">
              {formatCurrency(totalGastos)}
            </span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {gastosByTag.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs">
                Nenhum gasto registrado no período.
              </div>
            ) : (
              gastosByTag.map((item) => (
                <div key={item.tag} className="p-3 rounded-xl bg-[#121217] border border-zinc-800/80">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-rose-400" />
                      {item.tag}
                      <span className="text-[10px] text-zinc-500">({item.count} un)</span>
                    </span>
                    <div className="text-right">
                      <span className="font-bold font-mono-num text-rose-400 mr-2">
                        {formatCurrency(item.total)}
                      </span>
                      <span className="text-[11px] font-bold text-zinc-400">
                        {item.percent}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.max(2, item.percent)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Salários por Categoria */}
        <div className="p-5 rounded-2xl bg-[#0b0b0e] border border-zinc-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00ff7f]" />
              Relatório de Receitas por Tag / Fonte
            </h3>
            <span className="text-xs text-[#00ff7f] font-bold font-mono-num">
              {formatCurrency(totalSalario)}
            </span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {salariosByTag.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs">
                Nenhuma receita registrada no período.
              </div>
            ) : (
              salariosByTag.map((item) => (
                <div key={item.tag} className="p-3 rounded-xl bg-[#121217] border border-zinc-800/80">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#00ff7f]" />
                      {item.tag}
                      <span className="text-[10px] text-zinc-500">({item.count} un)</span>
                    </span>
                    <div className="text-right">
                      <span className="font-bold font-mono-num text-[#00ff7f] mr-2">
                        {formatCurrency(item.total)}
                      </span>
                      <span className="text-[11px] font-bold text-zinc-400">
                        {item.percent}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#00ff7f] h-full rounded-full transition-all"
                      style={{ width: `${Math.max(2, item.percent)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RELATÓRIO 4: LIQUIDEZ E STATUS DE PAGAMENTO (O que falta pagar e receber) */}
      <div className="p-5 rounded-2xl bg-[#0b0b0e] border border-zinc-800 shadow-xl">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          Relatório de Liquidez: Pagos vs. Pendentes no Período
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#121217] border border-zinc-800">
            <span className="text-xs text-zinc-400 uppercase tracking-wider block">
              Salários Recebidos
            </span>
            <span className="text-xl font-bold font-mono-num text-[#00ff7f] block mt-1">
              {formatCurrency(salariosRecebidos)}
            </span>
            <span className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Dinheiro já disponível em conta
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#121217] border border-zinc-800">
            <span className="text-xs text-zinc-400 uppercase tracking-wider block">
              Salários Não Recebidos (A Prever)
            </span>
            <span className="text-xl font-bold font-mono-num text-amber-300 block mt-1">
              {formatCurrency(salariosNaoRecebidos)}
            </span>
            <span className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Aguardando depósito
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#121217] border border-zinc-800">
            <span className="text-xs text-zinc-400 uppercase tracking-wider block">
              Gastos Já Pagos
            </span>
            <span className="text-xl font-bold font-mono-num text-[#00ff7f] block mt-1">
              {formatCurrency(gastosPagos)}
            </span>
            <span className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Contas liquidadas
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#121217] border border-zinc-800">
            <span className="text-xs text-zinc-400 uppercase tracking-wider block">
              Gastos Pendentes (A Vencer)
            </span>
            <span className="text-xl font-bold font-mono-num text-rose-400 block mt-1">
              {formatCurrency(gastosNaoPagos)}
            </span>
            <span className="text-[11px] text-rose-400/80 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Atenção às datas de vencimento
            </span>
          </div>
        </div>
      </div>

      {/* RELATÓRIO 5: COMPROMETIMENTO COM CARTÕES DE CRÉDITO */}
      <div className="p-5 rounded-2xl bg-[#0b0b0e] border border-zinc-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-violet-400" />
            <h3 className="text-base font-bold text-white">
              Relatório de Exposição e Comprometimento em Cartões
            </h3>
          </div>
          <span className="text-xs text-zinc-400">
            {cards.length} cartão(ões) cadastrado(s)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-3.5 rounded-xl bg-[#13131a] border border-zinc-800">
            <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">
              Comprometimento da Renda
            </span>
            <span className="text-2xl font-bold font-mono-num text-amber-300 mt-1 block">
              {comprometimentoRendaCartao}%
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              (Fatura total / Renda do período)
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#13131a] border border-zinc-800">
            <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">
              Total Faturas Ativas
            </span>
            <span className="text-2xl font-bold font-mono-num text-rose-400 mt-1 block">
              {formatCurrency(totalCartoesFatura)}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              Valor devido nos cartões
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#13131a] border border-zinc-800">
            <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">
              Status de Alerta
            </span>
            <span
              className={`text-sm font-bold mt-2 block ${
                comprometimentoRendaCartao > 50
                  ? 'text-rose-400'
                  : comprometimentoRendaCartao > 30
                  ? 'text-amber-300'
                  : 'text-[#00ff7f]'
              }`}
            >
              {comprometimentoRendaCartao > 50
                ? 'Alto Risco: Mais de 50% da renda comprometida'
                : comprometimentoRendaCartao > 30
                ? 'Moderado: Fique atento aos novos gastos'
                : 'Saudável: Cartões sob controle'}
            </span>
          </div>
        </div>

        {/* Detailed cards list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider">
                <th className="py-2 px-3">Cartão</th>
                <th className="py-2 px-3">Fatura</th>
                <th className="py-2 px-3">Limite Total</th>
                <th className="py-2 px-3">Limite Disponível</th>
                <th className="py-2 px-3">Vencimento</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {cards.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-900/50">
                  <td className="py-2.5 px-3 font-semibold text-white">{c.name}</td>
                  <td className="py-2.5 px-3 font-mono-num font-bold text-rose-400">
                    {formatCurrency(c.currentInvoice)}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-zinc-300">
                    {formatCurrency(c.limit)}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-[#00ff7f]">
                    {formatCurrency(Math.max(0, c.limit - c.currentInvoice))}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400">{formatDateDisplay(c.dueDate)}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.paidThisMonth
                          ? 'bg-[#00ff7f]/15 text-[#00ff7f]'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {c.paidThisMonth ? 'Pago' : 'Em Aberto'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
