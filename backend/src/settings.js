const { appSettingsCollection, now } = require('./db');
const { readStore } = require('./store');

const TELEGRAM_SETTINGS_ID = 'telegram';

const defaultTelegramSettings = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  birthdayChatId: '',
  birthdayMessageTemplate:
    'Happy Birthday, {name}! 🎉🎂 Wishing you an amazing day full of joy and celebration! 🥳✨',
  timezone: process.env.BOT_TIMEZONE || 'Asia/Beirut',
  lastRunDate: ''
};

function sanitizeTelegramSettings(doc = {}) {
  const {
    _id,
    createdAt,
    updatedAt,
    migratedFrom,
    ...settings
  } = doc;

  return {
    ...defaultTelegramSettings,
    ...settings
  };
}

async function migrateLegacyTelegramSettings() {
  const store = await readStore();
  const legacyTelegram = store.telegram || {};
  const settings = sanitizeTelegramSettings({
    botToken: legacyTelegram.botToken || process.env.TELEGRAM_BOT_TOKEN || '',
    birthdayChatId:
      legacyTelegram.birthdayChatId ||
      legacyTelegram.membersGroupChatId ||
      legacyTelegram.defaultChatId ||
      legacyTelegram.newRecruitsGroupChatId ||
      '',
    birthdayMessageTemplate: legacyTelegram.birthdayMessageTemplate,
    timezone: legacyTelegram.timezone,
    lastRunDate: legacyTelegram.lastRunDate
  });
  const timestamp = now();

  await appSettingsCollection().updateOne(
    { _id: TELEGRAM_SETTINGS_ID },
    {
      $set: {
        ...settings,
        migratedFrom: 'store.json',
        updatedAt: timestamp
      },
      $setOnInsert: { createdAt: timestamp }
    },
    { upsert: true }
  );

  return settings;
}

async function readTelegramSettings() {
  const existing = await appSettingsCollection().findOne({ _id: TELEGRAM_SETTINGS_ID });

  if (existing) {
    return sanitizeTelegramSettings(existing);
  }

  return migrateLegacyTelegramSettings();
}

async function writeTelegramSettings(telegram) {
  const current = await readTelegramSettings();
  const nextTelegram = Object.fromEntries(
    Object.entries(telegram || {}).filter(([, value]) => value !== undefined)
  );
  const nextSettings = sanitizeTelegramSettings({
    ...current,
    ...nextTelegram
  });
  const timestamp = now();

  await appSettingsCollection().updateOne(
    { _id: TELEGRAM_SETTINGS_ID },
    {
      $set: {
        ...nextSettings,
        updatedAt: timestamp
      },
      $setOnInsert: { createdAt: timestamp }
    },
    { upsert: true }
  );

  return nextSettings;
}

module.exports = {
  readTelegramSettings,
  writeTelegramSettings
};
