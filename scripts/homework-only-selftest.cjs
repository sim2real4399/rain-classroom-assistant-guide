const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(__dirname + '/../yuketang-ComplexAutomation.user.js', 'utf8');
const instrumented = source.replace(/\n  PanelManager\.registerMenu\(\);\n  boot\(\)\.catch\(error => PanelManager\.reportError\(error\)\);\s*\n\}\)\(\);\s*$/, `
  globalThis.testAPI = { Store, Utils, StopGate, AiWorkspace, HomeworkOnly,
    AiWorkspaceRunner, start, setPanel(value) { panel = value; },
    setPrevention(value) { preventScreenCheck = value; } };
})();`);
assert.notEqual(instrumented, source, 'test must disable browser bootstrap');
const makeStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key) };
};
const context = vm.createContext({
  URL, console, setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: makeStorage(), sessionStorage: makeStorage(),
  location: { href: 'https://www.yuketang.cn/ai-workspace/lms-graph/1/exercise/10',
    pathname: '/ai-workspace/lms-graph/1/exercise/10', origin: 'https://www.yuketang.cn' },
  window: { opener: null }, document: {},
});
vm.runInContext(instrumented, context, { timeout: 2000 });
const api = context.testAPI;
const { Store, Utils, StopGate, AiWorkspace, HomeworkOnly, AiWorkspaceRunner } = api;
api.setPrevention(() => {});
let logs = [];
let resets = 0;
const panel = { log: (...args) => logs.push(args.join(' ')),
  resetStartButton: () => resets++, releaseStart() {} };
api.setPanel(panel);

function flags(onlyHomework = true, autoAI = true) {
  StopGate.stopped = false;
  Store.setFeatureConf({ onlyHomework, autoAI });
  logs = [];
  resets = 0;
}
function item(label, href) {
  const link = href ? { getAttribute: () => href } : null;
  return { innerText: label, matches: () => false, querySelector: () => link };
}

(async () => {
  context.localStorage.setItem('ykt_ai_conf', '{"key":"example-key","model":"deepseek-flash"}');
  const savedAI = context.localStorage.getItem('ykt_ai_conf');
  assert.equal(Store.getFeatureConf().onlyHomework, true, 'homework-only defaults on');
  context.localStorage.setItem('ykt_feature_conf', '{"autoAI":true}');
  assert.equal(Store.getFeatureConf().onlyHomework, true, 'legacy settings migrate without losing autoAI');
  assert.equal(Store.getFeatureConf().autoAI, true);
  flags();
  assert.equal(context.localStorage.getItem('ykt_ai_conf'), savedAI, 'feature changes preserve API config');

  for (const label of ['作业\n单元作业', '作业单元作业', '练习 测试', '习题', '题目 1']) {
    assert.equal(HomeworkOnly.isExerciseItem(item(label)), true, label);
  }
  for (const label of ['视频 作业讲解', '音频 教学', '课件 练习指导', '讨论 习题讨论', '考试 期末', '', '未知']) {
    assert.equal(HomeworkOnly.isExerciseItem(item(label)), false, label);
  }
  assert.equal(HomeworkOnly.isExerciseItem(item('其他', '/ai-workspace/lms-graph/1/exercise/2')), true);
  assert.equal(HomeworkOnly.isExerciseItem(item('作业', '/ai-workspace/lms-graph/1/video/2')), false);
  assert.equal(HomeworkOnly.isExerciseItem(item('作业', 'http://[')), true, 'invalid href falls back to visible label');

  // Run real traversal through interleaved homework/video/forum/unknown items.
  flags();
  let active = 0;
  const types = ['exercise', 'video', 'forum', 'content', 'exercise', 'audio', 'exercise'];
  const labels = ['作业 第一份', '视频 教学', '讨论 交流', '课件 PPT', '作业 第二份', '音频 教学', '作业 第三份'];
  const clicked = [], answered = [], marked = [];
  const list = labels.map((label, index) => ({
    ...item(label), firstChild: {
      classList: { contains: name => name === 'is-active' && active === index },
      click: () => { clicked.push(index); active = index; },
    },
  }));
  AiWorkspace.getRoute = () => ({ type: types[active], leafId: String(active), classroomId: '1' });
  AiWorkspace.getAllScourse = () => list;
  AiWorkspace.getMedia = () => null;
  Utils.sleep = async () => {};
  const runner = new AiWorkspaceRunner(panel);
  runner.getReturnUrl = () => 'https://www.yuketang.cn/v2/web/studentLog/1';
  runner.returnToSource = async () => { throw Error('homework-only must stay in left-side traversal'); };
  runner.handleExercise = async route => { answered.push(route.leafId); return true; };
  runner.handleMedia = async () => { throw Error('video handler was called'); };
  runner.handleForum = async () => { throw Error('forum handler was called'); };
  context.sessionStorage.setItem('ykt_handoff_key', 'example');
  Store.setPendingAutoStart('1', '');
  await runner.run(false);
  assert.deepEqual(answered, ['0', '4', '6']);
  assert.deepEqual(clicked, [4, 6], 'non-homework items must never be clicked');
  assert.equal(Store.getPendingAutoStart(), null, 'traversal end clears automatic resume');
  assert(logs.some(line => line.includes('后续作业遍历结束')));
  assert(!logs.some(line => line.includes('课程刷完啦')), 'no claim that skipped media is completed');

  // Starting on a video pauses it and selects the next homework.
  flags();
  active = 1;
  let pauseCount = 0, nextCount = 0;
  AiWorkspace.getMedia = () => ({ pause: () => pauseCount++ });
  const mediaRunner = new AiWorkspaceRunner(panel);
  mediaRunner.autoSelect = async () => nextCount++;
  mediaRunner.handleMedia = async () => { throw Error('must skip media'); };
  await mediaRunner.run(false);
  assert.equal(pauseCount, 1);
  assert.equal(nextCount, 1);

  // Stop before navigation and during the navigation wait blocks further work.
  flags();
  const stoppedRunner = new AiWorkspaceRunner(panel);
  stoppedRunner.run = async () => { throw Error('must not continue after stop'); };
  StopGate.stop();
  const previousClicks = clicked.length;
  await stoppedRunner.handleNext(list, 4);
  assert.equal(clicked.length, previousClicks);
  flags();
  Utils.sleep = async () => StopGate.stop();
  await stoppedRunner.handleNext(list, 4);
  assert.equal(clicked.length, previousClicks + 1);

  // Explicitly turning the mode off preserves the upstream media path.
  flags(false);
  active = 1;
  let mediaCalls = 0;
  const legacyRunner = new AiWorkspaceRunner(panel);
  legacyRunner.handleMedia = async () => { mediaCalls++; return true; };
  legacyRunner.autoSelect = async () => {};
  await legacyRunner.run(false);
  assert.equal(mediaCalls, 1);

  flags(true, false);
  api.start();
  assert(logs.some(line => line.includes('勾选“自动作答')));
  assert.equal(resets, 1);
  flags();
  context.location.pathname = '/v2/web/studentLog/1';
  api.start();
  assert(logs.some(line => line.includes('单元作业页面后启动')));
  assert.equal(resets, 1, 'unsupported catalog entry stops without playing media');
  assert.equal(context.localStorage.getItem('ykt_ai_conf'), savedAI);
  console.log('OK: defaults/migration, settings preservation, item classification, interleaved homework traversal, video skip, stop guards, legacy mode and entry guards');
})().catch(error => { console.error(error); process.exitCode = 1; });
