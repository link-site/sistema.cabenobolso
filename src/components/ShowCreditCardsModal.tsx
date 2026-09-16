import React from 'react';
import { X, CreditCard as CreditCardIcon, Plus, ExternalLink, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { CreditCard, CardPurchase } from '../types';
import {
  formatCurrency,
  formatDateDisplay,
  parseDateMonthYear,
  getActiveCardBillingMonth,
  MONTH_NAMES,
} from '../utils/formatters';

interface ShowCreditCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CreditCard[];
  cardPurchases?: CardPurchase[];
  onNavigateToCards: () => void;
  onOpenAddNewCard: () => void;
  onTogglePaid: (id: string) => void;
}

export const ShowCreditCardsModal: React.FC<ShowCreditCardsModalProps> = ({
  isOpen,
  onClose,
  cards,
  cardPurchases = [],
  onNavigateToCards,
  onOpenAddNewCard,
  onTogglePaid,
}) => {
  if (!isOpen) return null;

  const activeBilling = getActiveCardBillingMonth();

  const getCardInvoice = (c: CreditCard) => {
    const list = cardPurchases.filter((p) => p.cardId === c.id);
    if (list.length > 0) {
      const curMonthList = list.filter((p) => {
        const { year, month } = parseDateMonthYear(p.billingDate);
        return year === activeBilling.year && month === activeBilling.month;
      });
      return curMonthList.reduce((sum, item) => sum + item.installmentAmount, 0);
    }
    return c.currentInvoice;
  };

  const totalInvoices = cards.reduce((acc, c) => acc + getCardInvoice(c), 0);
  const totalLimits = cards.reduce((acc, c) => acc + c.limit, 0);

  return (
    <div
      id="modal-show-cards-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="modal-show-cards-container"
        className="bg-[#0f0f12] border border-[#27272a] rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col"
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
              <h2 className="text-lg font-bold text-white tracking-wide">
                Cartões de Crédito Cadastrados
              </h2>
              <p className="text-xs text-zinc-400">
                Visualização rápida dos cartões gerenciados no Menu Cartões de Crédito
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

        {/* Resumo rápido */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-3.5">
            <span className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">
              Faturas em Aberto ({MONTH_NAMES[activeBilling.month]})
            </span>
            <span className="text-lg font-bold font-mono-num text-rose-400">
              {formatCurrency(totalInvoices)}
            </span>
          </div>
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-3.5">
            <span className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">
              Limite Total Disponível
            </span>
            <span className="text-lg font-bold font-mono-num text-[#00ff7f]">
              {formatCurrency(Math.max(0, totalLimits - totalInvoices))}
            </span>
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
              const invoiceVal = getCardInvoice(card);
              const usedPercent = Math.min(100, Math.round((invoiceVal / card.limit) * 100));
              const available = Math.max(0, card.limit - invoiceVal);

              return (
                <div
                  key={card.id}
                  className="bg-[#141417] border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shadow-inner"
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
                        <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            Fechamento: Dia {card.closingDay || 1}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            Vencimento: Dia {card.dueDay || card.dueDate || 10}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-zinc-400 block">
                        Fatura ({MONTH_NAMES[activeBilling.month]})
                      </span>
                      <span className="text-base font-bold font-mono-num text-rose-400">
                        {formatCurrency(invoiceVal)}
                      </span>
                    </div>
                  </div>

                  {/* Barra de limite */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                      <span>Limite usado: {usedPercent}%</span>
                      <span className="text-[#00ff7f]">Disponível: {formatCurrency(available)}</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
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

                  {/* Status pagamento */}
                  <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onTogglePaid(card.id)}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors ${
                        card.paidThisMonth
                          ? 'bg-[#00ff7f]/15 text-[#00ff7f] border border-[#00ff7f]/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                      }`}
                    >
                      {card.paidThisMonth ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Fatura Paga
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" /> Fatura em Aberto (Clique p/ Pagar)
                        </>
                      )}
                    </button>
                    <span className="text-xs text-zinc-500">
                      Limite Total: {formatCurrency(card.limit)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-3 mt-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddNewCard();
            }}
            className="px-4 py-2.5 rounded-xl bg-[#00ff7f] text-black font-bold text-xs uppercase tracking-wider hover:bg-[#10ef80] transition-colors flex items-center gap-2 shadow-lg shadow-[#00ff7f]/20"
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
            Ir para Menu Cartões
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
