import React, { useState, useEffect } from 'react';
import { X, CreditCard as CreditCardIcon, DollarSign, Calendar, ShieldCheck, Tag, Info } from 'lucide-react';
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
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState('1');
  const [dueDay, setDueDay] = useState('10');
  const [color, setColor] = useState('#8a05be');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingCard) {
        setName(editingCard.name);
        setLimit(editingCard.limit.toString());
        setClosingDay(String(editingCard.closingDay || 1));
        
        let dDay = editingCard.dueDay;
        if (!dDay && editingCard.dueDate) {
          if (editingCard.dueDate.includes('-')) {
            dDay = parseInt(editingCard.dueDate.split('-')[2], 10);
          } else {
            dDay = parseInt(editingCard.dueDate, 10);
          }
        }
        setDueDay(String(dDay || 10));
        setColor(editingCard.color || '#8a05be');
      } else {
        setName('');
        setLimit('');
        setClosingDay('1');
        setDueDay('10');
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

    const cleanLimit = limit.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsedLimit = parseFloat(cleanLimit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      setError('Por favor, informe o limite do cartão (maior que 0).');
      return;
    }

    const parsedClosing = parseInt(closingDay, 10);
    if (isNaN(parsedClosing) || parsedClosing < 1 || parsedClosing > 31) {
      setError('Por favor, informe um Dia de Fechamento válido (entre 1 e 31).');
      return;
    }

    const parsedDue = parseInt(dueDay, 10);
    if (isNaN(parsedDue) || parsedDue < 1 || parsedDue > 31) {
      setError('Por favor, informe um Dia de Vencimento válido (entre 1 e 31).');
      return;
    }

    onSave({
      name: name.trim(),
      currentInvoice: editingCard ? editingCard.currentInvoice : 0,
      limit: parsedLimit,
      dueDate: String(parsedDue),
      dueDay: parsedDue,
      closingDay: parsedClosing,
      color,
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Data de Fechamento */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Data de Fechamento (Dia)
              </label>
              <div className="relative">
                <input
                  id="input-card-closingday"
                  type="number"
                  min="1"
                  max="31"
                  required
                  placeholder="Ex: 1"
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                  className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl px-4 py-2 text-sm text-white font-mono-num transition-colors"
                />
                <Calendar className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Fim do ciclo de compras (ex: dia 1).
              </p>
            </div>

            {/* Dia do Vencimento */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Dia do vencimento
              </label>
              <div className="relative">
                <input
                  id="input-card-duedate"
                  type="number"
                  min="1"
                  max="31"
                  required
                  placeholder="Ex: 10"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl px-4 py-2 text-sm text-white font-mono-num transition-colors"
                />
                <Calendar className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Dia de pagamento da fatura.
              </p>
            </div>
          </div>

          {/* Dica do Ciclo de Fechamento */}
          <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-300">
            <Info className="w-4 h-4 text-[#00ff7f] mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-white block mb-0.5">Como funciona o ciclo:</span>
              <span className="text-zinc-400">
                Todas as compras realizadas no mês até o dia {closingDay || 1} fecham no ciclo do mês. Compras após o dia {closingDay || 1} entram no ciclo seguinte.
              </span>
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
