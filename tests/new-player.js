// New-player check: plays BookIt the way a first-time player does, on a phone-sized screen with no saves.
// Run before every release:  python3 -m http.server 8080  (in the repo), then  node tests/new-player.js
// Optional: BOOKIT_URL=http://localhost:8080/ WEEKS=6
// Fails (exit 1) on any page error, the "Something went wrong" screen, or a step that can't be reached.
const { chromium, devices } = require('playwright');
const URL = process.env.BOOKIT_URL || 'http://localhost:8080/';
const WEEKS = +process.env.WEEKS || 6;
const fails = [];
const step = (name) => console.log('  ' + name);

async function crashed(p) { return (await p.locator('text=Something went wrong').count()) > 0; }
async function check(p, name) { if (await crashed(p)) throw new Error('Crash screen after: ' + name); }
async function tap(p, sel, name, timeout = 4000) {
  const el = p.locator(sel).filter({ visible: true }).first();
  await el.waitFor({ state: 'visible', timeout });
  await el.click({ timeout }); await p.waitForTimeout(250); await check(p, name);
}
async function has(p, sel) { return (await p.locator(sel).filter({ visible: true }).count()) > 0; }

async function playShows(p, label) {
  const G = (f) => p.evaluate(f);
  const start = await G(() => window.__rb.G.week);
  for (let n = 0; n < WEEKS * 3 && (await G(() => window.__rb.G.week)) < start + WEEKS; n++) {
    const wk = await G(() => window.__rb.G.week), ran = await G(() => window.__rb.G.history.length);
    // Auto-fill books the card (weekly show or big event), then run it
    if (await has(p, '[data-act="autoFill"]')) await tap(p, '[data-act="autoFill"]', `${label} auto-fill wk ${wk}`);
    await tap(p, '[data-act="runShow"]', `${label} run wk ${wk}`);
    // finish the live show and answer whatever comes up, until the show is in the books and the next card is ready
    let done = false;
    for (let t = 0; t < 80 && !done; t++) {
      for (const s of ['[data-act="momPick"]', '[data-act="cutGo"]', '[data-act="afterShow"]', '[data-act="liveSkip"]', '[data-act="closeModal"]', '[data-act="tutNext"]']) if (await has(p, s)) { await p.locator(s).filter({ visible: true }).first().click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(150); }
      await p.waitForTimeout(150); await check(p, `${label} after show wk ${wk}`);
      done = (await G(() => window.__rb.G.history.length)) > ran && !(await has(p, '.modal, .cs, [data-act="liveSkip"], [data-act="afterShow"]'));
    }
    if (!done) throw new Error(`${label}: the show in week ${wk} never finished`);
    step(`${label}: week ${wk}, ${await G(() => window.__rb.G.history.at(-1).name)} rated ${await G(() => window.__rb.G.history.at(-1).rating)}`);
  }
  if ((await G(() => window.__rb.G.week)) < start + WEEKS) throw new Error(`${label}: stuck in week ${await G(() => window.__rb.G.week)}`);
}

async function run(name, fn) {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  try {
    await p.goto(URL); await p.waitForTimeout(1500);
    console.log(name); await fn(p);
  } catch (e) { fails.push(`${name}: ${e.message.split('\n').slice(0, 3).join(' ')}`); await p.screenshot({ path: `tests/fail-${name.replace(/\W+/g, '-')}.png` }).catch(() => {}); }
  for (const e of errs) fails.push(`${name}: page error: ${e}`);
  await b.close();
}

(async () => {
  // 1. The recommended path: name it, pick a budget, hold the draft, crown champions, play some weeks
  await run('Draft path', async p => {
    await p.getByText('New company', { exact: true }).click(); await p.waitForTimeout(400);
    await tap(p, '[data-act="wzGo"][data-id="company"]', 'Start my company');
    await p.getByText('Thunder Valley Wrestling', { exact: true }).first().click(); // name it
    for (let i = 0; i < 8 && !(await has(p, '[data-act="wzDraft"]')) && !(await has(p, '[data-act="wzAutoAll"]')); i++) await tap(p, '.btn.pri[data-act="wzGo"]', 'wizard next');
    if (await has(p, '[data-act="wzDraft"]')) await tap(p, '[data-act="wzDraft"]', 'Go to the draft');
    await tap(p, '[data-act="wzAutoAll"]', 'Draft the rest');
    if (await has(p, '[data-act="wzChamps"]')) await tap(p, '[data-act="wzChamps"]', 'Finish draft');
    for (let i = 0; i < 6 && !(await has(p, '[data-act="wzFinish"]')); i++) await tap(p, '.btn.pri[data-act="wzGo"]', 'titles next');
    await tap(p, '[data-act="wzFinish"]', 'Open for business');
    step('company open');
    await playShows(p, 'Draft path');
  });
  // 2. Skip setup with the starter roster
  await run('Skip setup', async p => {
    await p.getByText('New company', { exact: true }).click(); await p.waitForTimeout(400);
    await tap(p, '[data-act="wzQuick"]', 'Skip setup');
    await playShows(p, 'Skip setup');
  });
  if (fails.length) { console.error('\nFAILED\n' + fails.map(f => ' - ' + f).join('\n')); process.exit(1); }
  console.log('\nAll new-player checks passed.');
})();
