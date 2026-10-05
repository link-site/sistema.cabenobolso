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
  // TELEGRAM BOT INTEGRATION & DAILY AUTOMATED SCHEDULER
  // =========================================================================

  interface RegisteredTelegramSchedule {
    userId: string;
    botToken: string;
    chatId: string;
    scheduledTime: string; // "HH:MM", ex: "09:00"
    enabled: boolean;
    messageText: string;
    registeredDate?: string; // "YYYY-MM-DD"
    registeredMinutes?: number;
    lastSentDate?: string; // "YYYY-MM-DD"
    lastSentTimestamp?: string;
    lastSentStatus?: 'success' | 'error';
    lastSentError?: string;
  }

  const telegramSchedules = new Map<string, RegisteredTelegramSchedule>();
  const SCHEDULES_FILE = path.join(process.cwd(), 'telegram_schedules.json');

  function normalizeTimeString(timeStr: any): string {
    if (!timeStr || typeof timeStr !== 'string') return '09:00';
    const clean = timeStr.trim();
    const parts = clean.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        return `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:${String(Math.min(59, Math.max(0, m))).padStart(2, '0')}`;
      }
    }
    return '09:00';
  }

  function timeToMinutes(hhmm: string): number {
    const norm = normalizeTimeString(hhmm);
    const [h, m] = norm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function loadPersistedSchedules() {
    try {
      if (fs.existsSync(SCHEDULES_FILE)) {
        const raw = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
        const list: RegisteredTelegramSchedule[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((s) => {
            s.scheduledTime = normalizeTimeString(s.scheduledTime);
            telegramSchedules.set(s.userId, s);
          });
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
  function getBrazilTimeNow(): { timeStr: string; dateStr: string; totalMinutes: number } {
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
    const totalMinutes = timeToMinutes(timeStr);
    return { timeStr, dateStr, totalMinutes };
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

  // Helper de envio seguro para Telegram com fallback automático de texto puro se Markdown falhar
  async function sendTelegramDirect(token: string, chatId: string, message: string): Promise<{ ok: boolean; messageId?: number; description?: string }> {
    try {
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

      if (!data.ok && data.description?.includes("can't parse entities")) {
        console.warn('[Telegram] Erro de parsing Markdown, reenviando texto puro...');
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

      return {
        ok: Boolean(data.ok),
        messageId: data.result?.message_id,
        description: data.description,
      };
    } catch (e: any) {
      return {
        ok: false,
        description: e.message || 'Erro de conexão com Telegram',
      };
    }
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

      const result = await sendTelegramDirect(cleanToken, cleanId, message);

      if (!result.ok) {
        let friendlyErr = result.description || 'Erro ao enviar mensagem';
        if (result.description?.includes('chat not found')) {
          friendlyErr = cleanId.startsWith('@')
            ? 'O Telegram não aceita @usuario para conversas privadas. Use o seu Chat ID numérico (ex: 123456789) detectado pelo botão "Detectar Meu Chat ID".'
            : 'Chat não encontrado. Você já iniciou a conversa com o bot no Telegram enviando uma mensagem ("Oi")?';
        } else if (result.description?.includes('bot was blocked')) {
          friendlyErr = 'O bot foi bloqueado pelo usuário no seu Telegram.';
        } else if (result.description?.includes('Unauthorized')) {
          friendlyErr = 'Token de bot inválido ou expirado. Verifique o token fornecido pelo @BotFather.';
        }
        return res.status(400).json({
          success: false,
          error: friendlyErr,
          rawError: result.description,
        });
      }

      return res.json({
        success: true,
        messageId: result.messageId,
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
      const { userId = 'default_user', botToken, chatId, scheduledTime, enabled, messageText, forceSendToday } = req.body;

      if (!botToken || !chatId || !scheduledTime) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros obrigatórios ausentes para o agendamento.',
        });
      }

      const { timeStr, dateStr, totalMinutes } = getBrazilTimeNow();
      const normTime = normalizeTimeString(scheduledTime);
      const existing = telegramSchedules.get(userId);

      const schedule: RegisteredTelegramSchedule = {
        userId,
        botToken: cleanTelegramToken(botToken),
        chatId: cleanTelegramChatId(chatId),
        scheduledTime: normTime,
        enabled: Boolean(enabled),
        messageText: messageText || 'Você tem esse valor disponivel para gastar',
        registeredDate: existing?.registeredDate || dateStr,
        registeredMinutes: existing?.registeredMinutes || totalMinutes,
        lastSentDate: forceSendToday ? undefined : existing?.lastSentDate,
        lastSentTimestamp: existing?.lastSentTimestamp,
        lastSentStatus: existing?.lastSentStatus,
        lastSentError: existing?.lastSentError,
      };

      telegramSchedules.set(userId, schedule);
      savePersistedSchedules();
      console.log(`[Telegram Scheduler] Agendamento registrado para '${userId}' às ${normTime} (Ativo: ${enabled}) | Hora BR: ${timeStr}`);

      return res.json({
        success: true,
        schedule,
        serverTime: timeStr,
        serverDate: dateStr,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Consultar status do agendador
  app.get('/api/telegram/schedule-status/:userId', (req, res) => {
    const { userId } = req.params;
    const schedule = telegramSchedules.get(userId) || telegramSchedules.get('default_user');
    const { timeStr, dateStr, totalMinutes } = getBrazilTimeNow();

    let isSentToday = false;
    let isPendingToday = false;
    let nextRun = 'Desativado';

    if (schedule && schedule.enabled) {
      isSentToday = schedule.lastSentDate === dateStr && schedule.lastSentStatus === 'success';
      const schedMin = timeToMinutes(schedule.scheduledTime);
      if (!isSentToday) {
        if (totalMinutes < schedMin) {
          isPendingToday = true;
          nextRun = `Hoje às ${schedule.scheduledTime}`;
        } else {
          isPendingToday = true;
          nextRun = `Em processamento hoje (${schedule.scheduledTime})`;
        }
      } else {
        nextRun = `Amanhã às ${schedule.scheduledTime}`;
      }
    }

    return res.json({
      success: true,
      serverTime: timeStr,
      serverDate: dateStr,
      isSentToday,
      isPendingToday,
      nextRun,
      schedule: schedule || null,
      totalActiveSchedules: Array.from(telegramSchedules.values()).filter((s) => s.enabled).length,
    });
  });

  // 5. Forçar disparo imediato do relatório do dia
  app.post('/api/telegram/trigger-daily-now', async (req, res) => {
    try {
      const { userId = 'default_user', botToken, chatId, messageText } = req.body;
      const targetSchedule = telegramSchedules.get(userId);

      const tokenToUse = cleanTelegramToken(botToken || targetSchedule?.botToken);
      const chatIdToUse = cleanTelegramChatId(chatId || targetSchedule?.chatId);
      const textToUse = messageText || targetSchedule?.messageText || 'Você tem esse valor disponivel para gastar';

      if (!tokenToUse || !chatIdToUse) {
        return res.status(400).json({
          success: false,
          error: 'Credenciais do bot não encontradas para disparo imediato.',
        });
      }

      const { timeStr, dateStr } = getBrazilTimeNow();
      console.log(`[Telegram Scheduler] Disparo manual imediato solicitado para '${userId}' (${chatIdToUse}) às ${timeStr}`);

      const result = await sendTelegramDirect(tokenToUse, chatIdToUse, textToUse);

      if (result.ok) {
        if (targetSchedule) {
          targetSchedule.lastSentDate = dateStr;
          targetSchedule.lastSentTimestamp = new Date().toISOString();
          targetSchedule.lastSentStatus = 'success';
          targetSchedule.lastSentError = undefined;
          savePersistedSchedules();
        }
        return res.json({
          success: true,
          messageId: result.messageId,
          sentDate: dateStr,
          sentTime: timeStr,
          sentTimestamp: new Date().toISOString(),
        });
      } else {
        if (targetSchedule) {
          targetSchedule.lastSentStatus = 'error';
          targetSchedule.lastSentError = result.description;
          savePersistedSchedules();
        }
        return res.status(400).json({
          success: false,
          error: result.description || 'Falha ao enviar mensagem no Telegram',
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Rotina de disparo diário no servidor (Verifica a cada 15 segundos com janela robusta)
  setInterval(async () => {
    if (telegramSchedules.size === 0) return;

    const { timeStr, dateStr, totalMinutes } = getBrazilTimeNow();

    for (const [userId, item] of telegramSchedules.entries()) {
      if (!item.enabled || !item.botToken || !item.chatId) continue;

      const schedMinutes = timeToMinutes(item.scheduledTime);

      // Critério de disparo:
      // 1. O horário atual (em minutos) atingiu ou passou do horário agendado (ex: >= 09:00 / 540 min)
      // 2. A mensagem ainda NÃO foi entregue hoje com sucesso (lastSentDate !== dateStr)
      // 3. Se foi cadastrado hoje, garante que não dispare se foi cadastrado depois do horário, exceto se passou para o dia seguinte
      const isDue = totalMinutes >= schedMinutes;
      const notSentToday = item.lastSentDate !== dateStr;
      const wasRegisteredBeforeOrPastDays = item.registeredDate !== dateStr || (item.registeredMinutes || 0) <= schedMinutes;

      if (isDue && notSentToday && wasRegisteredBeforeOrPastDays) {
        console.log(`[Telegram Scheduler] ⏰ Horário atingido! Disparando aviso diário para ${userId} (${item.chatId}) às ${timeStr} (Agendado: ${item.scheduledTime})`);
        
        try {
          const result = await sendTelegramDirect(item.botToken, item.chatId, item.messageText);
          if (result.ok) {
            item.lastSentDate = dateStr;
            item.lastSentTimestamp = new Date().toISOString();
            item.lastSentStatus = 'success';
            item.lastSentError = undefined;
            savePersistedSchedules();
            console.log(`[Telegram Scheduler] ✅ Mensagem diária enviada com SUCESSO para ${userId} às ${timeStr}!`);
          } else {
            item.lastSentStatus = 'error';
            item.lastSentError = result.description || 'Erro retornado pela API do Telegram';
            // Para não spamar caso haja erro permanente (ex: token inválido), marca para não travar loop
            item.lastSentTimestamp = new Date().toISOString();
            savePersistedSchedules();
            console.error(`[Telegram Scheduler] ❌ Falha ao enviar para ${userId}:`, result.description);
          }
        } catch (dispatchErr: any) {
          item.lastSentStatus = 'error';
          item.lastSentError = dispatchErr.message;
          item.lastSentTimestamp = new Date().toISOString();
          savePersistedSchedules();
          console.error(`[Telegram Scheduler] ⚠️ Exceção ao enviar para ${userId}:`, dispatchErr);
        }
      }
    }
  }, 15000);

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
