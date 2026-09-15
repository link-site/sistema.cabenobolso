import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Tag,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Info,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import {
  Transaction,
  TransactionType,
  TagItem,
  SalaryStatus,
  ExpenseStatus,
} from '../types';
import {
  MONTH_NAMES,
  MONTH_ABBR,
  buildClampedDate,
  parseDateMonthYear,
} from '../utils/formatters';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: TransactionType;
  tags: TagItem[];
  currentDateDefault: string; // YYYY-MM-DD
  editingTransaction?: Transaction | null;
  onSave: (transaction: Omit<Transaction, 'id'>) => void;
  onSaveBatch?: (transactions: Omit<Transaction, 'id'>[]) => void;
  onUpdate?: (id: string, updated: Partial<Transaction>) => void;
  onUpdateWithReplication?: (
    id: string,
    updated: Omit<Transaction, 'id'>,
    replicateMonths: { year: number; month: number }[],
    originalName?: string
  ) => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  type,
  tags,
  currentDateDefault,
  editingTransaction,
  onSave,
  onSaveBatch,
  onUpdate,
  onUpdateWithReplication,
}) => {
  const isEditing = Boolean(editingTransaction);
  const activeType = editingTransaction ? editingTransaction.type : type;
  const isSalary = activeType === 'salario';
  const availableTags = tags.filter((t) => t.targetType === activeType);

  const [name, setName] = useState('');
  const [rawAmount, setRawAmount] = useState('');
  const [tag, setTag] = useState('');
  const [date, setDate] = useState(currentDateDefault);
  const [status, setStatus] = useState<SalaryStatus | ExpenseStatus>(
    isSalary ? 'Recebido' : 'Não pago'
  );

  // Duplication state
  const [enableDuplication, setEnableDuplication] = useState(false);
  const [duplicateYear, setDuplicateYear] = useState<number>(2026);
  const [selectedDuplicateMonths, setSelectedDuplicateMonths] = useState<
    { year: number; month: number }[]
  >([]);
  const [markFutureUnpaid, setMarkFutureUnpaid] = useState(true);

  const [error, setError] = useState('');

  // Extract base year and month from the current date
  const { year: baseYear, month: baseMonth } = useMemo(
    () => parseDateMonthYear(date),
    [date]
  );
  const baseDay = useMemo(() => {
    const parts = date.split('-');
    return parts.length >= 3 ? parseInt(parts[2], 10) || 15 : 15;
  }, [date]);

  // Generate Year list for duplication selector
  const yearsList = useMemo(() => {
    const years: number[] = [];
    for (let y = 2024; y <= 2035; y++) {
      years.push(y);
    }
    return years;
  }, []);

  // Initialize or reset form on open or when editingTransaction changes
  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        setName(editingTransaction.name);
        setRawAmount(String(editingTransaction.amount));
        setTag(editingTransaction.tag);
        setDate(editingTransaction.date);
        setStatus(editingTransaction.status);
        const parsed = parseDateMonthYear(editingTransaction.date);
        setDuplicateYear(parsed.year);
      } else {
        setName('');
        setRawAmount('');
        setDate(currentDateDefault);
        setTag(availableTags[0]?.name || '');
        setStatus(isSalary ? 'Recebido' : 'Não pago');
        const parsed = parseDateMonthYear(currentDateDefault);
        setDuplicateYear(parsed.year);
      }
      setEnableDuplication(false);
      setSelectedDuplicateMonths([]);
      setMarkFutureUnpaid(true);
      setError('');
    }
  }, [isOpen, editingTransaction, type, currentDateDefault]);

  if (!isOpen) return null;

  // Change base month directly (allows changing target month on edit)
  const handleChangeBaseMonth = (newMonthIdx: number) => {
    const newDateStr = buildClampedDate(baseYear, newMonthIdx, baseDay);
    setDate(newDateStr);
  };

  const handleChangeBaseYear = (newYear: number) => {
    const newDateStr = buildClampedDate(newYear, baseMonth, baseDay);
    setDate(newDateStr);
    setDuplicateYear(newYear);
  };

  // Toggle selection for a specific month
  const toggleMonthSelection = (year: number, monthIdx: number) => {
    if (year === baseYear && monthIdx === baseMonth) return; // Cannot duplicate to base month itself

    setSelectedDuplicateMonths((prev) => {
      const exists = prev.some((m) => m.year === year && m.month === monthIdx);
      if (exists) {
        return prev.filter((m) => !(m.year === year && m.month === monthIdx));
      } else {
        return [...prev, { year, month: monthIdx }].sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month
        );
      }
    });
  };

  // Presets
  const handlePresetRestOfYear = () => {
    const monthsToAdd: { year: number; month: number }[] = [];
    for (let m = baseMonth + 1; m < 12; m++) {
      monthsToAdd.push({ year: baseYear, month: m });
    }
    // If we are at December, select all months of next year
    if (monthsToAdd.length === 0 && baseYear < 2035) {
      for (let m = 0; m < 12; m++) {
        monthsToAdd.push({ year: baseYear + 1, month: m });
      }
    }
    setSelectedDuplicateMonths(monthsToAdd);
    setDuplicateYear(baseYear);
  };

  const handlePresetNext12Months = () => {
    const monthsToAdd: { year: number; month: number }[] = [];
    for (let i = 1; i <= 12; i++) {
      const totalMonth = baseMonth + i;
      const targetYear = baseYear + Math.floor(totalMonth / 12);
      const targetMonth = totalMonth % 12;
      if (targetYear <= 2035) {
        monthsToAdd.push({ year: targetYear, month: targetMonth });
      }
    }
    setSelectedDuplicateMonths(monthsToAdd);
  };

  const handlePresetAllYear = () => {
    const monthsToAdd: { year: number; month: number }[] = [];
    for (let m = 0; m < 12; m++) {
      if (m !== baseMonth || duplicateYear !== baseYear) {
        monthsToAdd.push({ year: duplicateYear, month: m });
      }
    }
    setSelectedDuplicateMonths(monthsToAdd);
  };

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

    const baseTxData: Omit<Transaction, 'id'> = {
      type: isSalary ? 'salario' : 'gasto',
      name: name.trim(),
      amount: parsed,
      tag,
      date,
      status,
    };

    if (isEditing && editingTransaction) {
      // EDIT MODE
      if (enableDuplication && selectedDuplicateMonths.length > 0 && onUpdateWithReplication) {
        onUpdateWithReplication(
          editingTransaction.id,
          baseTxData,
          selectedDuplicateMonths,
          editingTransaction.name
        );
      } else if (onUpdate) {
        onUpdate(editingTransaction.id, baseTxData);
      }
    } else {
      // CREATE MODE
      if (enableDuplication && selectedDuplicateMonths.length > 0 && onSaveBatch) {
        const batchTxs: Omit<Transaction, 'id'>[] = [baseTxData];

        selectedDuplicateMonths.forEach(({ year, month }) => {
          const targetDate = buildClampedDate(year, month, baseDay);
          const duplicateStatus = markFutureUnpaid
            ? isSalary
              ? 'Não Recebido'
              : 'Não pago'
            : status;

          batchTxs.push({
            type: baseTxData.type,
            name: baseTxData.name,
            amount: baseTxData.amount,
            tag: baseTxData.tag,
            date: targetDate,
            status: duplicateStatus,
          });
        });

        onSaveBatch(batchTxs);
      } else {
        onSave(baseTxData);
      }
    }

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
        className="bg-[#0f0f12] border border-[#27272a] rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: isSalary
            ? '0 0 35px rgba(0, 255, 128, 0.15)'
            : '0 0 35px rgba(244, 63, 94, 0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                isSalary
                  ? 'bg-[#00ff7f]/15 text-[#00ff7f] border border-[#00ff7f]/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isEditing ? (
                <Pencil className="w-5 h-5" />
              ) : isSalary ? (
                <ArrowUpRight className="w-5 h-5" />
              ) : (
                <ArrowDownRight className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {isEditing
                    ? isSalary
                      ? 'Editar Salário'
                      : 'Editar Gasto'
                    : isSalary
                    ? 'Lançar Salário'
                    : 'Lançar Gastos'}
                </h2>
                {isEditing && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Modo Edição
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                {isEditing
                  ? 'Altere os dados da movimentação e escolha os meses desejados'
                  : isSalary
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
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              {isSalary ? 'Nome do Salário' : 'Nome do Gasto'}
            </label>
            <input
              id="input-transaction-name"
              type="text"
              required
              placeholder={
                isSalary
                  ? 'Ex: Salário Mensal, Freelance, Rendimentos...'
                  : 'Ex: Aluguel, Mercado, Luz, Água, Internet...'
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#18181b] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-colors"
            />
          </div>

          {/* Valor */}
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

          {/* Data & Seletor de Mês Base */}
          <div className="p-3.5 rounded-2xl bg-[#141418] border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#00ff7f]" />
                <span>
                  {isSalary ? 'Data de Recebimento' : 'Data de Vencimento'}
                </span>
              </label>

              {/* Informative pill showing current month */}
              <span className="text-[11px] font-semibold text-[#00ff7f]">
                {MONTH_NAMES[baseMonth]} de {baseYear}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Datepicker input */}
              <div>
                <span className="text-[10px] text-zinc-400 font-medium block mb-1">
                  Data específica:
                </span>
                <input
                  id="input-transaction-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#1c1c22] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl px-3 py-2 text-xs sm:text-sm text-white transition-colors cursor-pointer"
                />
              </div>

              {/* Quick Month & Year Changer (Useful for changing month on edit or create) */}
              <div>
                <span className="text-[10px] text-zinc-400 font-medium block mb-1">
                  Mês do lançamento:
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    id="select-modal-base-month"
                    value={baseMonth}
                    onChange={(e) => handleChangeBaseMonth(Number(e.target.value))}
                    className="flex-1 bg-[#1c1c22] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none rounded-xl px-2.5 py-2 text-xs text-white font-semibold cursor-pointer"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    id="select-modal-base-year"
                    value={baseYear}
                    onChange={(e) => handleChangeBaseYear(Number(e.target.value))}
                    className="w-20 bg-[#1c1c22] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none rounded-xl px-2 py-2 text-xs text-white font-semibold cursor-pointer"
                  >
                    {yearsList.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Status do Lançamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              {isSalary ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStatus('Recebido')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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

          {/* DUPLICAÇÃO NOS OUTROS MESES */}
          <div className="pt-3 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="checkbox-enable-duplication"
                  checked={enableDuplication}
                  onChange={(e) => setEnableDuplication(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#00ff7f] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#00ff7f]"
                />
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5 text-[#00ff7f]" />
                  <span>
                    {isEditing
                      ? 'Duplicar / Replicar alteração nos outros meses'
                      : 'Duplicar este item nos outros meses'}
                  </span>
                </span>
              </label>

              {enableDuplication && selectedDuplicateMonths.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00ff7f]/20 text-[#00ff7f] border border-[#00ff7f]/40">
                  +{selectedDuplicateMonths.length} mês(es)
                </span>
              )}
            </div>

            {enableDuplication && (
              <div className="mt-3 p-3.5 rounded-2xl bg-[#141418] border border-zinc-800 space-y-3 animate-fadeIn">
                {/* Ano e Atalhos de Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                    <span className="font-semibold text-zinc-400">Ano:</span>
                    <select
                      id="select-duplicate-year"
                      value={duplicateYear}
                      onChange={(e) => setDuplicateYear(Number(e.target.value))}
                      className="bg-black border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white font-semibold cursor-pointer"
                    >
                      {yearsList.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Botões Rápidos */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={handlePresetRestOfYear}
                      className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      Restante do Ano
                    </button>
                    <button
                      type="button"
                      onClick={handlePresetNext12Months}
                      className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      Próximos 12 meses
                    </button>
                    <button
                      type="button"
                      onClick={handlePresetAllYear}
                      className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      Ano Todo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDuplicateMonths([])}
                      className="px-2 py-1 rounded-md bg-zinc-800/60 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Limpar</span>
                    </button>
                  </div>
                </div>

                {/* Grade dos 12 Meses */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Escolha os meses para aplicar ({duplicateYear}):
                  </span>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {MONTH_ABBR.map((abbr, mIdx) => {
                      const isBaseMonth =
                        mIdx === baseMonth && duplicateYear === baseYear;
                      const isSelected = selectedDuplicateMonths.some(
                        (item) => item.year === duplicateYear && item.month === mIdx
                      );

                      return (
                        <button
                          key={abbr}
                          type="button"
                          disabled={isBaseMonth}
                          onClick={() => toggleMonthSelection(duplicateYear, mIdx)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center relative cursor-pointer ${
                            isBaseMonth
                              ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed opacity-80'
                              : isSelected
                              ? isSalary
                                ? 'bg-[#00ff7f]/20 border border-[#00ff7f] text-[#00ff7f] shadow-sm shadow-[#00ff7f]/20'
                                : 'bg-rose-500/20 border border-rose-500 text-rose-300 shadow-sm shadow-rose-500/20'
                              : 'bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                          }`}
                        >
                          <span>{abbr}</span>
                          {isBaseMonth && (
                            <span className="text-[8px] text-zinc-500 font-normal leading-tight">
                              Base
                            </span>
                          )}
                          {isSelected && !isBaseMonth && (
                            <span className="text-[8px] font-mono leading-tight">
                              ✓ Ativo
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status dos Meses Duplicados */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={markFutureUnpaid}
                      onChange={(e) => setMarkFutureUnpaid(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 text-[#00ff7f] cursor-pointer accent-[#00ff7f]"
                    />
                    <span className="text-[11px] text-zinc-300">
                      Marcar meses futuros como{' '}
                      <strong className="text-white">
                        {isSalary ? 'Não Recebido' : 'Não pago'}
                      </strong>
                    </span>
                  </label>
                </div>

                {/* Informativo de Resumo */}
                <div className="p-2.5 rounded-xl bg-black/50 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-[#00ff7f] shrink-0 mt-0.5" />
                  <span>
                    {selectedDuplicateMonths.length === 0
                      ? 'Nenhum mês adicional selecionado. A operação será realizada apenas no mês base.'
                      : isEditing
                      ? `A alteração será aplicada em ${MONTH_NAMES[baseMonth]}/${baseYear} e replicada para os ${selectedDuplicateMonths.length} mês(es) selecionados.`
                      : `Este item será lançado em ${MONTH_NAMES[baseMonth]}/${baseYear} e duplicado para mais ${selectedDuplicateMonths.length} mês(es).`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-zinc-800/80">
            <button
              type="button"
              id="btn-cancel-transaction"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-submit-transaction"
              className={`px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg cursor-pointer ${
                isSalary
                  ? 'bg-[#00ff7f] text-black hover:bg-[#10ef80] hover:shadow-[#00ff7f]/25'
                  : 'bg-rose-500 text-white hover:bg-rose-600 hover:shadow-rose-500/25'
              }`}
            >
              {isEditing
                ? 'Salvar Alterações'
                : isSalary
                ? 'Confirmar Salário'
                : 'Confirmar Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
