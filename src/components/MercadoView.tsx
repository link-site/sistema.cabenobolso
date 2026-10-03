import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Store,
  ShoppingBag,
  Check,
  AlertCircle,
  Sparkles,
  TrendingDown,
  Search,
  ShoppingCart,
  RefreshCw,
  Copy,
  CheckCheck,
} from 'lucide-react';
import { MarketItem } from '../types';
import { formatCurrency } from '../utils/formatters';
import { DEFAULT_MARKET_ITEMS } from '../data/initialData';

interface MercadoViewProps {
  marketItems: MarketItem[];
  onAddMarketItem: (item: Omit<MarketItem, 'id' | 'createdAt'>) => Promise<any>;
  onUpdateMarketItem: (id: string, updates: Partial<MarketItem>) => Promise<any>;
  onDeleteMarketItem: (id: string) => Promise<any>;
}

const CATEGORIES = [
  'Hortifrúti',
  'Açougue & Peixaria',
  'Padaria & Sobremesas',
  'Frios & Laticínios',
  'Mercearia',
  'Bebidas',
  'Higiene & Cuidados',
  'Limpeza Doméstica',
  'Outros',
];

const SUGGESTIONS = [
  { name: 'Queijo Coalho (Kg)', category: 'Frios & Laticínios' },
  { name: 'Goma de Tapioca Fresca (1kg)', category: 'Mercearia' },
  { name: 'Café Santa Clara Vácuo 250g', category: 'Mercearia' },
  { name: 'Feijão de Corda Verde (Kg)', category: 'Hortifrúti' },
  { name: 'Carne de Sol de Alcatra (Kg)', category: 'Açougue & Peixaria' },
  { name: 'Leite Integral Betânia 1L', category: 'Frios & Laticínios' },
  { name: 'Cuscuz Flocão Maratá 500g', category: 'Mercearia' },
  { name: 'Refrigerante Cajuína São Geraldo 2L', category: 'Bebidas' },
];

