const PROVIDERS = [
  {
    name: 'hackclub',
    url: 'https://ai.hackclub.com/proxy/v1/chat/completions',
    keyEnv: 'HACKCLUB_AI_KEY',
    model: () => process.env.HACKCLUB_AI_MODEL || 'google/gemini-3.1-flash-lite'
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyEnv: 'GEMINI_API_KEY',
    model: () => process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  }
];

const UPSTREAM_TIMEOUT_MS = 20000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { messages, temperature, max_tokens: maxTokens } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'A non-empty "messages" array is required' });
    return;
  }

  let lastStatus = 503;
  let lastError = 'No AI provider is configured';

  for (const provider of PROVIDERS) {
    const apiKey = process.env[provider.keyEnv];
    if (!apiKey) continue;

    const body = { model: provider.model(), messages };
    if (typeof temperature === 'number') body.temperature = temperature;
    if (typeof maxTokens === 'number') body.max_tokens = maxTokens;

    try {
      const upstream = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      });

      if (upstream.ok) {
        const data = await upstream.json();
        res.status(200).json(data);
        return;
      }

      lastStatus = upstream.status;
      lastError = `${provider.name} responded with ${upstream.status}`;
    } catch (error) {
      lastStatus = 502;
      lastError = `${provider.name} request failed`;
    }
  }

  res.status(lastStatus === 429 ? 429 : lastStatus >= 500 ? 502 : lastStatus)
    .json({ error: lastError });
}
