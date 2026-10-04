import express from 'express';
import path from 'path';
import fs from 'fs';
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

  // Helper para estimar preços realistas nos supermercados de Fortaleza preservando a especificação exata do usuário
  function generateMarketBenchmarkPrices(itemName: string, category?: string) {
    const rawName = (itemName || 'Item').trim();
    const normName = rawName.toLowerCase();
    const normCat = (category || 'Outros').trim();

    let basePrice = 8.5;

    // Detecta multiplicadores de tamanho/volume informados pelo usuário
    let multiplier = 1;
    if (normName.includes('5l') || normName.includes('5 l') || normName.includes('5 litro') || normName.includes('5 litros')) {
      multiplier = 4.0;
    } else if (normName.includes('3l') || normName.includes('3 l') || normName.includes('3 litro') || normName.includes('3 litros')) {
      multiplier = 2.5;
    } else if (normName.includes('2l') || normName.includes('2 l') || normName.includes('2 litro') || normName.includes('2 litros')) {
      multiplier = 1.8;
    } else if (normName.includes('5kg') || normName.includes('5 kg') || normName.includes('5 quilo')) {
      multiplier = 4.5;
    } else if (normName.includes('10kg') || normName.includes('10 kg')) {
      multiplier = 9.0;
    } else if (normName.includes('fardo') || normName.includes('caixa')) {
      multiplier = 8.0;
    } else if (normName.includes('30un') || normName.includes('30 ovos') || normName.includes('cartela')) {
      multiplier = 1.0;
    }

    // Identificação de preço base por tipo de produto
    if (normName.includes('sabão líquido') || normName.includes('sabao liquido') || normName.includes('lava roupas líquido') || normName.includes('lava roupas liquido')) {
      basePrice = multiplier > 1 ? 8.2 * multiplier : 14.5; // ~R$ 32,80 para 5L
    } else if (normName.includes('sabão em pó') || normName.includes('sabao em po') || normName.includes('omo')) {
      basePrice = multiplier > 1 ? 7.5 * multiplier : 12.9;
    } else if (normName.includes('leite')) {
      basePrice = 5.49 * multiplier;
    } else if (normName.includes('café') || normName.includes('cafe')) {
      basePrice = 10.89 * multiplier;
    } else if (normName.includes('queijo') || normName.includes('coalho')) {
      basePrice = 38.9;
    } else if (normName.includes('cuscuz') || normName.includes('flocão') || normName.includes('flocao')) {
      basePrice = 2.49 * multiplier;
    } else if (normName.includes('tapioca') || normName.includes('goma')) {
      basePrice = 6.9 * multiplier;
    } else if (normName.includes('cajuína') || normName.includes('cajuina') || normName.includes('são geraldo')) {
      basePrice = 8.99 * multiplier;
    } else if (normName.includes('carne') || normName.includes('alcatra') || normName.includes('picanha') || normName.includes('sol')) {
      basePrice = 45.9 * multiplier;
    } else if (normName.includes('feijão') || normName.includes('feijao')) {
      basePrice = 8.2 * multiplier;
    } else if (normName.includes('arroz')) {
      basePrice = 5.79 * multiplier;
    } else if (normName.includes('açúcar') || normName.includes('acucar')) {
      basePrice = 4.29 * multiplier;
    } else if (normName.includes('óleo') || normName.includes('oleo')) {
      basePrice = 6.49 * multiplier;
    } else if (normName.includes('ovo') || normName.includes('ovos')) {
      basePrice = 17.9;
    } else if (normName.includes('frango') || normName.includes('peito')) {
      basePrice = 19.9 * multiplier;
    } else if (normName.includes('cerveja')) {
      basePrice = 4.19 * multiplier;
    } else if (normName.includes('pão') || normName.includes('pao')) {
      basePrice = 9.5 * multiplier;
    } else if (normName.includes('detergente')) {
      basePrice = 2.49 * multiplier;
    } else if (normName.includes('shampoo')) {
      basePrice = 15.9 * multiplier;
    } else {
      if (normCat.includes('Açougue') || normCat.includes('Peixaria')) basePrice = 36.0 * multiplier;
      else if (normCat.includes('Frios') || normCat.includes('Laticínios')) basePrice = 16.5 * multiplier;
      else if (normCat.includes('Hortifrúti')) basePrice = 6.5 * multiplier;
      else if (normCat.includes('Padaria')) basePrice = 12.0 * multiplier;
      else if (normCat.includes('Bebidas')) basePrice = 7.5 * multiplier;
      else if (normCat.includes('Higiene')) basePrice = 11.0 * multiplier;
      else if (normCat.includes('Limpeza')) basePrice = 8.5 * multiplier;
      else basePrice = 9.0 * multiplier;
    }

    const stores = [
      { supermarket: 'Atacadão', factor: 0.90, brandTag: 'Oferta Atacarejo / Econômica' },
      { supermarket: 'Mercadão', factor: 0.95, brandTag: 'Marca Popular' },
      { supermarket: 'CenterBox', factor: 0.98, brandTag: 'Marca Tradicional' },
      { supermarket: 'Lagoa', factor: 1.0, brandTag: 'Marca Cearense / Tradicional' },
      { supermarket: 'Frangolândia', factor: 1.02, brandTag: 'Mais Vendida' },
      { supermarket: 'Guará', factor: 1.12, brandTag: 'Linha Selecionada' },
      { supermarket: 'São Luiz', factor: 1.16, brandTag: 'Linha Premium / Especial' },
    ];

    const comparisons = stores.map((s) => {
      const rawPrice = Number((basePrice * s.factor).toFixed(2));
      return {
        supermarket: s.supermarket,
        productName: `${rawName} (${s.brandTag})`,
        price: rawPrice,
        isAvailable: true,
      };
    });

    const lowestPrice = Math.min(...comparisons.map((c) => c.price));
    const cheapest = comparisons.find((c) => c.price === lowestPrice);

    return {
      itemName: rawName,
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
        console.warn('[Mercado Cotação] Gemini API Key indisponível.');
      }

      if (ai) {
        const prompt = `Você é um pesquisador de preços de supermercados de Fortaleza, Ceará.
Faça uma pesquisa com as informações mais recentes de preços para o produto exato especificado:
- Produto Solicitado: "${itemName}"
- Categoria: "${category || 'Geral'}"

ATENÇÃO CRUCIAL ÀS REGRAS:
1. Respeite com absoluta fidelidade o nome, tipo, volume ou tamanho pedido pelo usuário. Por exemplo: se o usuário pediu "Sabão Líquido 5 Litro", a cotação deve ser exclusivamente de sabão líquido em embalagem de 5 litros (NÃO pode virar sabão em pó nem embalagem pequena).
2. Cada supermercado deve ter uma oferta realista com marcas reais vendidas no Ceará (ex: marcas populares, regionais ou líderes de mercado como Omo, Tixan Ypê, Baby Soft, Teiú, Betânia, Santa Clara, Fortaleza, etc.).
3. Os 7 supermercados a cotar são: Atacadão, Mercadão, CenterBox, Lagoa, Frangolândia, Guará, São Luiz.
4. "lowestPrice" deve ser o menor valor encontrado e "cheapestSupermarket" o nome do supermercado correspondente.

Responda ESTRITAMENTE em formato JSON com este schema:
{
  "itemName": "${itemName}",
  "category": "${category || 'Geral'}",
  "lowestPrice": 24.90,
  "cheapestSupermarket": "Atacadão",
  "comparisons": [
    { "supermarket": "Atacadão", "productName": "Ex: Sabão Líquido Teiú Galão 5L", "price": 24.90, "isAvailable": true },
    { "supermarket": "Mercadão", "productName": "Ex: Sabão Líquido Baby Soft 5L", "price": 27.50, "isAvailable": true },
    { "supermarket": "CenterBox", "productName": "Ex: Sabão Líquido Tixan Ypê 5L", "price": 32.90, "isAvailable": true },
    { "supermarket": "Lagoa", "productName": "Ex: Sabão Líquido Brilhante 5L", "price": 34.90, "isAvailable": true },
    { "supermarket": "Frangolândia", "productName": "Ex: Sabão Líquido Tixan Ypê 5L", "price": 35.50, "isAvailable": true },
    { "supermarket": "Guará", "productName": "Ex: Sabão Líquido Omo 5L", "price": 42.90, "isAvailable": true },
    { "supermarket": "São Luiz", "productName": "Ex: Sabão Líquido Omo Concentrado 5L", "price": 45.90, "isAvailable": true }
  ]
}`;

        // Modelos a tentar em ordem de velocidade e disponibilidade
        const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
        for (const m of models) {
          try {
            console.log(`[Mercado Cotação] Cotando "${itemName}" com modelo ${m}...`);
            const response = await generateWithTimeout(
              ai,
              m,
              {
                model: m,
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                },
              },
              7000
            );

            if (response && response.text) {
              const cleanedText = response.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
              const parsed = JSON.parse(cleanedText);
              if (parsed && parsed.lowestPrice && Array.isArray(parsed.comparisons) && parsed.comparisons.length > 0) {
                console.log(`[Mercado Cotação] Cotação obtida com sucesso via ${m} para "${itemName}"!`);
                return res.json({
                  success: true,
                  source: 'gemini',
                  data: parsed,
                });
              }
            }
          } catch (modelErr: any) {
            console.warn(`[Mercado Cotação] Modelo ${m} falhou para "${itemName}":`, modelErr?.message || modelErr);
          }
        }
      }

      // Se a IA não responder a tempo, aciona o benchmark dinâmico
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

  // Endpoint em lote para varredura rápida de múltiplos itens de mercado com IA
  app.post('/api/search-market-prices-bulk', async (req, res) => {
    const { items = [], apiKey } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, results: [] });
    }

    try {
      let ai: GoogleGenAI | null = null;
      try {
        ai = getGeminiClient(apiKey);
      } catch (e) {
        // segue sem ai
      }

      if (ai) {
        const simplifiedItems = items.map((it) => ({
          id: it.id,
          name: it.name || it.itemName,
          category: it.category || 'Geral',
        }));

        const prompt = `Você é um pesquisador de preços de supermercados de Fortaleza, Ceará.
Pesquise e informe preços recentes e realistas para os seguintes itens exatos de compras:
${JSON.stringify(simplifiedItems)}

Supermercados a cotar para CADA item:
Atacadão, Mercadão, CenterBox, Lagoa, Frangolândia, Guará, São Luiz.

REGRAS OBRIGATÓRIAS:
- Mantenha rigorosamente o tipo, volume, tamanho e especificação de cada produto (ex: Sabão Líquido 5 Litros deve ser cotado com embalagem 5L de marcas reais, NÃO sabão em pó).
- Atribua marcas reais vendidas no Ceará para cada supermercado.

Retorne ESTRITAMENTE em formato JSON com o schema:
{
  "results": [
    {
      "id": "id_do_item",
      "itemName": "nome_do_item",
      "lowestPrice": 24.90,
      "cheapestSupermarket": "Atacadão",
      "comparisons": [
        { "supermarket": "Atacadão", "productName": "Produto e Marca Real 5L", "price": 24.90, "isAvailable": true },
        { "supermarket": "Mercadão", "productName": "Produto e Marca Real 5L", "price": 27.50, "isAvailable": true },
        { "supermarket": "CenterBox", "productName": "Produto e Marca Real 5L", "price": 31.90, "isAvailable": true },
        { "supermarket": "Lagoa", "productName": "Produto e Marca Real 5L", "price": 34.00, "isAvailable": true },
        { "supermarket": "Frangolândia", "productName": "Produto e Marca Real 5L", "price": 33.90, "isAvailable": true },
        { "supermarket": "Guará", "productName": "Produto e Marca Real 5L", "price": 38.00, "isAvailable": true },
        { "supermarket": "São Luiz", "productName": "Produto e Marca Real 5L", "price": 42.00, "isAvailable": true }
      ]
    }
  ]
}`;

        try {
          console.log(`[Mercado Bulk] Cotando ${simplifiedItems.length} itens com Gemini...`);
          const response = await generateWithTimeout(
            ai,
            'gemini-3.1-flash-lite',
            {
              model: 'gemini-3.1-flash-lite',
              contents: prompt,
              config: { responseMimeType: 'application/json' },
            },
            12000
          );

          if (response && response.text) {
            const cleaned = response.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
            const parsed = JSON.parse(cleaned);
            if (parsed && Array.isArray(parsed.results) && parsed.results.length > 0) {
              console.log(`[Mercado Bulk] Cotação em lote concluída com sucesso para ${parsed.results.length} itens!`);
              return res.json({
                success: true,
                source: 'gemini-bulk',
                results: parsed.results,
              });
            }
          }
        } catch (bulkAiErr: any) {
          console.warn('[Mercado Bulk] Gemini falhou no lote, usando benchmark dinâmico:', bulkAiErr?.message || bulkAiErr);
        }
      }
    } catch (e) {
      console.warn('[Mercado Bulk] Erro geral:', e);
    }

    // Fallback dinâmico que respeita a especificação exata do usuário
    const results = items.map((it: any) => {
      const benchmark = generateMarketBenchmarkPrices(it.name || it.itemName, it.category);
      return {
        id: it.id,
        lowestPrice: benchmark.lowestPrice,
        cheapestSupermarket: benchmark.cheapestSupermarket,
        comparisons: benchmark.comparisons,
      };
    });

    return res.json({
      success: true,
      source: 'benchmark-dynamic',
      results,
    });
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
  const SCHEDULES_FILE = path.join(process.cwd(), 'telegram_schedules.json');

  function loadPersistedSchedules() {
    try {
      if (fs.existsSync(SCHEDULES_FILE)) {
        const raw = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
        const list: RegisteredTelegramSchedule[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((s) => telegramSchedules.set(s.userId, s));
          console.log(`[Telegram Scheduler] ${list.length} agendamento(s) carregados do disco.`);
        }
      }
    } catch (e) {
      console.warn('[Telegram Scheduler] Falha ao ler agendamentos do disco:', e);
    }
  }

  function savePersistedSchedules() {
    try {
      const list = Array.from(telegramSchedules.values());
      fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Telegram Scheduler] Falha ao salvar agendamentos no disco:', e);
    }
  }

  // Carrega agendamentos salvos na inicialização do servidor
  loadPersistedSchedules();

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

  // Helper para sanitizar token e chatId do Telegram
  function cleanTelegramToken(raw: any): string {
    if (!raw || typeof raw !== 'string') return '';
    let token = raw.trim();
    token = token.replace(/^["'\s]+|["'\s]+$/g, '');
    token = token.replace(/^https?:\/\/api\.telegram\.org\/bot/i, '');
    if (token.toLowerCase().startsWith('bot') && /^\d/.test(token.slice(3))) {
      token = token.slice(3);
    }
    token = token.replace(/\/+$/, '');
    return token.trim();
  }

  function cleanTelegramChatId(raw: any): string {
    if (!raw) return '';
    let id = String(raw).trim();
    id = id.replace(/^["'\s]+|["'\s]+$/g, '');
    return id;
  }

  // 1. Detectar Chat ID automaticamente via getUpdates
  app.post('/api/telegram/detect-chat-id', async (req, res) => {
    try {
      const { botToken } = req.body;
      const cleanToken = cleanTelegramToken(botToken);
      if (!cleanToken) {
        return res.status(400).json({
          success: false,
          error: 'Informe o Token do Bot gerado pelo @BotFather.',
        });
      }

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
      let updatesResponse = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=20`);
      let updatesData = await updatesResponse.json();

      // Se houver conflito de webhook pré-existente no bot, limpa o webhook
      if (!updatesData.ok && updatesData.description?.includes('webhook')) {
        try {
          await fetch(`https://api.telegram.org/bot${cleanToken}/deleteWebhook?drop_pending_updates=false`);
          updatesResponse = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=20`);
          updatesData = await updatesResponse.json();
        } catch (whErr) {
          console.warn('[Telegram] Falha ao resetar webhook:', whErr);
        }
      }

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
          needInteraction: true,
          error: `O bot @${botInfo.username} foi validado com sucesso, mas você ainda não enviou nenhuma mensagem para ele.\n\n👉 Abra o Telegram, pesquise por @${botInfo.username} (ou acesse https://t.me/${botInfo.username}), clique em "Começar" (ou envie "Oi") e depois clique em "Detectar Meu Chat ID" novamente!`,
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
          needInteraction: true,
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
      const cleanToken = cleanTelegramToken(botToken);
      const cleanId = cleanTelegramChatId(chatId);

      if (!cleanToken || !cleanId || !message) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros obrigatórios ausentes (Token, Chat ID ou Mensagem).',
        });
      }

      let response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanId,
          text: message,
          parse_mode: parseMode,
        }),
      });

      let data = await response.json();

      // Fallback: se falhar por formatação de markdown de caracteres especiais, reenvia sem parse_mode
      if (!data.ok && data.description?.includes("can't parse entities")) {
        console.warn('[Telegram] Erro de entidade Markdown, reenviando texto puro...');
        response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cleanId,
            text: message,
          }),
        });
        data = await response.json();
      }

      if (!data.ok) {
        let friendlyErr = data.description || 'Erro ao enviar mensagem';
        if (data.description?.includes('chat not found')) {
          friendlyErr = cleanId.startsWith('@')
            ? 'O Telegram não aceita @usuario para conversas privadas. Use o seu Chat ID numérico (ex: 123456789) detectado pelo botão "Detectar Meu Chat ID".'
            : 'Chat não encontrado. Você já iniciou a conversa com o bot no Telegram enviando uma mensagem ("Oi")?';
        } else if (data.description?.includes('bot was blocked')) {
          friendlyErr = 'O bot foi bloqueado pelo usuário no seu Telegram.';
        } else if (data.description?.includes('Unauthorized')) {
          friendlyErr = 'Token de bot inválido ou expirado. Verifique o token fornecido pelo @BotFather.';
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
      savePersistedSchedules();
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
            savePersistedSchedules();
            console.log(`[Telegram Scheduler] Mensagem enviada com sucesso para ${userId}`);
          } else {
            item.lastSentStatus = 'error';
            item.lastSentError = result.description || 'Erro retornado pela API do Telegram';
            savePersistedSchedules();
            console.error(`[Telegram Scheduler] Falha ao enviar para ${userId}:`, result.description);
          }
        } catch (dispatchErr: any) {
          item.lastSentStatus = 'error';
          item.lastSentError = dispatchErr.message;
          savePersistedSchedules();
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
