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
    currentInstallment?: number;
    installmentAmount?: number;
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
  // 'installment' = valor da parcela (padrão em extratos/faturas), 'total' = valor total da compra
  const [amountType, setAmountType] = useState<'installment' | 'total'>('installment');
  const [installmentCount, setInstallmentCount] = useState<number>(1);
  const [currentInstallment, setCurrentInstallment] = useState<number>(1);
  const [purchaseDate, setPurchaseDate] = useState(todayStr);

  // Month & Year of the first installment billing
  const [startMonth, setStartMonth] = useState<number>(new Date().getMonth());
  const [startYear, setStartYear] = useState<number>(2026);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Cartão de crédito');

  // OCR / Image scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
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
      setAmountType('installment');
      setInstallmentCount(1);
      setCurrentInstallment(1);
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

  // Safe installment count and current installment
  const count = Math.max(1, Math.min(48, installmentCount));
  const currentInst = Math.max(1, Math.min(count, currentInstallment));

  // Numeric amount calculation
  const parsedEnteredAmount = useMemo(() => {
    const clean = amountStr.replace(/[^\d.,]/g, '').replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  }, [amountStr]);

  // Se o valor digitado é da parcela ou o total:
  const { unitInstallmentAmount, computedTotalAmount } = useMemo(() => {
    if (parsedEnteredAmount <= 0) {
      return { unitInstallmentAmount: 0, computedTotalAmount: 0 };
    }
    if (count === 1) {
      return { unitInstallmentAmount: parsedEnteredAmount, computedTotalAmount: parsedEnteredAmount };
    }
    if (amountType === 'installment') {
      // O valor digitado é o da parcela mensal (ex: R$ 56,33)
      return {
        unitInstallmentAmount: parsedEnteredAmount,
        computedTotalAmount: Number((parsedEnteredAmount * count).toFixed(2)),
      };
    } else {
      // O valor digitado é o total da compra
      return {
        unitInstallmentAmount: Number((parsedEnteredAmount / count).toFixed(2)),
        computedTotalAmount: parsedEnteredAmount,
      };
    }
  }, [parsedEnteredAmount, count, amountType]);

  // Installments preview across subsequent months - a partir da parcela atual até a última
  const installmentsPreview = useMemo(() => {
    if (unitInstallmentAmount <= 0) return [];

    const previewList = [];
    const dueDay = parseInt(card.dueDate, 10) || 10;

    for (let c = currentInst; c <= count; c++) {
      const monthOffset = c - currentInst;
      const monthTotal = startMonth + monthOffset;
      const targetYear = startYear + Math.floor(monthTotal / 12);
      const targetMonthIndex = monthTotal % 12;
      const targetDate = buildClampedDate(targetYear, targetMonthIndex, dueDay);

      previewList.push({
        installmentNum: c,
        totalInstallments: count,
        monthName: MONTH_NAMES[targetMonthIndex],
        year: targetYear,
        amount: unitInstallmentAmount,
        billingDate: targetDate,
      });
    }

    return previewList;
  }, [unitInstallmentAmount, count, currentInst, startMonth, startYear, card.dueDate]);

  // Client-side image compressor & reader: redimensiona e comprime em JPEG
  // Garante que o arquivo enviado tenha entre 60KB e 200KB, permitindo upload quase instantâneo mesmo no 3G/4G fora do Google Cloud
  const processImageFile = async (file: File, aggressive = false): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) {
          return reject(new Error('Não foi possível ler o arquivo da imagem.'));
        }

        const img = new Image();
        img.onload = () => {
          try {
            // Em modo padrão: máx 1050px, qualidade 0.72 (~120KB)
            // Em modo agressivo (retry): máx 800px, qualidade 0.60 (~60KB)
            const MAX_DIM = aggressive ? 800 : 1050;
            const QUALITY = aggressive ? 0.60 : 0.72;

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
            const ctx = canvas.getContext('2d', { willReadFrequently: false });
            if (ctx) {
              // Fundo branco no caso de transparência PNG/WebP convertida para JPEG
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);

              let dataUrl = canvas.toDataURL('image/jpeg', QUALITY);

              // Se por algum motivo ainda ficou > 450KB, faz uma segunda redução para garantir payload leve
              if (dataUrl.length > 450000) {
                const secondCanvas = document.createElement('canvas');
                const secondWidth = Math.round(width * 0.75);
                const secondHeight = Math.round(height * 0.75);
                secondCanvas.width = secondWidth;
                secondCanvas.height = secondHeight;
                const secondCtx = secondCanvas.getContext('2d');
                if (secondCtx) {
                  secondCtx.fillStyle = '#FFFFFF';
                  secondCtx.fillRect(0, 0, secondWidth, secondHeight);
                  secondCtx.drawImage(canvas, 0, 0, secondWidth, secondHeight);
                  dataUrl = secondCanvas.toDataURL('image/jpeg', 0.62);
                }
              }

              resolve(dataUrl);
            } else {
              resolve(result);
            }
          } catch (canvasErr) {
            console.warn('Canvas resize falhou, usando imagem original:', canvasErr);
            resolve(result);
          }
        };

        img.onerror = () => {
          // Se falhou ao abrir como Image (ex: HEIC do iPhone ou formato não suportado diretamente)
          resolve(result);
        };

        img.src = result;
      };

      reader.onerror = () => reject(new Error('Erro ao ler o arquivo selecionado.'));
      reader.readAsDataURL(file);
    });
  };

  // Upload and analyze screenshot with Gemini
  const handleImageFile = async (file: File, isRetry = false) => {
    if (!file.type.startsWith('image/')) {
      setScanError('Por favor, selecione um arquivo de imagem válido (JPEG, PNG, WebP).');
      return;
    }

    lastSelectedFileRef.current = file;
    setIsScanning(true);
    setScanStep(isRetry ? 'Recomprimindo em modo super leve...' : 'Otimizando imagem para envio rápido...');
    setScanError('');
    setScanSuccessMsg('');
    setErrorMsg('');

    // Timeout de 55 segundos para permitir redes móveis e conexões residenciais com margem segura
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    try {
      // Garante presença do cookie de autenticação do ambiente Cloud Run em abas ou navegadores externos
      try {
        if (typeof document !== 'undefined' && window.location.hostname.includes('run.app')) {
          document.cookie = `__SECURE-aistudio_auth_flow_may_set_cookies=true; Path=/; Secure; SameSite=None; Partitioned; Max-Age=3600;`;
        }
      } catch {
        // Ignora restrições estritas de storage do navegador
      }

      const base64Image = await processImageFile(file, isRetry);

      setScanStep('Enviando para o servidor seguro...');

      const response = await fetch('/api/scan-card-invoice', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          image: base64Image,
          mimeType: 'image/jpeg',
          defaultYear: startYear || 2026,
        }),
        signal: controller.signal,
      });

      setScanStep('IA Gemini identificando compras no extrato...');

      clearTimeout(timeoutId);

      if (response.redirected && (response.url.includes('__cookie_check') || response.url.includes('auth-bridge') || response.url.includes('ServiceLogin'))) {
        throw new Error('Acesso externo requer validação de cookies da Google Cloud. Abra o app no navegador onde sua conta Google está ativa ou publique a versão final pelo botão "Share".');
      }

      const rawText = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(rawText);
      } catch {
        // Trata respostas HTML ou texto de proxies/Cloud Run/Vercel (ex: 404, 502, 504, 413, cookie check)
        if (rawText.trim().startsWith('<') || (response.headers.get('content-type') || '').includes('text/html')) {
          if (rawText.includes('404') || response.status === 404) {
            if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
              throw new Error('A rota /api/scan-card-invoice retornou 404 na Vercel. Atualize o deploy na Vercel com os novos arquivos (api/scan-card-invoice.ts e vercel.json) e adicione GEMINI_API_KEY no painel da Vercel.');
            }
            throw new Error('Servidor da API não encontrado (404). Verifique se o servidor de inteligência artificial está em execução.');
          }
          if (rawText.includes('cookie') || rawText.includes('Action required') || response.status === 302) {
            throw new Error('O navegador bloqueou os cookies de segurança da Google Cloud nesta sessão. Clique em "Tentar Novamente" ou acesse pela URL oficial compartilhada.');
          }
          if (response.status === 504 || response.status === 408) {
            throw new Error('O processamento demorou mais que o esperado pelo servidor. Clique em "Tentar Novamente" para enviar em formato otimizado.');
          }
        }
        if (response.status === 404) {
          if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
            throw new Error('A rota /api/scan-card-invoice retornou 404 na Vercel. Atualize o deploy na Vercel com os novos arquivos (api/scan-card-invoice.ts e vercel.json) e adicione GEMINI_API_KEY no painel da Vercel.');
          }
          throw new Error('Servidor da API não encontrado (404).');
        }
        if (response.status === 413) {
          throw new Error('A imagem é muito grande. Recorte apenas a lista de compras e tente novamente.');
        }
        if (
          rawText.toLowerCase().includes('timeout') ||
          rawText.toLowerCase().includes('gateway')
        ) {
          throw new Error('A conexão com o servidor oscilou ou expirou. Por favor, clique em "Tentar Novamente" para enviar em modo ultra-rápido.');
        }
        throw new Error(`Erro na comunicação com o servidor (${response.status || 'sem resposta'}). Por favor, clique em "Tentar Novamente".`);
      }

      if (!response.ok || !data.success) {
        const errorText =
          typeof data?.error === 'object'
            ? data.error.message || JSON.stringify(data.error)
            : data?.error || 'Falha ao ler os dados do print.';
        throw new Error(errorText);
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
        setAmountType('installment');
        setInstallmentCount(single.installmentCount || 1);
        setCurrentInstallment(single.currentInstallment || 1);
        if (single.date) {
          handlePurchaseDateChange(single.date);
        }
        if (single.category) {
          setCategory(single.category);
        }
        if (single.notes) {
          setNotes(single.notes);
        }
        const instStatusMsg =
          (single.installmentCount || 1) > 1
            ? (single.currentInstallment || 1) === (single.installmentCount || 1)
              ? `Última parcela (${single.currentInstallment}/${single.installmentCount}) de R$ ${single.amount.toFixed(2).replace('.', ',')} identificada!`
              : `Parcela ${single.currentInstallment || 1}/${single.installmentCount} de R$ ${single.amount.toFixed(2).replace('.', ',')} identificada!`
            : `Valor de R$ ${single.amount.toFixed(2).replace('.', ',')} identificado!`;
        setScanSuccessMsg(`Compra "${single.name}" lida com sucesso! ${instStatusMsg}`);
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
        setScanError('O envio demorou mais do que o limite da rede e foi cancelado. Clique em "Tentar Novamente" para enviar em formato reduzido.');
      } else {
        setScanError(err.message || 'Erro de comunicação ao ler imagem. Tente novamente.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsScanning(false);
      setScanStep('');
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
    setAmountType('installment');
    setInstallmentCount(item.installmentCount || 1);
    setCurrentInstallment(item.currentInstallment || 1);
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
      const totalCount = Math.max(1, item.installmentCount || 1);
      const currentInst = Math.max(1, Math.min(totalCount, item.currentInstallment || 1));
      const instAmount = item.amount;
      const totalAmt = Number((instAmount * totalCount).toFixed(2));

      onAddPurchase({
        cardId: card.id,
        name: item.name,
        totalAmount: totalAmt,
        installmentCount: totalCount,
        currentInstallment: currentInst,
        installmentAmount: instAmount,
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

    if (unitInstallmentAmount <= 0) {
      setErrorMsg('Informe um valor maior que zero');
      return;
    }

    const dueDay = parseInt(card.dueDate, 10) || 10;
    const initialBillingDate = buildClampedDate(startYear, startMonth, dueDay);

    onAddPurchase({
      cardId: card.id,
      name: name.trim(),
      totalAmount: computedTotalAmount,
      installmentCount: count,
      currentInstallment: currentInst,
      installmentAmount: unitInstallmentAmount,
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
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-[#00ff7f]" />
                <span>{scanStep || 'Analisando o histórico de compras com IA...'}</span>
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
                        handleImageFile(lastSelectedFileRef.current, true);
                      }
                    }}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] border border-rose-500/40 transition-colors shrink-0 flex items-center gap-1.5"
                    title="Tentar novamente com compressão otimizada para conexões lentas"
                  >
                    <span>Tentar Novamente</span>
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
                          {item.installmentCount > 1 ? (
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                                item.currentInstallment === item.installmentCount
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : item.currentInstallment === 1
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              Parcela {item.currentInstallment}/{item.installmentCount}
                              {item.currentInstallment === item.installmentCount && ' (Última)'}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                              À vista
                            </span>
                          )}
                          {item.category && (
                            <span className="text-zinc-500">• {item.category}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-mono-num font-bold text-sm text-white block">
                          {formatCurrency(item.amount)}
                        </span>
                        {item.installmentCount > 1 && (
                          <span className="text-[10px] text-zinc-400 block font-mono">
                            {item.currentInstallment === item.installmentCount
                              ? 'última parcela'
                              : `por mês (${item.installmentCount}x)`}
                          </span>
                        )}
                      </div>
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
                  Total desta Fatura:{' '}
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

            {/* 2. Valor & Tipo de Valor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                  {amountType === 'installment' && count > 1
                    ? 'Valor da Parcela Desta Fatura (R$)'
                    : 'Valor (R$)'}{' '}
                  <span className="text-[#00ff7f]">*</span>
                </label>

                {count > 1 && (
                  <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAmountType('installment')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                        amountType === 'installment'
                          ? 'bg-[#00ff7f] text-black font-bold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Valor da Parcela (Extrato)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountType('total')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                        amountType === 'total'
                          ? 'bg-[#00ff7f] text-black font-bold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Valor Total da Compra
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Input de Valor */}
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

                {/* Total de Parcelas */}
                <div>
                  <select
                    id="select-parcelas-compra"
                    value={installmentCount}
                    onChange={(e) => {
                      const newCount = parseInt(e.target.value, 10);
                      setInstallmentCount(newCount);
                      if (currentInstallment > newCount) {
                        setCurrentInstallment(newCount);
                      }
                    }}
                    className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00ff7f]"
                  >
                    <option value={1}>1x (À vista)</option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36, 48].map((n) => (
                      <option key={n} value={n}>
                        {n}x (Parcelado em {n} vezes)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Qual parcela está nesta fatura? (Apenas quando count > 1) */}
              {count > 1 && (
                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-300">
                      Qual parcela está nesta fatura?
                    </label>
                    <span className="text-[11px] font-mono text-[#00ff7f] font-bold">
                      Parcela {currentInst} de {count}
                    </span>
                  </div>

                  <select
                    id="select-parcela-atual"
                    value={currentInstallment}
                    onChange={(e) => setCurrentInstallment(parseInt(e.target.value, 10))}
                    className="w-full bg-[#16161d] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00ff7f]"
                  >
                    {Array.from({ length: count }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        {num === 1
                          ? `Parcela 1 de ${count} (1ª parcela agora, restando mais ${count - 1} parcelas)`
                          : num === count
                          ? `Parcela ${count} de ${count} (Última parcela agora, sem cobranças futuras)`
                          : `Parcela ${num} de ${count} (Parcela atual, restando mais ${count - num} parcelas)`}
                      </option>
                    ))}
                  </select>

                  {/* Dynamic Status Callout Badge */}
                  <div
                    className={`p-2.5 rounded-lg text-[11px] flex items-start gap-2 ${
                      currentInst === count
                        ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300'
                        : currentInst === 1
                        ? 'bg-blue-500/10 border border-blue-500/25 text-blue-300'
                        : 'bg-amber-500/10 border border-amber-500/25 text-amber-300'
                    }`}
                  >
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      {currentInst === count ? (
                        <span>
                          <strong>Última Parcela ({count}/{count}):</strong> Será cobrada apenas nesta fatura de{' '}
                          <strong>{MONTH_NAMES[startMonth]}/{startYear}</strong> no valor de{' '}
                          <strong>{formatCurrency(unitInstallmentAmount)}</strong>. Nenhuma parcela futura será gerada nos próximos meses.
                        </span>
                      ) : currentInst === 1 ? (
                        <span>
                          <strong>1ª Parcela (1/{count}):</strong> Será cobrada a parcela 1 ({formatCurrency(unitInstallmentAmount)}) em{' '}
                          <strong>{MONTH_NAMES[startMonth]}/{startYear}</strong>, e o sistema gerará automaticamente as outras{' '}
                          <strong>{count - 1} parcelas</strong> nos meses subsequentes. Total da compra:{' '}
                          <strong>{formatCurrency(computedTotalAmount)}</strong>.
                        </span>
                      ) : (
                        <span>
                          <strong>Parcela em Andamento ({currentInst}/{count}):</strong> Cobrança da parcela {currentInst} ({formatCurrency(unitInstallmentAmount)}) em{' '}
                          <strong>{MONTH_NAMES[startMonth]}/{startYear}</strong>. O sistema gerará apenas as{' '}
                          <strong>{count - currentInst} parcelas restantes</strong> para os meses futuros (as anteriores já foram quitadas).
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
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

                {/* Mês da Fatura Atual */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    {count > 1 ? `Mês da Parcela ${currentInst}` : 'Mês da Fatura'}
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

                {/* Ano da Fatura */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Ano da Fatura
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

            {/* 4. Visual Preview: Inclusão das Parcelas geradas */}
            {unitInstallmentAmount > 0 && count > 1 && (
              <div className="p-3.5 rounded-xl bg-[#14141a] border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#00ff7f]" />
                    {currentInst === count
                      ? `Parcela única a ser cobrada nesta fatura (Última):`
                      : `Distribuição das Parcelas a serem Lançadas (${installmentsPreview.length} fatura${installmentsPreview.length > 1 ? 's' : ''}):`}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[#00ff7f]">
                    {formatCurrency(unitInstallmentAmount)} / mês
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-zinc-800/60">
                  {installmentsPreview.map((item) => (
                    <div
                      key={item.installmentNum}
                      className="flex items-center justify-between text-xs py-1.5 first:pt-0"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                            item.installmentNum === item.totalInstallments
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {item.installmentNum}/{item.totalInstallments}
                          {item.installmentNum === item.totalInstallments && ' (Final)'}
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
