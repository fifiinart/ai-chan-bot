export function groupBy<T extends { [k in K]: keyof any }, K extends keyof T>(arr: T[], property: K): { [k in T[K]]: T[] } {
  return arr.reduce<{ [k in T[K]]: T[] }>((memo, x) => {
    if (!memo[x[property]]) { memo[x[property]] = []; }
    memo[x[property]].push(x);
    return memo;
  }, {} as { [k in T[K]]: T[] });
}