const { appSettingsCollection, now } = require('./db');
const { readStore } = require('./store');

const TELEGRAM_SETTINGS_ID = 'telegram';

const defaultTelegramSettings = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  birthdayChatId: '',
  logisticsChatId: '',
  birthdayMessageTemplate:
    'Happy Birthday, {name}! 🎉🎂 Wishing you an amazing day full of joy and celebration! 🥳✨',
  logisticsMessageTemplate:
    '📦 Logistics reorder reminder\n\nThe following items are at or below their reorder point:\n{items}\n\nPlease review the logistics inventory.',
  timezone: process.env.BOT_TIMEZONE || 'Asia/Beirut',
  lastRunDate: '',
  logisticsLastRunDate: ''
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
    logisticsChatId: legacyTelegram.logisticsChatId || '',
    birthdayMessageTemplate: legacyTelegram.birthdayMessageTemplate,
    logisticsMessageTemplate: legacyTelegram.logisticsMessageTemplate,
    timezone: legacyTelegram.timezone,
    lastRunDate: legacyTelegram.lastRunDate,
    logisticsLastRunDate: legacyTelegram.logisticsLastRunDate
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

async function claimBirthdayDelivery(date, memberId) {
  await readTelegramSettings();
  const deliveryKey = `${date}:${memberId}`;
  const result = await appSettingsCollection().updateOne(
    {
      _id: TELEGRAM_SETTINGS_ID,
      birthdayDeliveryKeys: { $ne: deliveryKey }
    },
    {
      $addToSet: { birthdayDeliveryKeys: deliveryKey },
      $set: { updatedAt: now() }
    }
  );

  return result.modifiedCount === 1;
}

async function releaseBirthdayDelivery(date, memberId) {
  const deliveryKey = `${date}:${memberId}`;
  await appSettingsCollection().updateOne(
    { _id: TELEGRAM_SETTINGS_ID },
    {
      $pull: { birthdayDeliveryKeys: deliveryKey },
      $set: { updatedAt: now() }
    }
  );
}

module.exports = {
  claimBirthdayDelivery,
  readTelegramSettings,
  releaseBirthdayDelivery,
  writeTelegramSettings
};
