import { useCustomerDisplayOrderSubscriber } from '../hooks/useCustomerDisplayOrderSync.js';

function formatEuro(n) {
  const v = Number(n) || 0;
  return `€ ${v.toFixed(2).replace('.', ',')}`;
}

/**
 * Customer-facing screen: mirrors the sales order ticket only (no cashier chrome).
 */
export function CustomerDisplayPage() {
  const { ticket } = useCustomerDisplayOrderSubscriber();

  const lines = ticket?.lines ?? [];
  const total = ticket?.total ?? 0;
  const customerName = ticket?.customerName ?? null;

  return (
    <div className="min-h-[100dvh] w-full bg-white text-black flex flex-col">
      <header className="shrink-0 border-b border-gray-200 px-6 py-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Order</h1>
        {customerName ? <p className="mt-1 text-lg text-gray-500 truncate">{customerName}</p> : null}
      </header>

      <main className="flex-1 overflow-auto px-6 py-2 max-h-[580px]">
        {lines.length === 0 ? (
          <p className="text-center text-xl text-slate-400 mt-16">Welcome</p>
        ) : (
          <ul className="max-w-3xl mx-auto flex flex-col">
            {lines.map((row) => (
              <li key={row.id} className="px-4 py-2">
                <div className="flex items-baseline justify-between gap-4 text-xl font-semibold">
                  <span className="text-left">{row.mainText}</span>
                  <span className="shrink-0 tabular-nums">{formatEuro(row.mainAmount)}</span>
                </div>
                {(row.sublines || []).length > 0 ? (
                  <ul className="mt-2 space-y-1 pl-4 border-l border-slate-600">
                    {row.sublines.map((sl, i) => (
                      <li key={`${row.id}-sl-${i}`} className="flex items-baseline justify-between gap-4 text-lg text-slate-200">
                        <span>{sl.text}</span>
                        <span className="shrink-0 tabular-nums">{formatEuro(sl.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="shrink-0 border-t border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-baseline justify-between gap-4 text-2xl font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatEuro(total)}</span>
        </div>
      </footer>
    </div>
  );
}
