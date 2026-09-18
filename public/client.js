let ws = null;
let canvas = null;
let ctx = null;
let screenWidth = 0;
let screenHeight = 0;
let scaleX = 1;
let scaleY = 1;
let lastFrameTime = Date.now();
let config = { quality: 60, fps: 15, scale: 70 };

const $ = (id) => document.getElementById(id);
const authScreen = $('auth-screen');
const controlScreen = $('control-screen');
const tokenInput = $('token-input');
const connectBtn = $('connect-btn');
const authError = $('auth-error');
const statusText = $('status-text');
const latencyEl = $('latency');
const settingsBtn = $('settings-btn');
const keyboardToggle = $('keyboard-toggle');
const terminalToggle = $('terminal-toggle');
const disconnectBtn = $('disconnect-btn');
const settingsPanel = $('settings-panel');
const keyboardPanel = $('keyboard-panel');
const terminalPanel = $('terminal-panel');
const textInput = $('text-input');
const sendTextBtn = $('send-text');
const cmdInput = $('cmd-input');
const runCmdBtn = $('run-cmd');
const terminalOutput = $('terminal-output');
const touchIndicator = $('touch-indicator');
const qualitySlider = $('quality-slider');
const fpsSlider = $('fps-slider');
const scaleSlider = $('scale-slider');
const applySettingsBtn = $('apply-settings');

connectBtn.addEventListener('click', connect);
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') connect();
});

disconnectBtn.addEventListener('click', () => {
  if (ws) ws.close();
  showAuth();
});

settingsBtn.addEventListener('click', () => togglePanel(settingsPanel, settingsBtn));
keyboardToggle.addEventListener('click', () => togglePanel(keyboardPanel, keyboardToggle));
terminalToggle.addEventListener('click', () => togglePanel(terminalPanel, terminalToggle));

function togglePanel(panel, btn) {
  const isVisible = panel.style.display !== 'none';
  [settingsPanel, keyboardPanel, terminalPanel].forEach(p => p.style.display = 'none');
  [settingsBtn, keyboardToggle, terminalToggle].forEach(b => b.classList.remove('active'));
  
  if (!isVisible) {
    panel.style.display = 'block';
    btn.classList.add('active');
    if (panel === keyboardPanel) textInput.focus();
    if (panel === terminalPanel) cmdInput.focus();
  }
}

qualitySlider.addEventListener('input', (e) => {
  $('quality-val').textContent = e.target.value;
});

fpsSlider.addEventListener('input', (e) => {
  $('fps-val').textContent = e.target.value;
});

scaleSlider.addEventListener('input', (e) => {
  $('scale-val').textContent = e.target.value;
});

applySettingsBtn.addEventListener('click', () => {
  config.quality = parseInt(qualitySlider.value);
  config.fps = parseInt(fpsSlider.value);
  config.scale = parseInt(scaleSlider.value) / 100;
  
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({
      type: 'config',
      quality: config.quality,
      fps: config.fps,
      scale: config.scale
    }));
  }
  
  settingsPanel.style.display = 'none';
  settingsBtn.classList.remove('active');
});

sendTextBtn.addEventListener('click', () => {
  const text = textInput.value.trim();
  if (text && ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'text', text }));
    textInput.value = '';
  }
});

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendTextBtn.click();
  }
});

runCmdBtn.addEventListener('click', () => {
  const cmd = cmdInput.value.trim();
  if (cmd && ws && ws.readyState === 1) {
    addTerminalLine('PS> ' + cmd, 'prompt');
    ws.send(JSON.stringify({ type: 'cmd', command: cmd }));
    cmdInput.value = '';
  }
});

cmdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    runCmdBtn.click();
  }
});

document.querySelectorAll('[data-key]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'key', key }));
    }
  });
});

document.querySelectorAll('[data-combo]').forEach(btn => {
  btn.addEventListener('click', () => {
    const combo = JSON.parse(btn.dataset.combo);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'key_combo',
        key: combo.key,
        modifiers: combo.modifiers
      }));
    }
  });
});

