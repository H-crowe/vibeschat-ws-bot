const fs = require('fs');
const path = require('path');
const { log: fallbackLog } = require('./logger');
const { GAME_COMMANDS } = require('./games_handler');

let sendMessageFunc = null;
let sendPrivateMessageFunc = null;
let logFunc = null;

const DATA_DIR = path.join(__dirname, 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const activeRooms = new Set();
const wantedRooms = new Set();
const pendingJoins = new Map();
const rejoinTimers = new Map();

function log(scope, message) {
  if (typeof logFunc === 'function') {
    logFunc(scope, message);
  } else {
    fallbackLog(scope, message);
  }
}

function normalizeRoomName(roomName) {
  return String(roomName || '').trim();
}

function getRoomKey(roomName) {
  return normalizeRoomName(roomName).toLowerCase();
}

function ensureRoomsFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(ROOMS_FILE)) {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readSavedRooms() {
  try {
    ensureRoomsFile();
    const raw = fs.readFileSync(ROOMS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    return parsed
      .map(normalizeRoomName)
      .filter(Boolean)
      .filter((roomName) => {
        const key = getRoomKey(roomName);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  } catch (err) {
    log('ERROR', `Failed to read data/rooms.json: ${err.message}`);
    return [];
  }
}

function writeSavedRooms(rooms) {
  try {
    const seen = new Set();
    const cleanRooms = rooms
      .map(normalizeRoomName)
      .filter(Boolean)
      .filter((roomName) => {
        const key = getRoomKey(roomName);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    fs.writeFileSync(ROOMS_FILE, JSON.stringify(cleanRooms, null, 2), 'utf8');
    return true;
  } catch (err) {
    log('ERROR', `Failed to write data/rooms.json: ${err.message}`);
    return false;
  }
}

function saveRoom(roomName) {
  const cleanRoomName = normalizeRoomName(roomName);
  if (!cleanRoomName) return false;

  const savedRooms = readSavedRooms();
  const exists = savedRooms.some((savedRoom) => getRoomKey(savedRoom) === getRoomKey(cleanRoomName));
  if (exists) return true;

  savedRooms.push(cleanRoomName);
  const saved = writeSavedRooms(savedRooms);
  if (saved) log('ROOM', `Saved room "${cleanRoomName}" to data/rooms.json`);
  return saved;
}

function setRoomHandlers({ sendMessage, sendPrivateMessage, log: logger }) {
  sendMessageFunc = sendMessage;
  sendPrivateMessageFunc = sendPrivateMessage;
  logFunc = logger;
}

function sendPrivateMessage(toUsername, body) {
  if (typeof sendPrivateMessageFunc === 'function') {
    sendPrivateMessageFunc(toUsername, body);
  }
}

function sendRoomMsg(roomName, body, attachments = []) {
  if (!sendMessageFunc || !roomName) return false;

  return sendMessageFunc({
    handler: 'room_msg',
    payload: {
      room_name: roomName,
      body,
      attachments
    }
  });
}

function getMessageRoomName(message) {
  return (
    message.room ||
    message.room_name ||
    message.roomname ||
    message.message?.room ||
    message.message?.room_name ||
    message.payload?.room_name ||
    ''
  );
}

function getMessageSender(message) {
  return (
    message.message?.sender ||
    message.message?.from_username ||
    message.sender ||
    message.from_username ||
    ''
  );
}

function getMessageBody(message) {
  return String(message.message?.body || message.body || '').trim();
}

function addActiveRoom(roomName) {
  const cleanRoomName = normalizeRoomName(roomName);
  if (!cleanRoomName) return;

  const wasAlreadyActive = isBotInRoom(cleanRoomName);
  activeRooms.add(cleanRoomName);
  wantedRooms.add(cleanRoomName);

  if (!wasAlreadyActive) {
    log('ROOM', `Added active room "${cleanRoomName}". Active rooms: ${activeRooms.size}`);
  }
}

function removeActiveRoom(roomName) {
  const key = getRoomKey(roomName);
  if (!key) return;

  for (const activeRoom of activeRooms) {
    if (getRoomKey(activeRoom) === key) {
      activeRooms.delete(activeRoom);
      log('ROOM', `Removed active room "${activeRoom}". Active rooms: ${activeRooms.size}`);
      return;
    }
  }
}

function isBotInRoom(roomName) {
  const key = getRoomKey(roomName);
  if (!key) return false;
  return Array.from(activeRooms).some((room) => getRoomKey(room) === key);
}

function getWantedRoomName(roomName) {
  const key = getRoomKey(roomName);
  if (!key) return '';
  return Array.from(wantedRooms).find((room) => getRoomKey(room) === key) || normalizeRoomName(roomName);
}

function joinRoom(roomName, requestedBy = 'system') {
  const cleanRoomName = normalizeRoomName(roomName);
  if (!cleanRoomName) return false;

  if (!sendMessageFunc) {
    log('ERROR', 'Cannot join room: sendMessage function is not ready');
    return false;
  }

  if (isBotInRoom(cleanRoomName)) {
    if (requestedBy && !requestedBy.startsWith('system')) {
      sendPrivateMessage(requestedBy, `Bot is already in room: ${cleanRoomName}`);
    }
    return true;
  }

  const key = getRoomKey(cleanRoomName);
  wantedRooms.add(cleanRoomName);
  pendingJoins.set(key, { roomName: cleanRoomName, requestedBy });

  if (rejoinTimers.has(key)) {
    clearTimeout(rejoinTimers.get(key));
    rejoinTimers.delete(key);
  }

  log('ROOM', `Joining "${cleanRoomName}" requested by ${requestedBy || 'unknown'}`);

  return sendMessageFunc({
    handler: 'join_room',
    payload: {
      room_name: cleanRoomName
    }
  });
}

function joinSavedRooms() {
  const rooms = readSavedRooms();
  if (rooms.length === 0) {
    log('ROOM', 'No saved rooms found in data/rooms.json');
    return;
  }

  log('ROOM', `Auto-joining ${rooms.length} saved room(s) from data/rooms.json`);

  rooms
    .forEach((roomName) => joinRoom(roomName, 'system_auto_join'));
}

function getOldestPendingJoin() {
  const first = pendingJoins.entries().next();
  if (first.done) return { key: '', pending: null };
  return { key: first.value[0], pending: first.value[1] };
}

function handleJoinRoomResponse(message) {
  if (message.handler !== 'join_room') return;

  const roomName =
    message.room ||
    message.room_name ||
    message.roomname ||
    message.payload?.room_name ||
    '';

  let key = getRoomKey(roomName);
  let pending = key ? pendingJoins.get(key) : null;

  if (!pending && !key) {
    const oldest = getOldestPendingJoin();
    key = oldest.key;
    pending = oldest.pending;
  }

  const finalRoomName = normalizeRoomName(roomName || pending?.roomName);
  const requestedBy = pending?.requestedBy;

  if (!finalRoomName) return;
  if (key) pendingJoins.delete(key);

  if (message.status === 'success') {
    addActiveRoom(finalRoomName);
    saveRoom(finalRoomName);

    if (requestedBy && !requestedBy.startsWith('system')) {
      sendPrivateMessage(requestedBy, `Bot joined room: ${finalRoomName}`);
    }
    return;
  }

  removeActiveRoom(finalRoomName);
  log('ROOM', `Failed to join "${finalRoomName}": ${message.reason || 'unknown reason'}`);

  if (requestedBy && !requestedBy.startsWith('system')) {
    sendPrivateMessage(requestedBy, `Failed to join room: ${finalRoomName}\n${message.reason || ''}`.trim());
  }
}

function handlePresence(message, botUsername) {
  const username = message.username || message.payload?.username;
  const roomName = message.room || message.payload?.room_name || message.payload?.room;

  if (username === botUsername && roomName) {
    addActiveRoom(roomName);
  }
}

function handleRoomMessage(message, botUsername) {
  if (message.handler !== 'room_msg' || message.status !== 'success') return false;

  const roomName = getMessageRoomName(message);
  const sender = getMessageSender(message);
  const body = getMessageBody(message);

  if (!roomName || !body) return false;
  if (sender && sender === botUsername) return false;

  if (body.toLowerCase() !== '.help') return false;

  const helpMessage = [
    'Room commands:',
    ...GAME_COMMANDS
  ].join('\n');

  log('ROOM', `.help command in room "${roomName}" by ${sender || 'unknown'}`);
  sendRoomMsg(roomName, helpMessage);
  return true;
}

function scheduleRejoin(roomName) {
  const cleanRoomName = getWantedRoomName(roomName);
  const key = getRoomKey(cleanRoomName);
  if (!key || rejoinTimers.has(key)) return;

  log('ROOM', `Auto-rejoining "${cleanRoomName}" in 2 seconds`);
  const timer = setTimeout(() => {
    rejoinTimers.delete(key);
    joinRoom(cleanRoomName, 'system_auto_rejoin');
  }, 2000);

  rejoinTimers.set(key, timer);
}

function handleRoomKicked(message) {
  const roomName = message.roomname || message.room_name || message.room || message.payload?.room_name;
  const cleanRoomName = normalizeRoomName(roomName);
  if (!cleanRoomName) return;

  wantedRooms.add(cleanRoomName);
  removeActiveRoom(cleanRoomName);
  log('ROOM', `Kicked from "${cleanRoomName}": ${message.reason || 'unknown reason'}`);
  scheduleRejoin(cleanRoomName);
}

module.exports = {
  setRoomHandlers,
  joinRoom,
  joinSavedRooms,
  handleJoinRoomResponse,
  handlePresence,
  handleRoomMessage,
  handleRoomKicked
};
