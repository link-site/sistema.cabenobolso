import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Send,
  Bot,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Bell,
  Sparkles,
  DollarSign,
  Calendar,
  Eye,
  EyeOff,
  Power,
  Info,
  Smartphone,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  CalendarCheck2,
  Zap,
  Activity,
  ShieldCheck,
  CheckCheck,
} from 'lucide-react';
import { Transaction, CreditCard, CardPurchase, TelegramBotConfig } from '../types';
import {
  calculateTelegramBudgetSummary,
  buildTelegramMessage,
} from '../utils/telegramFinance';
import {
  detectTelegramChatId,
  sendTelegramMessage,
  cleanTelegramToken,
  cleanTelegramChatId,
  getTelegramScheduleStatus,
  triggerDailyTelegramNow,
  registerTelegramScheduleOnServer,
  ScheduleStatusResult,
} from '../utils/telegramApi';
import { formatCurrency } from '../utils/formatters';

interface TelegramBotViewProps {
  transactions: Transaction[];
  cards: CreditCard[];
  cardPurchases: CardPurchase[];
  config: TelegramBotConfig;
  onSaveConfig: (updated: Partial<TelegramBotConfig>) => Promise<void>;
  onNavigateToBudget?: () => void;
  onNavigateToCards?: () => void;
}

