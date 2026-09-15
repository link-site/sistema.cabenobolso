import React, { useState } from 'react';
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
} from 'lucide-react';
import { CreditCard } from '../types';
import { formatCurrency, formatDateDisplay } from '../utils/formatters';
import { AddCreditCardModal } from './AddCreditCardModal';

interface CreditCardsViewProps {
  cards: CreditCard[];
  onAddCard: (card: Omit<CreditCard, 'id' | 'tag'>) => void;
  onUpdateCard: (id: string, updated: Partial<CreditCard>) => void;
  onDeleteCard: (id: string) => void;
  onTogglePaid: (id: string) => void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}

export const CreditCardsView: React.FC<CreditCardsViewProps> = ({
  cards,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onTogglePaid,
  isAddModalOpen,
  setIsAddModalOpen,
}) => {
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);

  // Quick purchase adjustment modal / state
  const [adjustCardId, setAdjustCardId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');

  const totalInvoices = cards.reduce((acc, c) => acc + c.currentInvoice, 0);
  const totalLimits = cards.reduce((acc, c) => acc + c.limit, 0);
  const totalAvailable = Math.max(0, totalLimits - totalInvoices);
  const averageUsage =
    totalLimits > 0 ? Math.min(100, Math.round((totalInvoices / totalLimits) * 100)) : 0;

  const handleOpenEdit = (card: CreditCard) => {
    setEditingCard(card);
    setIsAddModalOpen(true);
  };

  const handleSaveCard = (cardData: Omit<CreditCard, 'id' | 'tag'>) => {
    if (editingCard) {
      onUpdateCard(editingCard.id, cardData);
      setEditingCard(null);
    } else {
      onAddCard(cardData);
    }
  };

  const handleAddPurchaseToCard = (card: CreditCard) => {
    const val = parseFloat(adjustAmount.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      const newInvoice = card.currentInvoice + val;
      onUpdateCard(card.id, { currentInvoice: newInvoice });
      setAdjustCardId(null);
      setAdjustAmount('');
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
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Cartões de Crédito
              </h2>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30">
                Gestão Própria
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Controle suas faturas, limites e datas de vencimento de forma independente
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
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg shadow-[#00ff7f]/25 hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Adicionar Cartão de Crédito</span>
        </button>
      </div>

      {/* Cards Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Fatura Total em Aberto
          </span>
          <span className="text-2xl font-black font-mono-num text-rose-400 block mt-1">
            {formatCurrency(totalInvoices)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Soma de todas as faturas cadastradas
          </span>
        </div>

        <div className="bg-[#121217] border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Limite Disponível
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

      {/* Grid of Credit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const usedPct = Math.min(100, Math.round((card.currentInvoice / card.limit) * 100));
          const availableLimit = Math.max(0, card.limit - card.currentInvoice);

          return (
            <div
              key={card.id}
              id={`card-item-${card.id}`}
              className="bg-[#0f0f13] border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 shadow-xl transition-all relative flex flex-col justify-between"
            >
              {/* Card visual mockup top */}
              <div>
                <div
                  className="rounded-xl p-4 text-white shadow-lg relative overflow-hidden mb-4"
                  style={{
                    backgroundColor: card.color || '#27272a',
                    backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(0,0,0,0.4))',
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
                    <div>
                      <span className="text-[9px] uppercase opacity-60 block">Vencimento</span>
                      <span className="font-semibold">{formatDateDisplay(card.dueDate)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase opacity-60 block">Limite Total</span>
                      <span className="font-semibold">{formatCurrency(card.limit)}</span>
                    </div>
                  </div>
                </div>

                {/* Card details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
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
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                        Fatura Atual
                      </span>
                      <span className="text-lg font-black font-mono-num text-rose-400">
                        {formatCurrency(card.currentInvoice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
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

                  {/* Quick Add Purchase */}
                  {adjustCardId === card.id ? (
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 space-y-2">
                      <label className="text-xs font-semibold text-zinc-300 block">
                        Lançar Gasto/Compra nesta fatura:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Valor R$ (ex: 85,90)"
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(e.target.value)}
                          className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddPurchaseToCard(card)}
                          className="px-3 py-1.5 bg-[#00ff7f] text-black font-bold text-xs rounded-lg hover:bg-[#10ef80]"
                        >
                          Adicionar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustCardId(null);
                            setAdjustAmount('');
                          }}
                          className="px-2 py-1.5 bg-zinc-800 text-zinc-400 text-xs rounded-lg hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAdjustCardId(card.id)}
                      className="w-full py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-zinc-700/60 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#00ff7f]" />
                      Lançar Compra / Adicionar Valor
                    </button>
                  )}
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onTogglePaid(card.id)}
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
                    onClick={() => handleOpenEdit(card)}
                    title="Editar dados do cartão"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCard(card.id)}
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
              Cadastre seus cartões de crédito para controlar faturas, limites e dias de vencimento.
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

      <AddCreditCardModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCard(null);
        }}
        onSave={handleSaveCard}
        editingCard={editingCard}
      />
    </div>
  );
};
