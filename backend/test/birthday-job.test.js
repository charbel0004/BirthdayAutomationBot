const test = require('node:test');
const assert = require('node:assert/strict');
const { registerBirthdayJob } = require('../src/birthday-job');

test('scheduled birthday endpoint requires its dedicated secret and supports a safe readiness check', async () => {
  const routes = {};
  let calls = 0;
  let result = { date: '2026-11-02', matched: [{ name: 'Private name' }], delivery: [{ status: 'sent' }] };
  registerBirthdayJob({
    get: (path, ...handlers) => { routes.GET = handlers; },
    post: (path, ...handlers) => { routes.POST = handlers; }
  }, async () => { calls += 1; return result; });
  const request = async (method, authorization) => {
    const res = {
      code: 200,
      status(code) { this.code = code; return this; },
      set() { return this; },
      json(body) { this.body = body; return this; }
    };
    let authorized = false;
    routes[method][0]({ get: () => authorization }, res, () => { authorized = true; });
    if (authorized) await routes[method][1]({}, res);
    return res;
  };
  const previous = process.env.BIRTHDAY_JOB_TOKEN;
  try {
    delete process.env.BIRTHDAY_JOB_TOKEN;
    assert.equal((await request('POST', '')).code, 503);
    process.env.BIRTHDAY_JOB_TOKEN = 'test-secret';
    assert.equal((await request('POST', '')).code, 401);
    assert.equal((await request('POST', 'Bearer wrong')).code, 401);
    assert.equal(calls, 0);
    assert.deepEqual((await request('GET', 'Bearer test-secret')).body, { ready: true });
    assert.equal(calls, 0);
    assert.deepEqual((await request('POST', 'Bearer test-secret')).body, {
      date: '2026-11-02', skipped: false, matched: 1, sent: 1
    });
    result = { skipped: true, date: '2026-11-02', matched: [] };
    assert.equal((await request('POST', 'Bearer test-secret')).body.skipped, true);
    result = { error: 'delivery failed' };
    assert.equal((await request('POST', 'Bearer test-secret')).code, 503);
  } finally {
    if (previous === undefined) delete process.env.BIRTHDAY_JOB_TOKEN;
    else process.env.BIRTHDAY_JOB_TOKEN = previous;
  }
});
