import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CreditCard as CreditCardIcon,
  Calendar,
  DollarSign,
  Layers,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { CreditCard } from '../types';
import {
  formatCurrency,
  MONTH_NAMES,
  YEARS_UP_TO_2030,
  buildClampedDate,
  calculateBillingCycle,
} from '../utils/formatters';

interface AddCardPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CreditCard;
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
}

export const AddCardPurchaseModal: React.FC<AddCardPurchaseModalProps> = ({
  isOpen,
  onClose,
  card,
  onAddPurchase,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Form states
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [installmentCount, setInstallmentCount] = useState<number>(1);
  const [purchaseDate, setPurchaseDate] = useState(todayStr);

  // Month & Year of the first installment billing
  const [startMonth, setStartMonth] = useState<number>(new Date().getMonth());
  const [startYear, setStartYear] = useState<number>(2026);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Cartão de crédito');

  // Error feedback
  const [errorMsg, setErrorMsg] = useState('');

  // Handle purchase date change and recalculate billing cycle automatically
  const handlePurchaseDateChange = (newDateStr: string) => {
    setPurchaseDate(newDateStr);
    const { billingYear, billingMonth } = calculateBillingCycle(newDateStr, card.closingDay || 1);
    setStartYear(billingYear);
    setStartMonth(billingMonth);
  };

  // Synchronize initial dates when opening
  useEffect(() => {
    if (isOpen) {
      setName('');
      setAmountStr('');
      setInstallmentCount(1);
      const initialDate = new Date().toISOString().split('T')[0];
      setPurchaseDate(initialDate);

      // Calculate initial billing month based on purchase date and card closing day
      const { billingYear, billingMonth } = calculateBillingCycle(initialDate, card.closingDay || 1);
      setStartYear(billingYear);
      setStartMonth(billingMonth);
      setNotes('');
      setErrorMsg('');
    }
  }, [isOpen, card.closingDay]);

  // Numeric amount calculation
  const parsedTotalAmount = useMemo(() => {
    const clean = amountStr.replace(/[^\d.,]/g, '').replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  }, [amountStr]);

  // Installments preview across subsequent months
  const installmentsPreview = useMemo(() => {
    if (parsedTotalAmount <= 0) return [];

    const count = Math.max(1, Math.min(48, installmentCount));
    const rawVal = Math.floor((parsedTotalAmount / count) * 100) / 100;
    const remainder = Math.round((parsedTotalAmount - rawVal * count) * 100) / 100;

    const previewList = [];
    const dueDay = parseInt(card.dueDate, 10) || 10;

    for (let i = 0; i < count; i++) {
      const monthTotal = startMonth + i;
      const targetYear = startYear + Math.floor(monthTotal / 12);
      const targetMonthIndex = monthTotal % 12;
      const targetDate = buildClampedDate(targetYear, targetMonthIndex, dueDay);
      const instAmount = i === 0 ? Number((rawVal + remainder).toFixed(2)) : rawVal;

      previewList.push({
        installmentNum: i + 1,
        totalInstallments: count,
        monthName: MONTH_NAMES[targetMonthIndex],
        year: targetYear,
        amount: instAmount,
        billingDate: targetDate,
      });
    }

    return previewList;
  }, [parsedTotalAmount, installmentCount, startMonth, startYear, card.dueDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMsg('Informe o nome da compra');
      return;
    }

    if (parsedTotalAmount <= 0) {
      setErrorMsg('Informe um valor maior que zero');
      return;
    }

    const dueDay = parseInt(card.dueDate, 10) || 10;
    const initialBillingDate = buildClampedDate(startYear, startMonth, dueDay);

    onAddPurchase({
      cardId: card.id,
      name: name.trim(),
      totalAmount: parsedTotalAmount,
      installmentCount: Math.max(1, Math.min(48, installmentCount)),
      purchaseDate: purchaseDate || todayStr,
      startBillingDate: initialBillingDate,
      category: category || 'Cartão de crédito',
      notes: notes.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div
        id="modal-adicionar-compras-cartao"
        className="w-full max-w-xl bg-[#0f0f13] border border-zinc-800 rounded-2xl shadow-2xl p-6 text-white my-8 relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: card.color || '#00ff7f' }}
            >
              <ShoppingBag className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Adicionar Compras
              </h3>
              <p className="text-xs text-zinc-400">
                Lançamento no cartão:{' '}
                <span className="font-semibold text-white">{card.name}</span> • Fechamento todo dia{' '}
                <strong className="text-zinc-200">{card.closingDay || 1}</strong> • Vencimento dia{' '}
                <strong className="text-zinc-200">{card.dueDay || card.dueDate || 10}</strong>
              </p>
            </div>
          </div>

          <button
            id="btn-close-adicionar-compras"
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* 1. Nome da Compra */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Nome da Compra <span className="text-[#00ff7f]">*</span>
            </label>
            <input
              id="input-nome-compra"
              type="text"
              required
              placeholder="Ex: Supermercado Mensal, TV 55', Passagens Aéreas"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrorMsg('');
              }}
              className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00ff7f] focus:ring-1 focus:ring-[#00ff7f]"
            />
          </div>

          {/* 2. Valor & Parcelas em Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valor */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Valor Total (R$) <span className="text-[#00ff7f]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                  R$
                </span>
                <input
                  id="input-valor-compra"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0,00"
                  value={amountStr}
                  onChange={(e) => {
                    setAmountStr(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono-num text-white placeholder-zinc-500 focus:outline-none focus:border-[#00ff7f] focus:ring-1 focus:ring-[#00ff7f]"
                />
              </div>
            </div>

            {/* Parcelas */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Número de Parcelas
              </label>
              <select
                id="select-parcelas-compra"
                value={installmentCount}
                onChange={(e) => setInstallmentCount(parseInt(e.target.value, 10))}
                className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00ff7f]"
              >
                <option value={1}>1x (À vista)</option>
                <option value={2}>2x {parsedTotalAmount > 0 ? `(2x de ${formatCurrency(parsedTotalAmount / 2)})` : ''}</option>
                <option value={3}>3x {parsedTotalAmount > 0 ? `(3x de ${formatCurrency(parsedTotalAmount / 3)})` : ''}</option>
                <option value={4}>4x {parsedTotalAmount > 0 ? `(4x de ${formatCurrency(parsedTotalAmount / 4)})` : ''}</option>
                <option value={5}>5x {parsedTotalAmount > 0 ? `(5x de ${formatCurrency(parsedTotalAmount / 5)})` : ''}</option>
                <option value={6}>6x {parsedTotalAmount > 0 ? `(6x de ${formatCurrency(parsedTotalAmount / 6)})` : ''}</option>
                <option value={7}>7x {parsedTotalAmount > 0 ? `(7x de ${formatCurrency(parsedTotalAmount / 7)})` : ''}</option>
                <option value={8}>8x {parsedTotalAmount > 0 ? `(8x de ${formatCurrency(parsedTotalAmount / 8)})` : ''}</option>
                <option value={9}>9x {parsedTotalAmount > 0 ? `(9x de ${formatCurrency(parsedTotalAmount / 9)})` : ''}</option>
                <option value={10}>10x {parsedTotalAmount > 0 ? `(10x de ${formatCurrency(parsedTotalAmount / 10)})` : ''}</option>
                <option value={12}>12x {parsedTotalAmount > 0 ? `(12x de ${formatCurrency(parsedTotalAmount / 12)})` : ''}</option>
                <option value={18}>18x {parsedTotalAmount > 0 ? `(18x de ${formatCurrency(parsedTotalAmount / 18)})` : ''}</option>
                <option value={24}>24x {parsedTotalAmount > 0 ? `(24x de ${formatCurrency(parsedTotalAmount / 24)})` : ''}</option>
                <option value={36}>36x {parsedTotalAmount > 0 ? `(36x de ${formatCurrency(parsedTotalAmount / 36)})` : ''}</option>
              </select>
            </div>
          </div>

          {/* 3. Data da Compra & Mês Inicial da Parcela */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Data da Compra */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                  Data da Compra
                </label>
                <input
                  id="input-data-compra"
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => handlePurchaseDateChange(e.target.value)}
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00ff7f]"
                />
              </div>

              {/* Mês Inicial da 1ª Parcela */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                  Mês da 1ª Parcela
                </label>
                <select
                  id="select-mes-primeira-parcela"
                  value={startMonth}
                  onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00ff7f]"
                >
                  {MONTH_NAMES.map((mName, idx) => (
                    <option key={idx} value={idx}>
                      {mName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ano da 1ª Parcela - Inclui ano até 2030 */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                  Ano (Até 2030)
                </label>
                <select
                  id="select-ano-primeira-parcela"
                  value={startYear}
                  onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00ff7f]"
                >
                  {YEARS_UP_TO_2030.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Explicação do Ciclo */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
              <Info className="w-3.5 h-3.5 text-[#00ff7f] shrink-0" />
              <span>
                Ciclo do cartão: fechamento dia <strong className="text-white">{card.closingDay || 1}</strong>.
                Compras realizadas até dia {card.closingDay || 1} entram no mês da compra; após o fechamento, entram na fatura do mês seguinte.
              </span>
            </div>
          </div>

          {/* 4. Visual Preview: Inclusão das Parcelas nos meses seguintes */}
          {parsedTotalAmount > 0 && installmentCount > 1 && (
            <div className="p-3.5 rounded-xl bg-[#14141a] border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#00ff7f]" />
                  Distribuição das Parcelas nos Meses Seguintes ({installmentCount}x):
                </span>
                <span className="text-[11px] font-mono font-bold text-[#00ff7f]">
                  Total: {formatCurrency(parsedTotalAmount)}
                </span>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-zinc-800/60">
                {installmentsPreview.map((item) => (
                  <div
                    key={item.installmentNum}
                    className="flex items-center justify-between text-xs py-1.5 first:pt-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-zinc-300 font-mono">
                        {item.installmentNum}/{item.totalInstallments}
                      </span>
                      <span className="text-zinc-200">
                        {item.monthName} de {item.year}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Categoria Opcional */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Categoria / Tag (Opcional)
            </label>
            <input
              id="input-categoria-compra"
              type="text"
              placeholder="Ex: Supermercado, Eletrônicos, Lazer, Viagem"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#00ff7f]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              id="btn-cancel-compra"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              id="btn-submit-compra"
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#00ff7f]/25 hover:scale-[1.02]"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[3]" />
              <span>Adicionar Compras</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
