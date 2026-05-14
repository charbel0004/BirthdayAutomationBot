const { birthdaysCollection, usersCollection } = require('./db');
const { readTelegramSettings, writeTelegramSettings } = require('./store');
const { sendTelegramMessage } = require('./telegram');

function pad(n) {
  return String(n).padStart(2, '0');
}

function getTodayParts(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  const isoDate = `${year}-${month}-${day}`;
  const mmdd = `${pad(month)}-${pad(day)}`;

  return { isoDate, mmdd };
}

function buildBirthdayMessage(template, member) {
  return template.replace('{name}', member.name);
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

async function runBirthdayCheck({ force = false } = {}) {
  const telegram = await readTelegramSettings();
  const timezone = telegram.timezone || 'Asia/Beirut';
  const { isoDate, mmdd } = getTodayParts(timezone);
  const year = Number(isoDate.split('-')[0]);

  if (!force && telegram.lastRunDate === isoDate) {
    return { skipped: true, reason: 'Already run today', date: isoDate, matched: [] };
  }

  const baseMatch = {
    active: true,
    $or: [
      { birthdate: mmdd },
      ...(mmdd === '02-28' && !isLeapYear(year) ? [{ birthdate: '02-29' }] : [])
    ]
  };

  const matched = await birthdaysCollection()
    .find(baseMatch)
    .project({ name: 1, userId: 1 })
    .toArray();

  const birthdayOwners = matched.length
    ? await usersCollection()
        .find({ _id: { $in: matched.map((member) => member.userId).filter(Boolean) } })
        .project({ role: 1 })
        .toArray()
    : [];
  const ownersById = new Map(birthdayOwners.map((user) => [String(user._id), user]));

  if (matched.length > 0 && telegram.botToken) {
    const template = telegram.birthdayMessageTemplate || 'Happy Birthday, {name}!';

    for (const member of matched) {
      const owner = ownersById.get(String(member.userId || ''));
      const targetChatId = owner?.role === 'new recruit'
        ? telegram.newRecruitsGroupChatId
        : telegram.membersGroupChatId;

      if (!targetChatId) {
        continue;
      }

      await sendTelegramMessage({
        botToken: telegram.botToken,
        chatId: targetChatId,
        text: buildBirthdayMessage(template, member)
      });
    }
  }

  await writeTelegramSettings({ lastRunDate: isoDate });

  return {
    skipped: false,
    date: isoDate,
    matched: matched.map((member) => ({ id: String(member._id), name: member.name }))
  };
}

function getDelayUntilNextMidnightMs(timezone) {
  const now = new Date();
  const zonedNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const nextMidnight = new Date(zonedNow);

  nextMidnight.setHours(24, 0, 5, 0);
  return nextMidnight.getTime() - zonedNow.getTime();
}

function startBirthdayScheduler() {
  runBirthdayCheck().catch((err) => {
    console.error('[birthday-check] startup run failed:', err.message);
  });

  let timeoutId;
  let stopped = false;

  const scheduleNext = async () => {
    if (stopped) {
      return;
    }

    try {
      const telegram = await readTelegramSettings();
      const timezone = telegram.timezone || 'Asia/Beirut';
      const delayMs = getDelayUntilNextMidnightMs(timezone);

      timeoutId = setTimeout(async () => {
        try {
          await runBirthdayCheck();
        } catch (error) {
          console.error('[birthday-check] scheduled run failed:', error.message);
        } finally {
          scheduleNext();
        }
      }, delayMs);
    } catch (error) {
      console.error('[birthday-check] failed to schedule next run:', error.message);
      timeoutId = setTimeout(scheduleNext, 60 * 60 * 1000);
    }
  };

  scheduleNext();

  return () => {
    stopped = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}

module.exports = {
  runBirthdayCheck,
  startBirthdayScheduler
};
