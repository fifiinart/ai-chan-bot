export function groupBy<T extends Record<K, keyof any>, K extends keyof T>(arr: T[], property: K): Record<T[K], T[]> {
  return arr.reduce<Record<T[K], T[]>>((memo, x) => {
    if (!memo[x[property]]) { memo[x[property]] = []; }
    memo[x[property]].push(x);
    return memo;
  }, {} as Record<T[K], T[]>);
}