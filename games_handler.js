let sendMessageFunc = null;
let logFunc = null;

const PIC_URL = 'https://hagleysbeauty.com/wp-content/uploads/2023/03/test-button-1-600x600.jpg';
const GAME_COMMANDS = [
  '.s - test text reply',
  '.pic - test image attachment'
];

function log(scope, message) {
  if (typeof logFunc === 'function') {
    logFunc(scope, message);
  }
}

function setGamesHandlers({ sendMessage, log: logger }) {
  sendMessageFunc = sendMessage;
  logFunc = logger;
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

function getRoomName(message) {
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

function getSender(message) {
  return (
    message.message?.sender ||
    message.message?.from_username ||
    message.sender ||
    message.from_username ||
    ''
  );
}

function getBody(message) {
  return String(message.message?.body || message.body || '').trim();
}

function handleRoomMessage(message, botUsername) {
  if (message.handler !== 'room_msg' || message.status !== 'success') return;

  const roomName = getRoomName(message);
  const sender = getSender(message);
  const body = getBody(message);

  if (!roomName || !body) return;
  if (sender && sender === botUsername) return;

  const lowerBody = body.toLowerCase();

  if (lowerBody === '.s') {
    log('GAMES', `.s command in room "${roomName}" by ${sender || 'unknown'}`);
    sendRoomMsg(roomName, 'Spin test command is working.');
    return;
  }

  if (lowerBody === '.pic') {
    log('GAMES', `.pic command in room "${roomName}" by ${sender || 'unknown'}`);
    sendRoomMsg(roomName, 'Here is a test picture.', [PIC_URL]);
  }
}

module.exports = {
  setGamesHandlers,
  handleRoomMessage,
  GAME_COMMANDS
};
