// Captures the screenshots used on the portfolio card: node tools/shots.mjs
// Runs the Vite dev server, seeds demo data (tools/seed.js), then drives headless Chrome.
// Phone shots: 600-wide JPEGs in prototype/shots. Desktop shot: prototype/shots/web.jpg (1440×900).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, 'prototype', 'shots');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEED = fs.readFileSync(path.join(ROOT, 'tools', 'seed.js'), 'utf8');

fs.mkdirSync(SHOTS, { recursive: true });
const tmp = fs.mkdtempSync(path.join(ROOT, '.shots-'));
const port = 5700 + Math.floor(Math.random() * 200), dbg = port + 1000;
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${dbg}`, `--user-data-dir=${tmp}/profile`, 'about:blank'], { stdio: 'ignore' });
try {
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await sleep(250); }
  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    try { const p = (await (await fetch(`http://127.0.0.1:${dbg}/json`)).json()).find((t) => t.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {}
    if (!ws) await sleep(250);
  }
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = {};
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending[m.id]) { pending[m.id](m); delete pending[m.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (js) => { const r = await send('Runtime.evaluate', { expression: `(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));const $=s=>document.querySelector(s);const click=s=>$(s).click();${js}})()`, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); };
  await send('Page.enable');
  // No speech in headless Chrome, and fixed random numbers so every run builds the same puzzles.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'speechSynthesis.speak=()=>{};let __s=7;Math.random=()=>{__s=(__s*16807)%2147483647;return (__s-1)/2147483646};' });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const phone = () => send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const desktop = () => send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const home = async () => { await send('Page.navigate', { url: `${origin}/` }); await sleep(1500); };
  const grab = async (file, width = 600) => {
    await run('document.activeElement?.blur(); window.scrollTo(0,0);'); await sleep(400);
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const png = path.join(tmp, file + '.png');
    fs.writeFileSync(png, Buffer.from(s.result.data, 'base64'));
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '84', '--resampleWidth', String(width), png, '--out', path.join(SHOTS, file + '.jpg')], { stdio: 'pipe' });
  };
  const parent = `click('[aria-label="Grown-ups area"]'); await wait(500); for (const k of '1234') { click('.pin-key[aria-label="'+k+'"]'); await wait(120); } await wait(1500);`;
  const jigsaw = `[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.startsWith('Color Kingdom')).click(); await wait(500);
    [...document.querySelectorAll('.modal button')].find(b=>/Play/.test(b.textContent)).click(); await wait(1200);
    for (const n of [1,2,3,4,5,6,7,8,9,10,11,12,13]) { const p=$('[aria-label="Piece '+n+'"]'); if(!p) continue; p.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await wait(80); $('[aria-label="Spot '+n+'"]').click(); await wait(250); }`;

  await phone();
  await home();
  await run(`await eval(${JSON.stringify(SEED)});`);
  await home();
  await grab('home');
  await run(jigsaw); await sleep(600);
  await grab('jigsaw');
  await home();
  await run(parent);
  await grab('parent');
  await desktop();
  await home();
  await grab('web-home', 1440);
  await run(parent);
  await grab('web', 1440);
  console.log('captured', fs.readdirSync(SHOTS).join(', '));
  ws.close();
} finally {
  const exited = new Promise((r) => chrome.once('exit', r));
  chrome.kill(); server.kill();
  await Promise.race([exited, sleep(5000)]);
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
