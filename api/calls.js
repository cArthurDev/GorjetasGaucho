// Vercel Serverless Function: https://gorjetas-gaucho.vercel.app/api/calls
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ucojydxwmeewbumhzwkq.supabase.co';
// A publishable key já é pública e está no config.js do site.
// Use a service role apenas se você ativar RLS para esta tabela no futuro.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_UG7oOzFrJzXXIHbaW8s6tQ_QE5mFe7p';

function cors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

async function supabase(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

module.exports = async function handler(request, response) {
  cors(response);
  if (request.method === 'OPTIONS') return response.status(204).end();
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
