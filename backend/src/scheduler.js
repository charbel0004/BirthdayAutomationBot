const { birthdaysCollection, logisticsItemsCollection } = require('./db');
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

function formatStockAmount(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function pluralizeUnit(value, amount) {
  const unit = String(value || '').trim();
  if (!unit || Number(amount) === 1 || unit.endsWith('s')) return unit;
  if (/(s|x|z|ch|sh)$/i.test(unit)) return `${unit}es`;
  if (/[^aeiou]y$/i.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

function describeStockAmount(value, item) {
  const amount = Number(value);
  const unit = item.unit ? ` ${item.unit}` : '';
  const packageSize = Number(item.unitsPerPackage);

  if (!item.packageUnit || !Number.isFinite(packageSize) || packageSize <= 0) {
    return `${formatStockAmount(amount)}${unit}`;
  }

  const packages = Math.floor(amount / packageSize);
  const looseUnits = Number((amount - packages * packageSize).toFixed(6));
  const parts = [];
  if (packages) parts.push(`${formatStockAmount(packages)} ${pluralizeUnit(item.packageUnit, packages)}`);
  if (looseUnits || !packages) parts.push(`${formatStockAmount(looseUnits)}${unit}`);
  return `${parts.join(' + ')} (${formatStockAmount(amount)}${unit} total)`;
}

function buildLogisticsMessage(template, items) {
  const itemLines = items
    .map((item) => {
      return `• ${item.name}: ${describeStockAmount(item.quantity, item)} remaining (reorder at ${describeStockAmount(item.reorderPoint, item)})`;
    })
    .join('\n');

  return template.replace('{items}', itemLines);
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

async function runLogisticsCheck({ force = false } = {}) {
  const telegram = await readTelegramSettings();
  const timezone = telegram.timezone || 'Asia/Beirut';
  const { isoDate } = getTodayParts(timezone);

  if (!force && telegram.logisticsLastRunDate === isoDate) {
    return { skipped: true, reason: 'Already run today', date: isoDate, lowStockItems: [] };
  }

  const lowStockItems = await logisticsItemsCollection()
    .find({
      active: { $ne: false },
      $expr: { $lte: ['$quantity', '$reorderPoint'] }
    })
    .sort({ category: 1, name: 1 })
    .toArray();

  const sanitizedItems = lowStockItems.map((item) => ({
    id: String(item._id),
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    reorderPoint: item.reorderPoint,
    unit: item.unit,
    packageUnit: item.packageUnit || '',
    unitsPerPackage: item.unitsPerPackage || null
  }));

  if (lowStockItems.length > 0) {
    if (!telegram.botToken) {
      return {
        skipped: false,
        date: isoDate,
        lowStockItems: sanitizedItems,
        error: 'Missing Telegram bot token'
      };
    }

    if (!telegram.logisticsChatId) {
      return {
        skipped: false,
        date: isoDate,
        lowStockItems: sanitizedItems,
        error: 'Missing Telegram logistics chat ID'
      };
    }

    const template = telegram.logisticsMessageTemplate || defaultLogisticsMessageTemplate;
    try {
      await sendTelegramMessage({
        botToken: telegram.botToken,
        chatId: telegram.logisticsChatId,
        text: buildLogisticsMessage(template, lowStockItems)
      });
    } catch (error) {
      return {
        skipped: false,
        date: isoDate,
        lowStockItems: sanitizedItems,
        error: error.message
      };
    }
  }

  await writeTelegramSettings({ logisticsLastRunDate: isoDate });

  return {
    skipped: false,
    date: isoDate,
    lowStockItems: sanitizedItems,
    sent: lowStockItems.length > 0,
    chatId: lowStockItems.length > 0 ? telegram.logisticsChatId : undefined
  };
}

const defaultLogisticsMessageTemplate =
  '📦 Logistics reorder reminder\n\nThe following items are at or below their reorder point:\n{items}\n\nPlease review the logistics inventory.';

function getDelayUntilNextMidnightMs(timezone) {
  const now = new Date();
  const zonedNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const nextMidnight = new Date(zonedNow);

  nextMidnight.setHours(24, 0, 5, 0);
  return nextMidnight.getTime() - zonedNow.getTime();
}

function startBirthdayScheduler() {
  (async () => {
    const birthdayResult = await runBirthdayCheck();
    const logisticsResult = await runLogisticsCheck();
    return [birthdayResult, logisticsResult];
  })()
    .then(([birthdayResult, logisticsResult]) => {
      if (birthdayResult?.error) {
        console.error('[birthday-check] startup run incomplete:', birthdayResult.error);
      }
      if (logisticsResult?.error) {
        console.error('[logistics-check] startup run incomplete:', logisticsResult.error);
      }
    })
    .catch((err) => {
      console.error('[reminder-check] startup run failed:', err.message);
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
          const birthdayResult = await runBirthdayCheck();
          const logisticsResult = await runLogisticsCheck();
          if (birthdayResult?.error) {
            console.error('[birthday-check] scheduled run incomplete:', birthdayResult.error);
          }
          if (logisticsResult?.error) {
            console.error('[logistics-check] scheduled run incomplete:', logisticsResult.error);
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
  runLogisticsCheck,
  startBirthdayScheduler
};
