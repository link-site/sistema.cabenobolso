import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(customKey?: string): GoogleGenAI {
  const key = customKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY não configurada. Adicione a variável GEMINI_API_KEY no painel da Vercel (Project Settings > Environment Variables).'
    );
  }
  if (customKey) {
    return new GoogleGenAI({ apiKey: customKey });
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

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

export default async function handler(req: any, res: any) {
  // CORS para permitir requisições do front-end na Vercel e navegadores
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Utilize POST.',
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // mantém o body como está
      }
    }

    const { image, mimeType = 'image/jpeg', defaultYear, apiKey } = body || {};

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem foi fornecida para análise.',
      });
    }

    // Remove prefixo base64 se presente
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

    const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let response: any = null;
    let lastCallError: any = null;

    for (const modelCandidate of modelsToTry) {
      try {
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
          18000
        );

        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastCallError = err;
      }
    }

    if (!response || !response.text) {
      throw lastCallError || new Error('Não foi possível obter resposta dos modelos do Gemini.');
    }

    const responseText = response.text?.trim() || '{}';
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    const purchases = Array.isArray(parsedData.purchases) ? parsedData.purchases : [];

    return res.status(200).json({
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
    console.error('Erro na API da Vercel (/api/scan-card-invoice):', error);
    const errMsg = String(error?.message || error || '');
    let userFriendlyMsg = errMsg || 'Falha ao processar imagem da fatura.';

    if (errMsg.includes('GEMINI_API_KEY')) {
      userFriendlyMsg =
        'A variável GEMINI_API_KEY precisa ser configurada no painel da Vercel (Settings > Environment Variables).';
    } else if (errMsg.includes('leaked') || errMsg.includes('API key was reported as leaked')) {
      userFriendlyMsg = 'A chave da API Gemini foi revogada ou expirou. Gere uma nova chave no Google AI Studio.';
    }

    return res.status(500).json({
      success: false,
      error: userFriendlyMsg,
    });
  }
}
