// Vercel Serverless Function: https://gorjetas-gaucho.vercel.app/api/calls
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CALL_API_TOKEN = process.env.CALL_API_TOKEN;

function cors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

async function supabase(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

export default async function handler(request, response) {
  cors(response);
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return response.status(500).json({ error: 'Variáveis do Supabase não configuradas na Vercel.' });
  }

  if (request.method === 'GET') {
    const result = await supabase('chat_calls?select=id,usuario,call,created_at&order=created_at.desc');
    if (!result.ok) return response.status(502).json({ error: 'Não foi possível consultar as calls.' });
    const calls = await result.json();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const totals = calls.filter((call) => new Date(call.created_at).getTime() >= weekAgo).reduce((all, call) => {
      all[call.usuario] = (all[call.usuario] || 0) + 1;
      return all;
    }, {});
    const ranking = Object.entries(totals).map(([usuario, total]) => ({ usuario, total }))
      .sort((a, b) => b.total - a.total || a.usuario.localeCompare(b.usuario)).slice(0, 5);
    return response.status(200).json({ calls, ranking });
  }

  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
  if (CALL_API_TOKEN && request.headers.authorization !== `Bearer ${CALL_API_TOKEN}`) {
    return response.status(401).json({ error: 'Não autorizado.' });
  }

  const usuario = String(request.body?.usuario || '').trim();
  const call = String(request.body?.call || '').trim();
  if (!usuario || !call) return response.status(400).json({ error: 'Os campos "usuario" e "call" são obrigatórios.' });
  if (usuario.length > 60 || call.length > 80) return response.status(400).json({ error: 'Nome ou call excede o tamanho permitido.' });

  const result = await supabase('chat_calls', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ usuario, call })
  });
  if (!result.ok) return response.status(502).json({ error: 'Não foi possível salvar a call.' });
  const [created] = await result.json();
  return response.status(201).json({ ok: true, call: created });
}
