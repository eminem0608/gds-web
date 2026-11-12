// Checks the standalone design prototype in an isolated DOM stub, without any API calls.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../public/inventory-count-preview.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const stored = new Map();
function boot() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', textContent: '', hidden: true, value: '', callbacks: {},
      addEventListener(name, callback) { this.callbacks[name] = callback; },
      focus() {}, querySelectorAll() { return []; }
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: {
      getElementById: element, querySelector: () => ({ focus() {} }),
      addEventListener() {}, activeElement: null
    },
    localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    setTimeout: () => 1, clearTimeout() {}, console,
  });
  const run = code => vm.runInContext(code, context);
  run(script);
  return { run, element };
}
const { run, element } = boot();
const data = () => JSON.parse(run('JSON.stringify(currentDoc())'));
const confirm = code => run(`dialogCallback({get:k=>(${code})[k] ?? ''})`);
assert(element('app').innerHTML.includes('继续盘点'));
run("current='PD-示例-001';render()");
assert(data().rows.every(row => row.actual === null));
assert.match(run('issue(currentDoc())'), /3 项未完成/);
run('submit()');
assert.equal(data().state, 'counting');
assert.match(element('toast').textContent, /未完成实盘/);

run('currentDoc().rows.forEach(r=>r.actual=r.book);currentDoc().rows[1].actual=149');
assert.match(run('issue(currentDoc())'), /差异缺少原因/);
run("currentDoc().rows[1].reason='other'");
assert.match(run('issue(currentDoc())'), /必要说明/);
run("currentDoc().rows[1].note='现场复核少 1 kg';actions.save()");
const restored = boot();
restored.run("current='PD-示例-001'");
assert.equal(restored.run('currentDoc().rows[1].actual'), 149);

run('submit()'); confirm('{}');
assert.equal(data().state, 'review');
assert.equal(run('frozen(currentDoc())'), true);
run('actions.return()'); confirm("{note:'请重新复核重量'}");
assert.equal(data().state, 'returned');
assert.equal(run('editable(currentDoc())'), true);
run("recount('malt2')"); confirm("{actual:'148.5',note:'去皮称重后确认'}");
assert.equal(data().rows[1].recounts[0].before, 149);
assert.equal(data().rows[1].actual, 148.5);
run('submit()'); confirm('{}');
run('actions.approve()');
assert.equal(data().state, 'approved');
assert.equal(data().movements, undefined, 'Approval must not adjust inventory');
run('post()'); confirm('{}');
assert.equal(data().state, 'done');
assert.equal(data().movements.length, 1);
assert.equal(data().movements[0].quantity, -1.5);
assert.equal(run('frozen(currentDoc())'), false);
run('post()');
assert.throws(() => confirm('{}'), /重复入账/);
assert.equal(data().movements.length, 1);
run('closeDialog()');

// Completed counts no longer block another count in the same location.
run('create()'); confirm("{warehouse:'原料仓',bin:'A01'}");
assert.equal(data().state, 'draft');
run('start()'); confirm('{}');
assert.equal(data().state, 'counting');
run('add()');
assert.throws(() => confirm("{product:'malt',lot:'MALT-261015-01',actual:'5',note:'核实'}"), /已经在明细/);
assert.throws(() => confirm("{product:'yeast',lot:'MALT-261015-01',actual:'5',note:'核实'}"), /批次与商品/);
confirm("{product:'yeast',lot:'Y-261025-01',actual:'5',note:'现场发现已确认批次'}");
assert.equal(data().rows.at(-1).book, 0);
assert.equal(data().rows.at(-1).actual, 5);
run('actions.cancel()'); confirm("{note:'现场安排需要调整'}");
assert.equal(data().state, 'cancelled');
assert.equal(run('frozen(currentDoc())'), false);
assert.equal(data().movements, undefined);

run('create()'); confirm("{warehouse:'原料仓',bin:'A01'}");
run('start()'); confirm('{}');
run('currentDoc().rows.forEach(r=>r.actual=r.book);submit()'); confirm('{}');
assert.equal(data().state, 'done', 'No-difference count should finish without approval');

// A pending count must retain its scope until posting or cancellation.
run('create()'); confirm("{warehouse:'包材仓',bin:'B01'}");
run('start()');
assert.equal(data().state, 'draft');
assert.match(element('toast').textContent, /已有进行中的盘点/);
run('currentDoc().rows=[{actual:80,book:100,reserved:90,product:"麦芽",unit:"kg",reason:"damage",note:"破损"}]');
assert.match(run('issue(currentDoc())'), /少于已预占/);

// Escape custom text before inserting it into the preview markup.
assert.equal(run("esc('<img onerror=alert(1)>')"), '&lt;img onerror=alert(1)&gt;');
console.log('PASS: blank actuals, validation, saved progress, return/recount/resubmit, approval/posting separation, duplicate posting, found stock, cancellation, no-difference completion, overlapping scopes, reservation conflict and HTML escaping.');
