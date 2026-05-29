const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function formatLine(scope, message) {
  return `[${new Date().toISOString()}] [${scope}] ${message}`;
}

function log(scope, message) {
  const line = formatLine(scope, message);

  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
  } catch {
    // Keep the bot silent if log writing fails.
  }
}

module.exports = {
  log
};
