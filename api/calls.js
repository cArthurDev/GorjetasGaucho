// Vercel Serverless Function: https://gorjetas-gaucho.vercel.app/api/calls
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ucojydxwmeewbumhzwkq.supabase.co';
// A publishable key já é pública e está no config.js do site.
// Use a service role apenas se você ativar RLS para esta tabela no futuro.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_UG7oOzFrJzXXIHbaW8s6tQ_QE5mFe7p';

function cors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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
    // Mantém a fila em ordem de chegada: a primeira call fica no topo.
    const result = await supabase('chat_calls?select=id,usuario,call,created_at&completed_at=is.null&order=created_at.asc');
    if (!result.ok) {
      const detail = await result.text();
      console.error('Supabase GET chat_calls:', detail);
      return response.status(502).json({ error: 'Não foi possível consultar as calls.', detail });
    }
    const calls = await result.json();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const completedResult = await supabase(`chat_calls?select=id,usuario,bonus_amount,completed_at&completed_at=gte.${encodeURIComponent(weekAgo)}&order=completed_at.desc`);
    if (!completedResult.ok) return response.status(502).json({ error: 'Nao foi possivel consultar os bonus concluidos.' });
    const completedCalls = await completedResult.json();
    const totals = completedCalls.reduce((all, call) => {
      if (!all[call.usuario]) all[call.usuario] = { totalBonus: 0, latestId: call.id };
      all[call.usuario].totalBonus += Number(call.bonus_amount || 0);
      return all;
    }, {});
    const ranking = Object.entries(totals).map(([usuario, entry]) => ({ usuario, ...entry }))
      .sort((a, b) => b.totalBonus - a.totalBonus || a.usuario.localeCompare(b.usuario)).slice(0, 5);
    return response.status(200).json({ calls, ranking });
  }

  if (request.method === 'DELETE') {
    const id = String(request.query?.id || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return response.status(400).json({ error: 'ID de call inválido.' });
    const result = await supabase(`chat_calls?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' }
    });
    if (!result.ok) {
      const detail = await result.text();
      console.error('Supabase DELETE chat_calls:', detail);
      return response.status(502).json({ error: 'Não foi possível excluir a call.', detail });
    }
    return response.status(200).json({ ok: true });
  }

  if (request.method === 'PATCH') {
    const id = String(request.body?.id || '').trim();
    const bonusAmount = Number(request.body?.bonusAmount);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return response.status(400).json({ error: 'ID de call invalido.' });
    if (!Number.isFinite(bonusAmount) || bonusAmount <= 0) return response.status(400).json({ error: 'Informe um valor de bonus maior que zero.' });
    const result = await supabase(`chat_calls?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ bonus_amount: bonusAmount, completed_at: new Date().toISOString() })
    });
    if (!result.ok) return response.status(502).json({ error: 'Nao foi possivel concluir a call.' });
    return response.status(200).json({ ok: true, call: (await result.json())[0] });
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
  if (!result.ok) {
    const detail = await result.text();
    console.error('Supabase POST chat_calls:', detail);
    return response.status(502).json({ error: 'Não foi possível salvar a call.', detail });
  }
  const [created] = await result.json();
  return response.status(201).json({ ok: true, call: created });
}
