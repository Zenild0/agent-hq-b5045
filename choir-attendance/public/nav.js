// The phone's Back button. Back first closes anything open on top (a pop-up, a game screen), then goes
// to the Home page, and from Home it leaves the app, like any other app.
const state = { home: 'home', go: () => {}, current: () => 'home', overlays: [], silent: false };

// A function that closes something if it is open and returns true when it did (the Back press is then used up).
export const onBackFirst = (fn) => state.overlays.push(fn);

export function initBack({ home, go, current }) {
  Object.assign(state, { home, go, current });
  try { history.replaceState({ tab: home }, ''); } catch { return; }
  onBackFirst(() => { // any open pop-up dialog
    const d = [...document.querySelectorAll('dialog[open]')].pop();
    if (!d) return false;
    d.close();
    return true;
  });
  window.addEventListener('popstate', (e) => {
    if (state.silent) { state.silent = false; return; }
    if (state.overlays.some((fn) => fn())) { history.pushState({ tab: state.current() }, ''); return; } // keep the page where it is
    state.go(e.state?.tab || state.home);
  });
}

// Call whenever the visible page changes by the person's own action (not by Back).
export function noteVisit(tab) {
  try {
    const cur = history.state?.tab;
    if (tab === cur) return;
    if (tab === state.home) { state.silent = true; history.back(); } // drop the extra page so the next Back leaves the app
    else if (cur === state.home) history.pushState({ tab }, ''); // Home, then this page
    else history.replaceState({ tab }, ''); // moving between pages never builds a long trail
  } catch { /* history unavailable */ }
}