export const TelegramBotView: React.FC<TelegramBotViewProps> = ({
  transactions,
  cards,
  cardPurchases,
  config,
  onSaveConfig,
  onNavigateToBudget,
  onNavigateToCards,
}) => {
  // Local form state
  const [botToken, setBotToken] = useState(config.botToken || '');
  const [chatId, setChatId] = useState(config.chatId || '');
  const [chatName, setChatName] = useState(config.chatName || '');
  const [enabled, setEnabled] = useState(config.enabled ?? false);
  const [scheduledTime, setScheduledTime] = useState(config.scheduledTime || '09:00');
  const [messageTemplate, setMessageTemplate] = useState(config.messageTemplate || '');
  const [showToken, setShowToken] = useState(false);

  // Server Scheduler Status State
  const [serverStatus, setServerStatus] = useState<ScheduleStatusResult | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isTriggeringDaily, setIsTriggeringDaily] = useState(false);
  const [dailyTriggerFeedback, setDailyTriggerFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Action status states
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [detectSuccess, setDetectSuccess] = useState<string | null>(null);
  const [detectedBotUsername, setDetectedBotUsername] = useState<string | null>(null);
  const [needInteraction, setNeedInteraction] = useState(false);

  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synchronize when prop changes
  useEffect(() => {
    setBotToken(config.botToken || '');
    setChatId(config.chatId || '');
    setChatName(config.chatName || '');
    setEnabled(config.enabled ?? false);
    setScheduledTime(config.scheduledTime || '09:00');
    setMessageTemplate(config.messageTemplate || '');
  }, [config]);

  // Budget summary calculation: Regra: se estamos em Outubro, o valor disponível é do mês de Novembro!
  const summary = useMemo(() => {
    return calculateTelegramBudgetSummary(transactions, cards, cardPurchases);
  }, [transactions, cards, cardPurchases]);

  // Message preview text
  const previewMessage = useMemo(() => {
    return buildTelegramMessage(summary, messageTemplate);
  }, [summary, messageTemplate]);

  // Fetch Server Scheduler Status
  const fetchScheduleStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const data = await getTelegramScheduleStatus('default_user');
      setServerStatus(data);
    } catch {
      // silencioso
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchScheduleStatus();
    const timer = setInterval(fetchScheduleStatus, 10000);
    return () => clearInterval(timer);
  }, [fetchScheduleStatus]);

  // Handle Detect Chat ID
  const handleDetectChatId = async () => {
    const cleanToken = cleanTelegramToken(botToken);
    if (!cleanToken) {
      setDetectError('Por favor, informe o Token do Bot gerado pelo @BotFather antes de detectar o Chat ID.');
      return;
    }
    setBotToken(cleanToken);

    setIsDetecting(true);
    setDetectError(null);
    setDetectSuccess(null);
    setNeedInteraction(false);

    try {
      const data = await detectTelegramChatId(cleanToken);

      if (data.botUsername) {
        setDetectedBotUsername(data.botUsername);
      }

      if (data.success && data.chatId) {
        setChatId(String(data.chatId));
        const detectedName = data.chatName || data.chatUsername || 'Telegram';
        setChatName(detectedName);
        setDetectSuccess(`Chat ID detectado com sucesso: ${data.chatId} (${detectedName})`);
        setNeedInteraction(false);

        // Auto-save the detected chatId
        await onSaveConfig({
          botToken: cleanToken,
          chatId: String(data.chatId),
          chatName: detectedName,
        });

        // Registra no servidor
        await registerTelegramScheduleOnServer({
          botToken: cleanToken,
          chatId: String(data.chatId),
          scheduledTime,
          enabled,
          messageText: previewMessage,
        });
        fetchScheduleStatus();
      } else {
        setDetectError(data.error || 'Não foi possível encontrar mensagens recentes.');
        if (data.needInteraction) {
          setNeedInteraction(true);
        }
      }
    } catch (err: any) {
      setDetectError(`Erro na requisição: ${err.message || 'Verifique sua conexão'}`);
    } finally {
      setIsDetecting(false);
    }
  };

  // Handle Send Test Message
  const handleSendTestMessage = async () => {
    const cleanToken = cleanTelegramToken(botToken);
    const cleanId = cleanTelegramChatId(chatId);

    if (!cleanToken || !cleanId) {
      setTestResult({
        success: false,
        message: 'Preencha o Token do Bot e o Chat ID para poder testar o envio.',
      });
      return;
    }

    setBotToken(cleanToken);
    setChatId(cleanId);

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const data = await sendTelegramMessage(cleanToken, cleanId, previewMessage);

      if (data.success) {
        setTestResult({
          success: true,
          message: '🎉 Mensagem de teste enviada com sucesso no seu Telegram! Verifique seu aplicativo.',
        });
        await onSaveConfig({
          lastSentDate: new Date().toISOString().split('T')[0],
          lastSentTimestamp: new Date().toISOString(),
          lastSentStatus: 'success',
          lastSentError: undefined,
        });
        fetchScheduleStatus();
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Falha ao enviar mensagem de teste.',
        });
        await onSaveConfig({
          lastSentStatus: 'error',
          lastSentError: data.error,
        });
        fetchScheduleStatus();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Erro na comunicação: ${err.message || 'Verifique sua conexão'}`,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Handle Trigger Daily Report Immediately
  const handleTriggerDailyNow = async () => {
    const cleanToken = cleanTelegramToken(botToken);
    const cleanId = cleanTelegramChatId(chatId);

    if (!cleanToken || !cleanId) {
      setDailyTriggerFeedback({
        success: false,
        message: 'Configure e salve o Token e o Chat ID antes de disparar o relatório.',
      });
      return;
    }

    setIsTriggeringDaily(true);
    setDailyTriggerFeedback(null);

    try {
      const res = await triggerDailyTelegramNow({
        userId: 'default_user',
        botToken: cleanToken,
        chatId: cleanId,
        messageText: previewMessage,
      });

      if (res.success) {
        const todayStr = res.sentDate || new Date().toISOString().split('T')[0];
        setDailyTriggerFeedback({
          success: true,
          message: `✅ Relatório diário de ${summary.monthName} entregue no seu Telegram às ${res.sentTime || 'agora'}!`,
        });
        await onSaveConfig({
          lastSentDate: todayStr,
          lastSentTimestamp: new Date().toISOString(),
          lastSentStatus: 'success',
          lastSentError: undefined,
        });
        fetchScheduleStatus();
      } else {
        setDailyTriggerFeedback({
          success: false,
          message: res.error || 'Falha ao entregar relatório diário no Telegram.',
        });
        await onSaveConfig({
          lastSentStatus: 'error',
          lastSentError: res.error,
        });
        fetchScheduleStatus();
      }
    } catch (err: any) {
      setDailyTriggerFeedback({
        success: false,
        message: `Erro ao disparar: ${err.message || 'Verifique sua conexão'}`,
      });
    } finally {
      setIsTriggeringDaily(false);
    }
  };

  // Handle Save Settings
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const cleanToken = botToken.trim();
      const cleanId = chatId.trim();

      await onSaveConfig({
        botToken: cleanToken,
        chatId: cleanId,
        chatName: chatName.trim(),
        enabled,
        scheduledTime,
        messageTemplate: messageTemplate.trim(),
      });

      // Registra imediatamente no backend
      if (cleanToken && cleanId) {
        await registerTelegramScheduleOnServer({
          botToken: cleanToken,
          chatId: cleanId,
          scheduledTime,
          enabled,
          messageText: previewMessage,
        });
        fetchScheduleStatus();
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigured = Boolean(botToken.trim() && chatId.trim());
  const serverTime = serverStatus?.serverTime || '--:--';
  const serverDate = serverStatus?.serverDate || '';
  const isSentToday = serverStatus?.isSentToday || config.lastSentDate === serverDate && config.lastSentStatus === 'success';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00ff7f]/10 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f] shadow-md shadow-[#00ff7f]/10">
              <Bot className="w-5 h-5 text-[#00ff7f]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Bot de Notificações Telegram
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00ff7f]/15 text-[#00ff7f] border border-[#00ff7f]/30">
                  DISPONÍVEL DO ORÇAMENTO
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                O robô envia todo dia no horário agendado o valor disponível do Menu Orçamento Mensal para o mês seguinte
              </p>
            </div>
          </div>
        </div>

        {/* Global Bot Status Badge */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              enabled && isConfigured
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                : !isConfigured
                ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                : 'bg-amber-950/40 border-amber-500/30 text-amber-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                enabled && isConfigured
                  ? 'bg-emerald-400 animate-pulse'
                  : !isConfigured
                  ? 'bg-zinc-600'
                  : 'bg-amber-400'
              }`}
            />
            <span>
              {enabled && isConfigured
                ? `Ativo • Disparo diário às ${scheduledTime}`
                : !isConfigured
                ? 'Não Configurado'
                : 'Configurado (Envio Pausado)'}
            </span>
          </div>

          <button
            onClick={() => {
              const newStatus = !enabled;
              setEnabled(newStatus);
              onSaveConfig({ enabled: newStatus });
            }}
            disabled={!isConfigured}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !isConfigured
                ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                : enabled
                ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                : 'bg-[#00ff7f] text-black hover:bg-[#00ff7f]/90 font-black shadow-md shadow-[#00ff7f]/20'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{enabled ? 'Pausar Bot' : 'Ativar Bot'}</span>
          </button>
        </div>
      </div>

      {/* Real-time Calculation Highlight Card: Menu Orçamento Mensal */}
      <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00ff7f]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#00ff7f] uppercase tracking-wider mb-1">
              <CalendarCheck2 className="w-3.5 h-3.5" />
              <span>Regra de Negócio: Menu Orçamento Mensal (Mês Seguinte)</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Valor Disponível de {summary.monthName} / {summary.year}
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Calculado exatamente como no <b>Menu Orçamento Mensal</b>: soma dos salários e receitas previstos para {summary.monthName} menos o total de gastos e faturas de cartão.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-black/40 border border-zinc-800/80 p-4 rounded-xl">
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 block">
                {summary.isOverBudget ? 'Orçamento Ultrapassou' : 'Disponível no Orçamento'}
              </span>
              <span
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  summary.isOverBudget ? 'text-rose-400' : 'text-[#00ff7f]'
                }`}
              >
                {summary.isOverBudget
                  ? formatCurrency(summary.totalGastos - summary.totalSalario)
                  : formatCurrency(summary.availableAmount)}
              </span>
            </div>

            <div className="h-10 w-[1px] bg-zinc-800 hidden sm:block" />

            <div>
              <span className="text-[11px] font-semibold text-zinc-400 block flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-[#00ff7f]" />
                Salários ({summary.monthName})
              </span>
              <span className="text-sm sm:text-base font-bold text-emerald-400">
                {formatCurrency(summary.totalSalario)}
              </span>
            </div>

            <div className="h-10 w-[1px] bg-zinc-800 hidden sm:block" />

            <div>
              <span className="text-[11px] font-semibold text-zinc-400 block flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 text-rose-400" />
                Gastos ({summary.monthName})
              </span>
              <span className="text-sm sm:text-base font-bold text-rose-400">
                {formatCurrency(summary.totalGastos)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PAINEL DE DIAGNÓSTICO & STATUS DO DISPARO DIÁRIO */}
      <div className="bg-[#0b0f0d] border border-zinc-800 hover:border-[#00ff7f]/40 transition-all rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-900 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00ff7f]/10 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Diagnóstico do Sistema de Envio Automático</span>
                {isLoadingStatus && <RefreshCw className="w-3 h-3 animate-spin text-zinc-500" />}
              </h3>
              <p className="text-[11px] text-zinc-400">
                Monitoramento em tempo real do agendador diário às <b>{scheduledTime}</b> (Fuso de Brasília/Fortaleza)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchScheduleStatus}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-semibold cursor-pointer transition-all"
              title="Atualizar status do servidor"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin text-[#00ff7f]' : ''}`} />
              <span>Verificar Servidor</span>
            </button>

            <button
              onClick={handleTriggerDailyNow}
              disabled={isTriggeringDaily || !isConfigured}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md ${
                !isConfigured
                  ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                  : 'bg-[#00ff7f] hover:bg-[#00ff7f]/90 text-black shadow-[#00ff7f]/20 active:scale-95'
              }`}
              title="Dispara a mensagem diária com os valores de hoje imediatamente para o seu Telegram"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              <span>{isTriggeringDaily ? 'Enviando...' : '⚡ Disparar Relatório de Hoje Agora'}</span>
            </button>
          </div>
        </div>

        {dailyTriggerFeedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 leading-relaxed ${
              dailyTriggerFeedback.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {dailyTriggerFeedback.success ? (
              <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>{dailyTriggerFeedback.message}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Horário Atual no Servidor */}
          <div className="p-3.5 rounded-xl bg-black/60 border border-zinc-850 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#00ff7f]" />
              Hora de Brasília / Fortaleza
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-white">
                {serverTime}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {serverDate || new Date().toISOString().split('T')[0]}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 block">
              Horário configurado: <b>{scheduledTime}</b>
            </span>
          </div>

          {/* Card 2: Status do Envio de Hoje */}
          <div
            className={`p-3.5 rounded-xl border space-y-1 ${
              isSentToday
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : enabled
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                : 'bg-zinc-950 border-zinc-850 text-zinc-400'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#00ff7f]" />
              Status de Envio (Hoje)
            </span>
            <div className="text-sm font-bold truncate">
              {isSentToday
                ? '✅ Enviado com Sucesso Hoje'
                : enabled
                ? '⏳ Pendente / Aguardando'
                : 'Bot Desativado'}
            </div>
            <span className="text-[10px] text-zinc-400 block truncate">
              {isSentToday
                ? `Disparado em ${config.lastSentDate}`
                : enabled
                ? `Programado para ${scheduledTime}`
                : 'Ative o bot para receber'}
            </span>
          </div>

          {/* Card 3: Próxima Execução */}
          <div className="p-3.5 rounded-xl bg-black/60 border border-zinc-850 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-sky-400" />
              Próximo Disparo
            </span>
            <div className="text-sm font-bold text-white truncate">
              {serverStatus?.nextRun || (enabled ? `Hoje às ${scheduledTime}` : 'Desativado')}
            </div>
            <span className="text-[10px] text-zinc-500 block">
              1 disparo diário por usuário
            </span>
          </div>

          {/* Card 4: Conexão com Telegram */}
          <div className="p-3.5 rounded-xl bg-black/60 border border-zinc-850 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block flex items-center gap-1.5">
              <Bot className="w-3 h-3 text-[#00ff7f]" />
              Conexão com Robô
            </span>
            <div className="text-sm font-bold text-white truncate">
              {isConfigured ? (chatName || `Chat ${chatId}`) : 'Não Configurado'}
            </div>
            <span className="text-[10px] text-zinc-500 block truncate">
              {botToken ? 'Token salvo no banco' : 'Cole o Token do Bot'}
            </span>
          </div>
        </div>

        {/* Explicação e Dica de Solução */}
        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-850 flex items-start gap-2.5 text-xs text-zinc-400">
          <Info className="w-4 h-4 text-[#00ff7f] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <b className="text-zinc-200">Como funciona o envio diário:</b> O servidor do sistema mantém uma rotina que verifica o relógio do Brasil. Todos os dias às <b>{scheduledTime}</b> ele monta automaticamente o resumo financeiro de <b>{summary.monthName}</b> ({formatCurrency(summary.availableAmount)} disponível) e entrega diretamente na sua conversa do Telegram. Se o horário da manhã foi perdido por instabilidade ou reinício, basta clicar no botão <b>⚡ Disparar Relatório de Hoje Agora</b> acima para receber na hora.
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns (Configuration + Preview/Test) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Telegram Setup & Step-by-Step (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Guide Card */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#00ff7f]" />
              <span>Como conectar seu Telegram em 3 passos simples</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-zinc-950/60 border border-zinc-800/60 p-3 rounded-xl space-y-1">
                <span className="w-5 h-5 rounded-full bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30 flex items-center justify-center text-xs font-black">
                  1
                </span>
                <p className="text-xs font-semibold text-zinc-200">Abra o @BotFather</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  No Telegram, pesquise por{' '}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#00ff7f] underline hover:text-[#00ff7f]/80"
                  >
                    @BotFather
                  </a>{' '}
                  e clique em Começar.
                </p>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800/60 p-3 rounded-xl space-y-1">
                <span className="w-5 h-5 rounded-full bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30 flex items-center justify-center text-xs font-black">
                  2
                </span>
                <p className="text-xs font-semibold text-zinc-200">Crie o Bot</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Envie <code className="text-[#00ff7f] bg-black/40 px-1 rounded">/newbot</code>,
                  escolha um nome e copie o <b>Token HTTP</b> que ele gerar.
                </p>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800/60 p-3 rounded-xl space-y-1">
                <span className="w-5 h-5 rounded-full bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30 flex items-center justify-center text-xs font-black">
                  3
                </span>
                <p className="text-xs font-semibold text-zinc-200">Inicie & Detecte</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Cole o Token abaixo, envie <i>"Oi"</i> para o seu bot e clique em <b>Detectar Chat ID</b>!
                </p>
              </div>
            </div>
          </div>

          {/* Form Settings */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#00ff7f]" />
              <span>Credenciais da API do Telegram</span>
            </h3>

            {/* Bot Token Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">
                  Token do Bot (API Token do @BotFather)
                </label>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showToken ? 'Ocultar' : 'Mostrar'}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Ex: 7123456789:AAHeR... (fornecido pelo BotFather)"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full bg-black/60 border border-zinc-800 focus:border-[#00ff7f] rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-colors font-mono"
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                Seu token é salvo de forma segura na sua conta privada do Firestore.
              </p>
            </div>

            {/* Chat ID Input & Automatic Detection Button */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Seu Chat ID no Telegram
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Ex: 123456789 (seu ID pessoal)"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="flex-1 bg-black/60 border border-zinc-800 focus:border-[#00ff7f] rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={handleDetectChatId}
                  disabled={isDetecting || !botToken.trim()}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    isDetecting || !botToken.trim()
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 hover:border-[#00ff7f]/40 active:scale-95'
                  }`}
                  title="Consulta o Telegram e preenche seu Chat ID automaticamente"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin text-[#00ff7f]' : ''}`} />
                  <span>{isDetecting ? 'Detectando...' : 'Detectar Chat ID'}</span>
                </button>
              </div>

              {/* Chat Detection Feedback */}
              {detectError && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2 whitespace-pre-line leading-relaxed">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>{detectError}</div>
                  </div>

                  {detectedBotUsername && needInteraction && (
                    <div className="pt-1">
                      <a
                        href={`https://t.me/${detectedBotUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff7f] hover:bg-[#00ff7f]/90 text-black font-black rounded-lg text-xs transition-transform active:scale-95 shadow-md shadow-[#00ff7f]/20"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>1º Clique aqui: Iniciar @{detectedBotUsername} no Telegram</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {detectSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <div>{detectSuccess}</div>
                </div>
              )}

              {chatName && (
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="text-zinc-500">Destinatário identificado:</span>
                  <span className="text-white font-semibold">{chatName}</span>
                </div>
              )}

              {/* Dica do @userinfobot */}
              <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-zinc-300 font-semibold text-[11px]">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Sparkles className="w-3.5 h-3.5 text-[#00ff7f]" />
                    <span>Dica: Obtenha seu Chat ID em 3 segundos</span>
                  </span>
                  <a
                    href="https://t.me/userinfobot"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#00ff7f] hover:underline flex items-center gap-1 text-[11px] font-bold"
                  >
                    <span>@userinfobot</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Se preferir, abra o robô oficial <b>@userinfobot</b> no Telegram e envie qualquer mensagem. Ele responderá na hora com o seu número de <b>Id</b> (ex: <code className="text-[#00ff7f] bg-black/40 px-1 py-0.5 rounded">615009994</code>). Basta colar esse número no campo <b>Chat ID</b> acima!
                </p>
              </div>
            </div>

            <div className="h-[1px] bg-zinc-800/80 my-2" />

            {/* Schedule Section */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#00ff7f]" />
                <span>Horário do Envio Diário</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Horário de Disparo (24h)
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-black/60 border border-zinc-800 focus:border-[#00ff7f] rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none transition-colors font-mono cursor-pointer"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Fuso horário: Horário de Brasília / Fortaleza (UTC-3).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Envio Diário Automático
                  </label>
                  <div
                    onClick={() => setEnabled(!enabled)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                      enabled
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-black/40 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <Bell className={`w-4 h-4 ${enabled ? 'text-emerald-400' : 'text-zinc-500'}`} />
                      <span>{enabled ? 'Habilitado (1x ao dia)' : 'Desabilitado'}</span>
                    </div>
                    <div
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                        enabled ? 'bg-[#00ff7f]' : 'bg-zinc-800'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-black transition-transform ${
                          enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    O servidor dispara automaticamente todo dia às {scheduledTime}.
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Template Accordion / Textarea */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <span>Mensagem Personalizada (Opcional)</span>
                </label>
                {messageTemplate && (
                  <button
                    type="button"
                    onClick={() => setMessageTemplate('')}
                    className="text-[11px] text-zinc-400 hover:text-red-400 cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                placeholder="Deixe em branco para usar o padrão: 'Você tem esse valor disponivel para gastar...'"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="w-full bg-black/60 border border-zinc-800 focus:border-[#00ff7f] rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-colors resize-none leading-relaxed font-sans"
              />
              <p className="text-[11px] text-zinc-500">
                Variáveis disponíveis: <code className="text-[#00ff7f]">{'{valor}'}</code>,{' '}
                <code className="text-[#00ff7f]">{'{mes}'}</code>,{' '}
                <code className="text-[#00ff7f]">{'{ano}'}</code>,{' '}
                <code className="text-[#00ff7f]">{'{salario}'}</code>,{' '}
                <code className="text-[#00ff7f]">{'{gastos}'}</code>,{' '}
                <code className="text-[#00ff7f]">{'{status}'}</code>.
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#00ff7f] hover:bg-[#00ff7f]/90 text-black px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-[#00ff7f]/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{isSaving ? 'Salvando...' : 'Salvar Configurações'}</span>
              </button>

              {saveSuccess && (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Configurações salvas e agendadas com sucesso!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Message Preview & Instant Test (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Telegram Visual Message Preview */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-[#00ff7f]" />
                <span>Prévia do Aviso no Telegram</span>
              </h3>
              <span className="text-[11px] text-zinc-500 font-mono">
                {scheduledTime} Diário
              </span>
            </div>

            {/* Telegram Message Balloon Mockup */}
            <div className="bg-[#182533] border border-[#2b3c4f] rounded-2xl p-4 shadow-xl text-zinc-100 space-y-3 font-sans relative">
              <div className="flex items-center justify-between border-b border-[#243547] pb-2 text-[11px] text-sky-400 font-semibold">
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" />
                  <span>Cabe no Bolso Bot</span>
                </div>
                <span className="text-zinc-500 text-[10px]">bot • oficial</span>
              </div>

              <div className="text-xs whitespace-pre-wrap leading-relaxed font-sans text-zinc-200">
                {previewMessage}
              </div>

              <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-400 pt-1">
                <span>{scheduledTime}</span>
                <Check className="w-3 h-3 text-sky-400" />
              </div>
            </div>

            {/* Action: Test Send Button */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleSendTestMessage}
                disabled={isSendingTest || !botToken.trim() || !chatId.trim()}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg ${
                  isSendingTest || !botToken.trim() || !chatId.trim()
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                    : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/20 active:scale-95'
                }`}
              >
                {isSendingTest ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {isSendingTest ? 'Disparando Mensagem...' : '🚀 Testar Envio Imediato no Telegram'}
                </span>
              </button>

              {/* Test Result Feedback */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  )}
                  <div className="leading-relaxed">{testResult.message}</div>
                </div>
              )}
            </div>
          </div>

          {/* Budget Items Breakdown Card: Salários & Gastos de Novembro */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <CalendarCheck2 className="w-3.5 h-3.5 text-[#00ff7f]" />
                <span>Movimentações de {summary.monthName}</span>
              </h4>
              {onNavigateToBudget && (
                <button
                  onClick={onNavigateToBudget}
                  className="text-[11px] font-semibold text-[#00ff7f] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Abrir Orçamento</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/40 border border-emerald-500/20 p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                  Salários Previstos
                </span>
                <span className="text-sm font-extrabold text-[#00ff7f] block mt-0.5">
                  {formatCurrency(summary.totalSalario)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {summary.salariesCount} lançamento(s)
                </span>
              </div>

              <div className="bg-black/40 border border-rose-500/20 p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-rose-400 block">
                  Gastos Previstos
                </span>
                <span className="text-sm font-extrabold text-rose-400 block mt-0.5">
                  {formatCurrency(summary.totalGastos)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {summary.expensesCount} despesa(s)
                </span>
              </div>
            </div>

            {/* List Preview of Month's items */}
            {summary.salariesList.length === 0 && summary.expensesList.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2">
                Nenhuma movimentação cadastrada para {summary.monthName} ainda. Acesse o menu "Orçamento Mensal" para lançar salários e gastos.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {summary.salariesList.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-black/50 border border-zinc-800/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[#00ff7f] shrink-0" />
                      <span className="text-zinc-200 truncate">{tx.name}</span>
                    </div>
                    <span className="font-bold text-[#00ff7f] shrink-0">
                      +{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}

                {summary.expensesList.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-black/50 border border-zinc-800/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-zinc-200 truncate">{tx.name}</span>
                    </div>
                    <span className="font-bold text-rose-400 shrink-0">
                      -{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Last Sent Log & Status */}
          {config.lastSentDate && (
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <span className="font-semibold text-zinc-300 block">Histórico de Disparos:</span>
              <div className="flex items-center justify-between text-[11px]">
                <span>Último envio realizado:</span>
                <span className="text-white font-mono">
                  {config.lastSentDate}{' '}
                  {config.lastSentTimestamp
                    ? new Date(config.lastSentTimestamp).toLocaleTimeString('pt-BR')
                    : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>Status da entrega:</span>
                <span
                  className={`font-semibold ${
                    config.lastSentStatus === 'success' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {config.lastSentStatus === 'success' ? 'Entregue no Telegram' : 'Erro no envio'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
