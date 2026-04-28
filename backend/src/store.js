const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataFile = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'store.json');

const defaultStore = {
  admin: {
    username: 'admin',
    passwordHash: ''
  },
  telegram: {
    botToken: '',
    defaultChatId: '',
    birthdayMessageTemplate:
      'Happy Birthday, {name}! 🎉🎂 Wishing you an amazing day full of joy and celebration! 🥳✨',
    timezone: process.env.BOT_TIMEZONE || 'Asia/Beirut',
    lastRunDate: ''
  },
  members: []
};

let writeQueue = Promise.resolve();

async function buildInitialStore() {
  return {
    ...defaultStore,
    admin: {
      ...defaultStore.admin,
      passwordHash: await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10)
    }
  };
}

async function ensureFile() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(await buildInitialStore(), null, 2), 'utf-8');
  }
}

async function readStore() {
  await ensureFile();
  const raw = await fs.readFile(dataFile, 'utf-8');
  const parsed = JSON.parse(raw);

  return {
    ...defaultStore,
    ...parsed,
    admin: {
      ...defaultStore.admin,
      ...(parsed.admin || {})
    },
    telegram: {
      ...defaultStore.telegram,
      ...(parsed.telegram || {})
    },
    members: Array.isArray(parsed.members) ? parsed.members : []
  };
}

function writeStore(nextStore) {
  writeQueue = writeQueue.then(async () => {
    await ensureFile();
    await fs.writeFile(dataFile, JSON.stringify(nextStore, null, 2), 'utf-8');
  });

  return writeQueue;
}

async function readTelegramSettings() {
  const store = await readStore();
  return {
    botToken: store.telegram.botToken,
    defaultChatId: store.telegram.defaultChatId,
    birthdayMessageTemplate: store.telegram.birthdayMessageTemplate,
    timezone: store.telegram.timezone,
    lastRunDate: store.telegram.lastRunDate
  };
}

async function writeTelegramSettings(telegram) {
  const store = await readStore();
  store.telegram = {
    ...store.telegram,
    ...telegram
  };
  await writeStore(store);
  return store.telegram;
}

module.exports = {
  dataFile,
  readStore,
  readTelegramSettings,
  writeStore,
  writeTelegramSettings
};
