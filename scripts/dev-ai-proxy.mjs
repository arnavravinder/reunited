import http from 'node:http';
import { readFileSync } from 'node:fs';
import handler from '../api/ai.js';

const PORT = 3117;

try {
  const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
}

if (!process.env.HACKCLUB_AI_KEY && !process.env.GEMINI_API_KEY) {
  console.error('No HACKCLUB_AI_KEY or GEMINI_API_KEY found in .env — AI requests will fail.');
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  try {
    req.body = body ? JSON.parse(body) : {};
  } catch {
    req.body = {};
  }

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  await handler(req, res);
});

server.listen(PORT, () => {
  console.log(`AI dev proxy running at http://127.0.0.1:${PORT}/api/ai`);
});
