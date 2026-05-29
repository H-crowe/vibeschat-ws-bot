# vibeschat-ws-bot

Minimal VibesChat websocket bot for testing connection, private commands, friend requests, and room joining.

This project is a small extracted version of the main bot. It has no database, no games, no music, and no extra services. It only keeps the core websocket flow easy to read and test.

Created by **Dark**.

## Features

- Connects to the websocket server.
- Logs in with `3rd_login`.
- Sends `ping` every 15 seconds to keep the socket alive.
- Handles private messages.
- Marks private messages as `seen`.
- Accepts incoming friend requests automatically.
- Joins rooms with the private command `.join room_name`.
- Saves joined rooms in `data/rooms.json`.
- Auto-joins saved rooms when the bot starts.
- Rejoins a room automatically after being kicked.
- Writes logs to `logs/bot.log`.

## Project Structure

```text
vibeschat-ws-bot/
  data/
    rooms.json          Saved rooms list
  logs/
    bot.log             Runtime log file, created automatically
  config.json           Bot account and websocket server config
  index.js              Websocket connection, login, ping, and message routing
  pvt_handler.js        Private commands, seen status, and friend requests
  room_handler.js       Room join, saved rooms, presence, and rejoin logic
  logger.js             Console and file logger
  package.json
  README.md
```

## Setup

Install dependencies:

```bash
npm install
```

Create `config.json` from `config.example.json`, then add the bot account details:

```json
{
  "server_url": "wss://viberschat.space:8443",
  "username": "BOT_USERNAME",
  "password": "BOT_PASSWORD",
  "api_key": "BOT_API_KEY"
}
```

If you need an API key, contact the application admin.

Start the bot:

```bash
npm start
```

## Private Commands

Send the bot a private message:

```text
.join room_name
```

Example:

```text
.join null
```

The bot will try to join the room. If the join succeeds, the room name is saved to `data/rooms.json`.

## Friend Requests

Friend request logic is inside `pvt_handler.js`.

The bot:

- Checks pending friend requests after login.
- Rechecks pending friend requests every minute.
- Accepts live `friend_request` notifications immediately.

## Saved Rooms

Saved rooms are stored as a JSON array:

```json
[
  "room name here"
]
```

When the bot starts, it reads `data/rooms.json` and joins every saved room automatically.

## Logs

All logs are written to:

```text
logs/bot.log
```

Example log line:

```text
[2026-05-29T00:04:34.425Z] [AUTH] Logged in as coin
```

## Notes

- Created by Dark.
- Private command and friend request logic lives in `pvt_handler.js`.
- Room logic lives in `room_handler.js`.
- Runtime data lives in `data/`.
- Runtime logs live in `logs/`.
- `config.json` contains account credentials, so do not commit real production credentials to a public repository.
