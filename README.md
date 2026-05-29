# vibeschat-ws-bot

Minimal WebSocket bot for VibesChat. It is designed as a clean starter project for testing login, private commands, room joining, room commands, friend requests, and basic attachments.

## Platform

- Website: https://viberschat.space
- WebSocket: `wss://viberschat.space:8443`

## Features

- WebSocket connection and `3rd_login` authentication.
- Keep-alive ping every 15 seconds.
- Private message handling with `seen` status.
- Automatic friend request acceptance.
- Private `.join room_name` command.
- Saved room auto-join from `data/rooms.json`.
- Automatic rejoin after room kick.
- Room `.help`, `.s`, and `.pic` commands.
- File-only logging in `logs/bot.log`.

## Project Structure

```text
vibeschat-ws-bot/
  data/
    rooms.json             Saved rooms list
  logs/
    .gitkeep               Keeps the logs directory in git
    bot.log                Runtime log file, ignored by git
  config.example.json      Example config for GitHub
  config.json              Local bot credentials, ignored by git
  index.js                 WebSocket connection, login, ping, and routing
  pvt_handler.js           Private commands, seen status, and friend requests
  room_handler.js          Room join, saved rooms, presence, help, and rejoin
  games_handler.js         Example room commands and image attachment
  logger.js                File logger
  package.json
  package-lock.json
  README.md
```

## Setup

Node.js 18+ recommended.

Install dependencies:

```bash
npm install
```

Create `config.json` from `config.example.json`:

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

## Commands

Private commands:

```text
.join room_name
```

The bot joins the room and saves it to `data/rooms.json` after a successful join.

Room commands:

```text
.help
.s
.pic
```

- `.help` shows the available room commands.
- `.s` sends a simple test reply.
- `.pic` sends a text reply with a test image attachment.

## Runtime Data

Saved rooms are stored in `data/rooms.json`:

```json
[
  "room name here"
]
```

When the bot starts, it joins all saved rooms automatically.

## Logs

Logs are written only to:

```text
logs/bot.log
```

Example:

```text
[2026-05-29T00:04:34.425Z] [AUTH] Logged in as coin
```

## Notes

- Created by ɖαʀƙ.
- `config.json`, `node_modules/`, and runtime log files are ignored by git.
- This project intentionally avoids database, full game systems, music, and external services so the core WebSocket flow stays easy to study.
