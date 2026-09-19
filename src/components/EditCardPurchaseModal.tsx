import React, { useState, useEffect } from 'react';
import { X, Pencil, DollarSign, Calendar, Tag, AlertCircle, Layers, Check } from 'lucide-react';
import { CardPurchase } from '../types';
import { formatCurrency, parseCurrencyInput, formatDateDisplay } from '../utils/formatters';

interface EditCardPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: CardPurchase | null;
  onSaveSingle: (id: string, updated: Partial<CardPurchase>) => void;
  onSaveGroup: (
    groupId: string,
    updates: {
      name?: string;
      category?: string;
      installmentAmount?: number;
      totalAmount?: number;
      purchaseDate?: string;
    }
  ) => void;
}

const CATEGORY_SUGGESTIONS = [
  'Alimentação',
  'Mercado',
  'Farmácia',
  'Transporte',
  'Combustível',
  'Assinaturas',
  'Lazer',
  'Casa',
  'Roupas',
  'Eletrônicos',
  'Saúde',
  'Educação',
  'Outros',
];

export const EditCardPurchaseModal: React.FC<EditCardPurchaseModalProps> = ({
  isOpen,
  onClose,
  purchase,
  onSaveSingle,
  onSaveGroup,
}) => {
  const [name, setName] = useState('');
  const [installmentAmountStr, setInstallmentAmountStr] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [billingDate, setBillingDate] = useState('');
  const [category, setCategory] = useState('Outros');
  const [updateScope, setUpdateScope] = useState<'single' | 'all'>('single');
  const [error, setError] = useState('');

  useEffect(() => {
    if (purchase && isOpen) {
      setName(purchase.name);
      setInstallmentAmountStr(purchase.installmentAmount.toFixed(2).replace('.', ','));
      setPurchaseDate(purchase.purchaseDate || '');
      setBillingDate(purchase.billingDate || '');
      setCategory(purchase.category || 'Outros');
      setUpdateScope('single');
      setError('');
    }
  }, [purchase, isOpen]);

  if (!isOpen || !purchase) return null;

  const isInstallment = purchase.installmentCount > 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Por favor, informe a descrição ou nome da compra.');
      return;
    }

    const parsedAmount = parseCurrencyInput(installmentAmountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Por favor, informe um valor válido maior que zero.');
      return;
    }

    if (isInstallment && updateScope === 'all' && purchase.purchaseGroupId) {
      // Atualiza todas as parcelas do grupo
      const newTotal = parsedAmount * purchase.installmentCount;
      onSaveGroup(purchase.purchaseGroupId, {
        name: trimmedName,
        category,
        installmentAmount: parsedAmount,
        totalAmount: newTotal,
        purchaseDate,
      });
    } else {
      // Atualiza apenas esta parcela específica
      const updatedTotal = isInstallment
        ? purchase.totalAmount
        : parsedAmount;

      onSaveSingle(purchase.id, {
        name: trimmedName,
        category,
        installmentAmount: parsedAmount,
        totalAmount: updatedTotal,
        purchaseDate,
        billingDate,
      });
    }

    onClose();
  };

  return (
    <div
      id="modal-edit-purchase-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="modal-edit-purchase-container"
        className="bg-[#0f0f12] border border-[#27272a] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 0 35px rgba(0, 255, 128, 0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f]">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Editar Compra no Cartão
              </h2>
              <p className="text-xs text-zinc-400">
                {isInstallment
                  ? `Parcela ${purchase.currentInstallment} de ${purchase.installmentCount}`
                  : 'Compra à vista'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-edit-purchase"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Se for parcelada: escolha de escopo (apenas esta parcela ou todas) */}
          {isInstallment && (
            <div className="p-3.5 rounded-xl bg-[#141419] border border-zinc-800 space-y-2">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#00ff7f]" />
                Onde aplicar as alterações?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label
                  className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    updateScope === 'single'
                      ? 'bg-[#00ff7f]/10 border-[#00ff7f] text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="updateScope"
                    value="single"
                    checked={updateScope === 'single'}
                    onChange={() => setUpdateScope('single')}
                    className="mt-0.5 accent-[#00ff7f]"
                  />
                  <div>
                    <span className="font-bold block text-zinc-200">
                      Apenas esta parcela
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Altera somente a parcela {purchase.currentInstallment}/{purchase.installmentCount}
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    updateScope === 'all'
                      ? 'bg-[#00ff7f]/10 border-[#00ff7f] text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="updateScope"
                    value="all"
                    checked={updateScope === 'all'}
                    onChange={() => setUpdateScope('all')}
                    className="mt-0.5 accent-[#00ff7f]"
                  />
                  <div>
                    <span className="font-bold block text-zinc-200">
                      Todas as {purchase.installmentCount} parcelas
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Atualiza nome, categoria e valor em todos os meses
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Nome / Descrição */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">
              Nome / Estabelecimento <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              id="input-edit-purchase-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Supermercado Extra, Drogaria São Paulo..."
              className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00ff7f]"
              required
            />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span>
                {isInstallment && updateScope === 'all'
                  ? 'Valor de Cada Parcela (R$)'
                  : isInstallment
                  ? 'Valor Desta Parcela (R$)'
                  : 'Valor da Compra (R$)'}{' '}
                <span className="text-rose-400">*</span>
              </span>
              {isInstallment && updateScope === 'all' && (
                <span className="text-[11px] text-zinc-400">
                  Total:{' '}
                  <strong className="text-[#00ff7f]">
                    {formatCurrency(
                      parseCurrencyInput(installmentAmountStr) * purchase.installmentCount
                    )}
                  </strong>
                </span>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-semibold">
                R$
              </span>
              <input
                type="text"
                id="input-edit-purchase-amount"
                value={installmentAmountStr}
                onChange={(e) => setInstallmentAmountStr(e.target.value)}
                placeholder="0,00"
                className="w-full bg-[#16161d] border border-zinc-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#00ff7f]"
                required
              />
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                Data da Compra
              </label>
              <input
                type="date"
                id="input-edit-purchase-date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00ff7f]"
              />
            </div>

            {/* Mês / Data de Vencimento da Fatura (apenas quando editando parcela individual) */}
            {(!isInstallment || updateScope === 'single') && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#00ff7f]" />
                  Fatura / Vencimento
                </label>
                <input
                  type="date"
                  id="input-edit-purchase-billing-date"
                  value={billingDate}
                  onChange={(e) => setBillingDate(e.target.value)}
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00ff7f]"
                />
              </div>
            )}
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-500" />
              Categoria
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CATEGORY_SUGGESTIONS.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    category === cat
                      ? 'bg-[#00ff7f]/20 border-[#00ff7f] text-[#00ff7f] font-bold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              type="text"
              id="input-edit-purchase-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ou digite outra categoria..."
              className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#00ff7f]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              id="btn-cancel-edit-purchase"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-save-edit-purchase"
              className="px-5 py-2.5 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#00ff7f]/20 flex items-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
