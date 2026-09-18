// server.js - node.js v18+
import express from 'express';
import { WebSocketServer } from 'ws';
import screenshot from 'screenshot-desktop';
import robot from 'robotjs';
import sharp from 'sharp';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 10 * 1024 * 1024 });

const AUTH_TOKEN = process.env.AUTH_TOKEN || 'changeme123';
const PORT = process.env.PORT || 3000;

app.use(express.static(join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));

// health check endpoint for render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

const clients = new Map();

wss.on('connection', (ws, req) => {
  let authenticated = false;
  let clientConfig = { quality: 60, fps: 15, scale: 0.7 };
  let streamInterval = null;
  
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'auth') {
        if (msg.token === AUTH_TOKEN) {
          authenticated = true;
          clients.set(ws, clientConfig);
          ws.send(JSON.stringify({ type: 'auth', success: true }));
          startScreenStream(ws, clientConfig);
        } else {
          ws.send(JSON.stringify({ type: 'auth', success: false }));
          ws.close();
        }
        return;
      }
      
      if (!authenticated) {
        ws.close();
        return;
      }
      
      if (msg.type === 'config') {
        clientConfig.quality = msg.quality || clientConfig.quality;
        clientConfig.fps = msg.fps || clientConfig.fps;
        clientConfig.scale = msg.scale || clientConfig.scale;
        clients.set(ws, clientConfig);
      } else if (msg.type === 'mouse_move') {
        robot.moveMouse(msg.x, msg.y);
      } else if (msg.type === 'mouse_click') {
        robot.mouseClick(msg.button || 'left', msg.double || false);
      } else if (msg.type === 'mouse_scroll') {
        robot.scrollMouse(msg.x || 0, msg.y || 0);
      } else if (msg.type === 'key') {
        if (msg.modifiers && msg.modifiers.length > 0) {
          robot.keyTap(msg.key, msg.modifiers);
        } else {
          robot.keyTap(msg.key);
        }
      } else if (msg.type === 'key_combo') {
        robot.keyTap(msg.key, msg.modifiers || []);
      } else if (msg.type === 'text') {
        robot.typeString(msg.text);
      } else if (msg.type === 'cmd') {
        try {
          const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
          const { stdout, stderr } = await execAsync(msg.command, {
            shell,
            timeout: 30000,
            maxBuffer: 1024 * 1024
          });
          ws.send(JSON.stringify({
            type: 'cmd_result',
            stdout: stdout || '',
            stderr: stderr || ''
          }));
        } catch (err) {
          ws.send(JSON.stringify({
            type: 'cmd_result',
            stdout: err.stdout || '',
            stderr: err.stderr || err.message
          }));
        }
      }
    } catch (err) {
      console.error('message error:', err);
    }
  });
  
  ws.on('close', () => {
    clients.delete(ws);
    if (streamInterval) clearTimeout(streamInterval);
  });
  
  async function startScreenStream(socket, config) {
    const streamFrame = async () => {
      if (!clients.has(socket) || socket.readyState !== 1) return;
      
      try {
        const img = await screenshot({ format: 'png' });
        const screenSize = robot.getScreenSize();
        const newWidth = Math.floor(screenSize.width * config.scale);
        const newHeight = Math.floor(screenSize.height * config.scale);
        
        const compressed = await sharp(img)
          .resize(newWidth, newHeight, { fit: 'inside' })
          .jpeg({ quality: config.quality, progressive: false, mozjpeg: true })
          .toBuffer();
        
        const base64 = compressed.toString('base64');
        
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({
            type: 'screen',
            image: base64,
            width: screenSize.width,
            height: screenSize.height
          }));
        }
      } catch (err) {
        console.error('screenshot error:', err);
      }
      
      setTimeout(streamFrame, Math.floor(1000 / config.fps));
    };
    
    streamFrame();
  }
});

const HOST = process.env.RENDER ? '0.0.0.0' : '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`remote control server running on ${HOST}:${PORT}`);
  console.log(`auth token: ${AUTH_TOKEN}`);
  if (!process.env.RENDER) {
    console.log(`access from chromebook at http://<windows-pc-ip>:${PORT}`);
  }
});
