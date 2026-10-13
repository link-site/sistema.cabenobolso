import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bot,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  CreditCard,
  CalendarCheck2,
  Info,
  Sparkles,
  Copy,
  Check,
  Eye,
  EyeOff,
  Radio,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Transaction, CreditCard as CreditCardType, CardPurchase, TelegramBotConfig, TelegramLogItem } from '../types';
import { formatCurrency, MONTH_NAMES } from '../utils/formatters';
import { processTelegramQuery } from '../utils/telegramBotEngine';

interface TelegramBotViewProps {
  transactions: Transaction[];
  cards: CreditCardType[];
  cardPurchases: CardPurchase[];
  telegramConfig: TelegramBotConfig;
  onUpdateTelegramConfig: (newConfig: Partial<TelegramBotConfig>) => Promise<void>;
  onNavigateToBudget?: (year: number, month: number) => void;
  onNavigateToCards?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

export const TelegramBotView: React.FC<TelegramBotViewProps> = ({
  transactions,
  cards,
  cardPurchases,
  telegramConfig,
  onUpdateTelegramConfig,
  onNavigateToBudget,
  onNavigateToCards,
}) => {
  // Local form state
  const [tokenInput, setTokenInput] = useState(telegramConfig.botToken || '');
  const [chatIdInput, setChatIdInput] = useState(telegramConfig.chatId || '');
  const [isEnabled, setIsEnabled] = useState(telegramConfig.enabled || false);
  const [showToken, setShowToken] = useState(false);

  // Status & feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [tokenTestResult, setTokenTestResult] = useState<{ success: boolean; message: string; botName?: string } | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isDetectingChatId, setIsDetectingChatId] = useState(false);
  const [detectResult, setDetectResult] = useState<{ success: boolean; message: string; name?: string } | null>(null);
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Interactive In-App Simulator
  const [simQuery, setSimQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg-init-1',
        sender: 'bot',
        text:
          '👋 Olá! Sou o assistente do Sistema Cabe no Bolso.\n\n' +
          'Tenho acesso em tempo real ao seu **Menu Orçamento** e **Menu Cartões de Crédito**.\n\n' +
          '💡 Experimente me perguntar: *"Qual valor disponível no mês de novembro?"*',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Server interaction logs
  const [serverLogs, setServerLogs] = useState<TelegramLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Keep inputs synced when prop updates
  useEffect(() => {
    setTokenInput(telegramConfig.botToken || '');
    setChatIdInput(telegramConfig.chatId || '');
    setIsEnabled(telegramConfig.enabled || false);
  }, [telegramConfig]);

  // Scroll simulator chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Carrega logs de atendimento do servidor
  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/telegram/logs');
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setServerLogs(data.logs);
      }
    } catch (err) {
      // ignore
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  // Sincroniza dados com o servidor manualmente
  const handleManualSync = async () => {
    setIsSyncingData(true);
    setSyncFeedback(null);
    try {
      const res = await fetch('/api/telegram/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, cards, cardPurchases }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncFeedback(
          `Sincronizado! O bot possui acesso a ${data.counts.transactions} transações de orçamento, ${data.counts.cards} cartões e ${data.counts.cardPurchases} compras.`
        );
      } else {
        setSyncFeedback('Erro ao sincronizar dados com o bot.');
      }
    } catch (e) {
      setSyncFeedback('Erro de comunicação com o servidor.');
    } finally {
      setIsSyncingData(false);
      setTimeout(() => setSyncFeedback(null), 6000);
    }
  };

