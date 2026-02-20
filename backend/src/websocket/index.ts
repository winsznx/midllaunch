import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import Redis from 'ioredis';
import 'dotenv/config';

const WS_PORT = parseInt(process.env.WS_PORT || '8080');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis subscriber for receiving events from the indexer
const subscriber = new Redis(REDIS_URL);

// HTTP server for WebSocket
const server = createServer();
const wss = new WebSocketServer({ server });

// Track client subscriptions
interface Client {
  ws: WebSocket;
  channels: Set<string>;
}

const clients = new Map<WebSocket, Client>();

// Subscribe to Redis channels for events
subscriber.subscribe('launch_created', 'tokens_purchased', 'price_update', 'comment_posted', 'launch_finalized');

subscriber.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);
    console.log(`[WS] Broadcasting ${channel}:`, data.launchId || data.tokenAddress || 'global');

    // Broadcast to relevant clients
    clients.forEach(client => {
      if (!client.ws || client.ws.readyState !== WebSocket.OPEN) return;

      // Check if client is subscribed to this event
      const shouldSend =
        client.channels.has('global') ||
        (data.launchId && client.channels.has(`launch:${data.launchId}`)) ||
        (data.tokenAddress && client.channels.has(`launch:${data.tokenAddress}`));

      if (shouldSend) {
        client.ws.send(JSON.stringify({
          type: channel,
          data
        }));
      }
    });
  } catch (error) {
    console.error('[WS] Error broadcasting message:', error);
  }
});

// WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] New client connected');

  const client: Client = {
    ws,
    channels: new Set(['global']) // Subscribe to global by default
  };

  clients.set(ws, client);

  // Handle incoming messages
  ws.on('message', (rawMessage: Buffer) => {
    try {
      const message = JSON.parse(rawMessage.toString());

      if (message.type === 'subscribe' && message.channel) {
        client.channels.add(message.channel);
        console.log(`[WS] Client subscribed to: ${message.channel}`);

        ws.send(JSON.stringify({
          type: 'subscribed',
          channel: message.channel
        }));
      }

      if (message.type === 'unsubscribe' && message.channel) {
        client.channels.delete(message.channel);
        console.log(`[WS] Client unsubscribed from: ${message.channel}`);

        ws.send(JSON.stringify({
          type: 'unsubscribed',
          channel: message.channel
        }));
      }

      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('[WS] Error handling message:', error);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WS] Client error:', error);
    clients.delete(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString()
  }));
});

// Heartbeat to keep connections alive
setInterval(() => {
  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat' }));
    }
  });
}, 30000); // Every 30 seconds

// Start server
server.listen(WS_PORT, () => {
  console.log(`[WS] WebSocket server running on ws://localhost:${WS_PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WS] Shutting down...');
  wss.close();
  subscriber.quit();
  process.exit(0);
});

