import { NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { cn } from '@coston/agent/react';
import { VIEWS, VIEW_GROUPS } from './views.config';

/**
 * App shell: a sidebar listing every view, plus the routed content. The nav is
 * suppressed when `?chrome=0` so the visual spec captures each view on its own.
 */
export function Layout() {
  const [params] = useSearchParams();
  if (params.get('chrome') === '0') return <Outlet />;

  // Preserve the theme param when navigating between views.
  const suffix = params.get('theme') === 'dark' ? '?theme=dark' : '';

  return (
    <div className="flex min-h-screen bg-muted/30">
      <nav className="w-56 shrink-0 overflow-y-auto border-r border-border bg-background p-3 text-sm">
        <div className="flex items-center justify-between px-2 pb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            @coston/agent
          </span>
          <button
            type="button"
            onClick={() => document.documentElement.classList.toggle('dark')}
            className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Theme
          </button>
        </div>
        {VIEW_GROUPS.map(group => (
          <div key={group} className="mb-3">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{group}</div>
            {VIEWS.filter(v => v.group === group).map(v => (
              <NavLink
                key={v.name}
                to={v.path + suffix}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-2 py-1.5 transition-colors hover:bg-accent',
                    isActive && 'bg-accent font-medium text-foreground'
                  )
                }
              >
                {v.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
