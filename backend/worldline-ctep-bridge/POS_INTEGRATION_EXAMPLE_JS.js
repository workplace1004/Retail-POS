const API = 'http://localhost:3210';

async function ctepStatus() {
  const res = await fetch(`${API}/status`);
  return res.json();
}

async function startCtepSale(amount, reference) {
  const status = await ctepStatus();
  if (!status.terminalConnected) throw new Error('Worldline terminal niet verbonden');
  if (status.transactionBusy) throw new Error('Er loopt al een transactie');

  const res = await fetch(`${API}/sale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, reference, timeoutSec: 180 })
  });
  const accepted = await res.json();
  if (!res.ok || !accepted.accepted) throw new Error(accepted.error || 'Betaling niet gestart');

  while (true) {
    await new Promise(r => setTimeout(r, 1500));
    const txRes = await fetch(`${API}/transaction`);
    const tx = await txRes.json();
    if (tx.status && tx.status !== 'running') return tx;
  }
}

// Voorbeeld:
// startCtepSale(1.00, 'TICKET-123').then(console.log).catch(console.error);
