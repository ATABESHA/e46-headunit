import { WebSocketServer } from 'ws';

/**
 * WebSocket server that connects the hub to the screen app and to any of your
 * own programs (Python, Node, ...). Messages are JSON:
 *
 *   hub -> client  {type:"snapshot", state:{...}}            on connect
 *   hub -> client  {type:"state", topic, value}               on every change
 *   client -> hub  {type:"command", id, topic, value}         run a command
 *   hub -> client  {type:"result", id, ok, value | error}     command answer
 *   client -> hub  {type:"publish", topic, value}             set a topic yourself
 */
export function startServer(hub, { host = '127.0.0.1', port = 8765, log = console } = {}) {
  const wss = new WebSocketServer({ host, port });

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
    wss.once('listening', () => {
      log.info?.(`[hub] listening on ws://${host}:${wss.address().port}`);
      resolve({
        wss,
        port: wss.address().port,
        close: () =>
          new Promise((done) => {
            hub.off('state', onState);
            for (const client of wss.clients) client.terminate();
            wss.close(() => done());
          }),
      });
    });
    wss.once('error', reject);
  });
}
