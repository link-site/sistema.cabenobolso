import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Calendar,
  CreditCard as CreditCardIcon,
  Tag as TagIcon,
  Trash2,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  ShoppingBag,
  Info,
  Camera,
  Pencil,
} from 'lucide-react';
import { CreditCard, CardPurchase } from '../types';
import {
  formatCurrency,
  formatDateDisplay,
  MONTH_NAMES,
  MONTH_ABBR,
  YEARS_UP_TO_2030,
  parseDateMonthYear,
  getActiveCardBillingMonth,
} from '../utils/formatters';
import { AddCardPurchaseModal } from './AddCardPurchaseModal';
import { EditCardPurchaseModal } from './EditCardPurchaseModal';

interface CardDetailViewProps {
  card: CreditCard;
  cardPurchases: CardPurchase[];
  onBack: () => void;
  onAddPurchase: (params: {
    cardId: string;
    name: string;
    totalAmount: number;
    installmentCount: number;
    purchaseDate: string;
    startBillingDate: string;
    category?: string;
    notes?: string;
  }) => void;
  onDeletePurchase: (id: string) => void;
  onDeletePurchaseGroup: (groupId: string) => void;
  onUpdatePurchase?: (id: string, updated: Partial<CardPurchase>) => void;
  onUpdatePurchaseGroup?: (
    groupId: string,
    updates: {
      name?: string;
      category?: string;
      installmentAmount?: number;
      totalAmount?: number;
      purchaseDate?: string;
    }
  ) => void;
  onToggleCardPaid: (cardId: string) => void;
  onDeleteCard?: (id: string) => void;
}

