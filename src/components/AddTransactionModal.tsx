import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Tag, Check, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TransactionType, TagItem, SalaryStatus, ExpenseStatus } from '../types';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: TransactionType;
  tags: TagItem[];
  currentDateDefault: string; // YYYY-MM-DD
  onSave: (transaction: {
    type: TransactionType;
    name: string;
    amount: number;
    tag: string;
    date: string;
    status: SalaryStatus | ExpenseStatus;
  }) => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  type,
  tags,
  currentDateDefault,
  onSave,
}) => {
  const isSalary = type === 'salario';
  const availableTags = tags.filter((t) => t.targetType === type);

  const [name, setName] = useState('');
  const [rawAmount, setRawAmount] = useState('');
  const [tag, setTag] = useState('');
  const [date, setDate] = useState(currentDateDefault);
  const [status, setStatus] = useState<SalaryStatus | ExpenseStatus>(
    isSalary ? 'Recebido' : 'Não pago'
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setRawAmount('');
      setDate(currentDateDefault);
      setTag(availableTags[0]?.name || '');
      setStatus(isSalary ? 'Recebido' : 'Não pago');
      setError('');
    }
  }, [isOpen, type, currentDateDefault]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome.');
      return;
    }

    const clean = rawAmount.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Por favor, insira um valor válido maior que zero.');
      return;
    }

    if (!tag) {
      setError('Por favor, selecione uma tag.');
      return;
    }

    if (!date) {
      setError('Por favor, selecione a data.');
      return;
    }

    onSave({
      type,
      name: name.trim(),
      amount: parsed,
      tag,
      date,
      status,
    });

    onClose();
  };

  return (
    <div
      id="modal-transaction-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="modal-transaction-container"
        className="bg-[#0f0f12] border border-[#27272a] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: isSalary
            ? '0 0 30px rgba(0, 255, 128, 0.15)'
            : '0 0 30px rgba(244, 63, 94, 0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isSalary
                  ? 'bg-[#00ff7f]/15 text-[#00ff7f] border border-[#00ff7f]/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isSalary ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                {isSalary ? 'Lançar Salário' : 'Lançar Gastos'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isSalary
                  ? 'Cadastre uma nova receita ou salário'
                  : 'Cadastre uma nova despesa ou custo'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-transaction-modal"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              {isSalary ? 'Nome do Salário' : 'Nome do Gasto'}
            </label>
            <input
              id="input-transaction-name"
              type="text"
              required
              placeholder={isSalary ? 'Ex: Salário Mensal, Freelance...' : 'Ex: Aluguel, Mercado, Luz...'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-colors"
            />
          </div>

          {/* Valor (em moeda) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Valor (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono-num font-semibold text-sm">
                R$
              </span>
              <input
                id="input-transaction-amount"
                type="text"
                required
                inputMode="decimal"
                placeholder="0,00"
                value={rawAmount}
                onChange={(e) => setRawAmount(e.target.value)}
                className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-mono-num placeholder-zinc-500 transition-colors"
              />
            </div>
          </div>

          {/* Tag */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Tag ({isSalary ? 'Salário' : 'Gasto'})
              </label>
              <span className="text-[11px] text-zinc-500">
                {availableTags.length} tag(s) disponíveis
              </span>
            </div>
            <div className="relative">
              <select
                id="select-transaction-tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl px-4 py-2.5 text-sm text-white transition-colors appearance-none cursor-pointer"
              >
                {availableTags.length === 0 ? (
                  <option value="">Nenhuma tag cadastrada para esta opção</option>
                ) : (
                  availableTags.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
              <Tag className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              {isSalary ? 'Data de Recebimento' : 'Data de Vencimento'}
            </label>
            <div className="relative">
              <input
                id="input-transaction-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl px-4 py-2.5 text-sm text-white transition-colors cursor-pointer"
              />
              <Calendar className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Status Inicial */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Status Inicial
            </label>
            <div className="grid grid-cols-2 gap-2">
              {isSalary ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStatus('Recebido')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                      status === 'Recebido'
                        ? 'bg-[#00ff7f]/20 border-[#00ff7f] text-[#00ff7f]'
                        : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {status === 'Recebido' && <Check className="w-3.5 h-3.5" />}
                    Recebido
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('Não Recebido')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                      status === 'Não Recebido'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {status === 'Não Recebido' && <Check className="w-3.5 h-3.5" />}
                    Não Recebido
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStatus('Pago')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                      status === 'Pago'
                        ? 'bg-[#00ff7f]/20 border-[#00ff7f] text-[#00ff7f]'
                        : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {status === 'Pago' && <Check className="w-3.5 h-3.5" />}
                    Pago
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('Não pago')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                      status === 'Não pago'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                        : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {status === 'Não pago' && <Check className="w-3.5 h-3.5" />}
                    Não pago
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              id="btn-cancel-transaction"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-submit-transaction"
              className={`px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg ${
                isSalary
                  ? 'bg-[#00ff7f] text-black hover:bg-[#10ef80] hover:shadow-[#00ff7f]/25'
                  : 'bg-rose-500 text-white hover:bg-rose-600 hover:shadow-rose-500/25'
              }`}
            >
              {isSalary ? 'Confirmar Salário' : 'Confirmar Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
