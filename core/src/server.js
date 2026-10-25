import http from 'node:http';
import { WebSocketServer } from 'ws';

/**
 * One local server for everything:
 *
 *   ws://127.0.0.1:8765/            JSON messages (state, commands) - see below
 *   ws://127.0.0.1:8765/<path>      extra binary streams registered with hub.socket()
 *   http://127.0.0.1:8765/<prefix>  files registered with hub.route() (music, artwork)
 *
 * JSON messages:
 *   hub -> client  {type:"snapshot", state:{...}, commands:[...]}   on connect
 *   hub -> client  {type:"state", topic, value}                      on every change
 *   client -> hub  {type:"command", id, topic, value}                run a command
 *   hub -> client  {type:"result", id, ok, value | error}            command answer
 *   client -> hub  {type:"publish", topic, value}                    set a topic yourself
 */
export function startServer(hub, { host = '127.0.0.1', port = 8765, log = console } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // The screen app is loaded from a file, so allow it to fetch from here.
    res.setHeader('Access-Control-Allow-Origin', '*');
    for (const [prefix, handler] of hub.routes) {
      if (url.pathname.startsWith(prefix)) {
        Promise.resolve(handler(req, res, url)).catch((err) => {
          log.error?.(`[http] ${url.pathname}:`, err);
          if (!res.headersSent) res.writeHead(500);
          res.end();
        });
        return;
      }
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ noServer: true });
  const extra = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
      return;
    }
    const handler = hub.sockets.get(pathname);
    if (!handler) {
      socket.destroy();
      return;
    }
    extra.handleUpgrade(req, socket, head, (ws) => handler(ws, req));
  });

  const onState = (topic, value) => {
    const msg = JSON.stringify({ type: 'state', topic, value });
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(msg);
    }
  };
  hub.on('state', onState);

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'snapshot', state: hub.snapshot(), commands: hub.commands() }));

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', error: 'Message is not valid JSON' }));
        return;
      }

      if (msg.type === 'command') {
        try {
          const value = await hub.command(msg.topic, msg.value);
          ws.send(JSON.stringify({ type: 'result', id: msg.id, ok: true, value: value ?? null }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'result', id: msg.id, ok: false, error: err.message }));
        }
      } else if (msg.type === 'publish' && typeof msg.topic === 'string') {
        hub.set(msg.topic, msg.value);
      } else {
        ws.send(JSON.stringify({ type: 'error', error: `Unknown message type "${msg.type}"` }));
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const actualPort = server.address().port;
      log.info?.(`[hub] listening on http://${host}:${actualPort}`);
      resolve({
        server,
        wss,
        port: actualPort,
        close: () =>
          new Promise((done) => {
            hub.off('state', onState);
            for (const client of [...wss.clients, ...extra.clients]) client.terminate();
            wss.close();
            extra.close();
            server.close(() => done());
            server.closeAllConnections?.();
          }),
      });
    });
  });
}
