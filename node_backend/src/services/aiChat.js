// AI explanation service — uses Emergent LLM key via the emergent proxy.
// The AI is strictly limited to explaining the backend-calculated context provided.
// If the LLM is unreachable, a deterministic fallback explanation is generated.

const fetch = require('node-fetch');

const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY;
const EMERGENT_LLM_URL = 'https://integrations.emergentagent.com/llm/chat';

function fallbackExplanation({ userMessage, analysisContext, language }) {
  if (!analysisContext) {
    return language === 'hi'
      ? 'नमस्ते! अभी आपके लिए कोई सक्रिय लॉट/गणना उपलब्ध नहीं है। कृपया पहले एक लॉट बनाएँ, फिर मैं आपकी सटीक तुलना समझा सकता हूँ।'
      : "Namaste! I don't see an active lot to explain yet. Please create a lot first — then I can walk you through the transparent cost breakdown.";
  }
  const top = analysisContext.topThree[0];
  if (!top) return 'No selling options available yet for this lot.';
  const money = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const cmp = analysisContext.comparison;
  const cmpLine = cmp
    ? cmp.preferred === 'sell_now'
      ? `Sell-now beats storing today by ${money(cmp.difference)} (forecast is uncertain).`
      : `Storing 30 days could add ${money(Math.abs(cmp.difference))} — but it's a forecast, not a guarantee.`
    : '';
  if (language === 'hi') {
    return `आपके लॉट के लिए सबसे मजबूत विकल्प है ${top.marketName}. अपेक्षित शुद्ध वसूली: ${money(top.breakdown.netRealisation)}. मूल्य ${money(top.pricePerQuintal)}/क्विंटल पर, दूरी ${top.distanceKm} किमी है। परिवहन, कमीशन, पैकिंग और अपेक्षित हानि निकालने के बाद यह आँकड़ा है। ${cmpLine} अंतिम निर्णय आपका है।`;
  }
  return `The strongest option for your lot today is ${top.marketName}. Expected net realisation: ${money(top.breakdown.netRealisation)} at ${money(top.pricePerQuintal)}/quintal over ~${top.distanceKm.toFixed(0)} km. This is after transport ${money(top.breakdown.transportCost)}, commission ${money(top.breakdown.commissionCost)}, packaging ${money(top.breakdown.packagingCost)} and expected loss ${money(top.breakdown.spoilageCost)}. ${cmpLine} You remain the final decision-maker — would you like to compare option 2 or explain any single cost line?`;
}

async function generateAiExplanation({ userMessage, analysisContext, language }) {
  if (!EMERGENT_LLM_KEY) {
    return { text: fallbackExplanation({ userMessage, analysisContext, language }), source: 'fallback:no_key' };
  }

  const system = [
    "You are Sathi, KrishiSetu's farmer companion.",
    'STRICT RULES:',
    '- Never invent prices, distances, transport, storage, commission, packaging or spoilage numbers.',
    '- Only explain the numbers in the provided backend analysis context.',
    '- The farmer is the final decision-maker. Never auto-sell.',
    '- Be warm, concise, and clear. Prefer plain sentences over bullets unless comparing options.',
    language === 'hi' ? '- Respond in simple Hindi (Devanagari).' : '- Respond in clear English (mix in Hindi/Hinglish only if the farmer wrote in Hindi).',
    '- If asked about live/gov data, say demo data is in use unless the context says otherwise.',
  ].join('\n');

  const context = analysisContext ? {
    topThree: analysisContext.topThree,
    storeOption: analysisContext.storeOption,
    comparison: analysisContext.comparison,
    demoNotice: analysisContext.demoNotice,
    crop: analysisContext.crop,
    quantityQuintals: analysisContext.quantityQuintals,
  } : null;

  const messages = [
    { role: 'system', content: system },
    { role: 'system', content: 'BACKEND_ANALYSIS_CONTEXT:\n' + JSON.stringify(context, null, 2) },
    { role: 'user', content: userMessage },
  ];

  try {
    const r = await fetch(EMERGENT_LLM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EMERGENT_LLM_KEY}`,
      },
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-5.4',
        messages,
        temperature: 0.3,
      }),
      timeout: 15000,
    });
    if (!r.ok) {
      const errText = await r.text();
      console.warn('[aiChat] emergent llm error', r.status, errText.slice(0, 200));
      return { text: fallbackExplanation({ userMessage, analysisContext, language }), source: 'fallback:http_' + r.status };
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || data?.content || data?.output_text || fallbackExplanation({ userMessage, analysisContext, language });
    return { text, source: 'llm:emergent' };
  } catch (e) {
    console.warn('[aiChat] llm exception', e.message);
    return { text: fallbackExplanation({ userMessage, analysisContext, language }), source: 'fallback:exception' };
  }
}

module.exports = { generateAiExplanation, fallbackExplanation };
