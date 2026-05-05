const $ = (id) => document.getElementById(id);
let txPoll = null;

function pretty(x) { return JSON.stringify(x, null, 2); }
function pushLog(line) {
  $('log').textContent = line + '\n' + $('log').textContent;
}
function addAction(name, result) {
  const stamp = new Date().toLocaleTimeString('nl-BE', { hour12: false });
  pushLog(`[${stamp}] ${name}: ${JSON.stringify(result)}`);
}
function setBadges(status) {
  const d = status?.data || status || {};
  const connected = !!d.terminalConnected;
  const service = !!d.serviceStarted;
  $('badges').innerHTML = `
    <span class="pill ${service ? 'ok' : 'bad'}">Service: ${service ? 'STARTED' : 'STOPPED'}</span>
    <span class="pill ${connected ? 'ok' : 'bad'}">Terminal: ${connected ? 'CONNECTED' : 'NOT CONNECTED'}</span>
    <span class="pill">CTEP: ${d.ctepPort || 9000}</span>
    <span class="pill">HTTP: ${d.httpPort || 3210}</span>
    ${d.model ? `<span class="pill">Model: ${d.model}</span>` : ''}
    ${d.serialNumber ? `<span class="pill">Serial: ${d.serialNumber}</span>` : ''}
  `;
}
async function run(name, fn, outputEl) {
  try {
    const result = await fn();
    addAction(name, result);
    if (outputEl) outputEl.textContent = pretty(result);
    return result;
  } catch (e) {
    const result = { ok: false, error: e.message };
    addAction(name, result);
    if (outputEl) outputEl.textContent = pretty(result);
    return result;
  }
}

async function refreshStatus() {
  const r = await run('status', () => window.ctep.status(), $('statusOut'));
  setBadges(r);
  return r;
}
async function refreshTx() {
  return run('transaction', () => window.ctep.transaction(), $('txOut'));
}

$('btnStart').onclick = async () => { await run('startBridge', () => window.ctep.startBridge()); setTimeout(refreshStatus, 900); };
$('btnStop').onclick = async () => { await run('stopBridge', () => window.ctep.stopBridge()); setTimeout(refreshStatus, 400); };
$('btnPing').onclick = () => run('ping', () => window.ctep.ping(), $('statusOut'));
$('btnStatus').onclick = refreshStatus;
$('btnTx').onclick = refreshTx;
$('btnCancel').onclick = async () => { await run('cancel', () => window.ctep.cancel(), $('txOut')); await refreshStatus(); };
$('btnSale').onclick = async () => {
  const payload = {
    amount: Number($('amount').value),
    reference: $('reference').value || `POS-${Date.now()}`,
    timeoutSec: 180
  };
  const r = await run('sale', () => window.ctep.sale(payload), $('txOut'));
  await refreshStatus();
  if (r?.data?.accepted) {
    if (txPoll) clearInterval(txPoll);
    txPoll = setInterval(async () => {
      const tx = await refreshTx();
      const status = tx?.data?.status;
      if (status && status !== 'running') {
        clearInterval(txPoll);
        txPoll = null;
        await refreshStatus();
      }
    }, 1500);
  }
};

window.ctep.onLog(pushLog);
window.addEventListener('DOMContentLoaded', async () => {
  const existing = await window.ctep.getLogs();
  if (Array.isArray(existing)) existing.reverse().forEach(pushLog);
  await refreshStatus();
  await refreshTx();
});
