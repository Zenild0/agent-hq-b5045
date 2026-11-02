import { useCallback, useState } from 'react';
import type { SquadSort } from '../../../shared/types';

/**
 * A captain can order team lists their own way on their own phone; until they choose, they see the
 * order the auctioneer picked for the big screen.
 */
export function useOwnSquadSort(code: string, shared: SquadSort): [SquadSort, (v: SquadSort) => void] {
  const key = `zeno:sort:${code}`;
  const [own, setOwn] = useState<SquadSort | null>(() => {
    const v = localStorage.getItem(key);
    return v === 'price' || v === 'added' ? v : null;
  });
  const set = useCallback(
    (v: SquadSort) => {
      localStorage.setItem(key, v);
      setOwn(v);
    },
    [key],
  );
  return [own ?? shared, set];
}