export const MercadoView: React.FC<MercadoViewProps> = ({
  marketItems,
  onAddMarketItem,
  onUpdateMarketItem,
  onDeleteMarketItem,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todas');
  
  // Track expanded comparisons for specific items
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  
  // Loading states
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats calculation
  const itemsWithPrice = marketItems.filter((it) => it.lowestPrice !== undefined && it.lowestPrice !== null);
  const totalLowestBudget = itemsWithPrice.reduce((sum, it) => sum + (it.lowestPrice || 0), 0);

  // Determine the best supermarket overall (one with most cheapest items)
  const supermarketCheapestCounts: { [key: string]: number } = {};
  itemsWithPrice.forEach((item) => {
    if (item.cheapestSupermarket) {
      // Normalize supermarket names slightly if needed
      const name = item.cheapestSupermarket.trim();
      supermarketCheapestCounts[name] = (supermarketCheapestCounts[name] || 0) + 1;
    }
  });

  let bestSupermarket = 'Nenhum';
  let maxCheapestCount = 0;
  Object.entries(supermarketCheapestCounts).forEach(([name, count]) => {
    if (count > maxCheapestCount) {
      maxCheapestCount = count;
      bestSupermarket = name;
    }
  });

  // Calculate estimated savings. Premium supermarkets (São Luiz & Guará) vs Atacadão/cheapest.
  // We can simulate an average premium price (say, lowestPrice * 1.32) and find the difference.
  const estimatedSavings = itemsWithPrice.reduce((sum, it) => {
    const lowest = it.lowestPrice || 0;
    // Find highest price in comparison if available, or fall back to 30% higher
    const highest = it.comparisons && it.comparisons.length > 0 
      ? Math.max(...it.comparisons.filter(c => c.isAvailable && c.price > 0).map(c => c.price))
      : lowest * 1.3;
    return sum + (highest - lowest);
  }, 0);

  // Form handle
  const [copiedList, setCopiedList] = useState(false);

  const handleCopyList = () => {
    if (marketItems.length === 0) return;
    const lines = [
      '🛒 *Lista de Compras & Cotação (Fortaleza)*',
      `Supermercado Recomendado: ${bestSupermarket}`,
      `Total Cesta Mínima: ${formatCurrency(totalLowestBudget)}`,
      '',
      ...marketItems.map((item) => {
        const priceStr = item.lowestPrice !== undefined && item.lowestPrice !== null
          ? `${formatCurrency(item.lowestPrice)} (${item.cheapestSupermarket || 'Atacadão'})`
          : 'Sem cotação';
        return `• ${item.name} [${item.category}]: ${priceStr}`;
      }),
      '',
      'Gerado pelo Sistema Cabe no bolso'
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 2500);
  };

  const handleLoadDefaultItems = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      for (const def of DEFAULT_MARKET_ITEMS) {
        const alreadyExists = marketItems.some((it) => it.name.toLowerCase() === def.name.toLowerCase());
        if (!alreadyExists) {
          await onAddMarketItem({
            name: def.name,
            category: def.category,
            lowestPrice: def.lowestPrice,
            cheapestSupermarket: def.cheapestSupermarket,
            comparisons: def.comparisons,
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar itens de exemplo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddItem = async (e?: React.FormEvent, customItem?: { name: string; category: string }) => {
    if (e) e.preventDefault();
    
    const targetName = customItem ? customItem.name : name;
    const targetCategory = customItem ? customItem.category : category;

    if (!targetName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onAddMarketItem({
        name: targetName.trim(),
        category: targetCategory,
      });
      if (!customItem) {
        setName('');
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao adicionar o item da lista.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Search individual price
  const handleSearchItemPrice = async (item: MarketItem) => {
    setSearchingId(item.id);
    setError(null);
    try {
      const response = await fetch('/api/search-market-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemName: item.name,
          category: item.category,
        }),
      });

      const resData = await response.json();
      if (!resData.success) {
        throw new Error(resData.error || 'Erro ao processar busca.');
      }

      const { lowestPrice, cheapestSupermarket, comparisons } = resData.data;

      await onUpdateMarketItem(item.id, {
        lowestPrice,
        cheapestSupermarket,
        comparisons,
      });
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao pesquisar preços para "${item.name}": ${err.message || err}`);
    } finally {
      setSearchingId(null);
    }
  };

  // Bulk scan for all items without prices, or refresh all
  const handleScanAllPrices = async () => {
    if (marketItems.length === 0) return;
    setGlobalSearching(true);
    setError(null);

    // Filter to ones without price first; if none, scan everything
    const unpriced = marketItems.filter((it) => it.lowestPrice === undefined || it.lowestPrice === null);
    const targets = unpriced.length > 0 ? unpriced : marketItems;

    try {
      for (const item of targets) {
        setSearchingId(item.id);
        const response = await fetch('/api/search-market-prices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            itemName: item.name,
            category: item.category,
          }),
        });

        const resData = await response.json();
        if (resData.success) {
          const { lowestPrice, cheapestSupermarket, comparisons } = resData.data;
          await onUpdateMarketItem(item.id, {
            lowestPrice,
            cheapestSupermarket,
            comparisons,
          });
        }
        // Small delay to prevent API flooding
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro na varredura completa dos preços: ${err.message || err}`);
    } finally {
      setSearchingId(null);
      setGlobalSearching(false);
    }
  };

  // Delete item
  const handleDeleteItem = async (id: string) => {
    if (window.confirm('Tem certeza de que deseja remover este item de sua lista de compras?')) {
      try {
        await onDeleteMarketItem(id);
        if (expandedItemId === id) setExpandedItemId(null);
      } catch (err) {
        console.error(err);
        setError('Erro ao excluir item da lista.');
      }
    }
  };

  // Toggle expandable comparisons
  const toggleExpandItem = (id: string) => {
    setExpandedItemId(expandedItemId === id ? null : id);
  };

  // Filter items
  const filteredItems = marketItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategoryFilter === 'Todas' || item.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#00ff7f] bg-[#00ff7f]/10 border border-[#00ff7f]/20 px-2 py-0.5 rounded">
            Cotação Inteligente
          </span>
          <h2 className="text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#00ff7f]" />
            Pesquisa de Mercado
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Compare preços automaticamente entre os maiores supermercados de Fortaleza (Frangolândia, Lagoa, Guará, CenterBox, Atacadão, Mercadão e São Luiz).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {marketItems.length > 0 && (
            <>
              <button
                onClick={handleCopyList}
                className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-[#00ff7f]/40 hover:text-white text-zinc-300 px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer"
                title="Copiar lista de compras para a área de transferência (WhatsApp, notas)"
              >
                {copiedList ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-[#00ff7f]" />
                    <span className="text-[#00ff7f]">Lista Copiada!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Copiar Lista</span>
                  </>
                )}
              </button>

              <button
                onClick={handleScanAllPrices}
                disabled={globalSearching || searchingId !== null}
                className="flex items-center gap-2 bg-[#00ff7f]/10 border border-[#00ff7f]/30 hover:bg-[#00ff7f]/20 text-[#00ff7f] px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {globalSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                )}
                <span>{globalSearching ? 'Varrendo Preços...' : 'Buscar Todos os Preços'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">Ocorreu um erro:</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white font-bold cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* Analytics Summary Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Basket Estimate */}
        <div className="bg-[#0b0b0f] border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-zinc-800 pointer-events-none transition-transform group-hover:scale-110">
            <ShoppingBag className="w-16 h-16" />
          </div>
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Cesta (Preço Mínimo)</p>
          <p className="text-2xl font-black text-[#00ff7f] mt-1">
            {formatCurrency(totalLowestBudget)}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-2">
            <Check className="w-3.5 h-3.5 text-[#00ff7f]" />
            <span>Baseado em {itemsWithPrice.length} de {marketItems.length} itens cotados</span>
          </div>
        </div>

        {/* Card 2: Best Supermarket Overall */}
        <div className="bg-[#0b0b0f] border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-zinc-800 pointer-events-none transition-transform group-hover:scale-110">
            <Store className="w-16 h-16" />
          </div>
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Supermercado Recomendado</p>
          <p className="text-lg font-black text-white mt-1.5 truncate">
            {bestSupermarket !== 'Nenhum' ? bestSupermarket : 'Aguardando cotações'}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-2.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00ff7f]" />
            <span>
              {maxCheapestCount > 0 
                ? `Possui o menor preço em ${maxCheapestCount} item(ns)` 
                : 'Insira e pesquise itens para ver a recomendação'}
            </span>
          </div>
        </div>

        {/* Card 3: Estimated Savings */}
        <div className="bg-[#0b0b0f] border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-zinc-800 pointer-events-none transition-transform group-hover:scale-110">
            <TrendingDown className="w-16 h-16" />
          </div>
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Economia Estimada</p>
          <p className="text-2xl font-black text-amber-400 mt-1">
            {formatCurrency(estimatedSavings)}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-2">
            <TrendingDown className="w-3.5 h-3.5 text-[#00ff7f]" />
            <span>Economia média comprando no local mais barato</span>
          </div>
        </div>
      </div>

      {/* Input Form & Suggestions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Input Form */}
        <div className="bg-[#0b0b0f] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-black text-white border-b border-zinc-900 pb-2 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#00ff7f]" />
            Adicionar Item à Lista
          </h3>

          <form onSubmit={(e) => handleAddItem(e)} className="space-y-4">
            <div>
              <label htmlFor="itemName" className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">
                Nome do Item
              </label>
              <input
                id="itemName"
                type="text"
                placeholder="Ex: Queijo Coalho, Tapioca, Leite..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting || globalSearching}
                className="w-full bg-[#050507] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#00ff7f] transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="itemCategory" className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">
                Categoria
              </label>
              <select
                id="itemCategory"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isSubmitting || globalSearching}
                className="w-full bg-[#050507] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#00ff7f] transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || globalSearching}
              className="w-full bg-[#00ff7f] hover:bg-[#00e06e] text-black font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Adicionar à Lista</span>
            </button>
          </form>
        </div>

        {/* Right Side: Quick suggestions */}
        <div className="bg-[#0b0b0f] border border-zinc-800/80 rounded-2xl p-5 lg:col-span-2 space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-white border-b border-zinc-900 pb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Produtos Frequentes em Fortaleza
            </h3>
            <p className="text-[11px] text-zinc-400 mt-1">
              Dica: Clique em qualquer sugestão abaixo para adicionar rapidamente à sua lista de compras.
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              {SUGGESTIONS.map((sug, idx) => {
                const alreadyAdded = marketItems.some(
                  (it) => it.name.toLowerCase() === sug.name.toLowerCase()
                );
                return (
                  <button
                    key={idx}
                    onClick={() => handleAddItem(undefined, sug)}
                    disabled={alreadyAdded || isSubmitting || globalSearching}
                    className={`text-[11px] px-3 py-2 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                      alreadyAdded
                        ? 'bg-zinc-900/50 border-zinc-850 text-zinc-500 cursor-not-allowed'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-[#00ff7f]/40 hover:text-white'
                    }`}
                  >
                    <span>{sug.name}</span>
                    <span className="text-[9px] opacity-65 bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                      {sug.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-3 mt-4 text-[11px] text-zinc-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-zinc-600" />
            <span>O assistente fará uma busca baseada no nome para encontrar os preços correspondentes mais realistas.</span>
          </div>
        </div>
      </div>

      {/* Shopping List Table Card */}
      <div className="bg-[#0b0b0f] border border-zinc-800/80 rounded-2xl overflow-hidden">
        {/* Table Search and Filters header */}
        <div className="p-4 bg-[#0e0e12]/80 border-b border-zinc-900 flex flex-col md:flex-row items-center justify-between gap-4">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#00ff7f]" />
            Lista de Compras ({filteredItems.length} Itens)
          </h3>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Search filter input */}
            <div className="relative w-full sm:w-48">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-3.5 h-3.5 text-zinc-500" />
              </span>
              <input
                type="text"
                placeholder="Buscar item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#050507] border border-zinc-800 rounded-xl pl-8.5 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00ff7f]"
              />
            </div>

            {/* Category selection */}
            <div className="relative w-full sm:w-auto">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full sm:w-auto bg-[#050507] border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00ff7f]"
              >
                <option value="Todas">Todas as Categorias</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* List render */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto mb-3">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-zinc-400">Nenhum item na sua lista de compras.</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto mb-4">
              Adicione itens manualmente ou selecione uma das sugestões acima de produtos comuns em Fortaleza.
            </p>
            {marketItems.length === 0 && (
              <button
                onClick={handleLoadDefaultItems}
                disabled={isSubmitting || globalSearching}
                className="inline-flex items-center gap-2 bg-[#00ff7f]/10 border border-[#00ff7f]/30 hover:bg-[#00ff7f]/20 text-[#00ff7f] text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Carregar Itens de Exemplo (Fortaleza)</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-900">
            {filteredItems.map((item) => {
              const isExpanded = expandedItemId === item.id;
              const hasPrice = item.lowestPrice !== undefined && item.lowestPrice !== null;
              const isSearching = searchingId === item.id;

              return (
                <div key={item.id} className="transition-colors hover:bg-zinc-900/10">
                  {/* Primary row */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Bullet store category icon */}
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mt-0.5 shrink-0">
                        <Store className="w-4 h-4 text-[#00ff7f]" />
                      </div>
                      
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white leading-snug truncate">
                          {item.name}
                        </h4>
                        <span className="inline-block text-[10px] font-semibold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded mt-1">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    {/* Pricing matching columns */}
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      {/* Price status column */}
                      <div className="text-left sm:text-right">
                        {isSearching ? (
                          <div className="flex items-center gap-1.5 text-xs text-[#00ff7f]">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="animate-pulse">Cotando...</span>
                          </div>
                        ) : hasPrice ? (
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wide block leading-none">
                              Mais barato em
                            </span>
                            <span className="text-[11px] font-bold text-zinc-300 block mt-1">
                              {item.cheapestSupermarket}
                            </span>
                            <span className="text-sm font-black text-[#00ff7f] block mt-0.5">
                              {formatCurrency(item.lowestPrice!)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500">Sem cotação ativa</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Search button */}
                        <button
                          onClick={() => handleSearchItemPrice(item)}
                          disabled={searchingId !== null || globalSearching}
                          className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-[#00ff7f] border border-zinc-800 transition-colors cursor-pointer disabled:opacity-40"
                          title="Fazer busca individual de preços"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
                        </button>

                        {/* Expand button */}
                        {hasPrice && (
                          <button
                            onClick={() => toggleExpandItem(item.id)}
                            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                              isExpanded
                                ? 'bg-[#00ff7f]/10 border-[#00ff7f]/30 text-[#00ff7f]'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
                            }`}
                            title="Ver detalhes de comparação"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={searchingId !== null || globalSearching}
                          className="p-2 rounded-lg bg-zinc-900 hover:bg-red-950 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-900/30 transition-colors cursor-pointer disabled:opacity-40"
                          title="Remover item da lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expand comparison breakdown view */}
                  {isExpanded && item.comparisons && (
                    <div className="px-4 pb-4 pt-1 bg-[#07070a] border-t border-zinc-900">
                      <div className="rounded-xl border border-zinc-850/80 overflow-hidden bg-[#0a0a0f] mt-2">
                        {/* Comparison header */}
                        <div className="grid grid-cols-12 bg-zinc-900/80 px-4 py-2 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                          <div className="col-span-4">Supermercado</div>
                          <div className="col-span-5">Especificação do Produto</div>
                          <div className="col-span-3 text-right">Preço Cotado</div>
                        </div>

                        {/* Comparison details rows */}
                        <div className="divide-y divide-zinc-900/50">
                          {item.comparisons.map((comp, cIdx) => {
                            const isCheapest = comp.price === item.lowestPrice && comp.isAvailable;
                            return (
                              <div
                                key={cIdx}
                                className={`grid grid-cols-12 px-4 py-3 text-xs items-center ${
                                  isCheapest
                                    ? 'bg-[#00ff7f]/5 text-white'
                                    : 'text-zinc-300'
                                }`}
                              >
                                {/* Supermarket logo label */}
                                <div className="col-span-4 font-bold flex items-center gap-1.5">
                                  <Store className={`w-3.5 h-3.5 ${isCheapest ? 'text-[#00ff7f]' : 'text-zinc-600'}`} />
                                  <span>{comp.supermarket}</span>
                                </div>

                                {/* Product specification match */}
                                <div className="col-span-5 text-zinc-400 text-[11px] truncate pr-2">
                                  {comp.isAvailable ? comp.productName : 'Produto indisponível / Não cadastrado'}
                                </div>

                                {/* Price block */}
                                <div className="col-span-3 text-right">
                                  {comp.isAvailable ? (
                                    <div className="flex flex-col items-end">
                                      <span className={`font-semibold ${isCheapest ? 'text-[#00ff7f] font-black' : 'text-zinc-100'}`}>
                                        {formatCurrency(comp.price)}
                                      </span>
                                      {isCheapest && (
                                        <span className="text-[8px] uppercase tracking-wider text-[#00ff7f] font-black mt-0.5 bg-[#00ff7f]/10 border border-[#00ff7f]/20 px-1 py-0.2 rounded leading-none">
                                          Cheapest
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-zinc-600 text-[10px] font-semibold italic">Indisponível</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
