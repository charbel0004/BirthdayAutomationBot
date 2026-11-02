function createIdleShutdown({ timeoutMs, now = Date.now, onIdle }) {
  let lastActivity = now();
  let active = 0;
  let stopping = false;
  return {
    middleware(req, res, next) {
      if (req.path !== '/api/health') {
        active += 1;
        lastActivity = now();
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          active -= 1;
          lastActivity = now();
        };
        res.once('finish', finish);
        res.once('close', finish);
      }
      next();
    },
    check() {
      if (!stopping && active === 0 && now() - lastActivity >= timeoutMs) {
        stopping = true;
        onIdle();
      }
    }
  };
}

function installIdleShutdown(app) {
  const timeoutMs = Number(process.env.IDLE_SHUTDOWN_SECONDS || 0) * 1000;
  if (!process.env.FLY_APP_NAME || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return () => {};
  let server;
  const idle = createIdleShutdown({ timeoutMs, onIdle() {
    console.log('[idle-shutdown] No active requests; stopping until the next request.');
    server.close(() => process.exit(0));
  } });
  app.use(idle.middleware);
  return (listeningServer) => {
    server = listeningServer;
    const timer = setInterval(idle.check, 5000);
    timer.unref();
  };
}

module.exports = { createIdleShutdown, installIdleShutdown };
