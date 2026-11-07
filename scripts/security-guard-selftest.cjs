const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/../yuketang-ComplexAutomation.user.js', 'utf8');

function fixture() {
  const nodes = [], frames = [], observers = [], timeouts = new Map(), intervals = new Map();
  let nextTimer = 1;
  const doc = { body: {}, documentElement: {},
    getElementById: () => null,
    querySelectorAll: () => frames,
    createTreeWalker: () => { let i = 0; return { nextNode: () => nodes[i++] || null }; },
    defaultView: { frameElement: null, getComputedStyle: el => el.styleState || {} },
  };
  const addTitle = (text = '请完成安全校验', visible = true, target = doc, list = nodes) => {
    const element = { ownerDocument: target, hidden: false, parentElement: null,
      getClientRects: () => visible ? [{}] : [], closest: () => null };
    const node = { nodeValue: text, parentElement: element };
    list.push(node);
    return element;
  };
  const storage = () => { const map = new Map(); return {
    getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  }; };
  const context = vm.createContext({
    URL, console, document: doc, window: {}, localStorage: storage(), sessionStorage: storage(),
    location: { href: 'https://www.yuketang.cn/ai-workspace/lms-graph/1/exercise/2',
      pathname: '/ai-workspace/lms-graph/1/exercise/2', origin: 'https://www.yuketang.cn' },
    setTimeout: fn => { const id = nextTimer++; timeouts.set(id, fn); return id; },
    clearTimeout: id => timeouts.delete(id),
    setInterval: fn => { const id = nextTimer++; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
      observe() {} disconnect() { this.disconnected = true; }
    },
    GM_xmlhttpRequest: () => { throw Error('security prompt must never be sent to a model'); },
  });
  const instrumented = source.replace(/\n  PanelManager\.registerMenu\(\);\n  boot\(\)\.catch\(error => PanelManager\.reportError\(error\)\);\s*\n\}\)\(\);\s*$/, `
    globalThis.testAPI = { SecurityGuard, StopGate, Store, Solver, Utils, AiWorkspaceRunner,
      setPanel(value) { panel = value; } };
  })();`);
  assert.notEqual(source, instrumented);
  vm.runInContext(instrumented, context, { timeout: 2000 });
  const logs = [];
  context.testAPI.setPanel({ log: message => logs.push(message), resetStartButton() {} });
  return { ...context.testAPI, context, doc, nodes, frames, addTitle, observers, timeouts, intervals, logs };
}

(async () => {
  {
    const f = fixture();
    f.addTitle('题目中提到安全校验的普通说明');
    f.addTitle('请完成安全校验', false);
    assert.equal(f.SecurityGuard.check(), false, 'ordinary text and hidden prompts do not trip');
    const el = f.addTitle();
    el.parentElement = { styleState: { opacity: '0' }, parentElement: null };
    assert.equal(f.SecurityGuard.check(), false, 'hidden ancestor does not trip');
    el.parentElement.styleState.opacity = '1';
    let aborted = 0;
    f.StopGate.abortInflight = () => aborted++;
    f.Store.setPendingAutoStart('1', '');
    assert.equal(f.StopGate.isStopped(), true, 'action checkpoint detects visible prompt synchronously');
    assert.equal(aborted, 1);
    assert.equal(f.Store.getPendingAutoStart(), null);
    assert.equal(f.logs.length, 1);
    f.nodes.length = 0;
    assert.equal(f.StopGate.isStopped(), true, 'manual verification never automatically restarts work');
    assert.equal(f.SecurityGuard.check(), true);
    assert.equal(aborted, 1, 'stop is latched and idempotent');
  }
  {
    const f = fixture();
    const childNodes = [];
    const child = { ...f.doc, defaultView: { frameElement: null,
      getComputedStyle: () => ({}) },
      querySelectorAll: () => [],
      createTreeWalker: () => { let i = 0; return { nextNode: () => childNodes[i++] || null }; } };
    f.frames.push({ contentDocument: child });
    const inaccessible = {};
    Object.defineProperty(inaccessible, 'contentDocument', { get() { throw Error('cross origin'); } });
    f.frames.push(inaccessible);
    f.addTitle('请完成安全验证', true, child, childNodes);
    assert.equal(f.SecurityGuard.check(), true, 'same-origin nested prompt is detected; inaccessible frames are ignored');
  }
  {
    const f = fixture();
    const el = f.addTitle('请完成');
    el.parentElement = { textContent: '请完成安全校验', parentElement: null };
    assert.equal(f.SecurityGuard.check(), true, 'title split across child spans is detected');
  }
  {
    const f = fixture();
    f.addTitle();
    f.doc.getElementById = id => ['feature_auto_ai', 'ai_url'].includes(id) ? {} : null;
    assert.equal(f.SecurityGuard.check(), false, 'own panel/log document is excluded');
  }
  {
    const f = fixture();
    f.addTitle();
    f.nodes[0].parentElement.closest = () => ({});
    assert.equal(f.SecurityGuard.check(), false, 'own notice is excluded');
  }
  {
    const f = fixture();
    f.SecurityGuard.start();
    assert.equal(f.observers.length, 1);
    assert.equal(f.intervals.size, 1);
    f.addTitle();
    f.observers[0].callback();
    assert.equal(f.timeouts.size, 1);
    Array.from(f.timeouts.values())[0]();
    assert.equal(f.StopGate.stopped, true);
    assert.equal(f.intervals.size, 0);
    assert(f.observers.every(observer => observer.disconnected));
  }
  {
    const f = fixture();
    let writes = 0;
    const inputs = [0, 1].map(index => ({
      offsetParent: {}, scrollIntoView() {}, focus() {}, blur() {},
      set value(value) { writes++; }, dispatchEvent() {},
    }));
    f.context.Event = class {};
    f.Utils.sleep = async () => { f.addTitle(); f.SecurityGuard.check(); };
    await f.Solver.fillBlanks(['one', 'two'], { querySelectorAll: () => inputs });
    assert.equal(writes, 1, 'challenge after first blank prevents touching the second blank');
  }
  {
    const f = fixture();
    let clicked = 0, queriedAfterWait = 0;
    const blanks = [0, 1].map(() => ({ offsetParent: {}, click: () => clicked++ }));
    const root = { querySelectorAll: selector => selector.startsWith('.blank') ? blanks : [],
      querySelector: () => { queriedAfterWait++; return null; } };
    f.Utils.sleep = async () => { f.addTitle(); f.SecurityGuard.check(); };
    await f.Solver.fillBlanks(['one', 'two'], root);
    assert.equal(clicked, 1, 'challenge during first blank activation prevents second click');
    assert.equal(queriedAfterWait, 0, 'no input lookup or write after challenge');
  }
  {
    const f = fixture();
    f.addTitle();
    const result = await f.Solver.autoSelectAndSubmit('{"type":"choice","answers":["A"]}', {});
    assert.equal(result, 'incomplete', 'no option or submit controls touched during challenge');
    await f.Solver.fillBlanks(['example'], {});
    await assert.rejects(f.Solver.askAI('data:image/png;base64,example'), /已终止/);
    let clicks = 0;
    const runner = new f.AiWorkspaceRunner({ log() {} });
    await runner.handleNext([{ firstChild: { click: () => clicks++ } }], 0);
    assert.equal(clicks, 0, 'no navigation during challenge');
  }
  console.log('OK: visible/hidden/ordinary text, ancestor visibility, same-origin frames, own UI exclusion, cancellation, resume latch, observers, blocked API/submission/navigation');
})().catch(error => { console.error(error); process.exitCode = 1; });
