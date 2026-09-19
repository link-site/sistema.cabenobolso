import React, { useState, useMemo } from 'react';
import {
  CreditCard as CreditCardIcon,
  Plus,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Tag,
  ArrowUpRight,
  ArrowRight,
  ShoppingBag,
  Layers,
} from 'lucide-react';
import { CreditCard, CardPurchase } from '../types';
import {
  formatCurrency,
  formatDateDisplay,
  parseDateMonthYear,
  getActiveCardBillingMonth,
  MONTH_NAMES,
} from '../utils/formatters';
import { AddCreditCardModal } from './AddCreditCardModal';
import { CardDetailView } from './CardDetailView';
import { AddCardPurchaseModal } from './AddCardPurchaseModal';

interface CreditCardsViewProps {
  cards: CreditCard[];
  cardPurchases: CardPurchase[];
  onAddCard: (card: Omit<CreditCard, 'id' | 'tag'>) => void;
  onUpdateCard: (id: string, updated: Partial<CreditCard>) => void;
  onDeleteCard: (id: string) => void;
  onTogglePaid: (id: string) => void;
  onAddCardPurchase: (params: {
    cardId: string;
    name: string;
    totalAmount: number;
    installmentCount: number;
    currentInstallment?: number;
    installmentAmount?: number;
    purchaseDate: string;
    startBillingDate: string;
    category?: string;
    notes?: string;
  }) => void;
  onDeleteCardPurchase: (id: string) => void;
  onDeleteCardPurchaseGroup: (groupId: string) => void;
  onUpdateCardPurchase?: (id: string, updated: Partial<CardPurchase>) => void;
  onUpdateCardPurchaseGroup?: (
    groupId: string,
    updates: {
      name?: string;
      category?: string;
      installmentAmount?: number;
      totalAmount?: number;
      purchaseDate?: string;
    }
  ) => void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}

