const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createIdleShutdown } = require('../src/idle-shutdown');

test('idle shutdown ignores health probes, waits for requests and fires once', () => {
  let time = 0;
  let exits = 0;
  const idle = createIdleShutdown({ timeoutMs: 120000, now: () => time, onIdle: () => { exits += 1; } });
  const request = new EventEmitter();
  time = 100000;
  idle.middleware({ path: '/api/internal/birthdays/check' }, request, () => {});
  time = 300000;
  idle.check();
  assert.equal(exits, 0, 'An in-flight delivery must keep the machine awake');
  request.emit('finish');
  request.emit('close');
  time = 419999;
  idle.middleware({ path: '/api/health' }, new EventEmitter(), () => {});
  idle.check();
  assert.equal(exits, 0);
  time = 420000;
  idle.check();
  idle.check();
  assert.equal(exits, 1, 'Health checks must not keep an idle machine running');
});