  // Testa token com o BotFather via Telegram API
  const handleTestToken = async () => {
    if (!tokenInput.trim()) {
      setTokenTestResult({ success: false, message: 'Digite o token do bot primeiro.' });
      return;
    }
    setIsTestingToken(true);
    setTokenTestResult(null);

    try {
      const res = await fetch('/api/telegram/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: tokenInput.trim() }),
      });
      const data = await res.json();

      if (data.success && data.bot) {
        setTokenTestResult({
          success: true,
          message: `Bot validado com sucesso!`,
          botName: `@${data.bot.username} (${data.bot.firstName})`,
        });
      } else {
        setTokenTestResult({
          success: false,
          message: data.error || 'Token inválido ou rejeitado pelo Telegram.',
        });
      }
    } catch (err: any) {
      setTokenTestResult({ success: false, message: err.message || 'Falha ao conectar com o Telegram.' });
    } finally {
      setIsTestingToken(false);
    }
  };

  // Salva configurações
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onUpdateTelegramConfig({
        botToken: tokenInput.trim(),
        chatId: chatIdInput.trim(),
        enabled: isEnabled,
        autoPolling: true,
      });
      // Sincroniza dados logo após salvar
      await fetch('/api/telegram/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, cards, cardPurchases }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      fetchLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Detecta automaticamente o Chat ID inspecionando getUpdates do bot no Telegram
  const handleDetectChatId = async () => {
    const rawToken = tokenInput.trim();
    if (!rawToken) {
      setDetectResult({
        success: false,
        message: 'Digite ou cole o Token do Bot acima primeiro.',
      });
      return;
    }

    setIsDetectingChatId(true);
    setDetectResult(null);

    try {
      const res = await fetch('/api/telegram/detect-chat-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: rawToken }),
      });
      const data = await res.json();

      if (data.success && data.chatId) {
        setChatIdInput(data.chatId);
        setDetectResult({
          success: true,
          message: `Chat ID detectado: ${data.chatId} (${data.name})! Preenchido no formulário.`,
          name: data.name,
        });
      } else {
        setDetectResult({
          success: false,
          message:
            data.error ||
            'Nenhuma mensagem recebida ainda. Abra o Telegram, pesquise pelo seu bot, clique em "Iniciar" ou envie /start e tente novamente.',
        });
      }
    } catch (err: any) {
      setDetectResult({
        success: false,
        message: err.message || 'Falha ao buscar atualizações no Telegram.',
      });
    } finally {
      setIsDetectingChatId(false);
    }
  };

  // Envia mensagem de teste diretamente para o Telegram
  const handleSendTestMessage = async () => {
    const rawToken = tokenInput.trim();
    const rawChat = chatIdInput.trim().replace(/^@/, '');

    if (!rawToken) {
      setTestSendResult({
        success: false,
        message: 'Preencha o Token do Bot para realizar o teste.',
      });
      return;
    }

    if (!rawChat) {
      setTestSendResult({
        success: false,
        message: 'Preencha o seu Chat ID numérico (ex: 123456789) para receber a mensagem no Telegram.',
      });
      return;
    }

    // Verifica se digitou username com letras em vez de ID numérico
    if (isNaN(Number(rawChat))) {
      setTestSendResult({
        success: false,
        message:
          'O Chat ID deve ser um número (ex: 123456789), não o seu @username. Abra o Telegram, envie /start para o seu bot e clique no botão "Detectar meu Chat ID" abaixo para preencher automaticamente!',
      });
      return;
    }

    setIsSendingTest(true);
    setTestSendResult(null);

    try {
      // Garante que os dados mais recentes estejam sincronizados com o servidor
      await fetch('/api/telegram/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, cards, cardPurchases }),
      });

      const res = await fetch('/api/telegram/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: rawToken,
          chatId: rawChat,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setTestSendResult({
          success: true,
          message: data.message || 'Mensagem enviada com sucesso! Verifique seu aplicativo do Telegram.',
        });
        fetchLogs();
      } else {
        setTestSendResult({
          success: false,
          message: data.error || 'Falha ao enviar mensagem de teste.',
        });
      }
    } catch (err: any) {
      setTestSendResult({
        success: false,
        message: err.message || 'Erro de comunicação ao enviar mensagem.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Executa uma consulta no Simulador Interativo do Navegador
  const handleRunSimulation = async (questionText: string) => {
    const q = questionText.trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setSimQuery('');
    setIsSimulating(true);

    // Processamento da resposta com acesso total ao Orçamento e Cartões
    setTimeout(() => {
      try {
        const result = processTelegramQuery(q, {
          transactions,
          cards,
          cardPurchases,
        });

        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: result.text,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };

        setChatMessages((prev) => [...prev, botMsg]);
      } catch (err) {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: '❌ Ocorreu um erro ao consultar os dados do orçamento.',
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, botMsg]);
      } finally {
        setIsSimulating(false);
      }
    }, 250);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Resumo de dados disponíveis para o Bot
  const NovemberPreview = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const novTxs = transactions.filter((t) => {
      const parts = (t.date || '').split('-');
      return parseInt(parts[0], 10) === currentYear && parseInt(parts[1], 10) === 11;
    });

    const salarios = novTxs.filter((t) => t.type === 'salario').reduce((acc, c) => acc + (c.amount || 0), 0);
    const gastos = novTxs.filter((t) => t.type === 'gasto').reduce((acc, c) => acc + (c.amount || 0), 0);
    const disponivel = Math.max(0, salarios - gastos);
    const ultrapassou = Math.max(0, gastos - salarios);

    return {
      year: currentYear,
      salarios,
      gastos,
      disponivel,
      ultrapassou,
      isOver: gastos > salarios,
      txCount: novTxs.length,
    };
  }, [transactions]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* HEADER SECTION */}
      <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#00ff7f]/10 via-sky-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00ff7f]/20 via-sky-500/20 to-blue-600/20 border border-[#00ff7f]/40 flex items-center justify-center shrink-0 shadow-lg shadow-[#00ff7f]/10">
              <Bot className="w-6 h-6 text-[#00ff7f]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Bot Telegram Inteligente
                </h1>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                    isEnabled && telegramConfig.botToken
                      ? 'bg-emerald-500/10 text-[#00ff7f] border-[#00ff7f]/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isEnabled && telegramConfig.botToken ? 'bg-[#00ff7f] animate-pulse' : 'bg-zinc-500'
                    }`}
                  />
                  {isEnabled && telegramConfig.botToken ? 'Atendimento 24h Ativo' : 'Aguardando Configuração'}
                </span>
                {telegramConfig.botUsername && (
                  <span className="text-xs text-sky-400 font-mono bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/50">
                    @{telegramConfig.botUsername}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                Assistente financeiro com <strong className="text-zinc-200">acesso total e em tempo real</strong> ao
                seu <span className="text-[#00ff7f] font-medium">Menu Orçamento</span> e{' '}
                <span className="text-sky-400 font-medium">Menu Cartões de Crédito</span>. Pergunte qualquer valor pelo
                Telegram e receba respostas instantâneas!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
            <button
              onClick={handleManualSync}
              disabled={isSyncingData}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Garante que as últimas transações e faturas estejam na memória do bot"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#00ff7f] ${isSyncingData ? 'animate-spin' : ''}`} />
              <span>{isSyncingData ? 'Sincronizando...' : 'Sincronizar Dados'}</span>
            </button>
          </div>
        </div>

        {syncFeedback && (
          <div className="mt-4 p-3 rounded-xl bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-xs text-[#00ff7f] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* STATUS CARDS DE ACESSO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-zinc-800/80">
          <div className="p-3 rounded-xl bg-[#070709] border border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CalendarCheck2 className="w-4 h-4 text-[#00ff7f]" />
              <div>
                <p className="text-[11px] text-zinc-400">Acesso ao Orçamento</p>
                <p className="text-xs font-bold text-white">
                  {transactions.length} movimentações sincronizadas
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-[#00ff7f] bg-[#00ff7f]/10 px-2 py-0.5 rounded border border-[#00ff7f]/20">
              Conectado
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#070709] border border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4 h-4 text-sky-400" />
              <div>
                <p className="text-[11px] text-zinc-400">Acesso aos Cartões</p>
                <p className="text-xs font-bold text-white">
                  {cards.length} cartões ({cardPurchases.length} compras)
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              Conectado
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#070709] border border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Radio className={`w-4 h-4 ${isEnabled ? 'text-[#00ff7f]' : 'text-zinc-500'}`} />
              <div>
                <p className="text-[11px] text-zinc-400">Escuta Contínua (Polling)</p>
                <p className="text-xs font-bold text-white">
                  {isEnabled ? 'Serviço Ativo 24/7' : 'Desativado'}
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                isEnabled
                  ? 'text-[#00ff7f] bg-[#00ff7f]/10 border-[#00ff7f]/20'
                  : 'text-zinc-500 bg-zinc-800/40 border-zinc-700/50'
              }`}
            >
              {isEnabled ? 'Online' : 'Pausado'}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SECTION: CONFIGURATION & SIMULATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMN 1: BOT CONFIGURATION (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#00ff7f]" />
                <h2 className="text-base font-bold text-white">Credenciais do Bot</h2>
              </div>
              <span className="text-xs text-zinc-500 font-mono">Telegram API</span>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              {/* BOT TOKEN */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Token do Bot (@BotFather) <span className="text-[#00ff7f]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-[#00ff7f]" />}
                    <span>{showToken ? 'Ocultar' : 'Mostrar'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Ex: 7123456789:AAFlkJg5k..."
                    className="w-full bg-[#070709] border border-zinc-800 focus:border-[#00ff7f] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition-colors font-mono"
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-zinc-500">
                    Criado no Telegram pelo <span className="text-zinc-400 font-mono">@BotFather</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleTestToken}
                    disabled={isTestingToken || !tokenInput.trim()}
                    className="text-[11px] font-semibold text-[#00ff7f] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTestingToken ? 'animate-spin' : ''}`} />
                    <span>{isTestingToken ? 'Validando...' : 'Verificar Token'}</span>
                  </button>
                </div>

                {tokenTestResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      tokenTestResult.success
                        ? 'bg-emerald-950/40 border border-[#00ff7f]/40 text-[#00ff7f]'
                        : 'bg-rose-950/40 border border-rose-800/40 text-rose-300'
                    }`}
                  >
                    {tokenTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold">{tokenTestResult.message}</p>
                      {tokenTestResult.botName && (
                        <p className="text-[11px] opacity-90">{tokenTestResult.botName}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CHAT ID */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="text-xs font-semibold text-zinc-300">
                    Seu Chat ID do Telegram <span className="text-[#00ff7f]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectChatId}
                    disabled={isDetectingChatId || !tokenInput.trim()}
                    className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title="Detecta seu Chat ID lendo as mensagens recebidas pelo seu bot"
                  >
                    <RefreshCw className={`w-3 h-3 ${isDetectingChatId ? 'animate-spin' : ''}`} />
                    <span>{isDetectingChatId ? 'Detectando ID...' : 'Detectar meu Chat ID'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="Ex: 123456789"
                  className="w-full bg-[#070709] border border-zinc-800 focus:border-[#00ff7f] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition-colors font-mono"
                />

                <div className="mt-1.5 space-y-1">
                  <p className="text-[11px] text-zinc-400">
                    💡 O Telegram exige o <strong className="text-zinc-200">ID numérico</strong> para bots enviarem mensagens.
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Para preencher sozinho: abra o seu bot no Telegram, clique em <strong className="text-[#00ff7f]">Iniciar</strong> (ou envie <span className="text-zinc-300 font-mono">/start</span>) e clique no botão acima <span className="text-sky-400">"Detectar meu Chat ID"</span>.
                  </p>
                </div>

                {detectResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                      detectResult.success
                        ? 'bg-emerald-950/40 border border-[#00ff7f]/40 text-[#00ff7f]'
                        : 'bg-amber-950/40 border border-amber-800/40 text-amber-300'
                    }`}
                  >
                    {detectResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{detectResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* TOGGLE ATENDIMENTO */}
              <div className="p-3.5 rounded-xl bg-[#070709] border border-zinc-800/70 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Ativar Atendimento do Bot</p>
                  <p className="text-[11px] text-zinc-400">
                    Responde perguntas e comandos diretamente no Telegram
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEnabled(!isEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEnabled ? 'bg-[#00ff7f]' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* BOTÕES DE SALVAR E TESTAR */}
              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00ff7f] to-emerald-400 hover:from-[#00ff7f]/90 hover:to-emerald-300 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00ff7f]/20 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Configuração Salva com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Salvar Configuração do Bot</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSendTestMessage}
                  disabled={isSendingTest || !tokenInput.trim() || !chatIdInput.trim()}
                  className="w-full py-2 rounded-xl bg-sky-950/40 hover:bg-sky-900/40 border border-sky-800/60 text-sky-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-spin' : ''}`} />
                  <span>{isSendingTest ? 'Enviando...' : 'Enviar Mensagem de Teste no Telegram'}</span>
                </button>

                {testSendResult && (
                  <div
                    className={`p-3 rounded-xl text-xs space-y-2 ${
                      testSendResult.success
                        ? 'bg-emerald-950/50 border border-[#00ff7f]/50 text-[#00ff7f]'
                        : 'bg-rose-950/50 border border-rose-800/50 text-rose-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {testSendResult.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#00ff7f]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold leading-relaxed">{testSendResult.message}</p>
                      </div>
                    </div>
                    {!testSendResult.success && testSendResult.message.includes('/start') && (
                      <div className="pt-2 border-t border-rose-800/40 text-[11px] text-zinc-300 space-y-1">
                        <p className="font-bold text-white">Como resolver agora:</p>
                        <p>1. Abra o aplicativo do Telegram e busque pelo seu bot.</p>
                        <p>2. Clique em <strong className="text-[#00ff7f]">Iniciar</strong> ou envie <code className="bg-black/60 px-1 py-0.5 rounded text-white font-mono">/start</code>.</p>
                        <p>3. Clique no botão <button type="button" onClick={handleDetectChatId} className="text-sky-300 underline font-semibold">Detectar meu Chat ID</button> ou clique em enviar o teste novamente.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* GUIA PASSO A PASSO */}
          <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5 shadow-lg">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#00ff7f]" />
              Como Criar seu Bot no Telegram (1 minuto)
            </h3>
            <ol className="space-y-2.5 text-xs text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-800 text-[#00ff7f] font-bold flex items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <span>
                  Abra o Telegram e busque por{' '}
                  <strong className="text-white font-mono">@BotFather</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-800 text-[#00ff7f] font-bold flex items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <span>
                  Envie o comando <strong className="text-[#00ff7f] font-mono">/newbot</strong> e escolha um nome e um
                  username (deve terminar com <em>bot</em>).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-800 text-[#00ff7f] font-bold flex items-center justify-center shrink-0 text-[10px]">
                  3
                </span>
                <span>
                  Copie o <strong>HTTP API Token</strong> gerado e cole no campo "Token do Bot" acima.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-800 text-[#00ff7f] font-bold flex items-center justify-center shrink-0 text-[10px]">
                  4
                </span>
                <span>
                  Abra a conversa com o seu novo bot no Telegram e envie{' '}
                  <strong className="text-[#00ff7f] font-mono">/start</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-800 text-[#00ff7f] font-bold flex items-center justify-center shrink-0 text-[10px]">
                  5
                </span>
                <span>
                  Clique em <strong>Salvar</strong>! Agora você pode perguntar qualquer coisa do orçamento pelo celular!
                </span>
              </li>
            </ol>
          </div>
        </div>

        {/* COLUMN 2: INTERACTIVE SIMULATOR & REAL DATA PREVIEW (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* SIMULADOR INTERATIVO DO BOT */}
          <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[580px]">
            {/* SIMULATOR HEADER */}
            <div className="p-4 bg-[#0a0a0d] border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#00ff7f] to-sky-400 flex items-center justify-center text-black font-bold text-sm shadow">
                    🤖
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00ff7f] ring-2 ring-black" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Simulador do Bot Telegram</h3>
                    <span className="text-[10px] text-[#00ff7f] font-mono bg-[#00ff7f]/10 px-1.5 py-0.5 rounded">
                      Ao Vivo
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Testa as perguntas diretamente contra os dados reais do seu Orçamento
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setChatMessages([
                    {
                      id: `rst-${Date.now()}`,
                      sender: 'bot',
                      text: 'Histórico reiniciado. Faça uma pergunta sobre seu orçamento ou cartões!',
                      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    },
                  ]);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                title="Limpar histórico do simulador"
              >
                Limpar Chat
              </button>
            </div>

            {/* CHAT MESSAGES BODY */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#070709]/80 font-sans">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line shadow-md ${
                      msg.sender === 'user'
                        ? 'bg-[#00ff7f] text-black font-medium rounded-br-none'
                        : 'bg-zinc-900/90 text-zinc-200 border border-zinc-800/80 rounded-bl-none'
                    }`}
                  >
                    <div className="break-words">{msg.text}</div>
                    <div
                      className={`text-[9px] mt-1.5 text-right ${
                        msg.sender === 'user' ? 'text-black/60 font-mono' : 'text-zinc-500 font-mono'
                      }`}
                    >
                      {msg.time}
                    </div>
                  </div>
                </div>
              ))}
              {isSimulating && (
                <div className="flex justify-start">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 rounded-bl-none text-xs text-zinc-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff7f] animate-ping" />
                    <span>Calculando orçamento no banco de dados...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* QUICK SUGGESTIONS PILLS */}
            <div className="p-2.5 bg-[#0a0a0d] border-t border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
              <span className="text-[10px] uppercase font-bold text-zinc-500 px-1 shrink-0">
                Sugestões:
              </span>
              <button
                type="button"
                onClick={() => handleRunSimulation('qual valor disponivel no mês de novembro?')}
                className="px-2.5 py-1 rounded-full bg-[#00ff7f]/10 hover:bg-[#00ff7f]/20 border border-[#00ff7f]/30 text-[#00ff7f] text-[11px] font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>⭐ Disponível em Novembro?</span>
              </button>
              <button
                type="button"
                onClick={() => handleRunSimulation('quanto sobrou neste mês?')}
                className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] shrink-0 transition-colors cursor-pointer"
              >
                Sobrou neste mês?
              </button>
              <button
                type="button"
                onClick={() => handleRunSimulation('qual o valor da fatura dos cartões?')}
                className="px-2.5 py-1 rounded-full bg-sky-950/40 hover:bg-sky-900/40 border border-sky-800/40 text-sky-300 text-[11px] shrink-0 transition-colors cursor-pointer"
              >
                Faturas dos Cartões
              </button>
              <button
                type="button"
                onClick={() => handleRunSimulation('quais os gastos e despesas de novembro?')}
                className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] shrink-0 transition-colors cursor-pointer"
              >
                Gastos de Novembro
              </button>
              <button
                type="button"
                onClick={() => handleRunSimulation('/ajuda')}
                className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] shrink-0 transition-colors cursor-pointer"
              >
                /ajuda
              </button>
            </div>

            {/* INPUT CHAT FORM */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRunSimulation(simQuery);
              }}
              className="p-3 bg-[#0e0e12] border-t border-zinc-800/80 flex items-center gap-2"
            >
              <input
                type="text"
                value={simQuery}
                onChange={(e) => setSimQuery(e.target.value)}
                placeholder="Pergunte ex: Qual valor disponível no mês de novembro?"
                className="flex-1 bg-[#070709] border border-zinc-800 focus:border-[#00ff7f] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!simQuery.trim() || isSimulating}
                className="px-4 py-2.5 rounded-xl bg-[#00ff7f] hover:bg-[#00ff7f]/90 text-black font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Perguntar</span>
              </button>
            </form>
          </div>

          {/* CARD PREVIEW: DADOS DE NOVEMBRO (EXEMPLO ESPECIFICADO PELO USUÁRIO) */}
          <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4 text-[#00ff7f]" />
                <h3 className="text-sm font-bold text-white">
                  Dados Reais do Menu Orçamento — Novembro/{NovemberPreview.year}
                </h3>
              </div>
              {onNavigateToBudget && (
                <button
                  onClick={() => onNavigateToBudget(NovemberPreview.year, 10)}
                  className="text-xs text-[#00ff7f] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <span>Abrir no Orçamento</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <p className="text-xs text-zinc-400 mb-4">
              Estes são os valores calculados que o bot do Telegram acessa quando o usuário pergunta sobre o mês de{' '}
              <strong className="text-zinc-200">Novembro</strong>:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#070709] border border-zinc-800/70">
                <span className="text-[10px] text-zinc-500 uppercase font-semibold">Salários</span>
                <p className="text-sm font-bold text-white mt-0.5">
                  {formatCurrency(NovemberPreview.salarios)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#070709] border border-zinc-800/70">
                <span className="text-[10px] text-zinc-500 uppercase font-semibold">Gastos Totais</span>
                <p className="text-sm font-bold text-rose-400 mt-0.5">
                  {formatCurrency(NovemberPreview.gastos)}
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border col-span-2 sm:col-span-2 ${
                  NovemberPreview.isOver
                    ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                    : 'bg-[#00ff7f]/10 border-[#00ff7f]/30 text-[#00ff7f]'
                }`}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider">
                  {NovemberPreview.isOver ? '⚠️ Campo Ultrapassou' : '✅ Campo Disponível'}
                </span>
                <p className="text-base font-black mt-0.5">
                  {NovemberPreview.isOver
                    ? formatCurrency(NovemberPreview.ultrapassou)
                    : formatCurrency(NovemberPreview.disponivel)}
                </p>
                <p className="text-[10px] opacity-80 mt-0.5">
                  {NovemberPreview.isOver
                    ? 'Gastos superaram salários em Novembro'
                    : 'Saldo positivo livre para investimentos ou poupança'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HISTÓRICO DE INTERAÇÕES E LOGS DO SERVIDOR */}
      <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#00ff7f]" />
            <h3 className="text-sm font-bold text-white">Histórico de Atendimento e Mensagens Recentes</h3>
          </div>
          <button
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>Atualizar Logs</span>
          </button>
        </div>

        {serverLogs.length === 0 ? (
          <div className="p-8 text-center bg-[#070709] rounded-xl border border-zinc-800/60">
            <Bot className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-400">Nenhuma interação registrada ainda.</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Assim que você enviar uma mensagem no Telegram ou testar no simulador, ela aparecerá aqui em tempo real.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto font-mono text-xs pr-1">
            {serverLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg bg-[#070709] border border-zinc-800/70 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 ${
                      log.type === 'in'
                        ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                        : log.type === 'out'
                        ? 'bg-emerald-950/60 text-[#00ff7f] border border-[#00ff7f]/40'
                        : log.type === 'error'
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {log.type === 'in' ? 'RECEBIDA' : log.type === 'out' ? 'RESPOSTA' : log.type}
                  </span>
                  <div>
                    <p className="text-zinc-200 line-clamp-2">{log.message}</p>
                    {log.from && <p className="text-[10px] text-zinc-500 mt-0.5">Origem: {log.from}</p>}
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
