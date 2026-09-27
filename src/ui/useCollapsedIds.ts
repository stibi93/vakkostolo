import { useState } from 'react';

export function useCollapsedIds() {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  return {
    has: (id: string) => ids.has(id),
    toggle(id: string) {
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    collapseAll(all: string[]) { setIds(new Set(all)); },
    expandAll() { setIds(new Set()); },
    expand(open: string[]) {
      setIds((prev) => {
        const next = new Set(prev);
        open.forEach((id) => next.delete(id));
        return next;
      });
    },
  };
}
