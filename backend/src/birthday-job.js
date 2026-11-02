const { createHash, timingSafeEqual } = require('node:crypto');

function registerBirthdayJob(app, runBirthdayCheck) {
  const path = '/api/internal/birthdays/check';
  const authorize = (req, res, next) => {
    const expected = process.env.BIRTHDAY_JOB_TOKEN;
    if (!expected) return res.status(503).json({ error: 'Birthday job is not configured.' });
    const supplied = req.get('authorization') || '';
    const digest = (value) => createHash('sha256').update(value).digest();
    if (!timingSafeEqual(digest(supplied), digest(`Bearer ${expected}`))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.set('Cache-Control', 'no-store');
    next();
  };

  // Readiness check lets deployments verify credentials without sending messages.
  app.get(path, authorize, (req, res) => res.json({ ready: true }));
  app.post(path, authorize, async (req, res) => {
    try {
      const result = await runBirthdayCheck();
      if (result.error) {
        console.error('[birthday-job] delivery incomplete:', result.error);
        return res.status(503).json({ error: 'Birthday delivery incomplete; retry required.' });
      }
      return res.json({
        date: result.date,
        skipped: Boolean(result.skipped),
        matched: result.matched?.length || 0,
        sent: result.delivery?.filter((item) => item.status === 'sent').length || 0
      });
    } catch (error) {
      console.error('[birthday-job] check failed:', error.message);
      return res.status(503).json({ error: 'Birthday check failed; retry required.' });
    }
  });
}

module.exports = { registerBirthdayJob };
