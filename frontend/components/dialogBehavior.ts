export function createDialogStack<T>() {
  let entries: { value: T; depth: number }[] = [];
  const top = () => entries.reduce<{ value: T; depth: number } | undefined>((last, entry) =>
    !last || entry.depth >= last.depth ? entry : last, undefined)?.value;
  return {
    add(value: T, depth = 0) { entries.push({ value, depth }); },
    remove(value: T) { entries = entries.filter(entry => entry.value !== value); },
    isTop(value: T) { return top() === value; },
    get size() { return entries.length; },
  };
}

/** null lets the browser advance normally; -1 focuses a panel with no controls. */
export function getTabDestination(count: number, currentIndex: number, backwards: boolean): number | null {
  if (count === 0) return -1;
  if (currentIndex < 0) return backwards ? count - 1 : 0;
  if (backwards && currentIndex === 0) return count - 1;
  if (!backwards && currentIndex === count - 1) return 0;
  return null;
}
