/**
 * Utilitário de comunicação com a API do Telegram (Suporte Duplo: Servidor + Fallback Direto no Cliente)
 */

export function cleanTelegramToken(raw: any): string {
  if (!raw || typeof raw !== 'string') return '';
  let token = raw.trim();
  // Remove aspas ou espaços acidentais
  token = token.replace(/^["'\s]+|["'\s]+$/g, '');
  // Remove URL completa caso o usuário tenha colado
  token = token.replace(/^https?:\/\/api\.telegram\.org\/bot/i, '');
  // Remove prefixo 'bot' se colado junto com o token numérico (ex: bot712345:ABC...)
  if (token.toLowerCase().startsWith('bot') && /^\d/.test(token.slice(3))) {
    token = token.slice(3);
  }
  // Remove barra final
  token = token.replace(/\/+$/, '');
  return token.trim();
}

export function cleanTelegramChatId(raw: any): string {
  if (!raw) return '';
  let id = String(raw).trim();
  // Remove aspas ou espaços
  id = id.replace(/^["'\s]+|["'\s]+$/g, '');
  return id;
}

export interface DetectChatResult {
  success: boolean;
  chatId?: string;
  chatName?: string;
  chatUsername?: string | null;
  botUsername?: string;
  botName?: string;
  needInteraction?: boolean;
  error?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Detecta o Chat ID do usuário consultando o bot.
 * Tenta primeiro via endpoint do backend; se houver falha de rede/proxy, tenta direto na API do Telegram.
 */
export async function detectTelegramChatId(rawToken: string): Promise<DetectChatResult> {
  const token = cleanTelegramToken(rawToken);
  if (!token) {
    return {
      success: false,
      error: 'Por favor, informe o Token do Bot gerado pelo @BotFather.',
    };
  }

  // 1. Tentativa via Servidor Local
  try {
    const res = await fetch('/api/telegram/detect-chat-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken: token }),
    });

    const text = await res.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        if (data.success && data.chatId) {
          return {
            success: true,
            chatId: String(data.chatId),
            chatName: data.chatName,
            chatUsername: data.chatUsername,
            botUsername: data.botUsername,
            botName: data.botName,
          };
        }
        if (data.error) {
          return {
            success: false,
            botUsername: data.botUsername,
            botName: data.botName,
            needInteraction: data.needInteraction || data.error.includes('ainda não recebeu nenhuma mensagem'),
            error: data.error,
          };
        }
      } catch {
        // Ignora erro de parse e tenta via cliente
      }
    }
  } catch (serverErr) {
    console.warn('[Telegram] Servidor local indisponível, tentando direto via Telegram API...', serverErr);
  }

  // 2. Fallback Direto no Cliente (A API do Telegram suporta CORS)
  try {
    // Valida bot primeiro
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      return {
        success: false,
        error: `Token inválido ou não reconhecido pelo Telegram: ${meData.description || 'Verifique o token copiado do @BotFather'}.`,
      };
    }

    const botInfo = meData.result;

    // Busca atualizações
    let updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
    let updatesData = await updatesRes.json();

    // Se houver conflito de webhook ativo, remove o webhook e tenta novamente
    if (!updatesData.ok && updatesData.description?.includes('webhook')) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
        updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
        updatesData = await updatesRes.json();
      } catch {
        // segue com erro original
      }
    }

    if (!updatesData.ok) {
      return {
        success: false,
        error: `Erro ao consultar mensagens do bot: ${updatesData.description || 'Falha na API'}.`,
      };
    }

    const updates = updatesData.result || [];
    if (updates.length === 0) {
      return {
        success: false,
        botUsername: botInfo.username,
        botName: botInfo.first_name,
        needInteraction: true,
        error: `O bot @${botInfo.username} foi validado com sucesso, mas você ainda não enviou mensagem para ele.\n\n👉 Abra a conversa com o bot no Telegram, clique em "Começar" (ou envie "Oi") e depois clique em "Detectar Chat ID" novamente!`,
      };
    }

    // Busca o último chat válido
    let detectedChat: any = null;
    for (let i = updates.length - 1; i >= 0; i--) {
      const u = updates[i];
      const chat = u.message?.chat || u.edited_message?.chat || u.channel_post?.chat || u.my_chat_member?.chat;
      if (chat && chat.id) {
        detectedChat = chat;
        break;
      }
    }

    if (!detectedChat) {
      return {
        success: false,
        botUsername: botInfo.username,
        botName: botInfo.first_name,
        needInteraction: true,
        error: `Nenhuma mensagem direta de usuário encontrada. Envie um "Oi" para @${botInfo.username} no Telegram.`,
      };
    }

    return {
      success: true,
      chatId: String(detectedChat.id),
      chatName: detectedChat.first_name || detectedChat.title || detectedChat.username || 'Meu Telegram',
      chatUsername: detectedChat.username || null,
      botUsername: botInfo.username,
      botName: botInfo.first_name,
    };
  } catch (directErr: any) {
    return {
      success: false,
      error: `Não foi possível conectar com o Telegram: ${directErr.message || 'Verifique sua conexão'}.`,
    };
  }
}