function connect() {
  const token = tokenInput.value.trim();
  if (!token) {
    authError.textContent = 'enter auth token';
    return;
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'auth', token }));
  };
  
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    
    if (msg.type === 'auth') {
      if (msg.success) {
        showControl();
        ws.send(JSON.stringify({
          type: 'config',
          quality: config.quality,
          fps: config.fps,
          scale: config.scale
        }));
      } else {
        authError.textContent = 'invalid token';
        ws.close();
      }
    } else if (msg.type === 'screen') {
      const now = Date.now();
      const latency = now - lastFrameTime;
      lastFrameTime = now;
      latencyEl.textContent = `~${latency}ms`;
      drawScreen(msg.image, msg.width, msg.height);
    } else if (msg.type === 'cmd_result') {
      if (msg.stdout) addTerminalLine(msg.stdout, 'stdout');
      if (msg.stderr) addTerminalLine(msg.stderr, 'stderr');
    }
  };
  
  ws.onclose = () => {
    statusText.textContent = 'disconnected';
  };
  
  ws.onerror = () => {
    authError.textContent = 'connection failed';
  };
}

function showAuth() {
  authScreen.style.display = 'flex';
  controlScreen.style.display = 'none';
  tokenInput.value = '';
  authError.textContent = '';
}

function showControl() {
  authScreen.style.display = 'none';
  controlScreen.style.display = 'flex';
  
  canvas = $('screen');
  ctx = canvas.getContext('2d', { alpha: false });
  
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function drawScreen(base64, width, height) {
  if (screenWidth !== width || screenHeight !== height) {
    screenWidth = width;
    screenHeight = height;
    resizeCanvas();
  }
  
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = 'data:image/jpeg;base64,' + base64;
}

function resizeCanvas() {
  const container = canvas.parentElement;
  const containerRatio = container.clientWidth / container.clientHeight;
  const screenRatio = screenWidth / screenHeight;
  
  if (containerRatio > screenRatio) {
    canvas.height = container.clientHeight - 32;
    canvas.width = canvas.height * screenRatio;
  } else {
    canvas.width = container.clientWidth - 32;
    canvas.height = canvas.width / screenRatio;
  }
  
  scaleX = screenWidth / canvas.width;
  scaleY = screenHeight / canvas.height;
}

function handleMouseMove(e) {
  if (!ws || ws.readyState !== 1) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) * scaleX);
  const y = Math.floor((e.clientY - rect.top) * scaleY);
  
  ws.send(JSON.stringify({ type: 'mouse_move', x, y }));
}

function handleMouseDown(e) {
  if (!ws || ws.readyState !== 1) return;
  
  const button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
  ws.send(JSON.stringify({ type: 'mouse_click', button, double: e.detail === 2 }));
}

function handleWheel(e) {
  e.preventDefault();
  if (!ws || ws.readyState !== 1) return;
  
  const x = Math.sign(e.deltaX) * -1;
  const y = Math.sign(e.deltaY) * -5;
  ws.send(JSON.stringify({ type: 'mouse_scroll', x, y }));
}

let touchStartTime = 0;
let touchStartPos = { x: 0, y: 0 };
let isTouchMoving = false;

function handleTouchStart(e) {
  e.preventDefault();
  if (!ws || ws.readyState !== 1) return;
  
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((touch.clientX - rect.left) * scaleX);
  const y = Math.floor((touch.clientY - rect.top) * scaleY);
  
  touchStartTime = Date.now();
  touchStartPos = { x, y };
  isTouchMoving = false;
  
  showTouchIndicator(touch.clientX, touch.clientY);
  ws.send(JSON.stringify({ type: 'mouse_move', x, y }));
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!ws || ws.readyState !== 1) return;
  
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((touch.clientX - rect.left) * scaleX);
  const y = Math.floor((touch.clientY - rect.top) * scaleY);
  
  isTouchMoving = true;
  showTouchIndicator(touch.clientX, touch.clientY);
  ws.send(JSON.stringify({ type: 'mouse_move', x, y }));
}

function handleTouchEnd(e) {
  e.preventDefault();
  if (!ws || ws.readyState !== 1) return;
  
  hideTouchIndicator();
  
  const touchDuration = Date.now() - touchStartTime;
  
  if (!isTouchMoving && touchDuration < 300) {
    ws.send(JSON.stringify({ type: 'mouse_click', button: 'left', double: false }));
  }
}

function showTouchIndicator(x, y) {
  touchIndicator.style.left = (x - 20) + 'px';
  touchIndicator.style.top = (y - 20) + 'px';
  touchIndicator.classList.add('active');
}

function hideTouchIndicator() {
  touchIndicator.classList.remove('active');
}

function addTerminalLine(text, type) {
  const line = document.createElement('div');
  line.className = `terminal-line terminal-${type}`;
  line.textContent = text;
  terminalOutput.appendChild(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

window.addEventListener('resize', () => {
  if (canvas) resizeCanvas();
});
