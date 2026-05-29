const PRIVATE_COMMANDS = {
  help: {
    names: ['help', '\u0645\u0633\u0627\u0639\u062f\u0629']
  },
  join: {
    names: ['.join']
  }
};

let sendMessageFunc = null;
let logFunc = null;
let friendCheckTimer = null;

function log(scope, message) {
  if (typeof logFunc === 'function') {
    logFunc(scope, message);
  }
}

function setPvtHandlers({ sendMessage, log: logger }) {
  sendMessageFunc = sendMessage;
  logFunc = logger;
}

function sendPvtMessage(sendMessage, toUsername, body) {
  sendMessage({
    handler: 'pvt_chat',
    payload: {
      to_username: toUsername,
      body
    }
  });
}

function checkFriendRequests() {
  if (!sendMessageFunc) return false;

  return sendMessageFunc({
    handler: 'get_friend_requests'
  });
}

function startFriendRequestsCheck(intervalMs = 60 * 1000) {
  if (!sendMessageFunc) return;

  if (friendCheckTimer) {
    clearInterval(friendCheckTimer);
    friendCheckTimer = null;
  }

  log('FRIENDS', 'Checking friend requests');
  checkFriendRequests();

  friendCheckTimer = setInterval(() => {
    checkFriendRequests();
  }, intervalMs);
}

function stopFriendRequestsCheck() {
  if (friendCheckTimer) {
    clearInterval(friendCheckTimer);
    friendCheckTimer = null;
  }
}

function acceptFriendRequest(requestId) {
  if (!sendMessageFunc || !requestId) return false;

  return sendMessageFunc({
    handler: 'accept_friend_request',
    payload: {
      request_id: requestId
    }
  });
}

function handleFriendRequestsResponse(message) {
  if (message.handler !== 'friends_requests' || message.status !== 'success') return;

  const requests = Array.isArray(message.requests) ? message.requests : [];
  if (requests.length === 0) return;

  log('FRIENDS', `Found ${requests.length} friend request(s)`);

  requests.forEach((request) => {
    const requestId = request.id || request.request_id;
    const fromUser = request.from_username || request.username || 'unknown';
    log('FRIENDS', `Accepting request from ${fromUser}`);
    acceptFriendRequest(requestId);
  });
}

function handleFriendNotification(message) {
  if (message.handler !== 'notification' || message.type !== 'friend_request') return;

  const fromUser = message.from_username || message.username || 'unknown';
  const requestId = message.request_id || message.id;

  log('FRIENDS', `Friend request from ${fromUser}`);
  acceptFriendRequest(requestId);
}

function markMessageAsSeen(sendMessage, messageId) {
  if (!messageId) return;

  sendMessage({
    handler: 'pvt_msg_status',
    payload: {
      message_id: messageId,
      status: 'seen'
    }
  });
}

function getHelpMessage() {
  return [
    'Private commands:',
    '.join room_name - Join bot to room',
    'help - Show this message'
  ].join('\n');
}

function parseCommand(body) {
  const cleanBody = String(body || '').trim();
  const lowerBody = cleanBody.toLowerCase();

  if (PRIVATE_COMMANDS.help.names.includes(lowerBody)) {
    return { name: 'help', args: '' };
  }

  for (const commandName of PRIVATE_COMMANDS.join.names) {
    const lowerCommandName = commandName.toLowerCase();
    if (lowerBody.startsWith(`${lowerCommandName} `)) {
      return {
        name: 'join',
        args: cleanBody.slice(commandName.length).trim()
      };
    }
  }

  return null;
}

function handlePvtMessage(message, helpers) {
  const msg = message.message || {};
  const fromUser = msg.from_username;

  if (!fromUser) return;
  if (fromUser === helpers.getBotUsername()) return;

  markMessageAsSeen(helpers.sendMessage, msg.id);

  const body = String(msg.body || '').trim();
  if (!body) return;

  helpers.log('PVT', `${fromUser}: ${body}`);

  const command = parseCommand(body);
  if (!command) return;

  if (command.name === 'help') {
    sendPvtMessage(helpers.sendMessage, fromUser, getHelpMessage());
    return;
  }

  if (command.name === 'join') {
    if (!command.args) {
      sendPvtMessage(helpers.sendMessage, fromUser, 'Usage: .join room_name');
      return;
    }

    helpers.joinRoom(command.args, fromUser);
  }
}

module.exports = {
  setPvtHandlers,
  handlePvtMessage,
  sendPvtMessage,
  startFriendRequestsCheck,
  stopFriendRequestsCheck,
  handleFriendRequestsResponse,
  handleFriendNotification
};
