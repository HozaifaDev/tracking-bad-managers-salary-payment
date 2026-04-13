/**
 * Read/write config.json from disk so edits apply without server restart.
 * CONFIG_PATH in .env is relative to the backend directory.
 */
const fs = require('fs');
const path = require('path');

function getConfigPath() {
  const raw = process.env.CONFIG_PATH || '../config.json';
  return path.resolve(__dirname, '..', raw);
}

function readConfig() {
  const p = getConfigPath();
  if (!fs.existsSync(p)) {
    throw new Error(`config.json not found at ${p}`);
  }
  const text = fs.readFileSync(p, 'utf8');
  return JSON.parse(text);
}

function writeConfig(obj) {
  const p = getConfigPath();
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  return obj;
}

module.exports = { readConfig, writeConfig, getConfigPath };
