const { birthdaysCollection } = require('./db');
const {
  claimBirthdayDelivery,
  readTelegramSettings,
  releaseBirthdayDelivery,
  writeTelegramSettings
} = require('./settings');
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
    .project({ name: 1 })
    .toArray();
  const delivery = [];

  if (matched.length > 0) {
    const template = telegram.birthdayMessageTemplate || 'Happy Birthday, {name}!';
    const targetChatId = telegram.birthdayChatId;

    for (const member of matched) {
      if (!telegram.botToken) {
        delivery.push({
          memberId: String(member._id),
          name: member.name,
          status: 'skipped',
          reason: 'Missing Telegram bot token'
        });
        continue;
      }

      if (!targetChatId) {
        delivery.push({
          memberId: String(member._id),
          name: member.name,
          status: 'skipped',
          reason: 'Missing Telegram birthday chat ID'
        });
        continue;
      }

      const memberId = String(member._id);
      const claimed = await claimBirthdayDelivery(isoDate, memberId);
      if (!claimed) {
        delivery.push({
          memberId,
          name: member.name,
          status: 'already-sent',
          reason: 'Birthday message already delivered today'
        });
        continue;
      }

      try {
        await sendTelegramMessage({
          botToken: telegram.botToken,
          chatId: targetChatId,
          text: buildBirthdayMessage(template, member)
        });

        delivery.push({
          memberId,
          name: member.name,
          status: 'sent',
          chatId: targetChatId
        });
      } catch (error) {
        await releaseBirthdayDelivery(isoDate, memberId);
        delivery.push({
          memberId,
          name: member.name,
          status: 'failed',
          reason: error.message
        });
      }
    }
  }

  const blockedDeliveries = delivery.filter((item) => item.status === 'skipped' || item.status === 'failed');

  if (blockedDeliveries.length > 0) {
    return {
      skipped: false,
      date: isoDate,
      matched: matched.map((member) => ({ id: String(member._id), name: member.name })),
      delivery,
      error: blockedDeliveries.map((item) => `${item.name}: ${item.reason}`).join('; ')
    };
  }

  await writeTelegramSettings({ lastRunDate: isoDate });

  return {
    skipped: false,
    date: isoDate,
    matched: matched.map((member) => ({ id: String(member._id), name: member.name })),
    delivery
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
  runBirthdayCheck()
    .then((result) => {
      if (result?.error) {
        console.error('[birthday-check] startup run incomplete:', result.error);
      }
    })
    .catch((err) => {
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
          const result = await runBirthdayCheck();
          if (result?.error) {
            console.error('[birthday-check] scheduled run incomplete:', result.error);
          }
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
