import React, { useState } from 'react';
import {
  X,
  CreditCard as CreditCardIcon,
  Plus,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Clock,
  PlusCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Layers,
  Edit2,
  Check,
  RefreshCw,
} from 'lucide-react';
import { CreditCard, CardPurchase, Transaction } from '../types';
import {
  formatCurrency,
  formatDateDisplay,
  parseDateMonthYear,
  MONTH_NAMES,
  buildClampedDate,
} from '../utils/formatters';
import {
  findCardTransactionForMonth,
  getCardInvoiceForMonthYear,
} from '../utils/creditCardSync';

interface ShowCreditCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CreditCard[];
  cardPurchases?: CardPurchase[];
  selectedYear: number;
  selectedMonth: number;
  transactions?: Transaction[];
  onNavigateToCards: () => void;
  onOpenAddNewCard: () => void;
  onTogglePaid: (id: string) => void;
  onIncludeCardInBudget: (card: CreditCard, amount: number, dueDateStr: string) => void;
}

export const ShowCreditCardsModal: React.FC<ShowCreditCardsModalProps> = ({
  isOpen,
  onClose,
  cards,
  cardPurchases = [],
  selectedYear,
  selectedMonth,
  transactions = [],
  onNavigateToCards,
  onOpenAddNewCard,
  onTogglePaid,
  onIncludeCardInBudget,
}) => {
  // Feedback message when card is included into the monthly list
  const [successMsg, setSuccessMsg] = useState<string>('');
  // Editable amount state per card (cardId -> custom amount string)
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  // Which card is currently having its amount edited
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculates invoice for the selected month/year
  const getCardInvoiceForMonth = (card: CreditCard): number => {
    return getCardInvoiceForMonthYear(card, cardPurchases, selectedYear, selectedMonth);
  };

  // Find if card invoice is already in the monthly transactions list
  const findExistingTransaction = (card: CreditCard): Transaction | undefined => {
    return findCardTransactionForMonth(transactions, card, selectedYear, selectedMonth);
  };

  // Get current effective amount to include (custom or calculated)
  const getEffectiveAmount = (card: CreditCard): number => {
    if (customAmounts[card.id] !== undefined) {
      const clean = customAmounts[card.id].replace(/[^\d.,]/g, '').replace(',', '.');
      const val = parseFloat(clean);
      return isNaN(val) ? 0 : val;
    }
    return getCardInvoiceForMonth(card);
  };

  // Include card invoice into transactions
  const handleIncludeCard = (card: CreditCard) => {
    const amount = getEffectiveAmount(card);
    const dueDay = parseInt(card.dueDate, 10) || 10;
    const dueDateStr = buildClampedDate(selectedYear, selectedMonth, dueDay);

    const existing = findExistingTransaction(card);
    onIncludeCardInBudget(card, amount, dueDateStr);

    if (existing) {
      setSuccessMsg(
        `✓ Fatura do cartão "${card.name}" atualizada com sucesso para ${formatCurrency(amount)} na Lista de Movimentações de ${MONTH_NAMES[selectedMonth]} de ${selectedYear}!`
      );
    } else {
      setSuccessMsg(
        `✓ Fatura do cartão "${card.name}" (${formatCurrency(amount)}) incluída com sucesso na Lista de Movimentações de ${MONTH_NAMES[selectedMonth]} de ${selectedYear}!`
      );
    }

    setTimeout(() => {
      setSuccessMsg('');
    }, 4500);
  };

  // Include all cards that are not yet launched or update them
  const handleIncludeAllCards = () => {
    let count = 0;
    cards.forEach((card) => {
      const amount = getEffectiveAmount(card);
      const dueDay = parseInt(card.dueDate, 10) || 10;
      const dueDateStr = buildClampedDate(selectedYear, selectedMonth, dueDay);
      onIncludeCardInBudget(card, amount, dueDateStr);
      count++;
    });

    if (count > 0) {
      setSuccessMsg(
        `✓ ${count} fatura(s) de cartão sincronizada(s) com sucesso na Lista de Movimentações de ${MONTH_NAMES[selectedMonth]} de ${selectedYear}!`
      );
    }

    setTimeout(() => {
      setSuccessMsg('');
    }, 4500);
  };

  const totalInvoices = cards.reduce((acc, c) => acc + getCardInvoiceForMonth(c), 0);
  const totalLimits = cards.reduce((acc, c) => acc + c.limit, 0);
  const unlaunchedCardsCount = cards.filter((c) => !findExistingTransaction(c)).length;

  return (
    <div
      id="modal-show-cards-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="modal-show-cards-container"
        className="bg-[#0f0f12] border border-[#27272a] rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 0 35px rgba(0, 255, 128, 0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f]">
              <CreditCardIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Cartões de Crédito Cadastrados
              </h2>
              <p className="text-xs text-zinc-400">
                Mês de Referência:{' '}
                <strong className="text-white">
                  {MONTH_NAMES[selectedMonth]} de {selectedYear}
                </strong>{' '}
                • Inclua a fatura diretamente como gasto nas Movimentações
              </p>
            </div>
          </div>
          <button
            id="btn-close-show-cards"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert Message */}
        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/40 text-[#00ff7f] text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Resumo rápido */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-400 uppercase tracking-wider block mb-0.5">
                Faturas ({MONTH_NAMES[selectedMonth]}/{selectedYear})
              </span>
              <span className="text-xl font-bold font-mono-num text-rose-400">
                {formatCurrency(totalInvoices)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-zinc-400 block">Status no Mês</span>
              <span className="text-xs font-bold text-zinc-300">
                {cards.length - unlaunchedCardsCount} de {cards.length} incluídos
              </span>
            </div>
          </div>

          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-400 uppercase tracking-wider block mb-0.5">
                Limite Total Disponível
              </span>
              <span className="text-xl font-bold font-mono-num text-[#00ff7f]">
                {formatCurrency(Math.max(0, totalLimits - totalInvoices))}
              </span>
            </div>
            {unlaunchedCardsCount > 0 && (
              <button
                type="button"
                onClick={handleIncludeAllCards}
                className="px-3 py-1.5 rounded-lg bg-[#00ff7f]/15 hover:bg-[#00ff7f] text-[#00ff7f] hover:text-black border border-[#00ff7f]/30 font-bold text-xs transition-all flex items-center gap-1.5"
                title="Incluir todos os cartões não lançados na lista do mês"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Incluir Todos ({unlaunchedCardsCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Lista de cartões cadastrados */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {cards.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              Nenhum cartão cadastrado ainda. Clique abaixo para cadastrar!
            </div>
          ) : (
            cards.map((card) => {
              const invoiceVal = getCardInvoiceForMonth(card);
              const effectiveAmount = getEffectiveAmount(card);
              const usedPercent = Math.min(100, Math.round((invoiceVal / card.limit) * 100));
              const available = Math.max(0, card.limit - invoiceVal);
              const existingTx = findExistingTransaction(card);
              const isEditing = editingCardId === card.id;

              return (
                <div
                  key={card.id}
                  id={`card-modal-item-${card.id}`}
                  className="bg-[#141417] border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 transition-all space-y-3.5"
                >
                  {/* Top: Card info and Invoice */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-inner"
                        style={{ backgroundColor: card.color || '#8a05be' }}
                      >
                        CARD
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          {card.name}
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30">
                            {card.tag}
                          </span>
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            Fechamento: Dia <strong className="text-zinc-200">{card.closingDay || 1}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            Vencimento: Dia{' '}
                            <strong className="text-zinc-200">{card.dueDay || card.dueDate || 10}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Valor da Fatura com opção de edição */}
                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-zinc-400 block">
                        Fatura ({MONTH_NAMES[selectedMonth]})
                      </span>

                      {isEditing ? (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-zinc-400">R$</span>
                          <input
                            type="text"
                            autoFocus
                            placeholder="0,00"
                            value={
                              customAmounts[card.id] !== undefined
                                ? customAmounts[card.id]
                                : invoiceVal.toFixed(2).replace('.', ',')
                            }
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({
                                ...prev,
                                [card.id]: e.target.value,
                              }))
                            }
                            className="w-24 bg-[#1f1f27] border border-[#00ff7f] rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none text-right"
                          />
                          <button
                            type="button"
                            onClick={() => setEditingCardId(null)}
                            className="p-1 rounded bg-[#00ff7f] text-black hover:bg-[#10ef80]"
                            title="Confirmar valor"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className="text-base font-bold font-mono-num text-rose-400">
                            {formatCurrency(effectiveAmount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingCardId(card.id)}
                            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="Ajustar valor da fatura a ser incluída"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Barra de limite */}
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                      <span>Limite usado: {usedPercent}%</span>
                      <span className="text-[#00ff7f]">Disponível: {formatCurrency(available)}</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all rounded-full ${
                          usedPercent > 80
                            ? 'bg-rose-500'
                            : usedPercent > 50
                            ? 'bg-amber-400'
                            : 'bg-[#00ff7f]'
                        }`}
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Bar: Incluir na Lista de Movimentações do Mês */}
                  <div className="pt-2.5 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Status de Pagamento */}
                    <button
                      type="button"
                      onClick={() => onTogglePaid(card.id)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-auto ${
                        card.paidThisMonth
                          ? 'bg-[#00ff7f]/15 text-[#00ff7f] border border-[#00ff7f]/30'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      {card.paidThisMonth ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff7f]" />
                          <span>Fatura Paga</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Fatura em Aberto</span>
                        </>
                      )}
                    </button>

                    {/* BOTÃO PRINCIPAL: Incluir na lista de movimentações do mês */}
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                      {existingTx ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {Math.abs(existingTx.amount - effectiveAmount) > 0.001 ? (
                            <>
                              <span
                                className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-xl"
                                title={`Lançado no orçamento como ${formatCurrency(existingTx.amount)}, mas a fatura atual é ${formatCurrency(effectiveAmount)}`}
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                <span>No Orçamento: {formatCurrency(existingTx.amount)}</span>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleIncludeCard(card)}
                                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-all font-sans"
                                title="Atualizar valor da fatura nas movimentações do mês"
                              >
                                <RefreshCw className="w-3.5 h-3.5 animate-spin-once" />
                                <span>Atualizar para {formatCurrency(effectiveAmount)}</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-[11px] font-semibold text-[#00ff7f] flex items-center gap-1 bg-[#00ff7f]/10 border border-[#00ff7f]/30 px-2.5 py-1.5 rounded-xl">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Lançado e Atualizado ({formatCurrency(existingTx.amount)})</span>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleIncludeCard(card)}
                                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors"
                                title="Re-sincronizar fatura na lista de movimentações"
                              >
                                Sincronizar
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          id={`btn-incluir-cartao-${card.id}`}
                          onClick={() => handleIncludeCard(card)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-md shadow-[#00ff7f]/20 hover:scale-[1.02]"
                        >
                          <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                          <span>Incluir na Lista do Mês</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-3 mt-4 flex-wrap">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddNewCard();
            }}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Novo Cartão
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateToCards();
            }}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition-colors flex items-center gap-2"
          >
            <span>Ir para Menu Cartões</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
