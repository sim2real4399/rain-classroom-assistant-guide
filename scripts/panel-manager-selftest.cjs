const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/../yuketang-ComplexAutomation.user.js', 'utf8');
const instrumented = source.replace(/\n  PanelManager\.registerMenu\(\);\n  boot\(\)\.catch\(error => PanelManager\.reportError\(error\)\);\s*\n\}\)\(\);\s*$/, `
  globalThis.testAPI = { Utils, Store, StopGate, PanelManager, SecurityGuard, Decipherer, boot,
    setFactory(value) { createPanel = value; }, setPanel(value) { panel = value; } };
})();`);
assert.notEqual(source, instrumented);
function fixture() {
  const observers = [], timers = new Map(), documentEvents = new Map(), windowEvents = new Map(), menus = [];
  const store = new Map();
  const runtimeCalls = { security: 0, decipherer: 0 };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} }, URL,
    document: { body: null, documentElement: {}, getElementById: () => null,
      addEventListener: (name, fn) => documentEvents.set(name, fn),
      removeEventListener: name => documentEvents.delete(name) },
    window: { addEventListener: (name, fn) => windowEvents.set(name, fn),
      removeEventListener: name => windowEvents.delete(name) },
    location: { href: 'https://www.yuketang.cn/ai-workspace/lms-graph/1/exercise/2' },
    localStorage: { getItem: key => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) },
    setTimeout: fn => { timers.set(timers.size + 1, fn); return timers.size; },
    clearTimeout: id => timers.delete(id),
    MutationObserver: class {
      constructor(fn) { this.fn = fn; observers.push(this); }
      observe() {} disconnect() { this.disconnected = true; }
    },
    GM_registerMenuCommand: (title, callback) => menus.push({ title, callback }),
  });
  vm.runInContext(instrumented, context, { timeout: 2000 });
  context.testAPI.SecurityGuard.start = () => runtimeCalls.security++;
  context.testAPI.Decipherer.start = () => runtimeCalls.decipherer++;
  return { ...context.testAPI, context, observers, timers, documentEvents, windowEvents, menus, store, runtimeCalls };
}
(async () => {
  {
    const f = fixture();
    let resolved = false;
    const waiting = f.Utils.waitForMountTarget().then(value => { resolved = true; return value; });
    await Promise.resolve();
    assert.equal(resolved, false, 'html element alone is not a safe panel mount target');
    f.context.document.body = { tag: 'body' };
    f.observers[0].fn();
    assert.equal((await waiting).tag, 'body');
    assert.equal(f.timers.size, 0);
    assert.equal(f.documentEvents.size, 0);
    assert.equal(f.windowEvents.size, 0);
    assert.equal(f.observers[0].disconnected, true);
  }
  {
    const f = fixture();
    const waiting = f.Utils.waitForMountTarget();
    Array.from(f.timers.values())[0]();
    assert.equal(await waiting, null, 'timeout does not mount on documentElement');
  }
  {
    const f = fixture();
    f.context.document.body = {};
    let created = 0, shown = 0, handlerSet = 0;
    const healthyPanel = { iframe: { isConnected: true }, doc: { getElementById: () => ({}) },
      show: () => shown++, setStartHandler: () => handlerSet++, log() {} };
    f.setFactory(() => { created++; return healthyPanel; });
    f.store.set('ykt_ai_conf', 'previous-model-settings');
    const values = await Promise.all([f.PanelManager.show(), f.PanelManager.show()]);
    assert.equal(created, 1, 'boot and menu share one initialization');
    assert.equal(values[0], healthyPanel);
    assert.equal(values[1], healthyPanel);
    assert.equal(handlerSet, 1);
    await f.PanelManager.show();
    assert.equal(created, 1, 'hidden healthy panel is restored, not recreated');
    assert.equal(shown, 2);
    assert.equal(f.store.get('ykt_ai_conf'), 'previous-model-settings');
    f.PanelManager.registerMenu();
    f.PanelManager.registerMenu();
    assert.equal(f.menus.length, 1);
    assert.equal(f.menus[0].title, '显示/恢复雨课堂助手面板');
    await f.menus[0].callback();
    assert.equal(shown, 3);
    assert.deepEqual(f.runtimeCalls, { security: 1, decipherer: 1 }, 'restore does not duplicate runtime services');
    healthyPanel.iframe.isConnected = false;
    let stopped = 0;
    f.StopGate.abortInflight = () => stopped++;
    const recovered = { ...healthyPanel, iframe: { isConnected: true } };
    f.setFactory(() => recovered);
    await f.PanelManager.show();
    assert.equal(stopped, 1, 'detached panel recovery stops the old runner before replacement');
    assert.equal(f.StopGate.stopped, true);
    assert.deepEqual(f.runtimeCalls, { security: 1, decipherer: 1 }, 'rebuilding a panel does not restart services');
  }
  {
    const f = fixture();
    f.context.document.body = {};
    let errors = 0;
    f.PanelManager.reportError = () => errors++;
    f.setFactory(() => { throw Error('test initialization failure'); });
    const results = await Promise.all([f.PanelManager.show(), f.PanelManager.show()]);
    assert.deepEqual(results, [null, null], 'concurrent callers get handled failures');
    assert.equal(errors, 1);
    assert.equal(f.PanelManager.pending, null, 'failed initialization can be retried');
    assert.deepEqual(f.runtimeCalls, { security: 0, decipherer: 0 });
  }
  {
    const f = fixture();
    f.context.document.body = {};
    let shown = 0, started = 0;
    f.PanelManager.reportError = () => {};
    f.setFactory(() => { throw Error('first boot fails'); });
    await f.boot();
    assert.deepEqual(f.runtimeCalls, { security: 0, decipherer: 0 });
    f.setFactory(() => ({ iframe: { isConnected: true }, doc: { getElementById: () => ({}) },
      show: () => shown++, start: () => started++, setStartHandler() {}, log() {} }));
    f.PanelManager.registerMenu();
    await f.menus[0].callback();
    await f.menus[0].callback();
    assert.equal(shown, 2);
    assert.deepEqual(f.runtimeCalls, { security: 1, decipherer: 1 }, 'menu recovery after failed boot initializes both runtime services once');
    assert.equal(started, 0, 'menu recovery never starts homework');
    assert.equal(f.timers.size, 0, 'menu recovery schedules no automatic continuation');
  }
  console.log('OK: body readiness/timeout cleanup, single initialization, menu restore, detached recovery, settings preservation, retryable errors and runtime recovery without auto-start');
})().catch(error => { console.error(error); process.exitCode = 1; });
