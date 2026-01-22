// Split an array into chunks to limit batch sizes.
export const chunk = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};
