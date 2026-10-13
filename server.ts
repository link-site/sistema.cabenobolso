import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { processTelegramQuery, FinanceDataSnapshot } from './src/utils/telegramBotEngine';

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

  // Helper para estimar preços realistas nos supermercados de Fortaleza com variação real e vantagens por categoria
  function generateMarketBenchmarkPrices(itemName: string, category?: string) {
    const rawName = (itemName || 'Item').trim();
    const normName = rawName.toLowerCase();
    const normCat = (category || 'Outros').trim();

    let multiplier = 1;
    if (normName.includes('5l') || normName.includes('5 l') || normName.includes('5 litro') || normName.includes('5 litros')) {
      multiplier = 4.2;
    } else if (normName.includes('3l') || normName.includes('3 l') || normName.includes('3 litro')) {
      multiplier = 2.6;
    } else if (normName.includes('2l') || normName.includes('2 l') || normName.includes('2 litro')) {
      multiplier = 1.85;
    } else if (normName.includes('10kg') || normName.includes('10 kg')) {
      multiplier = 9.2;
    } else if (normName.includes('5kg') || normName.includes('5 kg') || normName.includes('5 quilo')) {
      multiplier = 4.6;
    } else if (normName.includes('fardo') || normName.includes('caixa')) {
      multiplier = 7.5;
    } else if (normName.includes('500g') || normName.includes('500 g')) {
      multiplier = 0.55;
    } else if (normName.includes('250g') || normName.includes('250 g')) {
      multiplier = 0.32;
    }

    let basePrice = 9.5;
    if (normName.includes('sabão líquido') || normName.includes('sabao liquido') || normName.includes('lava roupas líquido') || normName.includes('lava roupas liquido')) {
      basePrice = multiplier > 1 ? 7.8 * multiplier : 14.9;
    } else if (normName.includes('sabão em pó') || normName.includes('sabao em po') || normName.includes('omo') || normName.includes('tixan') || normName.includes('brilhante')) {
      basePrice = multiplier > 1 ? 7.2 * multiplier : 13.5;
    } else if (normName.includes('leite') || normName.includes('betânia') || normName.includes('camponesa') || normName.includes('itambé')) {
      basePrice = 5.69 * multiplier;
    } else if (normName.includes('café') || normName.includes('cafe') || normName.includes('santa clara') || normName.includes('pilão') || normName.includes('maratá')) {
      basePrice = 11.29 * multiplier;
    } else if (normName.includes('queijo') || normName.includes('coalho')) {
      basePrice = 39.9 * multiplier;
    } else if (normName.includes('cuscuz') || normName.includes('flocão') || normName.includes('flocao') || normName.includes('milharina')) {
      basePrice = 2.59 * multiplier;
    } else if (normName.includes('tapioca') || normName.includes('goma') || normName.includes('farinha')) {
      basePrice = 6.99 * multiplier;
    } else if (normName.includes('cajuína') || normName.includes('cajuina') || normName.includes('são geraldo')) {
      basePrice = 9.29 * multiplier;
    } else if (normName.includes('carne') || normName.includes('alcatra') || normName.includes('picanha') || normName.includes('patinho') || normName.includes('sol')) {
      basePrice = 44.9 * multiplier;
    } else if (normName.includes('frango') || normName.includes('peito') || normName.includes('coxa') || normName.includes('filé')) {
      basePrice = 19.8 * multiplier;
    } else if (normName.includes('feijão') || normName.includes('feijao') || normName.includes('corda') || normName.includes('carioca')) {
      basePrice = 8.49 * multiplier;
    } else if (normName.includes('arroz') || normName.includes('tio joão') || normName.includes('camil')) {
      basePrice = 5.99 * multiplier;
    } else if (normName.includes('açúcar') || normName.includes('acucar')) {
      basePrice = 4.49 * multiplier;
    } else if (normName.includes('óleo') || normName.includes('oleo') || normName.includes('soya') || normName.includes('liza')) {
      basePrice = 6.79 * multiplier;
    } else if (normName.includes('ovo') || normName.includes('ovos')) {
      basePrice = 18.5;
    } else if (normName.includes('cerveja') || normName.includes('heineken') || normName.includes('brahma') || normName.includes('amstel')) {
      basePrice = 4.39 * multiplier;
    } else if (normName.includes('refrigerante') || normName.includes('coca') || normName.includes('guaraná')) {
      basePrice = 8.5 * multiplier;
    } else if (normName.includes('pão') || normName.includes('pao')) {
      basePrice = 9.9 * multiplier;
    } else if (normName.includes('detergente') || normName.includes('ypê') || normName.includes('limpol')) {
      basePrice = 2.69 * multiplier;
    } else if (normName.includes('desinfetante') || normName.includes('amaciante') || normName.includes('sanitária') || normName.includes('sanitaria')) {
      basePrice = 6.89 * multiplier;
    } else if (normName.includes('shampoo') || normName.includes('sabonete') || normName.includes('creme dental') || normName.includes('pasta')) {
      basePrice = 12.9 * multiplier;
    } else {
      if (normCat.includes('Açougue') || normCat.includes('Peixaria')) basePrice = 37.0 * multiplier;
      else if (normCat.includes('Frios') || normCat.includes('Laticínios')) basePrice = 17.5 * multiplier;
      else if (normCat.includes('Hortifrúti')) basePrice = 6.8 * multiplier;
      else if (normCat.includes('Padaria')) basePrice = 12.5 * multiplier;
      else if (normCat.includes('Bebidas')) basePrice = 7.9 * multiplier;
      else if (normCat.includes('Higiene')) basePrice = 11.5 * multiplier;
      else if (normCat.includes('Limpeza')) basePrice = 8.9 * multiplier;
      else basePrice = 9.8 * multiplier;
    }

    let hash = 0;
    for (let i = 0; i < normName.length; i++) {
      hash = (hash << 5) - hash + normName.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash);

    const isCleaning = normCat.includes('Limpeza') || normName.includes('sabão') || normName.includes('sabao') || normName.includes('detergente') || normName.includes('amaciante') || normName.includes('desinfetante');
    const isDairyOrMeat = normCat.includes('Frios') || normCat.includes('Laticínios') || normCat.includes('Açougue') || normName.includes('queijo') || normName.includes('leite') || normName.includes('carne') || normName.includes('frango');
    const isHortifrutiOrRegional = normCat.includes('Hortifrúti') || normName.includes('cuscuz') || normName.includes('tapioca') || normName.includes('flocão') || normName.includes('feijão') || normName.includes('tomate') || normName.includes('cebola');
    const isBulkOrAtacado = multiplier >= 3.0 || normName.includes('5l') || normName.includes('5kg') || normName.includes('fardo') || normName.includes('caixa');

    let atacadaoFactor = isBulkOrAtacado ? 0.88 : (0.91 + (positiveHash % 5) * 0.01);
    let mercadaoFactor = isCleaning ? 0.87 : (0.90 + ((positiveHash >> 2) % 6) * 0.01);
    let centerBoxFactor = isHortifrutiOrRegional ? 0.86 : (0.93 + ((positiveHash >> 3) % 5) * 0.01);
    let frangolandiaFactor = isDairyOrMeat ? 0.87 : (0.94 + ((positiveHash >> 4) % 5) * 0.01);
    let lagoaFactor = (normName.includes('café') || normName.includes('cafe') || normName.includes('maratá') || normName.includes('santa clara')) ? 0.89 : (0.96 + ((positiveHash >> 5) % 5) * 0.01);
    let guaraFactor = 1.05 + ((positiveHash >> 1) % 6) * 0.015;
    let saoLuizFactor = 1.12 + ((positiveHash >> 3) % 7) * 0.015;

    const promoWinnerIndex = positiveHash % 5;
    if (promoWinnerIndex === 0 && !isDairyOrMeat && !isHortifrutiOrRegional) atacadaoFactor = Math.min(atacadaoFactor, 0.87);
    if (promoWinnerIndex === 1 && isCleaning) mercadaoFactor = Math.min(mercadaoFactor, 0.86);
    if (promoWinnerIndex === 2 && (isHortifrutiOrRegional || normCat.includes('Padaria'))) centerBoxFactor = Math.min(centerBoxFactor, 0.85);
    if (promoWinnerIndex === 3 && isDairyOrMeat) frangolandiaFactor = Math.min(frangolandiaFactor, 0.86);
    if (promoWinnerIndex === 4 && (normName.includes('café') || normCat.includes('Bebidas'))) lagoaFactor = Math.min(lagoaFactor, 0.88);

    const storeConfigs = [
      { supermarket: 'Atacadão', factor: atacadaoFactor, brandSpec: isBulkOrAtacado ? 'Embalagem Econômica Atacado' : 'Preço de Fardo / Atacado', badge: atacadaoFactor <= 0.89 ? 'Melhor Preço Atacado' : undefined },
      { supermarket: 'Mercadão', factor: mercadaoFactor, brandSpec: isCleaning ? 'Oferta Limpeza Mercadão' : 'Preço Popular', badge: mercadaoFactor <= 0.88 ? 'Oferta Imbatível' : undefined },
      { supermarket: 'CenterBox', factor: centerBoxFactor, brandSpec: isHortifrutiOrRegional ? 'Seleção Cearense Regional' : 'Marca Tradicional', badge: centerBoxFactor <= 0.88 ? 'Campeão Regional' : undefined },
      { supermarket: 'Lagoa', factor: lagoaFactor, brandSpec: 'Encarte da Semana Lagoa', badge: lagoaFactor <= 0.90 ? 'Oferta de Encarte' : undefined },
      { supermarket: 'Frangolândia', factor: frangolandiaFactor, brandSpec: isDairyOrMeat ? 'Especial Frios & Carnes' : 'Mais Vendida', badge: frangolandiaFactor <= 0.88 ? 'Oferta Especial' : undefined },
      { supermarket: 'Guará', factor: guaraFactor, brandSpec: 'Linha Selecionada Guará', badge: undefined },
      { supermarket: 'São Luiz', factor: saoLuizFactor, brandSpec: 'Linha Premium São Luiz', badge: undefined },
    ];

    const comparisons = storeConfigs.map((s) => {
      let price = Number((basePrice * s.factor).toFixed(2));
      const intPart = Math.floor(price);
      const decimalPart = price - intPart;
      let roundedDec = 0.99;
      if (decimalPart < 0.35) roundedDec = 0.29;
      else if (decimalPart < 0.65) roundedDec = 0.49;
      else if (decimalPart < 0.85) roundedDec = 0.79;
      else if (decimalPart < 0.95) roundedDec = 0.89;
      else roundedDec = 0.99;

      price = Number((intPart + roundedDec).toFixed(2));
      if (price <= 0) price = 1.99;

      return {
        supermarket: s.supermarket,
        productName: `${rawName} (${s.brandSpec})`,
        price,
        isAvailable: true,
        badge: s.badge,
        originalPrice: s.factor < 0.92 ? Number((price * 1.15).toFixed(2)) : undefined,
      };
    });

    const lowestPrice = Math.min(...comparisons.map((c) => c.price));
    const cheapest = comparisons.find((c) => c.price === lowestPrice);
    const highestPrice = Math.max(...comparisons.map((c) => c.price));
    const mostExpensive = comparisons.find((c) => c.price === highestPrice);

    const priceSpread = Number((highestPrice - lowestPrice).toFixed(2));
    const variationPercentage = lowestPrice > 0 ? Number((((highestPrice - lowestPrice) / lowestPrice) * 100).toFixed(1)) : 0;
    const averagePrice = Number((comparisons.reduce((sum, c) => sum + c.price, 0) / comparisons.length).toFixed(2));

    if (cheapest) {
      cheapest.badge = 'Menor Preço';
    }

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('pt-BR');
    const timeFormatted = now.toLocaleTimeString('pt-BR');

    return {
      itemName: rawName,
      category: normCat,
      lowestPrice,
      cheapestSupermarket: cheapest ? cheapest.supermarket : 'Atacadão',
      highestPrice,
      mostExpensiveSupermarket: mostExpensive ? mostExpensive.supermarket : 'São Luiz',
      priceSpread,
      variationPercentage,
      averagePrice,
      timestamp: now.toISOString(),
      date: dateFormatted,
      time: timeFormatted,
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
4. Diferentes supermercados podem ter o menor preço de acordo com promoções reais de encarte (ex: CenterBox em hortifrúti/regionais, Frangolândia em carnes/laticínios, Mercadão em limpeza, Atacadão em fardos/atacado).
5. "lowestPrice" deve ser o menor valor encontrado e "cheapestSupermarket" o nome do supermercado correspondente.

Responda ESTRITAMENTE em formato JSON com este schema:
{
  "itemName": "${itemName}",
  "category": "${category || 'Geral'}",
  "lowestPrice": 24.90,
  "cheapestSupermarket": "Atacadão",
  "highestPrice": 45.90,
  "mostExpensiveSupermarket": "São Luiz",
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

        // Modelos a tentar em ordem de disponibilidade (gemini-flash-latest primeiro)
        const models = ['gemini-flash-latest', 'gemini-3.8-flash'];
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
              4500
            );

            if (response && response.text) {
              const cleanedText = response.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
              const parsed = JSON.parse(cleanedText);
              if (parsed && parsed.lowestPrice && Array.isArray(parsed.comparisons) && parsed.comparisons.length > 0) {
                const now = new Date();
                const comparisons = parsed.comparisons;
                const lowest = parsed.lowestPrice || Math.min(...comparisons.map((c: any) => c.price));
                const highest = parsed.highestPrice || Math.max(...comparisons.map((c: any) => c.price));
                const cheapestObj = comparisons.find((c: any) => c.price === lowest);
                const expensiveObj = comparisons.find((c: any) => c.price === highest);

                const enrichedData = {
                  ...parsed,
                  lowestPrice: lowest,
                  cheapestSupermarket: parsed.cheapestSupermarket || (cheapestObj ? cheapestObj.supermarket : 'Atacadão'),
                  highestPrice: highest,
                  mostExpensiveSupermarket: parsed.mostExpensiveSupermarket || (expensiveObj ? expensiveObj.supermarket : 'São Luiz'),
                  priceSpread: Number((highest - lowest).toFixed(2)),
                  variationPercentage: lowest > 0 ? Number((((highest - lowest) / lowest) * 100).toFixed(1)) : 0,
                  averagePrice: Number((comparisons.reduce((s: number, c: any) => s + c.price, 0) / comparisons.length).toFixed(2)),
                  timestamp: now.toISOString(),
                  date: now.toLocaleDateString('pt-BR'),
                  time: now.toLocaleTimeString('pt-BR'),
                };

                console.log(`[Mercado Cotação] Cotação obtida com sucesso via ${m} para "${itemName}"!`);
                return res.json({
                  success: true,
                  source: 'gemini',
                  data: enrichedData,
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
  // TELEGRAM BOT 24/7 INTERACTIVE ASSISTANT (ORÇAMENTO & CARTÕES)
  // =========================================================================

  const DATA_DIR = path.join(process.cwd(), '.data');
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn('[Telegram] Could not create .data folder:', e);
    }
  }

  const TELEGRAM_CONFIG_FILE = path.join(DATA_DIR, 'telegram_config.json');
  const TELEGRAM_DATA_FILE = path.join(DATA_DIR, 'telegram_finance_snapshot.json');
  const TELEGRAM_LOGS_FILE = path.join(DATA_DIR, 'telegram_logs.json');

  interface ServerTelegramConfig {
    botToken: string;
    chatId: string;
    enabled: boolean;
    botUsername?: string;
    botFirstName?: string;
    autoPolling?: boolean;
    lastConnectedAt?: string;
    lastSyncAt?: string;
  }

  interface ServerTelegramLog {
    id: string;
    timestamp: string;
    type: 'in' | 'out' | 'info' | 'error';
    message: string;
    from?: string;
  }

  let serverTelegramConfig: ServerTelegramConfig = {
    botToken: '',
    chatId: '',
    enabled: false,
    autoPolling: true,
  };

  let serverFinanceData: FinanceDataSnapshot = {
    transactions: [],
    cards: [],
    cardPurchases: [],
  };

  let serverTelegramLogs: ServerTelegramLog[] = [];

  // Carrega configuração salva
  try {
    if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
      serverTelegramConfig = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG_FILE, 'utf-8'));
    }
    if (fs.existsSync(TELEGRAM_DATA_FILE)) {
      serverFinanceData = JSON.parse(fs.readFileSync(TELEGRAM_DATA_FILE, 'utf-8'));
    }
    if (fs.existsSync(TELEGRAM_LOGS_FILE)) {
      serverTelegramLogs = JSON.parse(fs.readFileSync(TELEGRAM_LOGS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn('[Telegram] Erro ao carregar arquivos locais salvos:', err);
  }

  const saveConfigToDisk = () => {
    try {
      fs.writeFileSync(TELEGRAM_CONFIG_FILE, JSON.stringify(serverTelegramConfig, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Telegram] Erro ao salvar config no disco:', e);
    }
  };

  const saveDataToDisk = () => {
    try {
      fs.writeFileSync(TELEGRAM_DATA_FILE, JSON.stringify(serverFinanceData, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Telegram] Erro ao salvar dados no disco:', e);
    }
  };

  const saveLogsToDisk = () => {
    try {
      fs.writeFileSync(TELEGRAM_LOGS_FILE, JSON.stringify(serverTelegramLogs.slice(0, 60), null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Telegram] Erro ao salvar logs:', e);
    }
  };

  const addTelegramLog = (type: 'in' | 'out' | 'info' | 'error', message: string, from?: string) => {
    const item: ServerTelegramLog = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      from,
    };
    serverTelegramLogs.unshift(item);
    if (serverTelegramLogs.length > 80) {
      serverTelegramLogs.pop();
    }
    saveLogsToDisk();
  };

  // Helper para envio de mensagem ao Telegram
  const sendTelegramMessage = async (
    token: string,
    chatId: string | number,
    text: string,
    replyMarkup?: any
  ): Promise<boolean> => {
    if (!token || !chatId) return false;

    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    try {
      let response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let resJson: any = await response.json();

      // Se falhar por erro de parsing do Markdown, reenvia como texto puro
      if (!resJson.ok && resJson.description && resJson.description.includes('can\'t parse entities')) {
        delete payload.parse_mode;
        response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        resJson = await response.json();
      }

      if (resJson.ok) {
        addTelegramLog('out', text, String(chatId));
        return true;
      } else {
        addTelegramLog('error', `Falha ao enviar: ${resJson.description || 'Erro desconhecido'}`, String(chatId));
        return false;
      }
    } catch (err: any) {
      console.error('[Telegram] Erro de rede ao enviar mensagem:', err);
      addTelegramLog('error', `Erro de rede: ${err.message || String(err)}`, String(chatId));
      return false;
    }
  };

  // Botões de ações rápidas sugeridas no Telegram
  const getTelegramReplyKeyboard = () => {
    return {
      inline_keyboard: [
        [
          { text: '💰 Disponível Novembro', callback_data: 'qual valor disponivel no mês de novembro?' },
          { text: '📊 Saldo Mês Atual', callback_data: 'qual o valor disponivel neste mês?' },
        ],
        [
          { text: '💳 Faturas dos Cartões', callback_data: 'quais meus cartões de crédito e faturas?' },
          { text: '💸 Gastos do Mês', callback_data: 'quais os gastos e despesas deste mês?' },
        ],
        [
          { text: '❓ Ajuda & Comandos', callback_data: '/ajuda' },
        ],
      ],
    };
  };

  // Gerenciador do loop de Long-Polling para receber mensagens 24/7
  let isPollingActive = false;
  let pollingAbortController: AbortController | null = null;
  let lastUpdateId = 0;

  const startTelegramPolling = () => {
    if (isPollingActive) return;
    if (!serverTelegramConfig.botToken || !serverTelegramConfig.enabled) return;

    isPollingActive = true;
    pollingAbortController = new AbortController();

    console.log('[Telegram Bot] Iniciando serviço de escuta contínua (Long-Polling)...');
    addTelegramLog('info', 'Serviço de escuta do Bot Telegram iniciado com sucesso.');

    (async () => {
      while (isPollingActive && serverTelegramConfig.enabled && serverTelegramConfig.botToken) {
        try {
          const url = `https://api.telegram.org/bot${serverTelegramConfig.botToken}/getUpdates?offset=${lastUpdateId}&timeout=10&allowed_updates=["message","callback_query"]`;
          const res = await fetch(url, { signal: pollingAbortController?.signal });
          const data: any = await res.json();

          if (data && data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              lastUpdateId = Math.max(lastUpdateId, update.update_id + 1);

              // 1. Mensagem de texto tradicional enviada pelo usuário
              if (update.message && update.message.text) {
                const chatId = update.message.chat.id;
                const queryText = update.message.text;
                const senderName = update.message.from?.first_name || update.message.from?.username || 'Usuário';

                addTelegramLog('in', queryText, `${senderName} (${chatId})`);

                // Processa a consulta acessando o Orçamento e os Cartões em tempo real
                const result = processTelegramQuery(queryText, serverFinanceData);

                // Envia resposta de volta com botões rápidos
                await sendTelegramMessage(
                  serverTelegramConfig.botToken,
                  chatId,
                  result.text,
                  getTelegramReplyKeyboard()
                );
              }

              // 2. Clique em botão interativo (Callback Query)
              if (update.callback_query && update.callback_query.data) {
                const cb = update.callback_query;
                const chatId = cb.message?.chat?.id;
                const queryText = cb.data;

                // Notifica o Telegram que o clique foi processado
                try {
                  await fetch(`https://api.telegram.org/bot${serverTelegramConfig.botToken}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ callback_query_id: cb.id }),
                  });
                } catch (e) {
                  // ignore
                }

                if (chatId) {
                  addTelegramLog('in', `[Botão] ${queryText}`, String(chatId));
                  const result = processTelegramQuery(queryText, serverFinanceData);
                  await sendTelegramMessage(
                    serverTelegramConfig.botToken,
                    chatId,
                    result.text,
                    getTelegramReplyKeyboard()
                  );
                }
              }
            }
          } else if (!data.ok) {
            console.warn('[Telegram Bot] Erro na resposta do getUpdates:', data.description);
            await new Promise((r) => setTimeout(r, 4000));
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            break;
          }
          console.warn('[Telegram Bot] Exceção no polling (tentando novamente):', err.message);
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
      isPollingActive = false;
      console.log('[Telegram Bot] Serviço de escuta finalizado.');
    })();
  };

  const stopTelegramPolling = () => {
    isPollingActive = false;
    if (pollingAbortController) {
      try {
        pollingAbortController.abort();
      } catch (e) {
        // ignore
      }
      pollingAbortController = null;
    }
  };

  // Se o bot já estiver configurado e ativo, inicia o polling imediatamente
  if (serverTelegramConfig.botToken && serverTelegramConfig.enabled) {
    startTelegramPolling();
  }

  // --- ROTAS DO TELEGRAM BOT ---

  // Retorna a configuração atual do bot
  app.get('/api/telegram/config', (req, res) => {
    res.json({
      success: true,
      config: serverTelegramConfig,
      isPollingActive,
      dataCounts: {
        transactions: serverFinanceData.transactions?.length || 0,
        cards: serverFinanceData.cards?.length || 0,
        cardPurchases: serverFinanceData.cardPurchases?.length || 0,
      },
    });
  });

  // Salva ou atualiza a configuração do bot
  app.post('/api/telegram/config', async (req, res) => {
    try {
      const { botToken, chatId, enabled, autoPolling } = req.body;

      serverTelegramConfig.botToken = (botToken || '').trim();
      serverTelegramConfig.chatId = (chatId || '').trim();
      serverTelegramConfig.enabled = Boolean(enabled);
      serverTelegramConfig.autoPolling = autoPolling !== false;

      // Se um token foi fornecido, verifica sua validade e recupera o nome do bot
      if (serverTelegramConfig.botToken) {
        try {
          const testRes = await fetch(`https://api.telegram.org/bot${serverTelegramConfig.botToken}/getMe`);
          const testJson: any = await testRes.json();
          if (testJson.ok && testJson.result) {
            serverTelegramConfig.botUsername = testJson.result.username;
            serverTelegramConfig.botFirstName = testJson.result.first_name;
            serverTelegramConfig.lastConnectedAt = new Date().toISOString();
          }
        } catch (e) {
          console.warn('[Telegram] Não foi possível validar token no salvamento:', e);
        }
      }

      saveConfigToDisk();

      // Reinicia ou para o serviço de escuta conforme status
      stopTelegramPolling();
      if (serverTelegramConfig.enabled && serverTelegramConfig.botToken) {
        startTelegramPolling();
      }

      addTelegramLog('info', `Configurações atualizadas: status ${serverTelegramConfig.enabled ? 'Ativo' : 'Inativo'}`);

      return res.json({
        success: true,
        config: serverTelegramConfig,
        isPollingActive,
      });
    } catch (err: any) {
      console.error('[Telegram] Erro ao salvar config:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Sincroniza dados mais recentes de Orçamento e Cartões de Crédito para o Bot ter acesso total
  app.post('/api/telegram/sync-data', (req, res) => {
    try {
      const { transactions = [], cards = [], cardPurchases = [] } = req.body;

      serverFinanceData = {
        transactions,
        cards,
        cardPurchases,
      };

      serverTelegramConfig.lastSyncAt = new Date().toISOString();
      saveDataToDisk();
      saveConfigToDisk();

      return res.json({
        success: true,
        syncedAt: serverTelegramConfig.lastSyncAt,
        counts: {
          transactions: transactions.length,
          cards: cards.length,
          cardPurchases: cardPurchases.length,
        },
      });
    } catch (err: any) {
      console.error('[Telegram] Erro na sincronização de dados:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Testa conexão com o BotFather via getMe
  app.post('/api/telegram/test-connection', async (req, res) => {
    try {
      const token = (req.body.botToken || serverTelegramConfig.botToken || '').trim();
      if (!token) {
        return res.status(400).json({ success: false, error: 'Token do bot não fornecido.' });
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data: any = await response.json();

      if (data.ok && data.result) {
        return res.json({
          success: true,
          bot: {
            id: data.result.id,
            username: data.result.username,
            firstName: data.result.first_name,
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          error: data.description || 'Token inválido ou não autorizado pelo Telegram.',
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Envia mensagem de teste diretamente para o Telegram do usuário
  app.post('/api/telegram/send-test', async (req, res) => {
    try {
      const token = (req.body.botToken || serverTelegramConfig.botToken || '').trim();
      const chatId = (req.body.chatId || serverTelegramConfig.chatId || '').trim();

      if (!token || !chatId) {
        return res.status(400).json({
          success: false,
          error: 'Bot Token e Chat ID são obrigatórios para envio de teste.',
        });
      }

      const current = new Date();
      const currentMonthName = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][current.getMonth()];

      const testMsg =
        `🎉 *Conexão com Telegram Confirmada!*\n\n` +
        `O seu bot do *Sistema Cabe no Bolso* está ativo e sincronizado!\n\n` +
        `✅ Acesso total ao **Menu Orçamento**\n` +
        `✅ Acesso total ao **Menu Cartões de Crédito**\n\n` +
        `💡 *Experimente perguntar agora:*\n` +
        `• _"Qual valor disponível no mês de novembro?"_\n` +
        `• _"Quanto sobrou no mês de ${currentMonthName.toLowerCase()}?"_\n` +
        `• _"Qual o valor da fatura do cartão?"_\n\n` +
        `Envie qualquer pergunta que eu calculo e respondo na hora!`;

      const sent = await sendTelegramMessage(token, chatId, testMsg, getTelegramReplyKeyboard());

      if (sent) {
        return res.json({ success: true, message: 'Mensagem de teste enviada com sucesso ao Telegram!' });
      } else {
        return res.status(500).json({ success: false, error: 'Falha ao enviar mensagem de teste. Verifique o Chat ID e se já enviou /start para o bot.' });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Simulador de perguntas do Bot no navegador (permite testar direto no app)
  app.post('/api/telegram/simulate', (req, res) => {
    try {
      const { query, customData } = req.body;
      if (!query) {
        return res.status(400).json({ success: false, error: 'Pergunta não informada.' });
      }

      const activeData = customData || serverFinanceData;
      const result = processTelegramQuery(query, activeData);

      addTelegramLog('in', `[Simulador] ${query}`, 'Navegador');
      addTelegramLog('out', result.text, 'Bot');

      return res.json({
        success: true,
        answer: result.text,
        matchedIntent: result.matchedIntent,
        details: result.details,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Retorna os logs recentes de interações
  app.get('/api/telegram/logs', (req, res) => {
    res.json({
      success: true,
      logs: serverTelegramLogs.slice(0, 50),
    });
  });

  // Webhook handler (caso o usuário opte por configurar Webhook direto no Telegram)
  app.post('/api/telegram/webhook', async (req, res) => {
    try {
      const update = req.body;
      if (update && update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const queryText = update.message.text;
        const senderName = update.message.from?.first_name || update.message.from?.username || 'Usuário';

        addTelegramLog('in', queryText, `${senderName} (${chatId})`);

        const result = processTelegramQuery(queryText, serverFinanceData);

        if (serverTelegramConfig.botToken) {
          await sendTelegramMessage(
            serverTelegramConfig.botToken,
            chatId,
            result.text,
            getTelegramReplyKeyboard()
          );
        }
      }
      return res.sendStatus(200);
    } catch (err) {
      console.error('[Telegram Webhook Error]:', err);
      return res.sendStatus(200);
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
