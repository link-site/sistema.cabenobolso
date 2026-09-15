import React, { useState, useEffect } from 'react';
import { X, CreditCard as CreditCardIcon, DollarSign, Calendar, ShieldCheck, Tag } from 'lucide-react';
import { CreditCard } from '../types';

interface AddCreditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (card: Omit<CreditCard, 'id' | 'tag'>) => void;
  editingCard?: CreditCard | null;
}

const CARD_COLORS = [
  { name: 'Roxo Nubank', value: '#8a05be' },
  { name: 'Laranja Inter', value: '#ff7a00' },
  { name: 'Verde Neon', value: '#00ff7f' },
  { name: 'Azul Escuro / Visa', value: '#1a365d' },
  { name: 'Preto Black / Carbon', value: '#27272a' },
  { name: 'Dourado / Gold', value: '#b45309' },
  { name: 'Vermelho Santander', value: '#dc2626' },
];

export const AddCreditCardModal: React.FC<AddCreditCardModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingCard,
}) => {
  const [name, setName] = useState('');
  const [invoice, setInvoice] = useState('');
  const [limit, setLimit] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [color, setColor] = useState('#8a05be');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingCard) {
        setName(editingCard.name);
        setInvoice(editingCard.currentInvoice.toString());
        setLimit(editingCard.limit.toString());
        setDueDate(editingCard.dueDate);
        setColor(editingCard.color || '#8a05be');
      } else {
        setName('');
        setInvoice('');
        setLimit('');
        // default to 10th of next month
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 10);
        setDueDate(nextMonth.toISOString().split('T')[0]);
        setColor('#8a05be');
      }
      setError('');
    }
  }, [isOpen, editingCard]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, digite o nome do cartão.');
      return;
    }

    const cleanInvoice = invoice.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsedInvoice = parseFloat(cleanInvoice);
    if (isNaN(parsedInvoice) || parsedInvoice < 0) {
      setError('Por favor, insira um valor de fatura válido (pode ser 0).');
      return;
    }

    const cleanLimit = limit.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsedLimit = parseFloat(cleanLimit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      setError('Por favor, informe o limite do cartão (maior que 0).');
      return;
    }

    if (!dueDate) {
      setError('Por favor, informe a data de vencimento.');
      return;
    }

    onSave({
      name: name.trim(),
      currentInvoice: parsedInvoice,
      limit: parsedLimit,
      dueDate,
      color,
      closingDay: 5,
    });

    onClose();
  };

  return (
    <div
      id="modal-creditcard-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="modal-creditcard-container"
        className="bg-[#0f0f12] border border-[#27272a] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 0 35px rgba(0, 255, 128, 0.18)',
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
                {editingCard ? 'Editar Cartão de Crédito' : 'Adicionar Cartão de Crédito'}
              </h2>
              <p className="text-xs text-zinc-400">
                A tag "Cartão de crédito" será incluída automaticamente
              </p>
            </div>
          </div>
          <button
            id="btn-close-card-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Nome do Cartão */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Nome do Cartão
            </label>
            <input
              id="input-card-name"
              type="text"
              required
              placeholder="Ex: Nubank Roxinho, Itaú Click, Inter..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Valor da Fatura / Gasto Atual */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Valor da Fatura (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">
                  R$
                </span>
                <input
                  id="input-card-invoice"
                  type="text"
                  required
                  inputMode="decimal"
                  placeholder="0,00"
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl pl-9 pr-3 py-2 text-sm text-white font-mono-num placeholder-zinc-500 transition-colors"
                />
              </div>
            </div>

            {/* Limite do Cartão */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Limite do Cartão (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">
                  R$
                </span>
                <input
                  id="input-card-limit"
                  type="text"
                  required
                  inputMode="decimal"
                  placeholder="5.000,00"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl pl-9 pr-3 py-2 text-sm text-white font-mono-num placeholder-zinc-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Data de Vencimento */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Data de Vencimento
            </label>
            <div className="relative">
              <input
                id="input-card-duedate"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl px-4 py-2.5 text-sm text-white transition-colors cursor-pointer"
              />
              <Calendar className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Tag Automática */}
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#00ff7f]" />
              <span className="text-xs text-zinc-300">Tag atribuída:</span>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-[#00ff7f]/15 border border-[#00ff7f]/30 text-[#00ff7f] text-xs font-bold">
              Cartão de crédito
            </span>
          </div>

          {/* Estilo / Cor visual do Cartão */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Cor do Cartão (Visual)
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c.value
                      ? 'scale-125 ring-2 ring-[#00ff7f] ring-offset-2 ring-offset-black'
                      : 'opacity-70 hover:opacity-100 hover:scale-110'
                  }`}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Botões */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              id="btn-cancel-card"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-submit-card"
              className="px-5 py-2.5 rounded-xl bg-[#00ff7f] text-black font-bold text-xs uppercase tracking-wider hover:bg-[#10ef80] transition-colors shadow-lg shadow-[#00ff7f]/20"
            >
              {editingCard ? 'Salvar Alterações' : 'Adicionar Cartão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
