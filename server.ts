import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(customKey?: string): GoogleGenAI {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente ou na requisição.');
  }
  if (customKey) {
    return new GoogleGenAI({ apiKey: customKey });
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Habilita CORS com suporte a credenciais (cookies) e origens externas/móveis
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Permite payloads de imagem em base64 até 50MB
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Helper para chamar o Gemini com timeout individual
  const generateWithTimeout = async (
    ai: GoogleGenAI,
    model: string,
    params: any,
    timeoutMs = 20000
  ): Promise<any> => {
    return Promise.race([
      ai.models.generateContent(params),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms excedido para ${model}`)), timeoutMs)
      ),
    ]);
  };

  // Endpoint para analisar imagem de print/fatura do cartão com Gemini
  app.post('/api/scan-card-invoice', async (req, res) => {
    req.setTimeout(65000);
    res.setTimeout(65000);

    try {
      const { image, mimeType = 'image/jpeg', defaultYear, apiKey } = req.body;

      if (!image) {
        return res.status(400).json({
          success: false,
          error: 'Nenhuma imagem foi fornecida para análise.',
        });
      }

      // Remove prefixo base64 se presente (ex: "data:image/jpeg;base64,")
      let base64Data = image;
      let detectedMimeType = mimeType;
      if (typeof image === 'string' && image.includes(';base64,')) {
        const matches = image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          detectedMimeType = matches[1];
          base64Data = matches[2];
        } else {
          base64Data = image.split(';base64,')[1];
        }
      }

      const contextYear = defaultYear || new Date().getFullYear();

      const prompt = `Você é um especialista em OCR e extração estruturada de dados de faturas e extratos de cartões de crédito brasileiros (como Cartão Atacadão, Nubank, Itaú, Bradesco, Santander, Inter, etc.).
Analise a imagem anexada que contém uma captura de tela (print) ou foto do histórico/extrato de compras de um cartão de crédito.

INSTRUÇÕES DE EXTRAÇÃO:
1. Identifique TODAS as compras/transações que aparecem na imagem.
2. Para cada transação/compra, extraia os seguintes campos:
   - "name": Nome do estabelecimento/loja ou descrição comercial da compra (ex: "STB*ORIGINPRESENTESLTD", "PG *99 RIDE, SAO PAULO", "DL*UberRides", "MERCADO LIVRE", etc.).
     ATENÇÃO: Remova metadados do cartão como "cartão virtual XXXX", "cartão titular XXXX", nome do portador como "Marcio M.", número de documento, etc. Mantenha apenas o nome comercial limpo e legível.
   - "amount": Valor numérico que aparece ao lado da transação (ex: 56.33, 7.70, 220.00). Use número decimal com ponto para centavos.
     IMPORTANTE: Em faturas e extratos de cartão de crédito brasileiros, o valor em reais exibido na linha da transação com parcelamento (ex: "Parcela 3/3 R$ 56,33" ou "Parcela 1/3 R$ 56,33") é SEMPRE o VALOR DA PARCELA daquele mês (neste exemplo, 56.33). Extraia exatamente esse valor da parcela como "amount".
   - "date": Data da transação no formato ISO "YYYY-MM-DD" (ex: "2026-09-13").
     - Observe os cabeçalhos de data na imagem (ex: "Domingo, 13 de setembro", "Quarta-feira, 21 de janeiro", "19/09").
     - Converta o mês por extenso em número (janeiro = 01, fevereiro = 02, março = 03, abril = 04, maio = 05, junho = 06, julho = 07, agosto = 08, setembro = 09, outubro = 10, novembro = 11, dezembro = 12).
     - Se o ano não estiver explícito no print, use o ano de contexto: ${contextYear}.
   - "installmentCount": Quantidade TOTAL de parcelas da compra (número inteiro).
     - Se for compra à vista (sem indicação de parcelas), coloque 1.
     - Se estiver indicado parcelamento como "Parcela 3/3", "Parcela 1/3", "08/08", "8x", o total de parcelas é o número total (ex: 3 no caso de 3/3 ou 1/3; 8 no caso de 8/8).
   - "currentInstallment": O número da parcela atual que aparece no print (número inteiro).
     - Se for à vista, coloque 1.
     - Se "Parcela 3/3", a parcela atual é 3.
     - Se "Parcela 1/3", a parcela atual é 1.
     - Se "Parcela 2/5", a parcela atual é 2.
   - "category": Sugira a categoria mais adequada entre: "Transporte", "Alimentação", "Supermercado", "Educação", "Saúde", "Lazer", "Serviços", "Compras", "Casa", "Outros".
   - "notes": Breve nota se houver informação útil (ex: "Cartão final 8905"), ou deixe vazio "".

Responda ESTRITAMENTE em formato JSON com a seguinte estrutura:
{
  "purchases": [
    {
      "name": "Nome da Compra",
      "amount": 100.50,
      "date": "2026-09-13",
      "installmentCount": 1,
      "currentInstallment": 1,
      "category": "Transporte",
      "notes": ""
    }
  ]
}`;

      const ai = getGeminiClient(apiKey);

      // Modelos para tentar sequencialmente
      const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
      let response: any = null;
      let lastCallError: any = null;

      for (const modelCandidate of modelsToTry) {
        try {
          console.log(`[Gemini OCR] Tentando com modelo '${modelCandidate}'...`);
          response = await generateWithTimeout(
            ai,
            modelCandidate,
            {
              model: modelCandidate,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      inlineData: {
                        mimeType: detectedMimeType,
                        data: base64Data,
                      },
                    },
                    {
                      text: prompt,
                    },
                  ],
                },
              ],
              config: {
                responseMimeType: 'application/json',
              },
            },
            18000 // 18 segundos por modelo
          );

          if (response && response.text) {
            console.log(`[Gemini OCR] Sucesso com modelo '${modelCandidate}'!`);
            break;
          }
        } catch (err: any) {
          lastCallError = err;
          console.warn(`[Gemini OCR] Modelo '${modelCandidate}' falhou ou demorou:`, err?.message || err);
          // Passa imediatamente para o próximo modelo alternativo
        }
      }

      if (!response || !response.text) {
        throw lastCallError || new Error('Não foi possível obter resposta dos modelos do Gemini.');
      }

      const responseText = response.text?.trim() || '{}';
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        const cleaned = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        parsedData = JSON.parse(cleaned);
      }

      const purchases = Array.isArray(parsedData.purchases) ? parsedData.purchases : [];

      return res.json({
        success: true,
        count: purchases.length,
        purchases: purchases.map((p: any) => ({
          name: String(p.name || 'Compra no Cartão').trim(),
          amount: Number(p.amount) || 0,
          date: String(p.date || new Date().toISOString().split('T')[0]),
          installmentCount: Math.max(1, parseInt(p.installmentCount, 10) || 1),
          currentInstallment: Math.max(1, parseInt(p.currentInstallment, 10) || 1),
          category: String(p.category || 'Cartão de crédito'),
          notes: String(p.notes || ''),
        })),
      });
    } catch (error: any) {
      console.error('Erro no /api/scan-card-invoice:', error);
      const errMsg = String(error?.message || error || '');
      let userFriendlyMsg = errMsg || 'Falha ao processar imagem da fatura.';

      if (errMsg.includes('reported as leaked') || errMsg.includes('API key was reported as leaked')) {
        userFriendlyMsg =
          'A chave de API do Gemini foi revogada pelo Google por segurança (vazamento detectado). Por favor, gere uma nova chave no Google AI Studio (aistudio.google.com) e atualize nas Configurações (Settings > Secrets) do projeto.';
      } else if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('invalid API key')) {
        userFriendlyMsg =
          'A chave de API do Gemini está inválida. Por favor, confira ou gere uma nova chave nas Configurações do projeto.';
      } else if (
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('Resource has been exhausted')
      ) {
        userFriendlyMsg =
          'O Google está com alta demanda momentânea nos modelos Flash. Por favor, aguarde alguns segundos e clique no botão Tentar Novamente.';
      } else if (errMsg.includes('Timeout')) {
        userFriendlyMsg =
          'O processamento da imagem demorou mais que o esperado pelo servidor. Por favor, tente novamente com um print mais leve ou recortado.';
      }

      return res.status(500).json({
        success: false,
        error: userFriendlyMsg,
      });
    }
  });

  // Helper para estimar preços realistas nos supermercados de Fortaleza em caso de indisponibilidade ou cota limite da API
  function generateMarketBenchmarkPrices(itemName: string, category?: string) {
    const normName = itemName.toLowerCase().trim();
    const normCat = (category || 'Outros').trim();

    let basePrice = 8.5;
    let productSpec = itemName;

    if (normName.includes('leite')) {
      basePrice = 5.49;
      productSpec = 'Leite Integral Betânia 1L';
    } else if (normName.includes('café') || normName.includes('cafe')) {
      basePrice = 10.89;
      productSpec = 'Café Santa Clara Vácuo 250g';
    } else if (normName.includes('queijo') || normName.includes('coalho')) {
      basePrice = 38.9;
      productSpec = 'Queijo Coalho Sertanejo Kg';
    } else if (normName.includes('cuscuz') || normName.includes('flocão') || normName.includes('flocao')) {
      basePrice = 2.49;
      productSpec = 'Flocão de Milho Maratá 500g';
    } else if (normName.includes('tapioca') || normName.includes('goma')) {
      basePrice = 6.9;
      productSpec = 'Goma de Tapioca Fresca Cearense 1kg';
    } else if (normName.includes('cajuína') || normName.includes('cajuina') || normName.includes('são geraldo')) {
      basePrice = 8.99;
      productSpec = 'Refrigerante Cajuína São Geraldo 2L';
    } else if (normName.includes('carne') || normName.includes('alcatra') || normName.includes('sol')) {
      basePrice = 45.9;
      productSpec = 'Carne de Sol de Alcatra Especial (Kg)';
    } else if (normName.includes('feijão') || normName.includes('feijao')) {
      basePrice = 8.2;
      productSpec = 'Feijão de Corda Verde / Macassar (Kg)';
    } else if (normName.includes('arroz')) {
      basePrice = 5.79;
      productSpec = 'Arroz Branco Tio João / Camil 1kg';
    } else if (normName.includes('açúcar') || normName.includes('acucar')) {
      basePrice = 4.29;
      productSpec = 'Açúcar Cristal Fortaleza 1kg';
    } else if (normName.includes('óleo') || normName.includes('oleo')) {
      basePrice = 6.49;
      productSpec = 'Óleo de Soja Soya / Liza 900ml';
    } else if (normName.includes('ovo') || normName.includes('ovos')) {
      basePrice = 17.9;
      productSpec = 'Cartela de Ovos Brancos 30un';
    } else if (normName.includes('frango') || normName.includes('peito')) {
      basePrice = 19.9;
      productSpec = 'Peito de Frango Congelado (Kg)';
    } else if (normName.includes('cerveja')) {
      basePrice = 4.19;
      productSpec = 'Cerveja Lata 350ml';
    } else if (normName.includes('pão') || normName.includes('pao')) {
      basePrice = 14.5;
      productSpec = 'Pão Francês Tradicional (Kg)';
    } else if (normName.includes('sabão') || normName.includes('sabao') || normName.includes('omo')) {
      basePrice = 12.9;
      productSpec = 'Sabão em Pó OMO Lavagem Perfeita 800g';
    } else if (normName.includes('detergente')) {
      basePrice = 2.49;
      productSpec = 'Detergente Líquido Ypê 500ml';
    } else if (normName.includes('shampoo')) {
      basePrice = 15.9;
      productSpec = 'Shampoo Seda / Pantene 325ml';
    } else {
      if (normCat.includes('Açougue') || normCat.includes('Peixaria')) basePrice = 36.0;
      else if (normCat.includes('Frios') || normCat.includes('Laticínios')) basePrice = 16.5;
      else if (normCat.includes('Hortifrúti')) basePrice = 6.5;
      else if (normCat.includes('Padaria')) basePrice = 12.0;
      else if (normCat.includes('Bebidas')) basePrice = 7.5;
      else if (normCat.includes('Higiene')) basePrice = 11.0;
      else if (normCat.includes('Limpeza')) basePrice = 8.5;
      else basePrice = 9.0;
    }

    const stores = [
      { supermarket: 'Atacadão', factor: 0.92 },
      { supermarket: 'Mercadão', factor: 0.96 },
      { supermarket: 'CenterBox', factor: 0.98 },
      { supermarket: 'Lagoa', factor: 1.0 },
      { supermarket: 'Frangolândia', factor: 1.02 },
      { supermarket: 'Guará', factor: 1.12 },
      { supermarket: 'São Luiz', factor: 1.16 },
    ];

    const comparisons = stores.map((s) => {
      const rawPrice = Number((basePrice * s.factor).toFixed(2));
      return {
        supermarket: s.supermarket,
        productName: productSpec,
        price: rawPrice,
        isAvailable: true,
      };
    });

    const lowestPrice = Math.min(...comparisons.map((c) => c.price));
    const cheapest = comparisons.find((c) => c.price === lowestPrice);

    return {
      itemName,
      category: normCat,
      lowestPrice,
      cheapestSupermarket: cheapest ? cheapest.supermarket : 'Atacadão',
      comparisons,
    };
  }

  // Endpoint para pesquisar preços de itens de supermercado em Fortaleza com Gemini e fallback automático
  app.post('/api/search-market-prices', async (req, res) => {
    const { itemName, category, apiKey } = req.body;

    if (!itemName) {
      return res.status(400).json({
        success: false,
        error: 'O nome do item é obrigatório.',
      });
    }

    try {
      let ai: GoogleGenAI | null = null;
      try {
        ai = getGeminiClient(apiKey);
      } catch (keyErr) {
        console.warn('[Mercado Cotação] Gemini API Key indisponível, usando benchmark local.');
      }

      if (ai) {
        const prompt = `Você é um assistente de economia doméstica especialista em Fortaleza, Ceará.
Faça uma pesquisa e análise realista de preços para o item de supermercado:
- Item: "${itemName}"
- Categoria sugerida: "${category || 'Geral'}"

Gere uma cotação comparativa realista para os seguintes supermercados de Fortaleza:
1. Atacadão (Fortaleza) - Geralmente o menor preço por ser atacarejo
2. Frangolândia - Rede tradicional cearense com preços médios competitivos
3. Lagoa (Supermercado Lagoa) - Rede tradicional de Fortaleza com bom custo-benefício
4. CenterBox - Preços intermediários e competitivos de bairro
5. Mercadão (Supermercado Mercadão) - Preços acessíveis
6. Guará (Supermercado Guará) - Rede mais premium, com variedade selecionada
7. São Luiz (Mercadinhos São Luiz) - Rede premium de alta qualidade e atendimento

Regras:
- Atribua um nome de produto específico e realista com marca popular cearense/nacional (ex: Betânia para leite, Santa Clara para café, M. Dias Branco/Fortaleza para massas e biscoitos, etc.).
- Defina o menor preço em "lowestPrice" e qual supermercado o oferece em "cheapestSupermarket".
- Forneça a lista de cotação em "comparisons".

Responda ESTRITAMENTE em formato JSON com a seguinte estrutura:
{
  "itemName": "${itemName}",
  "category": "${category || 'Geral'}",
  "lowestPrice": 5.49,
  "cheapestSupermarket": "Atacadão",
  "comparisons": [
    { "supermarket": "Atacadão", "productName": "Ex: Leite Integral Betânia 1L", "price": 5.19, "isAvailable": true },
    { "supermarket": "Mercadão", "productName": "Ex: Leite Integral Betânia 1L", "price": 5.39, "isAvailable": true },
    { "supermarket": "CenterBox", "productName": "Ex: Leite Integral Betânia 1L", "price": 5.49, "isAvailable": true },
    { "supermarket": "Lagoa", "productName": "Ex: Leite Integral Betânia 1L", "price": 5.59, "isAvailable": true },
    { "supermarket": "Frangolândia", "productName": "Ex: Leite Integral Betânia 1L", "price": 5.69, "isAvailable": true },
    { "supermarket": "Guará", "productName": "Ex: Leite Integral Betânia 1L", "price": 6.19, "isAvailable": true },
    { "supermarket": "São Luiz", "productName": "Ex: Leite Integral Betânia 1L", "price": 6.39, "isAvailable": true }
  ]
}`;

        const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
        for (const modelCandidate of modelsToTry) {
          try {
            console.log(`[Mercado Cotação] Tentando cotação com modelo '${modelCandidate}'...`);
            const response = await generateWithTimeout(
              ai,
              modelCandidate,
              {
                model: modelCandidate,
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                },
              },
              15000
            );

            if (response && response.text) {
              const cleanedText = response.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
              const parsed = JSON.parse(cleanedText);
              if (parsed && parsed.lowestPrice && Array.isArray(parsed.comparisons)) {
                console.log(`[Mercado Cotação] Cotação obtida com sucesso via '${modelCandidate}'!`);
                return res.json({
                  success: true,
                  source: 'gemini',
                  data: parsed,
                });
              }
            }
          } catch (modelErr: any) {
            console.warn(`[Mercado Cotação] Modelo '${modelCandidate}' falhou ou atingiu cota:`, modelErr?.message || modelErr);
          }
        }
      }

      // Se a IA não estiver disponível ou estiver com cota esgotada (429), aciona benchmark inteligente de Fortaleza
      console.log(`[Mercado Cotação] Ativando benchmark de mercado de Fortaleza para "${itemName}"`);
      const fallbackData = generateMarketBenchmarkPrices(itemName, category);
      return res.json({
        success: true,
        source: 'benchmark',
        data: fallbackData,
      });
    } catch (error: any) {
      console.error('Erro no /api/search-market-prices, retornando benchmark seguro:', error);
      const safeData = generateMarketBenchmarkPrices(itemName, category);
      return res.json({
        success: true,
        source: 'benchmark-fallback',
        data: safeData,
      });
    }
  });

  // =========================================================================
  // TELEGRAM BOT INTEGRATION & DAILY AUTOMATED SCHEDULER
  // =========================================================================

  interface RegisteredTelegramSchedule {
    userId: string;
    botToken: string;
    chatId: string;
    scheduledTime: string; // "HH:MM"
    enabled: boolean;
    messageText: string;
    lastSentDate?: string;
    lastSentTimestamp?: string;
    lastSentStatus?: 'success' | 'error';
    lastSentError?: string;
  }

  const telegramSchedules = new Map<string, RegisteredTelegramSchedule>();

  // Helper para obter hora e data no fuso de Fortaleza/Brasil (UTC-3)
  function getBrazilTimeNow(): { timeStr: string; dateStr: string } {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Fortaleza',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '00';

    const timeStr = `${getVal('hour')}:${getVal('minute')}`;
    const dateStr = `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
    return { timeStr, dateStr };
  }

  // 1. Detectar Chat ID automaticamente via getUpdates
  app.post('/api/telegram/detect-chat-id', async (req, res) => {
    try {
      const { botToken } = req.body;
      if (!botToken || typeof botToken !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Informe o Token do Bot gerado pelo @BotFather.',
        });
      }

      const cleanToken = botToken.trim();

      // Primeiro valida o token chamando getMe
      const meResponse = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const meData = await meResponse.json();

      if (!meData.ok) {
        return res.status(400).json({
          success: false,
          error: `Token inválido ou não reconhecido pelo Telegram: ${meData.description || 'Verifique o token copiado do @BotFather'}.`,
        });
      }

      const botInfo = meData.result;

      // Agora busca as últimas mensagens enviadas para o bot
      const updatesResponse = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=20`);
      const updatesData = await updatesResponse.json();

      if (!updatesData.ok) {
        return res.status(400).json({
          success: false,
          error: `Falha ao consultar mensagens: ${updatesData.description || 'Erro na API do Telegram'}.`,
        });
      }

      const updates = updatesData.result || [];
      if (updates.length === 0) {
        return res.json({
          success: false,
          botUsername: botInfo.username,
          botName: botInfo.first_name,
          error: `O bot @${botInfo.username} foi validado, mas ainda não recebeu nenhuma mensagem sua.\n\n👉 Abra o seu Telegram, pesquise por @${botInfo.username}, clique em "Começar" (ou envie "Oi") e depois clique em "Detectar Meu Chat ID" novamente!`,
        });
      }

      // Procura a última interação com chat id válido
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
        return res.json({
          success: false,
          botUsername: botInfo.username,
          botName: botInfo.first_name,
          error: `Nenhum chat de usuário identificado nas mensagens recebidas. Envie uma mensagem direta para @${botInfo.username} no Telegram.`,
        });
      }

      return res.json({
        success: true,
        chatId: String(detectedChat.id),
        chatName: detectedChat.first_name || detectedChat.title || detectedChat.username || 'Meu Telegram',
        chatUsername: detectedChat.username || null,
        botUsername: botInfo.username,
        botName: botInfo.first_name,
      });
    } catch (err: any) {
      console.error('Erro ao detectar chat id do Telegram:', err);
      return res.status(500).json({
        success: false,
        error: `Erro ao conectar com a API do Telegram: ${err.message || 'Verifique sua conexão'}.`,
      });
    }
  });

  // 2. Disparar mensagem avulsa ou de teste no Telegram
  app.post('/api/telegram/send-message', async (req, res) => {
    try {
      const { botToken, chatId, message, parseMode = 'Markdown' } = req.body;

      if (!botToken || !chatId || !message) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros obrigatórios ausentes (botToken, chatId, message).',
        });
      }

      const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: String(chatId).trim(),
          text: message,
          parse_mode: parseMode,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        let friendlyErr = data.description || 'Erro ao enviar mensagem';
        if (data.description?.includes('chat not found')) {
          friendlyErr = 'Chat não encontrado. Você já iniciou a conversa com o bot no Telegram?';
        } else if (data.description?.includes('bot was blocked')) {
          friendlyErr = 'O bot foi bloqueado pelo usuário no Telegram.';
        } else if (data.description?.includes('Unauthorized')) {
          friendlyErr = 'Token de bot inválido ou expirado.';
        }
        return res.status(400).json({
          success: false,
          error: friendlyErr,
          rawError: data.description,
        });
      }

      return res.json({
        success: true,
        messageId: data.result?.message_id,
        sentAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Erro ao enviar mensagem no Telegram:', err);
      return res.status(500).json({
        success: false,
        error: `Falha na requisição para o Telegram: ${err.message}`,
      });
    }
  });

  // 3. Registrar ou atualizar agendamento diário no servidor
  app.post('/api/telegram/register-schedule', (req, res) => {
    try {
      const { userId = 'default_user', botToken, chatId, scheduledTime, enabled, messageText } = req.body;

      if (!botToken || !chatId || !scheduledTime) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros obrigatórios ausentes para o agendamento.',
        });
      }

      const existing = telegramSchedules.get(userId);
      const schedule: RegisteredTelegramSchedule = {
        userId,
        botToken: botToken.trim(),
        chatId: String(chatId).trim(),
        scheduledTime: scheduledTime.trim(),
        enabled: Boolean(enabled),
        messageText: messageText || 'Você tem esse valor disponivel para gastar',
        lastSentDate: existing?.lastSentDate,
        lastSentTimestamp: existing?.lastSentTimestamp,
        lastSentStatus: existing?.lastSentStatus,
        lastSentError: existing?.lastSentError,
      };

      telegramSchedules.set(userId, schedule);
      console.log(`[Telegram Scheduler] Agendamento registrado para ${userId} às ${scheduledTime} (Ativo: ${enabled})`);

      return res.json({
        success: true,
        schedule,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Consultar status do agendador
  app.get('/api/telegram/schedule-status/:userId', (req, res) => {
    const { userId } = req.params;
    const schedule = telegramSchedules.get(userId);
    const { timeStr, dateStr } = getBrazilTimeNow();
    return res.json({
      success: true,
      serverTime: timeStr,
      serverDate: dateStr,
      schedule: schedule || null,
    });
  });

  // 5. Rotina de disparo diário no servidor (Verifica a cada 30 segundos)
  setInterval(async () => {
    if (telegramSchedules.size === 0) return;

    const { timeStr, dateStr } = getBrazilTimeNow();

    for (const [userId, item] of telegramSchedules.entries()) {
      if (!item.enabled) continue;

      // Se o horário atual bate com o horário configurado e ainda não foi enviado hoje
      if (item.scheduledTime === timeStr && item.lastSentDate !== dateStr) {
        console.log(`[Telegram Scheduler] Disparando aviso diário para ${userId} (${item.chatId}) às ${timeStr}`);
        try {
          const response = await fetch(`https://api.telegram.org/bot${item.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: item.chatId,
              text: item.messageText,
              parse_mode: 'Markdown',
            }),
          });
          const result = await response.json();
          if (result.ok) {
            item.lastSentDate = dateStr;
            item.lastSentTimestamp = new Date().toISOString();
            item.lastSentStatus = 'success';
            item.lastSentError = undefined;
            console.log(`[Telegram Scheduler] Mensagem enviada com sucesso para ${userId}`);
          } else {
            item.lastSentStatus = 'error';
            item.lastSentError = result.description || 'Erro retornado pela API do Telegram';
            console.error(`[Telegram Scheduler] Falha ao enviar para ${userId}:`, result.description);
          }
        } catch (dispatchErr: any) {
          item.lastSentStatus = 'error';
          item.lastSentError = dispatchErr.message;
          console.error(`[Telegram Scheduler] Exceção ao enviar para ${userId}:`, dispatchErr);
        }
      }
    }
  }, 30000);

  // Middleware global de erro do Express (garante SEMPRE resposta JSON em vez de HTML)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error('Express Error Handler:', err);
      if (err.type === 'entity.too.large') {
        return res.status(413).json({
          success: false,
          error: 'A imagem enviada é muito grande. Por favor, recorte apenas a área das compras e envie novamente.',
        });
      }
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Erro interno no servidor ao processar os dados.',
      });
    }
    next();
  });

  // Vite middleware em desenvolvimento, static em produção
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Servidor] Porta ${PORT} já está em uso.`);
    } else {
      console.error('[Servidor] Erro HTTP:', err);
    }
  });

  const handleShutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

startServer();
