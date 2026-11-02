import { useEffect } from 'react';

/** Puts who/what this tab is in the browser tab title — essential when many tabs are open. */
export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    const before = document.title;
    document.title = `${title} — ZenoBid`;
    return () => {
      document.title = before;
    };
  }, [title]);
  return null;
}
