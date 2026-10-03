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
