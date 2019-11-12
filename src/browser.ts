import { ClientAbstract } from "./client-abstract";

export class BrowserClient extends ClientAbstract {
  client: WebSocket;

  constructor(socketUrl) {
    super();

    const connect = () => {
      const ws = new WebSocket(socketUrl);
      this.client = ws;

      ws.addEventListener('open', () => ws.send('text'));
      ws.addEventListener('close', () => setTimeout(connect, 2000));
      ws.addEventListener('message', (event) => this.onMessage(event.data));
    };

    connect();
  }
}
