const debuggerUrl = process.env.BROWSER_DEBUG_URL || "http://127.0.0.1:9223";
const appUrl = process.env.APP_URL || "http://localhost:5174";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findPage() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const pages = await fetch(`${debuggerUrl}/json/list`).then((response) => response.json());
      const page = pages.find((item) => item.type === "page");
      if (page) return page;
    } catch {
      // The browser may still be starting.
    }
    await delay(250);
  }
  throw new Error(`Browser debugger did not start at ${debuggerUrl}`);
}

const page = await findPage();
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const runtimeErrors = [];
const requestErrors = [];
let messageId = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    runtimeErrors.push(message.params.exceptionDetails.text);
  }
  if (message.method === "Runtime.consoleAPICalled") {
    const values = message.params.args.map((item) => item.value || item.description || "");
    runtimeErrors.push(`${message.params.type}: ${values.join(" ")}`);
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    runtimeErrors.push(message.params.entry.text);
  }
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
    requestErrors.push({
      status: message.params.response.status,
      url: message.params.response.url,
    });
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function command(method, params = {}) {
  messageId += 1;
  socket.send(JSON.stringify({ id: messageId, method, params }));
  return new Promise((resolve, reject) => pending.set(messageId, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

await Promise.all([
  command("Runtime.enable"),
  command("Log.enable"),
  command("Network.enable"),
  command("Page.enable"),
]);
await command("Page.navigate", { url: appUrl });
await delay(1200);

const loginVisible = await evaluate(`Boolean(document.querySelector('.login-form'))`);
if (!loginVisible) throw new Error("Explicit login form is not visible");

await evaluate(`(() => {
  const setValue = (selector, value) => {
    const input = document.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  setValue('input[autocomplete="username"]', 'admin');
  setValue('input[autocomplete="current-password"]', 'admin');
  document.querySelector('.login-form').requestSubmit();
})()`);
await delay(2500);

const result = await evaluate(`(() => ({
  loginVisible: Boolean(document.querySelector('.login-form')),
  appVisible: Boolean(document.querySelector('.app')),
  title: document.querySelector('.page-title')?.textContent?.trim() || '',
  statValues: [...document.querySelectorAll('.stat-value')].map((item) => item.textContent.trim()),
  tankCards: document.querySelectorAll('.tank-card').length,
  currentPage: document.querySelector('#app')?.__vue_app__?._instance?.setupState?.currentPage,
  visibleText: document.body.innerText.slice(0, 2500),
}))()`);

const pageChecks = [];
for (const label of [
  "酒厂", "生产管理", "配方工艺", "库存采购", "物流追溯",
  "报表分析", "系统设置", "我的任务",
]) {
  await evaluate(`(() => {
    const label = ${JSON.stringify(label)};
    const button = [...document.querySelectorAll('.nav-item')]
      .find((item) => item.textContent.includes(label));
    if (!button) throw new Error('Navigation item not found: ' + label);
    button.click();
  })()`);
  await delay(700);
  pageChecks.push(await evaluate(`(() => ({
    title: document.querySelector('.page-title')?.textContent?.trim() || '',
    contentLength: document.querySelector('.content')?.innerText?.trim().length || 0,
    tableRows: document.querySelectorAll('.content tbody tr').length,
    emptyMessages: document.querySelectorAll('.content .empty').length,
  }))()`));
}

await evaluate(`(() => {
  const button = [...document.querySelectorAll('.nav-item')]
    .find((item) => item.textContent.includes('系统设置'));
  if (!button) throw new Error('System settings navigation item not found');
  button.click();
})()`);
await delay(700);
await evaluate(`(() => {
  const button = [...document.querySelectorAll('.master-nav-item')]
    .find((item) => item.textContent.includes('账号与权限'));
  if (!button) throw new Error('Account settings item not found');
  button.click();
})()`);
await delay(1200);

const accountChecks = {};
for (const tab of [
  { label: '用户管理', selector: '.account-card', key: 'users' },
  { label: '角色管理', selector: '.role-manage-card', key: 'roles' },
  { label: '组织机构', selector: '.organization-row', key: 'organizations' },
]) {
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('.account-tabs button')]
      .find((item) => item.textContent.includes(${JSON.stringify(tab.label)}));
    if (!button) throw new Error('Account tab not found: ' + ${JSON.stringify(tab.label)});
    button.click();
  })()`);
  await delay(500);
  accountChecks[tab.key] = await evaluate(
    `document.querySelectorAll(${JSON.stringify(tab.selector)}).length`,
  );
}

if (accountChecks.users < 1 || accountChecks.roles < 1 || accountChecks.organizations < 1) {
  throw new Error('Account settings data missing: ' + JSON.stringify(accountChecks));
}

console.log(JSON.stringify({ ...result, pageChecks, accountChecks, runtimeErrors, requestErrors }, null, 2));
await command("Browser.close");
