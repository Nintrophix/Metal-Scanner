import { lazy, Suspense, useEffect, useState } from 'react';
import { Landing } from './landing/Landing';
import { Logo } from './brand/Logo';

const Workspace = lazy(() => import('./workspace/Workspace'));

type Route = { page: 'landing' } | { page: 'app'; sample: boolean };

function parse(): Route {
  const h = window.location.hash;
  if (h.startsWith('#/app')) return { page: 'app', sample: h.includes('sample') };
  return { page: 'landing' };
}

/** Hides the HTML boot screen once the first real view has painted and fonts are ready. */
export function finishBoot() {
  const el = document.getElementById('boot');
  if (!el || el.classList.contains('done')) return;
  const hide = () => {
    el.classList.add('done');
    setTimeout(() => el.remove(), 260);
  };
  // Wait for webfonts so the first paint is final, but never longer than 1.5 s. Timers, not
  // requestAnimationFrame: rAF does not run in background tabs and would strand the overlay.
  let done = false;
  const once = () => {
    if (!done) {
      done = true;
      setTimeout(hide, 0);
    }
  };
  (document.fonts?.ready ?? Promise.resolve()).then(once);
  setTimeout(once, 1500);
}

function BootFallback() {
  // The workspace chunk is loading. On first visit the HTML boot screen is still up; after
  // navigating from the landing page it is gone, so render the same treatment in React.
  const [htmlBoot] = useState(() => !!document.getElementById('boot'));
  useEffect(() => {
    const msg = document.getElementById('boot-msg');
    if (msg) msg.textContent = 'Loading workspace';
  }, []);
  if (htmlBoot) return null;
  return (
    <div className="boot-screen" role="status">
      <Logo size={24} />
      <div className="boot-bar"><i /></div>
      <span>Loading workspace</span>
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    document.title = route.page === 'app' ? 'Workspace — Irontronics' : 'Irontronics — Scan a metal part, cut it again';
  }, [route.page]);

  if (route.page === 'app') {
    return (
      <Suspense fallback={<BootFallback />}>
        <Workspace sample={route.sample} />
      </Suspense>
    );
  }
  return <Landing />;
}
