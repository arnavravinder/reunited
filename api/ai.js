const UPSTREAM_TIMEOUT_MS = 8000;

const SKIP_WINDOW_MS = 10 * 60 * 1000;
const providerSkipUntil = new Map();

const flattenMessages = (messages) => messages
  .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
  .join('\n\n');

const PROVIDERS = [
  {
    name: 'hackclub',
    enabled: () => Boolean(process.env.HACKCLUB_AI_KEY),
    request: (messages, opts) => ({
      url: 'https://ai.hackclub.com/proxy/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HACKCLUB_AI_KEY}`
      },
      body: {
        model: process.env.HACKCLUB_AI_MODEL || 'google/gemini-3.1-flash-lite',
        messages,
        ...opts
      }
    }),
    parse: (data) => (data?.choices?.[0]?.message ? data : null)
  },
  {
    name: 'gemini',
    enabled: () => Boolean(process.env.GEMINI_API_KEY),
    request: (messages, opts) => ({
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`
      },
      body: {
        model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
        messages,
        ...opts
      }
    }),
    parse: (data) => (data?.choices?.[0]?.message ? data : null)
  },
  {
    name: 'reunited-gemini',
    enabled: () => true,
    request: (messages) => ({
      url: process.env.REUNITED_GEMINI_URL || 'https://api.reunited.co.in/api/gemini',
      headers: { 'Content-Type': 'application/json' },
      body: { prompt: flattenMessages(messages) }
    }),
    parse: (data) => {
      const parts = data?.data?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map(p => p.text || '').join('') : '';
      if (!text) return null;
      return { choices: [{ message: { role: 'assistant', content: text } }] };
    }
  }
];

/**
 * Handles chat completion requests using the first available AI provider.
 *
 * Validates the request, forwards messages and supported options to configured providers,
 * and falls back to other providers when a request fails or returns unusable data.
 */
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

  const opts = {};
  if (typeof temperature === 'number') opts.temperature = temperature;
  if (typeof maxTokens === 'number') opts.max_tokens = maxTokens;

  let lastStatus = 503;
  let lastError = 'No AI provider is configured';

  for (const provider of PROVIDERS) {
    if (!provider.enabled()) continue;
    if ((providerSkipUntil.get(provider.name) || 0) > Date.now()) continue;

    try {
      const { url, headers, body } = provider.request(messages, opts);
      const upstream = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      });

      if (upstream.ok) {
        const data = await upstream.json();
        const parsed = provider.parse(data);
        if (parsed) {
          res.status(200).json(parsed);
          return;
        }
        lastStatus = 502;
        lastError = `${provider.name} returned an unusable response`;
        continue;
      }

      lastStatus = upstream.status;
      lastError = `${provider.name} responded with ${upstream.status}`;
      if ([401, 402, 403].includes(upstream.status)) {
        providerSkipUntil.set(provider.name, Date.now() + SKIP_WINDOW_MS);
      }
    } catch (error) {
      lastStatus = 502;
      lastError = `${provider.name} request failed`;
      providerSkipUntil.set(provider.name, Date.now() + SKIP_WINDOW_MS);
    }
  }

  res.status(lastStatus === 429 ? 429 : lastStatus >= 500 ? 502 : lastStatus)
    .json({ error: lastError });
}
