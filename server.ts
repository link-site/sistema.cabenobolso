import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

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
  const PORT = 3000;

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
   - "name": Nome do estabelecimento/loja ou descrição da compra (ex: "PG *99 RIDE, SAO PAULO", "DL*UberRides, Sao Paulo", "ESCOLA PEQUENO MESTRE", "MERCADO LIVRE", etc.).
     ATENÇÃO: Remova metadados do cartão como "cartão virtual XXXX", "cartão titular XXXX", nome do portador como "Marcio M.", número de documento, etc. Mantenha apenas o nome comercial limpo e legível.
   - "amount": Valor numérico da compra (ex: 7.70, 7.30, 220.00). Use número decimal com ponto para centavos.
     Se for compra parcelada (ex: "Parcela 8/8" com R$ 220,00), extraia o valor numérico que aparece para a parcela.
   - "date": Data da transação no formato ISO "YYYY-MM-DD" (ex: "2026-09-13").
     - Observe os cabeçalhos de data na imagem (ex: "Domingo, 13 de setembro", "Quarta-feira, 21 de janeiro").
     - Converta o mês por extenso em número (janeiro = 01, fevereiro = 02, março = 03, abril = 04, maio = 05, junho = 06, julho = 07, agosto = 08, setembro = 09, outubro = 10, novembro = 11, dezembro = 12).
     - Se o ano não estiver explícito no print, use o ano de contexto: ${contextYear}.
   - "installmentCount": Quantidade TOTAL de parcelas da compra (número inteiro).
     - Se for compra à vista (sem indicação de parcelas), coloque 1.
     - Se estiver indicado parcelamento como "Parcela 8/8", "08/08", "8x", "1/3", extraia o total de parcelas (ex: 8 no caso de 8/8).
   - "currentInstallment": O número da parcela atual que aparece no print (número inteiro).
     - Se for à vista, coloque 1.
     - Se "Parcela 8/8", coloque 8. Se "Parcela 2/5", coloque 2.
   - "category": Sugira a categoria mais adequada entre: "Transporte", "Alimentação", "Supermercado", "Educação", "Saúde", "Lazer", "Serviços", "Compras", "Casa", "Outros".
   - "notes": Breve nota se houver informação útil (ex: "Cartão final 9488"), ou deixe vazio "".

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
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
