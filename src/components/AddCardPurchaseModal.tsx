import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Camera,
  UploadCloud,
  Loader2,
  CheckSquare,
  Square,
  ArrowRight,
  AlertCircle,
  FileImage,
} from 'lucide-react';
import { CreditCard } from '../types';
import {
  formatCurrency,
  MONTH_NAMES,
  YEARS_UP_TO_2030,
  buildClampedDate,
  calculateBillingCycle,
} from '../utils/formatters';

interface ScannedItem {
  id: string;
  name: string;
  amount: number;
  date: string;
  installmentCount: number;
  currentInstallment: number;
  category: string;
  notes: string;
  selected: boolean;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSelectedFileRef = useRef<File | null>(null);

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

  // OCR / Image scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanSuccessMsg, setScanSuccessMsg] = useState('');
  const [scannedItems, setScannedItems] = useState<ScannedItem[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
      setScanError('');
      setScanSuccessMsg('');
      setScannedItems(null);
      setIsScanning(false);
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

  // Client-side image compressor & reader (redimensiona para máx 1200px e comprime para evitar estouro de timeout/payload)
  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1200;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.78));
          } else {
            resolve(result);
          }
        };
        img.onerror = () => resolve(result);
        img.src = result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Upload and analyze screenshot with Gemini
  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setScanError('Por favor, selecione um arquivo de imagem válido (JPEG, PNG, WebP).');
      return;
    }

    lastSelectedFileRef.current = file;
    setIsScanning(true);
    setScanError('');
    setScanSuccessMsg('');
    setErrorMsg('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const base64Image = await processImageFile(file);

      const response = await fetch('/api/scan-card-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          mimeType: 'image/jpeg',
          defaultYear: startYear || 2026,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const rawText = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(rawText);
      } catch {
        // Trata respostas HTML ou texto de proxies/Cloud Run (ex: 502, 504, 413, "The page cannot be displayed")
        if (response.status === 504 || response.status === 408) {
          throw new Error('O processamento demorou mais que o esperado. Por favor, tente novamente.');
        }
        if (response.status === 413) {
          throw new Error('A imagem é muito grande. Recorte apenas a lista de compras e tente novamente.');
        }
        if (
          rawText.toLowerCase().includes('the page') ||
          rawText.toLowerCase().includes('timeout') ||
          rawText.toLowerCase().includes('gateway')
        ) {
          throw new Error('A conexão com o servidor oscilou ou expirou. Por favor, clique em "Tentar Novamente".');
        }
        throw new Error(`Erro na comunicação com o servidor (${response.status}). Por favor, tente novamente.`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data?.error || 'Falha ao ler os dados do print.');
      }

      const purchases = data.purchases || [];

      if (purchases.length === 0) {
        setScanError('Nenhuma compra foi encontrada na imagem. Você pode preencher manualmente abaixo.');
        return;
      }

      if (purchases.length === 1) {
        // Apenas 1 compra: preenche direto o formulário
        const single = purchases[0];
        setName(single.name);
        setAmountStr(single.amount.toFixed(2).replace('.', ','));
        setInstallmentCount(single.installmentCount || 1);
        if (single.date) {
          handlePurchaseDateChange(single.date);
        }
        if (single.category) {
          setCategory(single.category);
        }
        if (single.notes) {
          setNotes(single.notes);
        }
        setScanSuccessMsg(`Compra "${single.name}" identificada com sucesso! Confira os dados abaixo.`);
        setScannedItems(null);
      } else {
        // Múltiplas compras encontradas: abre visualizador para seleção
        const items: ScannedItem[] = purchases.map((p: any, idx: number) => ({
          id: `scan-${idx}-${Date.now()}`,
          name: p.name,
          amount: p.amount,
          date: p.date || todayStr,
          installmentCount: p.installmentCount || 1,
          currentInstallment: p.currentInstallment || 1,
          category: p.category || 'Cartão de crédito',
          notes: p.notes || '',
          selected: true,
        }));
        setScannedItems(items);
        setScanSuccessMsg(`Identificadas ${items.length} compras no print! Selecione quais deseja adicionar.`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Erro ao ler print:', err);
      if (err.name === 'AbortError') {
        setScanError('O processamento demorou mais de 25 segundos e foi cancelado para não travar o app. Por favor, recorte o print para incluir apenas as compras e tente novamente.');
      } else {
        setScanError(err.message || 'Erro de comunicação ao ler imagem. Tente novamente.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Toggle selection in multi-item list
  const toggleItemSelection = (id: string) => {
    if (!scannedItems) return;
    setScannedItems((prev) =>
      prev ? prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)) : null
    );
  };

  // Toggle all selection
  const toggleAllSelection = () => {
    if (!scannedItems) return;
    const allSelected = scannedItems.every((item) => item.selected);
    setScannedItems((prev) =>
      prev ? prev.map((item) => ({ ...item, selected: !allSelected })) : null
    );
  };

  // Preencher formulário com um dos itens da lista
  const handleSelectSingleFromList = (item: ScannedItem) => {
    setName(item.name);
    setAmountStr(item.amount.toFixed(2).replace('.', ','));
    setInstallmentCount(item.installmentCount || 1);
    if (item.date) {
      handlePurchaseDateChange(item.date);
    }
    if (item.category) {
      setCategory(item.category);
    }
    if (item.notes) {
      setNotes(item.notes);
    }
    setScannedItems(null);
    setScanSuccessMsg(`Compra "${item.name}" carregada no formulário para ajuste.`);
  };

  // Adicionar todas as compras selecionadas de uma só vez
  const handleAddSelectedPurchases = () => {
    if (!scannedItems) return;
    const selected = scannedItems.filter((i) => i.selected);
    if (selected.length === 0) {
      setScanError('Selecione pelo menos uma compra para adicionar.');
      return;
    }

    const dueDay = parseInt(card.dueDate, 10) || 10;

    selected.forEach((item) => {
      const { billingYear, billingMonth } = calculateBillingCycle(item.date, card.closingDay || 1);
      const initialBillingDate = buildClampedDate(billingYear, billingMonth, dueDay);

      onAddPurchase({
        cardId: card.id,
        name: item.name,
        totalAmount: item.amount,
        installmentCount: item.installmentCount || 1,
        purchaseDate: item.date,
        startBillingDate: initialBillingDate,
        category: item.category || 'Cartão de crédito',
        notes: item.notes || '',
      });
    });

    onClose();
  };

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
        {/* Input oculto para upload de foto/print */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleImageFile(e.target.files[0]);
            }
          }}
        />

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
                <span className="font-semibold text-white">{card.name}</span> • Fechamento dia{' '}
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

        {/* OCR / Image Upload Box */}
        <div className="mt-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageFile(e.dataTransfer.files[0]);
              }
            }}
            className={`p-3.5 rounded-2xl border transition-all ${
              isDragging
                ? 'border-[#00ff7f] bg-[#00ff7f]/10'
                : 'border-zinc-800 bg-[#14141a] hover:border-zinc-700'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f] shrink-0">
                  {isScanning ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Importar por Print do Cartão
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#00ff7f]/20 text-[#00ff7f] uppercase">
                      IA Gemini
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Envie o print do extrato (ex: Atacadão, Nubank). O sistema extrai nome, valor, data e parcelas.
                  </p>
                </div>
              </div>

              <button
                id="btn-upload-print-cartao"
                type="button"
                disabled={isScanning}
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-bold transition-all shadow hover:border-[#00ff7f]/50 disabled:opacity-50 shrink-0"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#00ff7f]" />
                    <span>Lendo print...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-[#00ff7f]" />
                    <span>Enviar Foto / Print</span>
                  </>
                )}
              </button>
            </div>

            {/* Scanning Progress */}
            {isScanning && (
              <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2 text-xs text-[#00ff7f] animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analisando o histórico de compras com visão computacional...</span>
              </div>
            )}

            {/* Error Message */}
            {scanError && (
              <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-400">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{scanError}</span>
                </div>
                {lastSelectedFileRef.current && (
                  <button
                    type="button"
                    onClick={() => {
                      if (lastSelectedFileRef.current) {
                        handleImageFile(lastSelectedFileRef.current);
                      }
                    }}
                    className="self-start sm:self-auto px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] border border-rose-500/40 transition-colors shrink-0"
                  >
                    Tentar Novamente
                  </button>
                )}
              </div>
            )}

            {/* Success Message */}
            {scanSuccessMsg && !scannedItems && (
              <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2 text-xs text-[#00ff7f]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{scanSuccessMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Multi-item Scanned Results View (se identificou 2 ou mais compras no print) */}
        {scannedItems && scannedItems.length > 0 ? (
          <div className="mt-5 space-y-4 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-[#14141c] border border-zinc-800">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    Compras Detectadas no Print ({scannedItems.length})
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Selecione as que deseja adicionar:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleAllSelection}
                  className="text-xs font-semibold text-[#00ff7f] hover:underline"
                >
                  {scannedItems.every((i) => i.selected) ? 'Desmarcar Todas' : 'Marcar Todas'}
                </button>
              </div>

              {/* List of Scanned Purchases */}
              <div className="mt-3 max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-zinc-800/60">
                {scannedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`pt-2 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-xl transition-colors ${
                      item.selected ? 'bg-zinc-900/90 border border-zinc-800' : 'opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleItemSelection(item.id)}
                        className="text-zinc-400 hover:text-white"
                      >
                        {item.selected ? (
                          <CheckSquare className="w-4 h-4 text-[#00ff7f]" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-500" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                          <span>{item.date}</span>
                          {item.installmentCount > 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-[#00ff7f] font-mono text-[10px] font-bold">
                              {item.installmentCount}x
                            </span>
                          )}
                          {item.category && (
                            <span className="text-zinc-500">• {item.category}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono-num font-bold text-sm text-white">
                        {formatCurrency(item.amount)}
                      </span>
                      <button
                        type="button"
                        title="Preencher formulário com esta compra"
                        onClick={() => handleSelectSingleFromList(item)}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 font-semibold"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total of selected items */}
              <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-zinc-400">
                  Selecionadas:{' '}
                  <strong className="text-white">
                    {scannedItems.filter((i) => i.selected).length} de {scannedItems.length}
                  </strong>
                </span>
                <span className="text-zinc-300">
                  Total Selecionado:{' '}
                  <strong className="text-[#00ff7f] font-mono-num text-sm">
                    {formatCurrency(
                      scannedItems
                        .filter((i) => i.selected)
                        .reduce((sum, item) => sum + item.amount, 0)
                    )}
                  </strong>
                </span>
              </div>
            </div>

            {/* Action Buttons for Batch Add */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setScannedItems(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold transition-colors"
              >
                Voltar ao Formulário Manual
              </button>

              <button
                id="btn-add-selected-scanned"
                type="button"
                onClick={handleAddSelectedPurchases}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#00ff7f]/25 hover:scale-[1.02]"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                <span>
                  Adicionar {scannedItems.filter((i) => i.selected).length} Compras ao Cartão
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* Form Body Normal */
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
                  <option value={2}>
                    2x{' '}
                    {parsedTotalAmount > 0
                      ? `(2x de ${formatCurrency(parsedTotalAmount / 2)})`
                      : ''}
                  </option>
                  <option value={3}>
                    3x{' '}
                    {parsedTotalAmount > 0
                      ? `(3x de ${formatCurrency(parsedTotalAmount / 3)})`
                      : ''}
                  </option>
                  <option value={4}>
                    4x{' '}
                    {parsedTotalAmount > 0
                      ? `(4x de ${formatCurrency(parsedTotalAmount / 4)})`
                      : ''}
                  </option>
                  <option value={5}>
                    5x{' '}
                    {parsedTotalAmount > 0
                      ? `(5x de ${formatCurrency(parsedTotalAmount / 5)})`
                      : ''}
                  </option>
                  <option value={6}>
                    6x{' '}
                    {parsedTotalAmount > 0
                      ? `(6x de ${formatCurrency(parsedTotalAmount / 6)})`
                      : ''}
                  </option>
                  <option value={7}>
                    7x{' '}
                    {parsedTotalAmount > 0
                      ? `(7x de ${formatCurrency(parsedTotalAmount / 7)})`
                      : ''}
                  </option>
                  <option value={8}>
                    8x{' '}
                    {parsedTotalAmount > 0
                      ? `(8x de ${formatCurrency(parsedTotalAmount / 8)})`
                      : ''}
                  </option>
                  <option value={9}>
                    9x{' '}
                    {parsedTotalAmount > 0
                      ? `(9x de ${formatCurrency(parsedTotalAmount / 9)})`
                      : ''}
                  </option>
                  <option value={10}>
                    10x{' '}
                    {parsedTotalAmount > 0
                      ? `(10x de ${formatCurrency(parsedTotalAmount / 10)})`
                      : ''}
                  </option>
                  <option value={12}>
                    12x{' '}
                    {parsedTotalAmount > 0
                      ? `(12x de ${formatCurrency(parsedTotalAmount / 12)})`
                      : ''}
                  </option>
                  <option value={18}>
                    18x{' '}
                    {parsedTotalAmount > 0
                      ? `(18x de ${formatCurrency(parsedTotalAmount / 18)})`
                      : ''}
                  </option>
                  <option value={24}>
                    24x{' '}
                    {parsedTotalAmount > 0
                      ? `(24x de ${formatCurrency(parsedTotalAmount / 24)})`
                      : ''}
                  </option>
                  <option value={36}>
                    36x{' '}
                    {parsedTotalAmount > 0
                      ? `(36x de ${formatCurrency(parsedTotalAmount / 36)})`
                      : ''}
                  </option>
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
        )}
      </div>
    </div>
  );
};
