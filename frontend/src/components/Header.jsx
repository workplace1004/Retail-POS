import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function IconCart() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 512.001 512.001" fill="currentColor" aria-hidden="true">
      <path d="M485.16,331.373l26.688-200.15c1.366-10.251-6.62-19.361-16.951-19.361c-12.445,0-377.092,0-384.578,0L99.401,29.973 c-1.131-8.478-8.362-14.81-16.914-14.81H17.513c-8.76,0-16.444,6.417-17.406,15.124C-1.029,40.58,7,49.292,17.064,49.292h50.507 c0.058,0.437,46.118,345.891,47.932,359.49c1.129,8.467,8.351,14.79,16.894,14.79h47.378 c-17.13,33.366,7.242,73.266,44.813,73.266c37.51,0,61.972-39.843,44.812-73.266h76.81c-17.13,33.366,7.242,73.266,44.812,73.266 c37.51,0,61.972-39.842,44.813-73.266h36.363c8.76,0,16.444-6.417,17.406-15.124c1.135-10.293-6.893-19.005-16.958-19.005H147.407 l-5.764-43.23c16.987,0,308.554,0,326.568,0C476.781,346.213,484.029,339.869,485.16,331.373z M391.023,430.842 c21.439,0,21.439,32.446,0,32.446S369.584,430.842,391.023,430.842z M224.587,430.842c21.44,0,21.439,32.446,0,32.446 S203.147,430.842,224.587,430.842z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M4.5 1C4.77614 1 5 1.22386 5 1.5V2H10V1.5C10 1.22386 10.2239 1 10.5 1C10.7761 1 11 1.22386 11 1.5V2H12.5C13.3284 2 14 2.67157 14 3.5V12.5C14 13.3284 13.3284 14 12.5 14H2.5C1.67157 14 1 13.3284 1 12.5V3.5C1 2.67157 1.67157 2 2.5 2H4V1.5C4 1.22386 4.22386 1 4.5 1Z" fill="currentColor" />
    </svg>
  );
}

function IconInWaiting() {
  return (
    <svg width="20" height="20" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" strokeWidth="3" stroke="currentColor" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="32" cy="32" r="25.3" />
      <polyline points="32 11.88 32 32.77 43.22 41.38" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12c2.761 0 5-2.686 5-6s-2.239-6-5-6-5 2.686-5 6 2.239 6 5 6zm0 2c-3.867 0-7 3.134-7 7h14c0-3.866-3.133-7-7-7z" />
    </svg>
  );
}

export function Header({
  webordersCount,
  inPlanningCount,
  inWaitingCount = 0,
  onOpenWeborders,
  onOpenInPlanning,
  onOpenInWaiting,
  functionButtonSlots = []
}) {
  const { t } = useLanguage();
  const slots = Array.isArray(functionButtonSlots)
    ? functionButtonSlots.map((slot) => String(slot || '').trim()).filter(Boolean)
    : [];
  const slotCount = Math.min(4, Math.max(1, slots.length));
  const navGridClassByCount = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4'
  };
  const navGridClass = navGridClassByCount[slotCount] || 'grid-cols-1';

  const getButtonConfig = (id) => {
    switch (id) {
      case 'weborders':
        return { label: t('control.functionButton.weborders'), icon: <IconCart />, onClick: onOpenWeborders };
      case 'in-wacht':
        return {
          label: `${inWaitingCount} ${t('control.functionButton.inWaiting')}`,
          icon: <IconInWaiting />,
          onClick: onOpenInWaiting || onOpenInPlanning
        };
      case 'geplande-orders':
        return {
          label: `${inPlanningCount} ${t('control.functionButton.scheduledOrders')}`,
          icon: <IconCalendar />,
          onClick: onOpenInPlanning
        };
      case 'reservaties':
        return { label: t('control.functionButton.reservations'), icon: <IconCalendar />, onClick: null };
      case 'verkopers':
        return { label: t('control.functionButton.sellers'), icon: <IconUser />, onClick: null };
      default:
        return null;
    }
  };

  return (
    <header className="flex items-stretch w-full bg-pos-bg py-2 px-2 shrink-0 gap-1">
      <nav className={`flex-1 min-w-0 grid ${navGridClass} items-center gap-1`}>
        {slots.map((slotId, idx) => {
          const cfg = getButtonConfig(slotId);
          if (!cfg) return null;
          return (
            <button
              key={`header-slot-${idx}-${slotId}`}
              type="button"
              onClick={cfg.onClick || undefined}
              disabled={!cfg.onClick}
              className={`rounded-md min-h-[46px] max-h-[46px] bg-pos-panel w-full justify-center text-pos-text text-md px-2 flex items-center gap-3 min-w-0 ${
                cfg.onClick ? 'active:bg-green-500' : 'opacity-80 cursor-default'
              }`}
            >
              <span className="opacity-90 shrink-0">{cfg.icon}</span>
              <span className="text-left flex items-center min-w-0 truncate h-full">{cfg.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
