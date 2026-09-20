import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Printer,
  Calendar,
  Tag,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Award,
  Search,
  TrendingUp,
  Info,
} from 'lucide-react';
import { Transaction, CreditCard as CreditCardType, TagItem, CardPurchase } from '../types';
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
  cardPurchases?: CardPurchase[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  cards,
  tags,
  cardPurchases = [],
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'cartoes' | 'projecoes'>('geral');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseCardFilter, setPurchaseCardFilter] = useState<string>('all');

  // Filtros de transações gerais
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const { year, month } = parseDateMonthYear(t.date);
      return year === selectedYear && (selectedMonth === 'all' || month === selectedMonth);
    });
  }, [transactions, selectedYear, selectedMonth]);

  // Totais Gerais
  const totals = useMemo(() => {
    let recs = 0, recsPaid = 0;
    let exps = 0, expsPaid = 0;

    filteredTransactions.forEach((t) => {
      if (t.type === 'salario') {
        recs += t.amount;
        if (t.status === 'Recebido') recsPaid += t.amount;
      } else {
        exps += t.amount;
        if (t.status === 'Pago') expsPaid += t.amount;
      }
    });

    return {
      salario: recs,
      salarioRecebido: recsPaid,
      salarioPendente: recs - recsPaid,
      gastos: exps,
      gastosPagos: expsPaid,
      gastosPendentes: exps - expsPaid,
      saldo: recs - exps,
      poupanca: recs > 0 ? Math.max(0, Math.round(((recs - exps) / recs) * 100)) : 0,
    };
  }, [filteredTransactions]);

  // Agrupamento por Tag/Categoria (Transações Gerais)
  const statsByTag = useMemo(() => {
    const expensesMap: Record<string, { total: number; count: number }> = {};
    const incomesMap: Record<string, { total: number; count: number }> = {};

    filteredTransactions.forEach((t) => {
      const map = t.type === 'gasto' ? expensesMap : incomesMap;
      if (!map[t.tag]) map[t.tag] = { total: 0, count: 0 };
      map[t.tag].total += t.amount;
      map[t.tag].count += 1;
    });

    const format = (map: Record<string, { total: number; count: number }>, total: number) =>
      Object.entries(map)
        .map(([tag, data]) => ({
          tag,
          total: data.total,
          count: data.count,
          percent: total > 0 ? Math.round((data.total / total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

    return {
      gastos: format(expensesMap, totals.gastos),
      receitas: format(incomesMap, totals.salario),
    };
  }, [filteredTransactions, totals]);

  // Helper de cálculo de fatura por cartão
  const getCardInvoice = (c: CreditCardType) => {
    const list = cardPurchases.filter(
      (p) =>
        p.cardId === c.id &&
        parseDateMonthYear(p.billingDate).year === selectedYear &&
        (selectedMonth === 'all' || parseDateMonthYear(p.billingDate).month === selectedMonth)
    );
    return list.length > 0 ? list.reduce((sum, item) => sum + item.installmentAmount, 0) : c.currentInvoice;
  };

  const totalCartoesFatura = useMemo(() => {
    return cards.reduce((sum, c) => sum + getCardInvoice(c), 0);
  }, [cards, cardPurchases, selectedYear, selectedMonth]);

  const comprometimentoRenda =
    totals.salario > 0 ? Math.min(100, Math.round((totalCartoesFatura / totals.salario) * 100)) : 0;

  // ----------------------------------------------------
  // NOVO: Processamento de Compras Parceladas Ativas
  // ----------------------------------------------------
  const activePurchases = useMemo(() => {
    return cardPurchases.filter((p) => {
      const { year, month } = parseDateMonthYear(p.billingDate);
      return year === selectedYear && (selectedMonth === 'all' || month === selectedMonth);
    });
  }, [cardPurchases, selectedYear, selectedMonth]);

  const purchaseStats = useMemo(() => {
    if (activePurchases.length === 0) return { total: 0, count: 0, avg: 0, max: null };
    const total = activePurchases.reduce((sum, p) => sum + p.installmentAmount, 0);
    const count = activePurchases.length;
    let max = activePurchases[0];
    activePurchases.forEach((p) => {
      if (p.installmentAmount > max.installmentAmount) max = p;
    });
    return { total, count, avg: total / count, max };
  }, [activePurchases]);

  const filteredPurchases = useMemo(() => {
    return activePurchases.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(purchaseSearch.toLowerCase());
      const matchesCard = purchaseCardFilter === 'all' || p.cardId === purchaseCardFilter;
      return matchesSearch && matchesCard;
    });
  }, [activePurchases, purchaseSearch, purchaseCardFilter]);

  // ----------------------------------------------------
  // NOVO: Processamento de Tags por Cartão de Crédito
  // ----------------------------------------------------
  const tagsByCard = useMemo(() => {
    return cards.map((card) => {
      const pList = cardPurchases.filter((p) => {
        const { year, month } = parseDateMonthYear(p.billingDate);
        return p.cardId === card.id && year === selectedYear && (selectedMonth === 'all' || month === selectedMonth);
      });

      const categoryMap: Record<string, { total: number; count: number }> = {};
      pList.forEach((p) => {
        const cat = p.category || 'Sem Categoria';
        if (!categoryMap[cat]) categoryMap[cat] = { total: 0, count: 0 };
        categoryMap[cat].total += p.installmentAmount;
        categoryMap[cat].count += 1;
      });

      const cardTotal = pList.reduce((sum, p) => sum + p.installmentAmount, 0);
      const breakdown = Object.entries(categoryMap)
        .map(([category, data]) => ({
          category,
          total: data.total,
          count: data.count,
          percent: cardTotal > 0 ? Math.round((data.total / cardTotal) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      // Encontra a Tag mais gasta para este cartão
      const topTag = breakdown[0]?.category || 'Nenhuma';
      const topTagAmount = breakdown[0]?.total || 0;

      return {
        card,
        total: cardTotal,
        purchaseCount: pList.length,
        breakdown,
        topTag,
        topTagAmount,
      };
    });
  }, [cards, cardPurchases, selectedYear, selectedMonth]);

  // Encontra o Cartão mais usado (com maior número de compras faturadas)
  const rankingCards = useMemo(() => {
    return [...tagsByCard].sort((a, b) => b.purchaseCount - a.purchaseCount);
  }, [tagsByCard]);

  const mostUsedCard = useMemo(() => {
    return rankingCards[0] && rankingCards[0].purchaseCount > 0 ? rankingCards[0] : null;
  }, [rankingCards]);

  // ----------------------------------------------------
  // NOVO: Planejamento / Projeção de Faturas de Cartão (6 Meses)
  // ----------------------------------------------------
  const projections = useMemo(() => {
    const startMonth = typeof selectedMonth === 'number' ? selectedMonth : new Date().getMonth();
    const startYear = selectedYear;
    const res = [];

    for (let i = 1; i <= 6; i++) {
      let targetMonth = startMonth + i;
      let targetYear = startYear;
      if (targetMonth > 11) {
        targetYear += Math.floor(targetMonth / 12);
        targetMonth = targetMonth % 12;
      }

      const cardInvoices = cards.map((card) => {
        const total = cardPurchases
          .filter((p) => {
            const { year, month } = parseDateMonthYear(p.billingDate);
            return p.cardId === card.id && year === targetYear && month === targetMonth;
          })
          .reduce((sum, p) => sum + p.installmentAmount, 0);
        return { card, total };
      });

      res.push({
        monthName: MONTH_NAMES[targetMonth],
        year: targetYear,
        total: cardInvoices.reduce((sum, ci) => sum + ci.total, 0),
        breakdown: cardInvoices,
      });
    }
    return res;
  }, [cards, cardPurchases, selectedYear, selectedMonth]);

  const handleExportCSV = () => {
    const headers = ['Tipo', 'Nome/Descrição', 'Valor (R$)', 'Categoria/Tag', 'Data', 'Origem/Fatura'];
    const rows: string[][] = [];

    filteredTransactions.forEach((t) => {
      rows.push([
        t.type === 'salario' ? 'Receita' : 'Gasto Geral',
        t.name,
        t.amount.toFixed(2),
        t.tag,
        formatDateDisplay(t.date),
        t.status,
      ]);
    });

    activePurchases.forEach((p) => {
      const card = cards.find((c) => c.id === p.cardId);
      rows.push([
        'Parcela Cartão',
        `${p.name} (${p.currentInstallment}/${p.installmentCount})`,
        p.installmentAmount.toFixed(2),
        p.category || 'Sem Categoria',
        formatDateDisplay(p.purchaseDate),
        card ? card.name : 'Cartão',
      ]);
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))].join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `relatorio-completo-${selectedYear}-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn print:bg-white print:text-black">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0f0f13] border border-zinc-800 shadow-xl print:border-none print:shadow-none">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f]">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white print:text-black">
              Relatórios Financeiros & Diagnóstico
            </h2>
            <p className="text-xs text-zinc-400">Análises detalhadas, controle de cartões e projeções futuras</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-[#18181b] border border-zinc-700 text-white text-xs sm:text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-[#00ff7f]"
          >
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2035].map((y) => (
              <option key={y} value={y}>Ano {y}</option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-[#18181b] border border-zinc-700 text-white text-xs sm:text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-[#00ff7f]"
          >
            <option value="all">Ano Completo</option>
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx}>{m}</option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#18181b] hover:bg-zinc-800 border border-zinc-700 hover:border-[#00ff7f] text-zinc-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#00ff7f]" />
            <span>CSV</span>
          </button>

          <button
            onClick={window.print}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black text-xs font-bold transition-all cursor-pointer shadow-md shadow-[#00ff7f]/20"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* Sub-abas de Navegação */}
      <div className="flex border-b border-zinc-800 gap-1.5 print:hidden">
        <button
          onClick={() => setActiveSubTab('geral')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold border-b-2 cursor-pointer transition-colors ${
            activeSubTab === 'geral' ? 'border-[#00ff7f] text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Balanço Geral
        </button>
        <button
          onClick={() => setActiveSubTab('cartoes')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold border-b-2 cursor-pointer transition-colors ${
            activeSubTab === 'cartoes' ? 'border-[#00ff7f] text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Controle de Compras & Cartões
        </button>
        <button
          onClick={() => setActiveSubTab('projecoes')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold border-b-2 cursor-pointer transition-colors ${
            activeSubTab === 'projecoes' ? 'border-[#00ff7f] text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Planejamento & Projeções
        </button>
      </div>

      {/* ABA 1: BALANÇO GERAL */}
      {(activeSubTab === 'geral' || window.matchMedia('print').matches) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#0e1410] border border-emerald-500/30">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Receitas (Salários)</span>
              <span className="text-2xl font-black font-mono text-[#00ff7f] block mt-1">{formatCurrency(totals.salario)}</span>
              <span className="text-[10px] text-zinc-400 block mt-1">
                {totals.salarioPendente > 0 ? `${formatCurrency(totals.salarioRecebido)} rec. • ${formatCurrency(totals.salarioPendente)} pend.` : '100% recebido'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#140e10] border border-rose-500/30">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">Gastos Gerais</span>
              <span className="text-2xl font-black font-mono text-rose-400 block mt-1">{formatCurrency(totals.gastos)}</span>
              <span className="text-[10px] text-zinc-400 block mt-1">
                {totals.gastosPendentes > 0 ? `${formatCurrency(totals.gastosPagos)} pago • ${formatCurrency(totals.gastosPendentes)} pend.` : '100% quitado'}
              </span>
            </div>

            <div className={`p-4 rounded-2xl border ${totals.saldo >= 0 ? 'bg-[#0a150e] border-[#00ff7f]/40 text-[#00ff7f]' : 'bg-[#180e12] border-rose-500/50 text-rose-400'}`}>
              <span className="text-xs font-bold uppercase tracking-wider block">{totals.saldo >= 0 ? 'Superávit Líquido' : 'Déficit no Período'}</span>
              <span className="text-2xl font-black font-mono block mt-1">{formatCurrency(Math.abs(totals.saldo))}</span>
              <span className="text-[10px] text-zinc-400 block mt-1">{totals.saldo >= 0 ? 'Finanças controladas' : 'Orçamento estourado'}</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#121217] border border-zinc-800">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Taxa de Poupança</span>
              <span className="text-2xl font-black font-mono text-amber-300 block mt-1">{totals.poupanca}%</span>
              <span className="text-[10px] text-zinc-500 block mt-1">Percentual preservado da renda</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gastos por Categoria */}
            <div className="p-5 rounded-2xl bg-[#0b0b0e] border border-zinc-800 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Gastos por Categoria (Fluxo de Caixa)
              </h3>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {statsByTag.gastos.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 text-xs">Nenhum gasto registrado.</div>
                ) : (
                  statsByTag.gastos.map((item) => (
                    <div key={item.tag} className="p-2.5 rounded-xl bg-[#121217] border border-zinc-900">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-zinc-300 truncate max-w-[150px]">{item.tag} <span className="text-[9px] text-zinc-500">({item.count}x)</span></span>
                        <span><b className="text-rose-400 mr-2">{formatCurrency(item.total)}</b> <span className="text-[10px] text-zinc-400 font-bold">{item.percent}%</span></span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full" style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Receitas por Tag */}
            <div className="p-5 rounded-2xl bg-[#0b0b0e] border border-zinc-800 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00ff7f]" /> Receitas por Categoria / Fonte
              </h3>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {statsByTag.receitas.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 text-xs">Nenhuma receita registrada.</div>
                ) : (
                  statsByTag.receitas.map((item) => (
                    <div key={item.tag} className="p-2.5 rounded-xl bg-[#121217] border border-zinc-900">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-zinc-300 truncate max-w-[150px]">{item.tag} <span className="text-[9px] text-zinc-500">({item.count}x)</span></span>
                        <span><b className="text-[#00ff7f] mr-2">{formatCurrency(item.total)}</b> <span className="text-[10px] text-zinc-400 font-bold">{item.percent}%</span></span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#00ff7f] h-full rounded-full" style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: ANÁLISE DE COMPRAS E CARTÕES */}
      {activeSubTab === 'cartoes' && (
        <div className="space-y-6">
          {/* Cruzamento: Cartões que tiveram mais compras e suas tags principais */}
          <div className="p-5 rounded-2xl bg-[#0b0b0e] border border-zinc-800 shadow-xl">
            <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              Cruzamento: Cartões Mais Utilizados & Principais Tags de Uso
            </h3>

            {mostUsedCard ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {/* Cartão Campeão de Compras */}
                <div className="p-4.5 rounded-xl bg-[#13111c] border border-[#a78bfa]/30 flex flex-col justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-[#a78bfa]/10 border border-[#a78bfa]/20 text-[9px] text-[#c084fc] font-bold uppercase tracking-wider block w-fit">
                      Cartão Mais Utilizado
                    </span>
                    <h4 className="text-lg font-black text-white mt-2">{mostUsedCard.card.name}</h4>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                      Este cartão lidera o número de transações no período com{' '}
                      <span className="text-[#00ff7f] font-bold">{mostUsedCard.purchaseCount}</span> parcelas/compras na fatura atual.
                    </p>
                  </div>
                  <div className="mt-4 border-t border-zinc-800/80 pt-3">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">Tag Mais Consumida</span>
                    <span className="text-sm font-black text-[#00ff7f]">{mostUsedCard.topTag}</span>
                    <span className="text-xs text-zinc-400 ml-1.5">({formatCurrency(mostUsedCard.topTagAmount)})</span>
                  </div>
                </div>

                {/* Ranking de Todos os Cartões por Compras */}
                <div className="lg:col-span-2 space-y-3 flex flex-col justify-center">
                  <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                    Ranking de Cartões (Faturamento & Tags Principais)
                  </h4>
                  {rankingCards.map((item) => {
                    const maxCount = Math.max(...rankingCards.map((i) => i.purchaseCount), 1);
                    const barPercent = Math.round((item.purchaseCount / maxCount) * 100);
                    const cardColor = item.card.color || '#a78bfa';

                    return (
                      <div key={item.card.id} className="p-3 rounded-lg bg-[#121217] border border-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cardColor }} />
                          <span className="font-bold text-white truncate">{item.card.name}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                            <span>{item.purchaseCount} parcelas</span>
                            <span className="font-bold">Fatura: {formatCurrency(item.total)}</span>
                          </div>
                          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${barPercent}%`, backgroundColor: cardColor }} />
                          </div>
                        </div>
                        <div className="bg-[#18181f] px-2 py-0.5 border border-zinc-800 rounded text-right min-w-[100px]">
                          <span className="text-[8px] text-zinc-500 uppercase font-black block">Tag Principal</span>
                          <span className="font-semibold text-rose-400">{item.topTag}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-zinc-600 text-xs">Sem dados de cartões ou compras registrados.</div>
            )}
          </div>

          {/* Tags de cada Cartão */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" /> Relatório de Tags / Categorias de cada Cartão
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tagsByCard.map((item) => {
                const cardColor = item.card.color || '#8b5cf6';
                return (
                  <div key={item.card.id} className="p-4 rounded-xl bg-[#0b0b0e] border border-zinc-800 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cardColor }} />
                          <span className="font-bold text-xs uppercase text-zinc-300 truncate max-w-[110px]">{item.card.name}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-rose-400">{formatCurrency(item.total)}</span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                        {item.breakdown.length === 0 ? (
                          <div className="py-6 text-center text-zinc-600 text-xs">Nenhuma compra parcelada.</div>
                        ) : (
                          item.breakdown.map((cat) => (
                            <div key={cat.category} className="text-xs">
                              <div className="flex justify-between mb-0.5 text-zinc-400">
                                <span className="truncate max-w-[110px]">{cat.category}</span>
                                <span className="font-mono">{formatCurrency(cat.total)} ({cat.percent}%)</span>
                              </div>
                              <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${cat.percent}%`, backgroundColor: cardColor }} />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-500">
                      <span>Total de itens faturados:</span>
                      <span className="font-bold text-zinc-300">{item.purchaseCount} un</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Análise de Compras - Detalhado */}
          <div className="p-5 rounded-2xl bg-[#0b0b0e] border border-zinc-800 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 border-b border-zinc-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-[#00ff7f]" /> Relatório Detalhado de Compras Parceladas
                </h3>
                <span className="text-[10px] text-zinc-400">Filtre e pesquise parcelas cobradas no período</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar compra..."
                    value={purchaseSearch}
                    onChange={(e) => setPurchaseSearch(e.target.value)}
                    className="pl-7 pr-2.5 py-1.5 bg-[#141419] border border-zinc-700 hover:border-zinc-500 text-xs text-white rounded-lg focus:outline-none focus:border-[#00ff7f] w-32 sm:w-44"
                  />
                </div>

                <select
                  value={purchaseCardFilter}
                  onChange={(e) => setPurchaseCardFilter(e.target.value)}
                  className="bg-[#141419] border border-zinc-700 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00ff7f]"
                >
                  <option value="all">Todos Cartões</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Stats de Compras */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs">
              <div className="p-3 rounded-lg bg-[#121217] border border-zinc-900">
                <span className="text-zinc-500 block">Soma Parcelada</span>
                <b className="text-rose-400 text-base font-black font-mono block mt-0.5">{formatCurrency(purchaseStats.total)}</b>
              </div>
              <div className="p-3 rounded-lg bg-[#121217] border border-zinc-900">
                <span className="text-zinc-500 block">Qtd Parcelas Ativas</span>
                <b className="text-amber-300 text-base font-black font-mono block mt-0.5">{purchaseStats.count} parcelas</b>
              </div>
              <div className="p-3 rounded-lg bg-[#121217] border border-zinc-900">
                <span className="text-zinc-500 block">Ticket Médio</span>
                <b className="text-[#00ff7f] text-base font-black font-mono block mt-0.5">{formatCurrency(purchaseStats.avg)}</b>
              </div>
              <div className="p-3 rounded-lg bg-[#121217] border border-zinc-900 truncate">
                <span className="text-zinc-500 block">Maior Parcela</span>
                <b className="text-rose-400 text-base font-black font-mono block mt-0.5 truncate">{purchaseStats.max ? formatCurrency(purchaseStats.max.installmentAmount) : 'R$ 0,00'}</b>
              </div>
            </div>

            {/* Tabela de Compras */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#121217] border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider">
                    <th className="py-2 px-3">Compra</th>
                    <th className="py-2 px-3">Cartão</th>
                    <th className="py-2 px-3">Tag/Categoria</th>
                    <th className="py-2 px-3">Parc.</th>
                    <th className="py-2 px-3">Valor Parc.</th>
                    <th className="py-2 px-3">Valor Total</th>
                    <th className="py-2 px-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-zinc-500 text-xs">Nenhuma compra parcelada encontrada.</td>
                    </tr>
                  ) : (
                    filteredPurchases.map((p) => {
                      const card = cards.find((c) => c.id === p.cardId);
                      return (
                        <tr key={p.id} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="py-2 px-3 font-semibold text-white">{p.name}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: card ? `${card.color || '#8b5cf6'}15` : '#4b556315', color: card ? (card.color || '#8b5cf6') : '#9ca3af' }}>
                              {card ? card.name : 'Outro'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-zinc-300">
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3 text-zinc-500shrink-0" />
                              {p.category || 'Sem Categoria'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-zinc-400">{p.currentInstallment}/{p.installmentCount}</td>
                          <td className="py-2 px-3 font-mono font-bold text-rose-400">{formatCurrency(p.installmentAmount)}</td>
                          <td className="py-2 px-3 font-mono text-zinc-400">{formatCurrency(p.totalAmount)}</td>
                          <td className="py-2 px-3 text-zinc-500 font-mono">{formatDateDisplay(p.purchaseDate)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: PROJEÇÕES FUTURAS */}
      {activeSubTab === 'projecoes' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#0f0f13] border border-zinc-800 shadow-xl">
            <h3 className="text-sm font-black text-white mb-1 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-violet-400" /> Projeção de Faturas de Cartão (Próximos 6 Meses)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
              Análise estratégica e linha do tempo de faturamento pré-comprometido para manter suas despesas organizadas e dentro do limite ("caber no bolso").
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projections.map((proj, index) => {
              const capRatio = totals.salario > 0 ? Math.min(100, Math.round((proj.total / totals.salario) * 100)) : 0;
              return (
                <div key={`${proj.year}-${proj.monthName}`} className="p-4 rounded-xl bg-[#0b0b0e] border border-zinc-800 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center border-b border-zinc-850 pb-2 mb-3">
                      <span className="font-bold text-sm text-white">{proj.monthName} / {proj.year}</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">{index + 1}º mês à frente</span>
                    </div>

                    <div className="mb-4">
                      <span className="text-[9px] text-zinc-500 uppercase font-black block">Fatura Total Projetada</span>
                      <span className="text-xl font-black font-mono text-rose-400">{formatCurrency(proj.total)}</span>
                    </div>

                    <div className="space-y-1.5 min-h-24">
                      {proj.breakdown.filter((ci) => ci.total > 0).length === 0 ? (
                        <div className="py-6 text-center text-zinc-600 text-xs">Fatura zerada para este mês.</div>
                      ) : (
                        proj.breakdown
                          .filter((ci) => ci.total > 0)
                          .map((ci) => (
                            <div key={ci.card.id} className="flex justify-between text-xs p-1.5 rounded bg-[#121217] border border-zinc-900">
                              <span className="font-semibold text-zinc-300">{ci.card.name}</span>
                              <span className="font-mono text-zinc-400">{formatCurrency(ci.total)}</span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-zinc-900">
                    <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                      <span>Exposição da Renda Est.</span>
                      <span className="font-bold text-zinc-300">{capRatio}%</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full" style={{ width: `${capRatio}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-[#0b0b0e] border border-zinc-850 flex gap-3.5 items-start text-xs leading-relaxed max-w-4xl">
            <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <b className="text-white">Dica de Diagnóstico Estratégico:</b>
              <p className="text-zinc-400 mt-1">
                Conforme as parcelas de faturas antigas chegam ao fim, o comprometimento do seu limite é reduzido.
                Mantenha a soma de suas faturas estimadas sempre abaixo de 30% da sua renda mensal para garantir um fluxo de caixa saudável e evitar o superendividamento.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
