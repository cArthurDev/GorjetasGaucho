/* Execute com: node api-server.js. Configure PORT e CALL_API_TOKEN se desejar. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || 3000);
const token = process.env.CALL_API_TOKEN;
const dataFile = path.join(__dirname, 'api-data', 'calls.json');

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return { calls: Array.isArray(data.calls) ? data.calls : [], history: Array.isArray(data.history) ? data.history : [] };
  } catch { return { calls: [], history: [] }; }
}

function writeData(data) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
}

function send(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  response.end(JSON.stringify(data));
}

function weeklyRanking(history) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const totals = history.filter((item) => item.createdAt >= weekAgo).reduce((result, item) => {
    result[item.usuario] = (result[item.usuario] || 0) + 1;
    return result;
  }, {});
  return Object.entries(totals).map(([usuario, total]) => ({ usuario, total }))
    .sort((a, b) => b.total - a.total || a.usuario.localeCompare(b.usuario)).slice(0, 5);
}

http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === 'OPTIONS') return send(response, 204, {});
  if (url.pathname !== '/api/calls') return send(response, 404, { error: 'Rota não encontrada.' });
  if (request.method === 'GET') {
    const data = readData();
    return send(response, 200, { calls: data.calls, ranking: weeklyRanking(data.history) });
  }
  if (request.method !== 'POST') return send(response, 405, { error: 'Método não permitido.' });
  if (token && request.headers.authorization !== `Bearer ${token}`) return send(response, 401, { error: 'Não autorizado.' });

  let raw = '';
  request.on('data', (chunk) => { raw += chunk; if (raw.length > 10000) request.destroy(); });
  request.on('end', () => {
    try {
      const body = JSON.parse(raw || '{}');
      const usuario = String(body.usuario || '').trim();
      const call = String(body.call || '').trim();
      if (!usuario || !call) return send(response, 400, { error: 'Os campos "usuario" e "call" são obrigatórios.' });
      if (usuario.length > 60 || call.length > 80) return send(response, 400, { error: 'Nome ou call excede o tamanho permitido.' });
      const data = readData();
      const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, usuario, call, createdAt: Date.now() };
      data.calls.push(entry);
      data.history.push({ usuario, createdAt: entry.createdAt });
      writeData(data);
      return send(response, 201, { ok: true, call: entry, total: data.calls.length });
    } catch { return send(response, 400, { error: 'JSON inválido.' }); }
  });
}).listen(port, () => console.log(`API de calls: http://localhost:${port}/api/calls`));