export const CardDetailView: React.FC<CardDetailViewProps> = ({
  card,
  cardPurchases,
  onBack,
  onAddPurchase,
  onDeletePurchase,
  onDeletePurchaseGroup,
  onUpdatePurchase,
  onUpdatePurchaseGroup,
  onToggleCardPaid,
  onDeleteCard,
}) => {
  // Mês e ano ativo da fatura do cartão (mês seguinte ao calendário atual)
  const activeBilling = useMemo(() => getActiveCardBillingMonth(), []);
  const [selectedYear, setSelectedYear] = useState<number>(activeBilling.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(activeBilling.month);
  const [viewAllMonths, setViewAllMonths] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal for adding purchases
  const [isAddPurchaseModalOpen, setIsAddPurchaseModalOpen] = useState<boolean>(false);

  // Modal for editing purchases
  const [editingPurchase, setEditingPurchase] = useState<CardPurchase | null>(null);

  // In-app deletion states (replaces window.confirm for iframe reliability)
  const [purchaseToDelete, setPurchaseToDelete] = useState<CardPurchase | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<{
    groupId: string;
    name: string;
    count: number;
  } | null>(null);
  const [showDeleteCardModal, setShowDeleteCardModal] = useState<boolean>(false);

  // Filter purchases for this specific card, sorted with most recent date first
  const thisCardPurchases = useMemo(() => {
    return cardPurchases
      .filter((p) => p.cardId === card.id)
      .sort((a, b) => {
        const dateA = a.purchaseDate || a.billingDate || '';
        const dateB = b.purchaseDate || b.billingDate || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        const billA = a.billingDate || '';
        const billB = b.billingDate || '';
        if (billA !== billB) {
          return billB.localeCompare(billA);
        }
        return b.currentInstallment - a.currentInstallment;
      });
  }, [cardPurchases, card.id]);

  // Calculate totals per month for this year to display in month tabs
  const monthSums = useMemo(() => {
    const sums: { [key: number]: { count: number; total: number } } = {};
    for (let m = 0; m < 12; m++) {
      sums[m] = { count: 0, total: 0 };
    }

    thisCardPurchases.forEach((p) => {
      const { year, month } = parseDateMonthYear(p.billingDate);
      if (year === selectedYear) {
        if (!sums[month]) {
          sums[month] = { count: 0, total: 0 };
        }
        sums[month].count += 1;
        sums[month].total += p.installmentAmount;
      }
    });

    return sums;
  }, [thisCardPurchases, selectedYear]);

  // Filter purchases based on active selection (year + month or all) & search query,
  // ordered with most recent dates on top and older ones below
  const filteredPurchases = useMemo(() => {
    const list = thisCardPurchases.filter((p) => {
      // Name search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesCat = p.category ? p.category.toLowerCase().includes(query) : false;
        if (!matchesName && !matchesCat) return false;
      }

      if (viewAllMonths) return true;

      const { year, month } = parseDateMonthYear(p.billingDate);
      return year === selectedYear && month === selectedMonth;
    });

    return [...list].sort((a, b) => {
      // 1. Data da Compra (mais recente em cima, antiga embaixo)
      const dateA = a.purchaseDate || a.billingDate || '';
      const dateB = b.purchaseDate || b.billingDate || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      // 2. Data de Faturamento/Vencimento
      const billA = a.billingDate || '';
      const billB = b.billingDate || '';
      if (billA !== billB) {
        return billB.localeCompare(billA);
      }

      // 3. Parcela (parcela mais recente/avançada primeiro)
      if (a.currentInstallment !== b.currentInstallment) {
        return b.currentInstallment - a.currentInstallment;
      }

      // 4. Nome da compra
      return a.name.localeCompare(b.name);
    });
  }, [thisCardPurchases, selectedYear, selectedMonth, viewAllMonths, searchTerm]);

  // Month invoice calculation (from actual purchases or fallback to card invoice)
  const currentMonthInvoiceTotal = useMemo(() => {
    const monthPurchases = thisCardPurchases.filter((p) => {
      const { year, month } = parseDateMonthYear(p.billingDate);
      return year === selectedYear && month === selectedMonth;
    });

    const sumPurchases = monthPurchases.reduce((acc, p) => acc + p.installmentAmount, 0);
    return sumPurchases;
  }, [thisCardPurchases, selectedYear, selectedMonth]);

  // Total of all upcoming purchases for this card
  const totalAllCardPurchases = useMemo(() => {
    return thisCardPurchases.reduce((acc, p) => acc + p.installmentAmount, 0);
  }, [thisCardPurchases]);

  // Available limit based on card limit minus invoice
  const invoiceForLimit = thisCardPurchases.length > 0 ? currentMonthInvoiceTotal : card.currentInvoice;
  const availableLimit = Math.max(0, card.limit - invoiceForLimit);

  return (
    <div id="screen-card-movimentacoes" className="space-y-6 pb-16 animate-fadeIn">
      {/* Top Header with Back Button and Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0f0f13] border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            id="btn-voltar-cartoes"
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar aos Cartões</span>
          </button>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">{card.name}</h2>
              <span
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: card.color || '#00ff7f' }}
              />
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30">
                Movimentações & Faturas
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Fechamento todo dia <strong className="text-zinc-200">{card.closingDay || 1}</strong> • Dia do Vencimento:{' '}
              <strong className="text-zinc-200">{card.dueDay || card.dueDate || 10}</strong> • Limite Total:{' '}
              <strong className="text-zinc-200">{formatCurrency(card.limit)}</strong>
            </p>
          </div>
        </div>

        {/* Botão Adicionar Compras & Excluir Cartão */}
        <div className="flex items-center gap-2">
          {onDeleteCard && (
            <button
              id="btn-excluir-cartao-detalhe"
              type="button"
              onClick={() => setShowDeleteCardModal(true)}
              className="flex items-center gap-1.5 px-3 py-3 rounded-xl bg-zinc-900 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 text-xs font-semibold transition-all"
              title="Excluir este cartão"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Excluir Cartão</span>
            </button>
          )}

          <button
            id="btn-abrir-importar-print"
            type="button"
            onClick={() => setIsAddPurchaseModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs sm:text-sm border border-zinc-700/60 hover:border-[#00ff7f]/50 transition-all shadow"
            title="Importar compras através de foto ou print do extrato do cartão"
          >
            <Camera className="w-4 h-4 text-[#00ff7f]" />
            <span className="hidden sm:inline">Importar Print</span>
          </button>

          <button
            id="btn-abrir-adicionar-compras"
            type="button"
            onClick={() => setIsAddPurchaseModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg shadow-[#00ff7f]/25 hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Adicionar Compras</span>
          </button>
        </div>
      </div>

      {/* Card Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fatura do Mês Selecionado */}
        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-4 relative overflow-hidden">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Fatura {MONTH_NAMES[selectedMonth]} / {selectedYear}
          </span>
          <span className="text-2xl font-black font-mono-num text-rose-400 block mt-1">
            {formatCurrency(
              thisCardPurchases.length > 0
                ? currentMonthInvoiceTotal
                : card.currentInvoice
            )}
          </span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">
              {monthSums[selectedMonth]?.count || 0} {monthSums[selectedMonth]?.count === 1 ? 'compra' : 'compras'}
            </span>
            <button
              type="button"
              onClick={() => onToggleCardPaid(card.id)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                card.paidThisMonth
                  ? 'bg-[#00ff7f]/15 border-[#00ff7f]/40 text-[#00ff7f]'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
              }`}
            >
              {card.paidThisMonth ? 'Fatura Paga' : 'Em Aberto'}
            </button>
          </div>
        </div>

        {/* Limite Disponível */}
        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Limite Disponível
          </span>
          <span className="text-2xl font-black font-mono-num text-[#00ff7f] block mt-1">
            {formatCurrency(availableLimit)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Poder de compra restante do cartão
          </span>
        </div>

        {/* Total Comprometido em Parcelas Futuras */}
        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Total em Parcelas Cadastradas
          </span>
          <span className="text-2xl font-black font-mono-num text-amber-300 block mt-1">
            {formatCurrency(totalAllCardPurchases)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {thisCardPurchases.length} parcelas ao longo do tempo
          </span>
        </div>

        {/* Limite Total */}
        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Limite Concedido
          </span>
          <span className="text-2xl font-black font-mono-num text-white block mt-1">
            {formatCurrency(card.limit)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Fechamento e vencimento: Dia {card.dueDate}
          </span>
        </div>
      </div>

      {/* Month & Year Navigation: Incluindo Ano até 2030 e Meses com parcelas */}
      <div className="bg-[#0f0f13] border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Year Selector (2024 to 2030) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#00ff7f]" />
              Ano:
            </span>
            <div className="flex flex-wrap gap-1 bg-[#16161d] p-1 rounded-xl border border-zinc-800">
              {YEARS_UP_TO_2030.map((yr) => (
                <button
                  key={yr}
                  id={`btn-ano-${yr}`}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedYear === yr
                      ? 'bg-[#00ff7f] text-black shadow-md shadow-[#00ff7f]/20 font-black'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle All Months & Search */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar compras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#16161d] border border-zinc-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#00ff7f]"
              />
            </div>

            <button
              id="btn-toggle-ver-todas-parcelas"
              type="button"
              onClick={() => setViewAllMonths(!viewAllMonths)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                viewAllMonths
                  ? 'bg-[#00ff7f]/20 border-[#00ff7f] text-[#00ff7f]'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white'
              }`}
            >
              {viewAllMonths ? '✓ Todas as Parcelas' : 'Ver Todas as Parcelas'}
            </button>
          </div>
        </div>

        {/* 12 Months Selector Tabs */}
        {!viewAllMonths && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5 pt-2 border-t border-zinc-800/60">
            {MONTH_NAMES.map((mName, idx) => {
              const isSelected = selectedMonth === idx;
              const info = monthSums[idx] || { count: 0, total: 0 };

              return (
                <button
                  key={idx}
                  id={`btn-mes-${idx}`}
                  type="button"
                  onClick={() => setSelectedMonth(idx)}
                  className={`p-2 rounded-xl text-center flex flex-col items-center justify-between min-h-[58px] transition-all border ${
                    isSelected
                      ? 'bg-[#00ff7f]/15 border-[#00ff7f] text-white shadow-md shadow-[#00ff7f]/10'
                      : 'bg-[#14141a] border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${
                      isSelected ? 'text-[#00ff7f]' : 'text-zinc-300'
                    }`}
                  >
                    {MONTH_ABBR[idx]}
                  </span>

                  {info.count > 0 ? (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-mono-num font-bold text-white">
                        {formatCurrency(info.total)}
                      </span>
                      <span className="text-[9px] text-zinc-500">
                        {info.count} comp.
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-600 font-mono">-</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de Movimentações Organizada em Lista */}
      <div className="bg-[#0f0f13] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">
              {viewAllMonths
                ? 'Todas as Compras & Parcelas do Cartão'
                : `Compras & Parcelas de ${MONTH_NAMES[selectedMonth]} de ${selectedYear}`}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] font-bold text-zinc-300">
              {filteredPurchases.length} movimentação(ões)
            </span>
          </div>

          <span className="text-xs text-zinc-400 font-mono-num">
            Subtotal:{' '}
            <strong className="text-[#00ff7f]">
              {formatCurrency(
                filteredPurchases.reduce((acc, p) => acc + p.installmentAmount, 0)
              )}
            </strong>
          </span>
        </div>

        {filteredPurchases.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto mb-3">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-zinc-300">
              Nenhuma compra encontrada{' '}
              {viewAllMonths
                ? 'neste cartão.'
                : `para ${MONTH_NAMES[selectedMonth]} de ${selectedYear}.`}
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Clique no botão abaixo para registrar compras à vista ou parceladas nos próximos meses.
            </p>
            <button
              type="button"
              onClick={() => setIsAddPurchaseModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-[#00ff7f] text-black font-bold text-xs hover:bg-[#10ef80] transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Adicionar compras</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-[#14141a]/60 text-[11px] uppercase tracking-wider text-zinc-400 font-bold">
                  <th className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#00ff7f]" />
                      <span>Data Compra</span>
                      <span className="text-[10px] text-zinc-500 font-normal lowercase tracking-normal">
                        (recentes 1º)
                      </span>
                    </div>
                  </th>
                  <th className="py-3 px-4">Nome da Compra</th>
                  <th className="py-3 px-4">Parcela</th>
                  <th className="py-3 px-4">Mês de Cobrança</th>
                  <th className="py-3 px-4 text-right">Valor da Parcela</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-xs">
                {filteredPurchases.map((purchase) => {
                  const isInstallment = purchase.installmentCount > 1;

                  return (
                    <tr
                      key={purchase.id}
                      id={`row-compra-${purchase.id}`}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      {/* Data da Compra */}
                      <td className="py-3 px-4 text-zinc-300 font-mono-num whitespace-nowrap">
                        {formatDateDisplay(purchase.purchaseDate)}
                      </td>

                      {/* Nome da Compra */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm">
                            {purchase.name}
                          </span>
                          {purchase.category && (
                            <span className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                              <TagIcon className="w-2.5 h-2.5 text-[#00ff7f]" />
                              {purchase.category}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Parcela */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isInstallment ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/30 text-amber-300 font-mono font-bold text-[11px]">
                            {purchase.currentInstallment}/{purchase.installmentCount}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f] font-mono font-bold text-[11px]">
                            À vista
                          </span>
                        )}
                      </td>

                      {/* Mês da Fatura de Cobrança */}
                      <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          {formatDateDisplay(purchase.billingDate)}
                        </span>
                      </td>

                      {/* Valor da Parcela */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-[#00ff7f] text-sm">
                        {formatCurrency(purchase.installmentAmount)}
                      </td>

                      {/* Valor Total da Compra */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-zinc-400">
                        {formatCurrency(purchase.totalAmount)}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Editar Compra */}
                          <button
                            type="button"
                            id={`btn-edit-purchase-${purchase.id}`}
                            title="Editar informações desta compra"
                            onClick={() => setEditingPurchase(purchase)}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-[#00ff7f] hover:bg-[#00ff7f]/15 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Excluir Parcela Individual */}
                          <button
                            type="button"
                            title="Excluir esta parcela específica"
                            onClick={() => setPurchaseToDelete(purchase)}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Se for parcelada, permitir excluir compra inteira (todas parcelas) */}
                          {isInstallment && purchase.purchaseGroupId && (
                            <button
                              type="button"
                              title="Excluir compra completa (todas as parcelas)"
                              onClick={() =>
                                setGroupToDelete({
                                  groupId: purchase.purchaseGroupId,
                                  name: purchase.name,
                                  count: purchase.installmentCount,
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-[10px] font-bold transition-colors"
                            >
                              Excluir Tudo
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Adicionar Compras */}
      <AddCardPurchaseModal
        isOpen={isAddPurchaseModalOpen}
        onClose={() => setIsAddPurchaseModalOpen(false)}
        card={card}
        onAddPurchase={onAddPurchase}
      />

      {/* Modal de Confirmação: Excluir Parcela Específica */}
      {purchaseToDelete && (
        <div
          id="modal-confirm-delete-parcel"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setPurchaseToDelete(null)}
        >
          <div
            className="bg-[#0f0f13] border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 0 35px rgba(244, 63, 94, 0.2)' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white text-center">
              Excluir Parcela
            </h3>

            <p className="text-sm text-zinc-300 text-center mt-2">
              Deseja excluir a parcela{' '}
              <strong className="text-white">
                {purchaseToDelete.currentInstallment}/{purchaseToDelete.installmentCount}
              </strong>{' '}
              de <strong className="text-white font-semibold">"{purchaseToDelete.name}"</strong> (
              <span className="text-[#00ff7f] font-mono font-bold">
                {formatCurrency(purchaseToDelete.installmentAmount)}
              </span>
              )?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPurchaseToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-excluir-parcela"
                onClick={() => {
                  const id = purchaseToDelete.id;
                  setPurchaseToDelete(null);
                  onDeletePurchase(id);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-rose-600/25"
              >
                Excluir Parcela
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação: Excluir Compra Completa (Todas as parcelas) */}
      {groupToDelete && (
        <div
          id="modal-confirm-delete-group"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setGroupToDelete(null)}
        >
          <div
            className="bg-[#0f0f13] border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 0 35px rgba(244, 63, 94, 0.2)' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white text-center">
              Excluir Compra Completa
            </h3>

            <p className="text-sm text-zinc-300 text-center mt-2">
              Deseja excluir a compra completa{' '}
              <strong className="text-white font-semibold">"{groupToDelete.name}"</strong> e todas as suas{' '}
              <strong className="text-rose-400">{groupToDelete.count} parcelas</strong> lançadas nos meses seguintes?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-excluir-grupo"
                onClick={() => {
                  const gId = groupToDelete.groupId;
                  setGroupToDelete(null);
                  onDeletePurchaseGroup(gId);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-rose-600/25"
              >
                Excluir Todas as Parcelas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação: Excluir Cartão a partir desta tela */}
      {showDeleteCardModal && onDeleteCard && (
        <div
          id="modal-confirm-delete-card-from-detail"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowDeleteCardModal(false)}
        >
          <div
            className="bg-[#0f0f13] border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 0 35px rgba(244, 63, 94, 0.2)' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white text-center">
              Excluir Cartão de Crédito
            </h3>

            <p className="text-sm text-zinc-300 text-center mt-2">
              Tem certeza que deseja remover o cartão{' '}
              <strong className="text-white font-semibold">"{card.name}"</strong>?
            </p>

            <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              ⚠️ Todas as compras e parcelas deste cartão serão excluídas definitivamente.
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteCardModal(false)}
                className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-excluir-cartao-detalhe"
                onClick={() => {
                  setShowDeleteCardModal(false);
                  onDeleteCard(card.id);
                  onBack();
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-rose-600/25"
              >
                Sim, Excluir Cartão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Compra / Parcela */}
      <EditCardPurchaseModal
        isOpen={!!editingPurchase}
        onClose={() => setEditingPurchase(null)}
        purchase={editingPurchase}
        onSaveSingle={(id, updated) => {
          if (onUpdatePurchase) {
            onUpdatePurchase(id, updated);
          }
        }}
        onSaveGroup={(groupId, updates) => {
          if (onUpdatePurchaseGroup) {
            onUpdatePurchaseGroup(groupId, updates);
          }
        }}
      />
    </div>
  );
};