/**
 * Envia uma mensagem para o Telegram com fallback automático para texto puro caso o Markdown falhe.
 */
export async function sendTelegramMessage(
  rawToken: string,
  rawChatId: string,
  message: string
): Promise<SendMessageResult> {
  const token = cleanTelegramToken(rawToken);
  const chatId = cleanTelegramChatId(rawChatId);

  if (!token || !chatId || !message) {
    return {
      success: false,
      error: 'Parâmetros obrigatórios ausentes (Token, Chat ID ou Mensagem).',
    };
  }

  // 1. Tentativa via Servidor Local
  try {
    const res = await fetch('/api/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: token,
        chatId: chatId,
        message: message,
        parseMode: 'Markdown',
      }),
    });

    const text = await res.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        if (data.success) {
          return { success: true, messageId: data.messageId };
        }
        if (data.error) {
          // Se for erro específico do telegram (como token inválido ou chat not found), retorna logo
          if (data.error.includes('inválido') || data.error.includes('bloqueado') || data.error.includes('não encontrado')) {
            return { success: false, error: data.error };
          }
        }
      } catch {
        // Fallback para envio direto
      }
    }
  } catch (err) {
    console.warn('[Telegram] Servidor local falhou no envio, tentando direto via Telegram API...', err);
  }

  // 2. Fallback Direto no Cliente
  try {
    // Primeira tentativa com Markdown
    let response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    let data = await response.json();

    // Se falhar por erro de parsing do Markdown, tenta novamente como texto simples
    if (!data.ok && data.description?.includes("can't parse entities")) {
      response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      });
      data = await response.json();
    }

    if (!data.ok) {
      let friendly = data.description || 'Erro ao enviar mensagem';
      if (data.description?.includes('chat not found')) {
        friendly = chatId.startsWith('@')
          ? 'O Telegram não aceita @usuario para mensagens privadas. Use seu Chat ID numérico (ex: 123456789) detectado pelo botão acima!'
          : 'Chat não encontrado. Você já iniciou a conversa com o bot no Telegram enviando "Oi"?';
      } else if (data.description?.includes('bot was blocked')) {
        friendly = 'O bot foi bloqueado pelo usuário no Telegram.';
      } else if (data.description?.includes('Unauthorized')) {
        friendly = 'Token do Bot inválido ou expirado. Verifique no @BotFather.';
      }
      return { success: false, error: friendly };
    }

    return {
      success: true,
      messageId: data.result?.message_id,
    };
  } catch (directErr: any) {
    return {
      success: false,
      error: `Falha ao conectar com o Telegram: ${directErr.message || 'Verifique sua conexão'}.`,
    };
  }
}
