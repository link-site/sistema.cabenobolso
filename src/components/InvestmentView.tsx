import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  PieChart,
  Calendar,
  Sparkles,
  ArrowRight,
  Info,
  DollarSign,
  Clock,
  Coins,
  Receipt,
  Layers,
  ChevronRight,
  ChevronLeft,
  Award,
  Wallet,
  Zap,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Globe,
  Flame,
} from 'lucide-react';
import { Transaction, CreditCard, CardPurchase } from '../types';
import { formatCurrency, MONTH_NAMES, getNextMonthBudget } from '../utils/formatters';
import {
  INVESTMENT_PROFILES,
  MARKET_BENCHMARKS,
  MARKET_BEST_PRACTICES,
  InvestmentLevelKey,
} from '../utils/investmentData';
import {
  calculateBudgetFinancialSnapshot,
  calculateCompoundSimulation,
  getComparativeSimulation,
} from '../utils/investmentCalculations';

interface InvestmentViewProps {
  transactions: Transaction[];
  cards: CreditCard[];
  cardPurchases: CardPurchase[];
  onNavigateToBudget?: (year: number, month: number) => void;
}

export const InvestmentView: React.FC<InvestmentViewProps> = ({
  transactions,
  cards,
  cardPurchases,
  onNavigateToBudget,
}) => {
  // Inicializa com o mês de orçamento atual/próximo
  const defaultTarget = useMemo(() => getNextMonthBudget(), []);
  const [selectedYear, setSelectedYear] = useState<number>(defaultTarget.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultTarget.month);

  // Perfil selecionado para detalhes
  const [activeLevel, setActiveLevel] = useState<InvestmentLevelKey>('moderado');
  const [viewMode, setViewMode] = useState<'perfil' | 'comparativo'>('perfil');

  // Diagnóstico financeiro do mês selecionado
  const snapshot = useMemo(() => {
    return calculateBudgetFinancialSnapshot(
      transactions,
      cards,
      cardPurchases,
      selectedYear,
      selectedMonth
    );
  }, [transactions, cards, cardPurchases, selectedYear, selectedMonth]);

  // Parâmetros do Simulador de Juros Compostos
  // Por padrão usa a sobra líquida do orçamento (se positiva), ou R$ 300
  const initialDefaultMonthly = snapshot.monthlySurplus > 0 ? Math.round(snapshot.monthlySurplus) : 300;
  const [monthlyContribution, setMonthlyContribution] = useState<number>(initialDefaultMonthly);
  const [initialAmount, setInitialAmount] = useState<number>(1000);
  const [simulationPeriodMonths, setSimulationPeriodMonths] = useState<number>(60); // 5 anos padrão

  // Atalhos de prazos pré-definidos
  const periodPresets = [
    { label: '6 meses', months: 6, desc: 'Reserva curta' },
    { label: '1 ano', months: 12, desc: 'Curto prazo' },
    { label: '2 anos', months: 24, desc: 'IR mínimo 15%' },
    { label: '5 anos', months: 60, desc: 'Médio prazo' },
    { label: '10 anos', months: 120, desc: 'Multiplicação' },
    { label: '20 anos', months: 240, desc: 'Aposentadoria' },
    { label: '30 anos', months: 360, desc: 'Independência (FIRE)' },
  ];

  // Cálculo da simulação do nível ativo
  const activeProfile = INVESTMENT_PROFILES[activeLevel];
  const activeSimulation = useMemo(() => {
    return calculateCompoundSimulation(
      initialAmount,
      monthlyContribution,
      activeProfile.annualReturn,
      simulationPeriodMonths
    );
  }, [initialAmount, monthlyContribution, activeProfile.annualReturn, simulationPeriodMonths]);

  // Simulação comparativa (Poupança vs Conservador vs Moderado vs Arrojado)
  const comparativeData = useMemo(() => {
    return getComparativeSimulation(
      initialAmount,
      monthlyContribution,
      simulationPeriodMonths
    );
  }, [initialAmount, monthlyContribution, simulationPeriodMonths]);

  // Função para navegar meses do orçamento
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleSetCurrentMonth = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  };

  // Botão rápido para sincronizar o aporte com a sobra do mês
  const handleUseBudgetSurplus = () => {
    if (snapshot.monthlySurplus > 0) {
      setMonthlyContribution(Math.round(snapshot.monthlySurplus));
    } else {
      setMonthlyContribution(200);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* Top Header Banner */}
      <div className="relative rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-zinc-800 p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00ff7f]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f]">
                <TrendingUp className="w-6 h-6" />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-[#00ff7f] px-2 py-0.5 rounded-full bg-[#00ff7f]/10 border border-[#00ff7f]/20">
                Mercado Financeiro 2026
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Simulador de <span className="text-[#00ff7f]">Investimentos</span> & Práticas
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Simulação de rentabilidade patrimonial com base no seu orçamento mensal real (ganhos x gastos),
              estruturada com as <strong>3 Melhores Práticas do Mercado Atual</strong> e comparativo com a Poupança.
            </p>
          </div>

          {/* Live Market Benchmark Ticker */}
          <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-3.5 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center shrink-0">
            <div className="px-2">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Taxa Selic</span>
              <span className="text-sm sm:text-base font-extrabold text-[#00ff7f]">
                {MARKET_BENCHMARKS.selicRate.toFixed(2)}% <span className="text-[10px] text-zinc-400 font-normal">a.a.</span>
              </span>
            </div>
            <div className="px-2 border-l border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Taxa CDI</span>
              <span className="text-sm sm:text-base font-extrabold text-cyan-400">
                {MARKET_BENCHMARKS.cdiRate.toFixed(2)}% <span className="text-[10px] text-zinc-400 font-normal">a.a.</span>
              </span>
            </div>
            <div className="px-2 border-l border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Inflação IPCA</span>
              <span className="text-sm sm:text-base font-extrabold text-amber-400">
                {MARKET_BENCHMARKS.ipcaInflation.toFixed(2)}% <span className="text-[10px] text-zinc-400 font-normal">est.</span>
              </span>
            </div>
            <div className="px-2 border-l border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">FGC Garantia</span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-400">
                R$ 250k <span className="text-[10px] text-zinc-400 font-normal">/CPF</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Diagnóstico Orçamentário Real (Ganhos vs Gastos) */}
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#00ff7f]" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                1. Diagnóstico do seu Orçamento Mensal
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Identificamos seus ganhos e gastos reais para calcular sua capacidade de investimento.
            </p>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-2 self-start sm:self-auto bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-white px-2">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleSetCurrentMonth}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-300 transition-colors cursor-pointer"
            >
              Hoje
            </button>
          </div>
        </div>

        {/* 3 Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card Ganhos */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Ganhos do Mês (Receitas)
              </span>
              <p className="text-xl sm:text-2xl font-black text-emerald-400">
                {formatCurrency(snapshot.totalIncome)}
              </p>
              <span className="text-[11px] text-zinc-500">Salários e entradas registradas</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Coins className="w-5 h-5" />
            </div>
          </div>

          {/* Card Gastos */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Gastos do Mês (Despesas)
              </span>
              <p className="text-xl sm:text-2xl font-black text-rose-400">
                {formatCurrency(snapshot.totalExpenses)}
              </p>
              <span className="text-[11px] text-zinc-500">Contas fixas, variáveis & faturas</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>

          {/* Card Sobra Disponível para Investir */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            snapshot.monthlySurplus > 0
              ? 'bg-[#00ff7f]/5 border-[#00ff7f]/30'
              : 'bg-amber-500/5 border-amber-500/30'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Sobra para Investir
                </span>
                {snapshot.monthlySurplus > 0 && (
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-[#00ff7f]/20 text-[#00ff7f]">
                    {snapshot.savingsRatePercentage.toFixed(0)}% da renda
                  </span>
                )}
              </div>
              <p className={`text-xl sm:text-2xl font-black ${
                snapshot.monthlySurplus > 0 ? 'text-[#00ff7f]' : 'text-amber-400'
              }`}>
                {formatCurrency(snapshot.monthlySurplus)}
              </p>
              <button
                onClick={handleUseBudgetSurplus}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00ff7f] hover:underline cursor-pointer"
              >
                <Zap className="w-3 h-3" />
                Usar este valor no simulador
              </button>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              snapshot.monthlySurplus > 0
                ? 'bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f]'
                : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
            }`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Régua da Melhores Práticas 50 / 30 / 20 */}
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-zinc-200">
                Padrão Ouro de Mercado: Regra 50 / 30 / 20
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">
              50% Necessidades • 30% Desejos/Estilo de Vida • 20% Investimentos
            </span>
          </div>

          {/* Progress Bar Comparativo */}
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden flex">
              <div
                style={{
                  width: `${Math.min(100, (snapshot.totalExpenses / (snapshot.totalIncome || 1)) * 100)}%`,
                }}
                className={`h-full transition-all ${
                  snapshot.totalExpenses > snapshot.totalIncome
                    ? 'bg-rose-500'
                    : (snapshot.totalExpenses / (snapshot.totalIncome || 1)) > 0.8
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                title={`Gastos: ${formatCurrency(snapshot.totalExpenses)}`}
              />
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, (snapshot.monthlySurplus / (snapshot.totalIncome || 1)) * 100))}%`,
                }}
                className="h-full bg-[#00ff7f] transition-all"
                title={`Sobra para Investir: ${formatCurrency(snapshot.monthlySurplus)}`}
              />
            </div>
            <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Gastos Atuais: {snapshot.totalIncome > 0 ? ((snapshot.totalExpenses / snapshot.totalIncome) * 100).toFixed(0) : 0}% da renda
              </span>
              <span className="flex items-center gap-1 font-bold text-[#00ff7f]">
                <span className="w-2 h-2 rounded-full bg-[#00ff7f] inline-block" />
                Sobra Líquida: {snapshot.savingsRatePercentage.toFixed(0)}% (Meta ideal: 20%)
              </span>
            </div>
          </div>

          {/* Diagnóstico Contextual */}
          <div className="pt-2 flex items-start gap-2 text-xs">
            {snapshot.savingsRatePercentage >= 20 ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Parabéns!</strong> Você poupa {snapshot.savingsRatePercentage.toFixed(0)}% da sua renda, superando a meta dos 20% da regra 50/30/20. Isso acelera drasticamente sua independência financeira!
                </span>
              </div>
            ) : snapshot.monthlySurplus > 0 ? (
              <div className="flex items-center gap-2 text-amber-400">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Você tem uma sobra positiva de {formatCurrency(snapshot.monthlySurplus)} ({snapshot.savingsRatePercentage.toFixed(0)}% da renda). A meta ideal é chegar em 20% ({formatCurrency(snapshot.idealInvestments)}). Comece investindo essa sobra!
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Seus gastos neste mês consumiram todo o salário. Revise os custos fixos no menu <strong>Orçamento Mensal</strong> para liberar pelo menos R$ 100 a R$ 200 para dar o primeiro passo.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Banner Passo Zero: Reserva de Emergência */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-zinc-950 border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                  Regra nº 1 dos Investimentos
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.2 rounded-full font-bold">
                  Reserva de Emergência
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Sua Reserva Ideal: 6 meses de gastos = {formatCurrency(snapshot.recommendedEmergencyFund.months6)}
              </h3>
              <p className="text-xs text-zinc-400 max-w-xl">
                Antes de buscar ações ou fundos imobiliários, acumule de 3 a 6 meses de custo de vida no <strong>Nível 1 (Tesouro Selic ou CDB 100% CDI)</strong> com liquidez diária.
                {snapshot.monthsToReachEmergencyFund6Months > 0 && (
                  <span className="text-emerald-400 font-semibold ml-1">
                    Com a sua sobra atual, você atinge a meta em aproximadamente {snapshot.monthsToReachEmergencyFund6Months} meses.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Liquidez</span>
              <span className="text-xs font-bold text-emerald-400">Resgate Imediato D+0</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Os 3 Níveis de Investimento (Melhores Práticas) */}
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#00ff7f]" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                2. Os 3 Níveis de Investimento do Mercado Atual
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Carteiras recomendadas de acordo com as diretrizes da ANBIMA e consultores financeiros profissionais.
            </p>
          </div>

          {/* Toggle Perfil / Comparativo */}
          <div className="flex items-center p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs self-start sm:self-auto">
            <button
              onClick={() => setViewMode('perfil')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'perfil'
                  ? 'bg-[#00ff7f] text-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Ver em Detalhes
            </button>
            <button
              onClick={() => setViewMode('comparativo')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'comparativo'
                  ? 'bg-[#00ff7f] text-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Comparativo Lado a Lado
            </button>
          </div>
        </div>

        {/* 3 Level Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['conservador', 'moderado', 'arrojado'] as InvestmentLevelKey[]).map((key) => {
            const profile = INVESTMENT_PROFILES[key];
            const isSelected = activeLevel === key;

            return (
              <button
                key={key}
                onClick={() => {
                  setActiveLevel(key);
                  setViewMode('perfil');
                }}
                className={`p-4 rounded-xl text-left transition-all border cursor-pointer relative overflow-hidden group ${
                  isSelected
                    ? 'bg-zinc-900 border-[#00ff7f] shadow-lg shadow-[#00ff7f]/10'
                    : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900/80 hover:border-zinc-700'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#00ff7f]/10 rounded-full blur-xl pointer-events-none" />
                )}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${profile.riskBadgeColor}`}>
                    Risco: {profile.risk}
                  </span>
                  <span className="text-xs font-mono font-black text-[#00ff7f]">
                    ~{profile.annualReturn.toFixed(2)}% a.a.
                  </span>
                </div>

                <h3 className="text-base font-black text-white flex items-center gap-1.5">
                  {profile.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                  {profile.tagline}
                </p>

                <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Horizonte: {profile.horizon.split(' ')[0]} {profile.horizon.split(' ')[1]}</span>
                  <span className={`font-semibold flex items-center gap-1 ${isSelected ? 'text-[#00ff7f]' : 'text-zinc-400 group-hover:text-white'}`}>
                    {isSelected ? 'Selecionado' : 'Explorar'}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* View Mode: Detalhes do Perfil Ativo */}
        {viewMode === 'perfil' && (
          <div className="p-5 sm:p-6 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${activeProfile.riskBadgeColor}`}>
                    {activeProfile.risk}
                  </span>
                  <h3 className="text-lg font-black text-white">
                    {activeProfile.name} • Rentabilidade Média: ~{activeProfile.annualReturn.toFixed(2)}% a.a. (~{activeProfile.monthlyReturnEstimate.toFixed(2)}% a.m.)
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  <strong>Indicado para:</strong> {activeProfile.idealFor}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Clock className="w-4 h-4 text-[#00ff7f]" />
                <span>Horizonte: <strong className="text-white">{activeProfile.horizon}</strong></span>
              </div>
            </div>

            {/* Asset Allocation Progress Bar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                <span>Alocação Recomendada da Carteira</span>
                <span className="text-[#00ff7f]">Total: 100%</span>
              </div>

              {/* Multi-segment Bar */}
              <div className="h-4 w-full rounded-full bg-zinc-800 overflow-hidden flex shadow-inner">
                {activeProfile.allocations.map((alloc) => (
                  <div
                    key={alloc.id}
                    style={{
                      width: `${alloc.percentage}%`,
                      backgroundColor: alloc.color,
                    }}
                    className="h-full transition-all hover:opacity-90 cursor-pointer"
                    title={`${alloc.name}: ${alloc.percentage}%`}
                  />
                ))}
              </div>

              {/* Allocation Cards Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {activeProfile.allocations.map((alloc) => (
                  <div
                    key={alloc.id}
                    className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: alloc.color }}
                        />
                        <span className="text-xs font-bold text-white truncate">
                          {alloc.name}
                        </span>
                      </div>
                      <span className="text-xs font-black font-mono text-[#00ff7f]">
                        {alloc.percentage}%
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      {alloc.description}
                    </p>
                    <div className="pt-1 flex flex-wrap gap-1">
                      {alloc.examples.map((ex, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-800"
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Assets Examples & Strategy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Estratégias Recomendadas */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                  <Award className="w-4 h-4 text-[#00ff7f]" />
                  <span>Melhores Práticas Deste Nível</span>
                </div>
                <ul className="space-y-2 text-xs text-zinc-300">
                  {activeProfile.keyStrategies.map((strat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#00ff7f] font-bold mt-0.5">✓</span>
                      <span>{strat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Ativos Recomendados no Mercado Hoje */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Exemplos Práticos do Mercado Brasileiro</span>
                </div>
                <div className="space-y-2">
                  {activeProfile.recommendedAssets.map((asset, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-white block truncate">
                          {asset.symbolOrName}
                        </span>
                        <span className="text-[11px] text-zinc-400 block truncate">
                          {asset.description}
                        </span>
                      </div>
                      {asset.badge && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-[#00ff7f] border border-[#00ff7f]/20 shrink-0">
                          {asset.badge}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Mode: Comparativo Lado a Lado */}
        {viewMode === 'comparativo' && (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="p-3.5 font-bold">Critério / Característica</th>
                  <th className="p-3.5 font-bold text-emerald-400">Nível 1: Conservador</th>
                  <th className="p-3.5 font-bold text-cyan-400">Nível 2: Moderado</th>
                  <th className="p-3.5 font-bold text-amber-400">Nível 3: Arrojado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950/80 text-zinc-300">
                <tr>
                  <td className="p-3.5 font-bold text-white">Rentabilidade Estimada</td>
                  <td className="p-3.5 font-mono font-bold text-[#00ff7f]">~10,75% a.a.</td>
                  <td className="p-3.5 font-mono font-bold text-cyan-400">~12,50% a.a.</td>
                  <td className="p-3.5 font-mono font-bold text-amber-400">~15,00% a.a.</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-white">Nível de Risco</td>
                  <td className="p-3.5 text-emerald-400 font-semibold">Muito Baixo (Sem perdas)</td>
                  <td className="p-3.5 text-cyan-400 font-semibold">Moderado (Oscilação baixa)</td>
                  <td className="p-3.5 text-amber-400 font-semibold">Arrojado (Volatilidade maior)</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-white">Liquidez & Resgate</td>
                  <td className="p-3.5">Imediata (D+0 / D+1)</td>
                  <td className="p-3.5">Mista (D+0 a D+2 na B3)</td>
                  <td className="p-3.5">Foco no Longo Prazo</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-white">Garantia / Proteção</td>
                  <td className="p-3.5">FGC R$ 250k + Tesouro Direto</td>
                  <td className="p-3.5">FGC em Renda Fixa + Ativos Reais</td>
                  <td className="p-3.5">Diversificação Global (Dólar)</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-white">Foco Principal</td>
                  <td className="p-3.5">Reserva de Emergência & Segurança</td>
                  <td className="p-3.5">Renda Passiva Mensal (Dividendos)</td>
                  <td className="p-3.5">Multiplicação & Independência (FIRE)</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-white">Ativos Principais</td>
                  <td className="p-3.5 font-mono text-[11px]">Tesouro Selic, CDB 100% CDI, LCI/LCA</td>
                  <td className="p-3.5 font-mono text-[11px]">FIIs (HGLG11/MXRF11), IPCA+, ITUB4</td>
                  <td className="p-3.5 font-mono text-[11px]">IVVB11 (S&P500), WEGE3, BTC, IPCA+ 2045</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: Simulador Interativo de Juros Compostos (Bola de Neve) */}
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#00ff7f]" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                3. Simulador de Projeção Financeira Interativa
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Simule o crescimento do seu patrimônio com aportes mensais, juros compostos e renda passiva futura.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Perfil ativo:</span>
            <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg border ${activeProfile.riskBadgeColor}`}>
              {activeProfile.name}
            </span>
          </div>
        </div>

        {/* Inputs do Simulador */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Aporte Mensal */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Aporte Mensal (R$)
              </label>
              <button
                onClick={handleUseBudgetSurplus}
                className="text-[10px] font-bold text-[#00ff7f] hover:underline cursor-pointer"
                title="Puxar a sobra calculada do seu orçamento"
              >
                Puxar Sobra ({formatCurrency(snapshot.monthlySurplus)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-bold">
                R$
              </span>
              <input
                type="number"
                min="0"
                step="50"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-lg font-black text-white focus:outline-none focus:border-[#00ff7f] transition-colors"
              />
            </div>
            {/* Quick Increment Buttons */}
            <div className="flex gap-1.5 pt-1">
              {[100, 250, 500, 1000].map((add) => (
                <button
                  key={add}
                  onClick={() => setMonthlyContribution((prev) => prev + add)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-[10px] font-bold text-zinc-300 transition-colors cursor-pointer"
                >
                  +{add}
                </button>
              ))}
            </div>
          </div>

          {/* Investimento Inicial */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Investimento Inicial (R$)
              </label>
              <span className="text-[10px] text-zinc-500">Valor já guardado</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-bold">
                R$
              </span>
              <input
                type="number"
                min="0"
                step="500"
                value={initialAmount}
                onChange={(e) => setInitialAmount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-lg font-black text-white focus:outline-none focus:border-[#00ff7f] transition-colors"
              />
            </div>
            <div className="flex gap-1.5 pt-1">
              {[0, 1000, 5000, 10000].map((val) => (
                <button
                  key={val}
                  onClick={() => setInitialAmount(val)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                    initialAmount === val
                      ? 'bg-[#00ff7f]/20 text-[#00ff7f] border border-[#00ff7f]/40'
                      : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {val === 0 ? 'Zero' : `${val / 1000}k`}
                </button>
              ))}
            </div>
          </div>

          {/* Prazo em Meses / Anos */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Prazo de Investimento
              </label>
              <span className="text-xs font-mono font-bold text-[#00ff7f]">
                {simulationPeriodMonths} meses ({(simulationPeriodMonths / 12).toFixed(1)} anos)
              </span>
            </div>
            {/* Period Slider */}
            <input
              type="range"
              min="6"
              max="360"
              step="6"
              value={simulationPeriodMonths}
              onChange={(e) => setSimulationPeriodMonths(Number(e.target.value))}
              className="w-full accent-[#00ff7f] cursor-pointer"
            />
            {/* Quick Period Badges */}
            <div className="flex flex-wrap gap-1 pt-1">
              {periodPresets.map((p) => (
                <button
                  key={p.months}
                  onClick={() => setSimulationPeriodMonths(p.months)}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                    simulationPeriodMonths === p.months
                      ? 'bg-[#00ff7f] text-black font-bold'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dashboard de Resultados da Simulação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card Patrimônio Final */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-[#00ff7f]/40 shadow-xl shadow-[#00ff7f]/5 space-y-1 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#00ff7f]/15 rounded-full blur-xl pointer-events-none" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00ff7f]">
              Patrimônio Total Acumulado
            </span>
            <p className="text-2xl sm:text-3xl font-black text-white">
              {formatCurrency(activeSimulation.finalTotal)}
            </p>
            <span className="text-[11px] text-zinc-400 block pt-1">
              Multiplicador: <strong>{activeSimulation.gainMultiplier.toFixed(2)}x</strong> seu capital
            </span>
          </div>

          {/* Card Total Investido do Bolso */}
          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Total Investido do Bolso
            </span>
            <p className="text-xl sm:text-2xl font-black text-zinc-200">
              {formatCurrency(activeSimulation.totalInvested)}
            </p>
            <span className="text-[11px] text-zinc-500 block pt-1">
              {initialAmount > 0 ? `${formatCurrency(initialAmount)} inicial + ` : ''}
              {simulationPeriodMonths} aportes de {formatCurrency(monthlyContribution)}
            </span>
          </div>

          {/* Card Juros Ganhos (Efeito Bola de Neve) */}
          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Juros Compostos Recebidos
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-400">
              {formatCurrency(activeSimulation.totalInterest)}
            </p>
            <span className="text-[11px] text-zinc-400 block pt-1">
              {activeSimulation.finalTotal > 0
                ? `${((activeSimulation.totalInterest / activeSimulation.finalTotal) * 100).toFixed(0)}% do patrimônio veio de juros!`
                : 'Dinheiro gerando dinheiro'}
            </span>
          </div>

          {/* Card Renda Passiva Futura */}
          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-cyan-500/30 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-cyan-400" />
              Renda Passiva Mensal
            </span>
            <p className="text-xl sm:text-2xl font-black text-cyan-300">
              {formatCurrency(activeSimulation.monthlyPassiveIncomeEstimate)}
              <span className="text-xs text-zinc-400 font-normal">/mês</span>
            </p>
            <span className="text-[11px] text-zinc-400 block pt-1">
              Salário passivo caindo na conta todo mês sem gastar o principal
            </span>
          </div>
        </div>

        {/* Comparativo de Desempenho com a Poupança */}
        <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChartVisualIcon className="w-4 h-4 text-[#00ff7f]" />
                Comparativo: Por que a Poupança faz você perder dinheiro?
              </h4>
              <p className="text-xs text-zinc-400">
                Veja o quanto você acumularia no mesmo período ({simulationPeriodMonths} meses) em cada alternativa:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {comparativeData.items.map((item) => {
              const isSelected = item.key === activeLevel;
              const isPoupanca = item.key === 'poupanca';

              return (
                <div
                  key={item.key}
                  className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                    isPoupanca
                      ? 'bg-zinc-950/90 border-zinc-800/80 text-zinc-400'
                      : isSelected
                      ? 'bg-[#00ff7f]/5 border-[#00ff7f]/40 shadow-md shadow-[#00ff7f]/10'
                      : 'bg-zinc-900/40 border-zinc-800/70 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                      {item.name}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {item.annualRate.toFixed(2)}% a.a.
                    </span>
                  </div>

                  <p className={`text-lg font-black ${
                    isPoupanca ? 'text-zinc-300' : isSelected ? 'text-[#00ff7f]' : 'text-white'
                  }`}>
                    {formatCurrency(item.finalTotal)}
                  </p>

                  <div className="space-y-1 text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                    <div className="flex justify-between">
                      <span>Juros gerados:</span>
                      <span className="font-mono text-zinc-300">{formatCurrency(item.totalInterest)}</span>
                    </div>
                    {!isPoupanca && (
                      <div className="flex justify-between text-[#00ff7f] font-bold">
                        <span>A mais que a Poupança:</span>
                        <span className="font-mono">+{formatCurrency(item.differenceVsPoupanca)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 4: As 5 Melhores Práticas de Mercado Atual */}
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
          <Award className="w-5 h-5 text-[#00ff7f]" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              4. Melhores Práticas do Mercado Financeiro Atual
            </h2>
            <p className="text-xs text-zinc-400">
              Diretrizes indispensáveis para investir com inteligência, proteger seu capital e pagar menos impostos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MARKET_BEST_PRACTICES.map((practice, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#00ff7f]/10 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f] text-xs font-black shrink-0">
                  {idx + 1}
                </span>
                <h4 className="text-sm font-bold text-white leading-tight">
                  {practice.title}
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-[#00ff7f] block">
                {practice.subtitle}
              </span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {practice.description}
              </p>
            </div>
          ))}

          {/* Card Bônus: Tripé dos Investimentos */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-[#00ff7f]/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#00ff7f]/10 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f] text-xs font-black shrink-0">
                ★
              </span>
              <h4 className="text-sm font-bold text-white leading-tight">
                O Tripé dos Investimentos
              </h4>
            </div>
            <span className="text-[11px] font-semibold text-cyan-400 block">
              Rentabilidade x Liquidez x Segurança
            </span>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Nenhum ativo no mundo possui os 3 simultaneamente no nível máximo.
              Por isso a diversificação entre os 3 níveis (Conservador, Moderado e Arrojado) é o único 'almoço grátis' das finanças.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mini visual helper icon
const BarChartVisualIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);
