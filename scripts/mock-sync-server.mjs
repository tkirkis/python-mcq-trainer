// Minimal stand-in for the sync backend, used by the Playwright two-device test.
// POST /push?user=u {events:[...]}  -> stores events (idempotent by id)
// GET  /pull?user=u&since=<seq>     -> {events, cursor}
// GET  /stats?user=u                -> {count}
import http from 'node:http';

const port = Number(process.env.MOCK_SYNC_PORT || 8787);
const users = new Map(); // user -> { seq, rows: [{seq, ev}], ids: Set }

function bucket(user) {
  if (!users.has(user)) users.set(user, { seq: 0, rows: [], ids: new Set() });
  return users.get(user);
}

const server = http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url, 'http://x');
  const b = bucket(url.searchParams.get('user') || 'default');
  if (url.pathname === '/push' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { events = [] } = JSON.parse(body || '{}');
      for (const ev of events) {
        if (!ev?.id || b.ids.has(ev.id)) continue;
        b.ids.add(ev.id);
        b.rows.push({ seq: ++b.seq, ev });
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, count: b.rows.length }));
    });
    return;
  }
  if (url.pathname === '/pull') {
    const since = Number(url.searchParams.get('since') || 0);
    const rows = b.rows.filter((r) => r.seq > since);
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ events: rows.map((r) => r.ev), cursor: String(b.seq) }));
  }
  if (url.pathname === '/stats') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ count: b.rows.length }));
  }
  if (url.pathname === '/reset') {
    users.clear();
    return res.end('ok');
  }
  res.statusCode = 404;
  res.end('not found');
});

server.listen(port, () => console.log(`mock sync server on http://localhost:${port}`));