export const CreditCardsView: React.FC<CreditCardsViewProps> = ({
  cards,
  cardPurchases,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onTogglePaid,
  onAddCardPurchase,
  onDeleteCardPurchase,
  onDeleteCardPurchaseGroup,
  onUpdateCardPurchase,
  onUpdateCardPurchaseGroup,
  isAddModalOpen,
  setIsAddModalOpen,
}) => {
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);

  // Selected card to view detailed movements / transactions screen
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Direct modal trigger for adding purchases
  const [purchaseModalCard, setPurchaseModalCard] = useState<CreditCard | null>(null);

  const selectedCard = useMemo(() => {
    return cards.find((c) => c.id === selectedCardId) || null;
  }, [cards, selectedCardId]);

  // If a card is selected, render the dedicated movements/faturas screen
  if (selectedCard) {
    return (
      <CardDetailView
        card={selectedCard}
        cardPurchases={cardPurchases}
        onBack={() => setSelectedCardId(null)}
        onAddPurchase={onAddCardPurchase}
        onDeletePurchase={onDeleteCardPurchase}
        onDeletePurchaseGroup={onDeleteCardPurchaseGroup}
        onUpdatePurchase={onUpdateCardPurchase}
        onUpdatePurchaseGroup={onUpdateCardPurchaseGroup}
        onToggleCardPaid={onTogglePaid}
        onDeleteCard={(id) => {
          setSelectedCardId(null);
          onDeleteCard(id);
        }}
      />
    );
  }

  // Mês atual no card do cartão é sempre o mês seguinte ao mês calendário atual.
  // Exemplo: se estamos em setembro, o mês atual da fatura é outubro.
  const activeBilling = getActiveCardBillingMonth();
  const curYear = activeBilling.year;
  const curMonth = activeBilling.month;

  const totalInvoices = cards.reduce((acc, c) => {
    const cardPurchasesList = cardPurchases.filter((p) => p.cardId === c.id);
    if (cardPurchasesList.length > 0) {
      const pForCard = cardPurchasesList.filter((p) => {
        const { year, month } = parseDateMonthYear(p.billingDate);
        return year === curYear && month === curMonth;
      });
      return acc + pForCard.reduce((sum, item) => sum + item.installmentAmount, 0);
    }
    return acc + c.currentInvoice;
  }, 0);

  const totalLimits = cards.reduce((acc, c) => acc + c.limit, 0);
  const totalAvailable = Math.max(0, totalLimits - totalInvoices);
  const averageUsage =
    totalLimits > 0 ? Math.min(100, Math.round((totalInvoices / totalLimits) * 100)) : 0;

  const handleOpenEdit = (card: CreditCard, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCard(card);
    setIsAddModalOpen(true);
  };

  const handleDeleteCardClick = (card: CreditCard, e: React.MouseEvent) => {
    e.stopPropagation();
    setCardToDelete(card);
  };

  const handleTogglePaidClick = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePaid(cardId);
  };

  const handleSaveCard = (cardData: Omit<CreditCard, 'id' | 'tag'>) => {
    if (editingCard) {
      onUpdateCard(editingCard.id, cardData);
      setEditingCard(null);
    } else {
      onAddCard(cardData);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0f0f13] border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f] shadow-lg shadow-[#00ff7f]/20">
            <CreditCardIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">Cartões de Crédito</h2>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30">
                Gestão de Compras & Parcelas
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Clique em qualquer cartão para ver as compras, parcelas nos meses seguintes e faturas
            </p>
          </div>
        </div>

        {/* Botão Adicionar Cartão de Crédito */}
        <button
          id="btn-adicionar-cartao"
          onClick={() => {
            setEditingCard(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg shadow-[#00ff7f]/25 hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Adicionar Cartão de Crédito</span>
        </button>
      </div>

      {/* Cards Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
              Fatura Total em Aberto
            </span>
            <span className="text-[10px] font-bold text-[#00ff7f] px-2 py-0.5 rounded-full bg-[#00ff7f]/10 border border-[#00ff7f]/30 uppercase">
              {MONTH_NAMES[curMonth]}
            </span>
          </div>
          <span className="text-2xl font-black font-mono-num text-rose-400 block mt-1">
            {formatCurrency(totalInvoices)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Faturas ativas do cartão ({MONTH_NAMES[curMonth]} de {curYear})
          </span>
        </div>

        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Limite Disponível Geral
          </span>
          <span className="text-2xl font-black font-mono-num text-[#00ff7f] block mt-1">
            {formatCurrency(totalAvailable)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Poder de compra restante
          </span>
        </div>

        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Limite Total Concedido
          </span>
          <span className="text-2xl font-black font-mono-num text-white block mt-1">
            {formatCurrency(totalLimits)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Em {cards.length} cartão(ões) ativo(s)
          </span>
        </div>

        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Uso Geral de Limite
          </span>
          <span className="text-2xl font-black font-mono-num text-amber-300 block mt-1">
            {averageUsage}%
          </span>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                averageUsage > 80
                  ? 'bg-rose-500'
                  : averageUsage > 50
                  ? 'bg-amber-400'
                  : 'bg-[#00ff7f]'
              }`}
              style={{ width: `${averageUsage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-[#00ff7f]" />
          <span>
            <strong>Dica:</strong> Clique no card do cartão para abrir a tela com o botão{' '}
            <strong className="text-white">"Adicionar compras"</strong> e ver a lista organizada de
            movimentações e parcelas mês a mês até 2030.
          </span>
        </div>
      </div>

      {/* Grid of Credit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          // Calculate card purchases for this card
          const cardPurchasesList = cardPurchases.filter((p) => p.cardId === card.id);
          const curMonthPurchases = cardPurchasesList.filter((p) => {
            const { year, month } = parseDateMonthYear(p.billingDate);
            return year === curYear && month === curMonth;
          });

          const currentInvoice =
            cardPurchasesList.length > 0
              ? curMonthPurchases.reduce((sum, p) => sum + p.installmentAmount, 0)
              : card.currentInvoice;

          const usedPct =
            card.limit > 0 ? Math.min(100, Math.round((currentInvoice / card.limit) * 100)) : 0;
          const availableLimit = Math.max(0, card.limit - currentInvoice);

          return (
            <div
              key={card.id}
              id={`card-item-${card.id}`}
              onClick={() => setSelectedCardId(card.id)}
              className="bg-[#0f0f13] border border-zinc-800 hover:border-[#00ff7f]/50 rounded-2xl p-5 shadow-xl transition-all relative flex flex-col justify-between cursor-pointer group hover:shadow-2xl hover:shadow-[#00ff7f]/5 hover:-translate-y-0.5"
            >
              <div>
                {/* Card visual mockup top */}
                <div
                  className="rounded-xl p-4 text-white shadow-lg relative overflow-hidden mb-4 group-hover:scale-[1.01] transition-transform"
                  style={{
                    backgroundColor: card.color || '#27272a',
                    backgroundImage:
                      'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(0,0,0,0.4))',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-7 h-5 rounded bg-amber-300/80 shadow-sm flex items-center justify-center">
                        <div className="w-5 h-3 border border-amber-600/40 rounded-sm" />
                      </div>
                      <span className="text-[10px] font-mono opacity-80">CHIP</span>
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider">
                      {card.name}
                    </span>
                  </div>

                  <div className="mt-5 font-mono text-sm tracking-widest opacity-70">
                    •••• •••• •••• {card.id.slice(-4)}
                  </div>

                  <div className="mt-4 flex items-end justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[9px] uppercase opacity-60 block">Fechamento</span>
                        <span className="font-semibold">Dia {card.closingDay || 1}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase opacity-60 block">Vencimento</span>
                        <span className="font-semibold">Dia {card.dueDay || card.dueDate || 10}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase opacity-60 block">Limite Total</span>
                      <span className="font-semibold">{formatCurrency(card.limit)}</span>
                    </div>
                  </div>
                </div>

                {/* Card details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2 group-hover:text-[#00ff7f] transition-colors">
                      {card.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f] text-[11px] font-bold">
                      <Tag className="w-3 h-3" />
                      {card.tag}
                    </span>
                  </div>

                  {/* Fatura e Limite */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#141418] border border-zinc-800">
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">
                          Fatura do Mês
                        </span>
                        <span className="text-[10px] font-bold text-[#00ff7f] uppercase">
                          ({MONTH_NAMES[curMonth]})
                        </span>
                      </div>
                      <span className="text-lg font-black font-mono-num text-rose-400">
                        {formatCurrency(currentInvoice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-0.5">
                        Disponível
                      </span>
                      <span className="text-lg font-black font-mono-num text-[#00ff7f]">
                        {formatCurrency(availableLimit)}
                      </span>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                      <span>Utilização: {usedPct}%</span>
                      <span>Limite: {formatCurrency(card.limit)}</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usedPct > 85
                            ? 'bg-rose-500'
                            : usedPct > 60
                            ? 'bg-amber-400'
                            : 'bg-[#00ff7f]'
                        }`}
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Badges de Compras Cadastradas */}
                  <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#00ff7f]" />
                      Compras cadastradas:
                    </span>
                    <span className="font-bold text-white font-mono">
                      {cardPurchasesList.length} {cardPurchasesList.length === 1 ? 'Compra' : 'Compras'}
                    </span>
                  </div>

                  {/* Botão de ação: Ver Compras & Movimentações */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCardId(card.id);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-[#00ff7f]/10 hover:bg-[#00ff7f] text-[#00ff7f] hover:text-black border border-[#00ff7f]/30 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Ver Compras & Faturas</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="mt-4 pt-3.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => handleTogglePaidClick(card.id, e)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border transition-all ${
                    card.paidThisMonth
                      ? 'bg-[#00ff7f]/15 border-[#00ff7f] text-[#00ff7f]'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                  }`}
                >
                  {card.paidThisMonth ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff7f]" />
                      <span>Fatura Paga</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 text-rose-400" />
                      <span>Em Aberto</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPurchaseModalCard(card);
                    }}
                    title="Adicionar compra diretamente"
                    className="p-1.5 rounded-lg text-[#00ff7f] hover:bg-[#00ff7f]/10 transition-colors"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleOpenEdit(card, e)}
                    title="Editar dados do cartão"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCardClick(card, e)}
                    title="Excluir cartão"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {cards.length === 0 && (
          <div className="col-span-full py-16 text-center text-zinc-500 bg-[#0c0c0f] border border-zinc-800/80 rounded-2xl">
            <CreditCardIcon className="w-12 h-12 text-zinc-600 mx-auto mb-3 opacity-50" />
            <h3 className="text-base font-bold text-zinc-300">
              Nenhum cartão de crédito cadastrado
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
              Cadastre seus cartões de crédito para controlar faturas, compras parceladas nos meses
              seguintes e limites.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingCard(null);
                setIsAddModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#00ff7f] text-black font-bold text-xs uppercase tracking-wider hover:bg-[#10ef80] transition-all shadow-lg shadow-[#00ff7f]/20"
            >
              Adicionar Primeiro Cartão
            </button>
          </div>
        )}
      </div>

      {/* Modal Adicionar / Editar Cartão */}
      <AddCreditCardModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCard(null);
        }}
        onSave={handleSaveCard}
        editingCard={editingCard}
      />

      {/* Modal Adicionar Compra Rápida se acionada diretamente */}
      {purchaseModalCard && (
        <AddCardPurchaseModal
          isOpen={true}
          onClose={() => setPurchaseModalCard(null)}
          card={purchaseModalCard}
          onAddPurchase={onAddCardPurchase}
        />
      )}

      {/* Modal de Confirmação para Excluir Cartão (Substitui window.confirm para funcionar no iframe) */}
      {cardToDelete && (
        <div
          id="modal-confirm-delete-card"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setCardToDelete(null)}
        >
          <div
            className="bg-[#0f0f13] border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 0 35px rgba(244, 63, 94, 0.2)',
            }}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white text-center">
              Excluir Cartão de Crédito
            </h3>

            <p className="text-sm text-zinc-300 text-center mt-2">
              Tem certeza que deseja excluir o cartão{' '}
              <strong className="text-white font-semibold">"{cardToDelete.name}"</strong>?
            </p>

            <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              ⚠️ Atenção: Todas as compras e faturas vinculadas a este cartão também serão excluídas permanentemente.
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                id="btn-cancel-delete-card"
                onClick={() => setCardToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-card"
                onClick={() => {
                  const targetId = cardToDelete.id;
                  setCardToDelete(null);
                  onDeleteCard(targetId);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-rose-600/25"
              >
                Sim, Excluir Cartão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
