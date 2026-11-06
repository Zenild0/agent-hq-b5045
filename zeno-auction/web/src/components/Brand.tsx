import { Moon, Sun } from 'lucide-react';
import type { EventSettings } from '../../../shared/types';
import { useAppearance } from '../lib/appearance';
import { Logo } from './ui';

/** Light / dark switch. A person's choice is remembered on their device and wins over the organiser's default. */
export function ModeToggle({ className = '' }: { className?: string }) {
  const { mode, setMode } = useAppearance();
  const next = mode === 'dark' ? 'light' : 'dark';
  return (
    <button className={`btn-ghost !px-3 !py-2 ${className}`} title={`Switch to ${next} mode`} aria-label={`Switch to ${next} mode`} onClick={() => setMode(next)}>
      {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{mode === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}

/** True when the organiser chose the "Your brand" theme and uploaded a logo. */
export const hasBrand = (s: Pick<EventSettings, 'theme' | 'brand'> | undefined) => !!s && s.theme === 'brand' && !!s.brand?.logo;

/** The logo at the top left: the company's own when branded, otherwise ZenoBid's. Always credits ZenoBid. */
export function EventLogo({ settings, size = 'md' }: { settings: EventSettings; size?: 'md' | 'lg' }) {
  if (!hasBrand(settings)) return <Logo size={size} />;
  return (
    <div className="flex items-center gap-3">
      <img src={settings.brand.logo} alt={`${settings.name} logo`} className={`${size === 'lg' ? 'h-14' : 'h-10'} max-w-[200px] object-contain`} />
      <PoweredBy className="hidden sm:block" />
    </div>
  );
}

/** "Powered by ZenoBid" — shown whenever a company's own branding is on. */
export function PoweredBy({ className = '' }: { className?: string }) {
  return <span className={`whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 ${className}`}>Powered by ZenoBid</span>;
}

/** The event's own logo: beside the controls, or as a wide banner (the organiser's choice). */
export function EventSideLogo({ settings }: { settings: EventSettings }) {
  if (!hasBrand(settings) || !settings.brand.eventLogo || settings.brand.eventLogoStyle !== 'side') return null;
  return <img src={settings.brand.eventLogo} alt="" className="h-10 max-w-[200px] object-contain" />;
}
export function EventBanner({ settings }: { settings: EventSettings }) {
  if (!hasBrand(settings) || !settings.brand.eventLogo || settings.brand.eventLogoStyle !== 'banner') return null;
  return (
    <div className="card overflow-hidden p-2">
      <img src={settings.brand.eventLogo} alt="" className="mx-auto max-h-28 w-full object-contain" />
    </div>
  );
}
