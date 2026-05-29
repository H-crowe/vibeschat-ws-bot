const WebSocket = require('ws');
const config = require('./config.json');
const pvtHandler = require('./pvt_handler');
const roomHandler = require('./room_handler');
const { log } = require('./logger');

let ws = null;
let userInfo = null;
let isAuthenticated = false;
let pingTimer = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let shouldReconnect = true;

function connect() {
  shouldReconnect = true;
  log('WS', `Connecting to ${config.server_url}`);

  ws = new WebSocket(config.server_url);

  ws.on('open', () => {
    log('WS', 'Connected. Waiting for welcome message...');
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(message);
    } catch (err) {
      log('ERROR', `Failed to parse message: ${err.message}`);
    }
  });

  ws.on('error', (err) => {
    log('ERROR', `WebSocket error: ${err.message}`);
  });

  ws.on('close', (code, reason) => {
    log('WS', `Closed: ${code}${reason ? ` - ${reason}` : ''}`);
    isAuthenticated = false;
    userInfo = null;
    stopPing();
    pvtHandler.stopFriendRequestsCheck();

    if (shouldReconnect) scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectAttempts += 1;
  const delay = Math.min(reconnectAttempts * 5000, 30000);
  log('WS', `Reconnecting in ${delay / 1000}s...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function sendMessage(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log('ERROR', 'Cannot send: websocket is not open');
    return false;
  }

  ws.send(JSON.stringify(payload));
  return true;
}

function login() {
  log('AUTH', `Logging in as ${config.username}`);
  sendMessage({
    handler: '3rd_login',
    payload: {
      username: config.username,
      password: config.password,
      api_key: config.api_key
    }
  });
}

function handleLoginResponse(message) {
  if (message.status !== 'success') {
    log('AUTH', `Login failed: ${message.reason || 'unknown reason'}`);
    return;
  }

  isAuthenticated = true;
  reconnectAttempts = 0;
  userInfo = message.user || {};
  log('AUTH', `Logged in as ${userInfo.username || config.username}`);

  startPing();
  pvtHandler.startFriendRequestsCheck();
  roomHandler.joinSavedRooms();
}

function startPing() {
  stopPing();
  pingTimer = setInterval(() => {
    sendMessage({
      handler: 'ping',
      payload: { ping: 'ok' }
    });
  }, 15000);
  log('WS', 'Ping started every 15 seconds');
}

function stopPing() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function sendPrivateMessage(toUsername, body) {
  pvtHandler.sendPvtMessage(sendMessage, toUsername, body);
}

function handleMessage(message) {
  if (message.handler === 'welcome' && message.status === 'success') {
    login();
    return;
  }

  if (message.handler === '3rd_login') {
    handleLoginResponse(message);
    return;
  }

  if (!isAuthenticated) return;

  if (message.handler === 'friends_requests') {
    pvtHandler.handleFriendRequestsResponse(message);
    return;
  }

  if (message.handler === 'notification' && message.type === 'friend_request') {
    pvtHandler.handleFriendNotification(message);
    return;
  }

  if (message.handler === 'pvt_chat' && message.status === 'received') {
    pvtHandler.handlePvtMessage(message, {
      sendMessage,
      joinRoom: roomHandler.joinRoom,
      log,
      getBotUsername: () => userInfo?.username
    });
    return;
  }

  if (message.handler === 'join_room') {
    roomHandler.handleJoinRoomResponse(message);
    return;
  }

  if (message.handler === 'room_presence' && (message.status === 'joined' || message.status === 'update')) {
    roomHandler.handlePresence(message, userInfo?.username);
    return;
  }

  if (message.handler === 'room_kicked') {
    roomHandler.handleRoomKicked(message);
  }
}

function shutdown() {
  shouldReconnect = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  stopPing();
  pvtHandler.stopFriendRequestsCheck();
  if (ws) ws.close();
}

process.on('SIGINT', () => {
  log('APP', 'Stopping...');
  shutdown();
  setTimeout(() => process.exit(0), 300);
});

roomHandler.setRoomHandlers({
  sendMessage,
  sendPrivateMessage,
  log
});

pvtHandler.setPvtHandlers({
  sendMessage,
  log
});

connect();
