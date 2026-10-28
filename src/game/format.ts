export const baht = (n: number): string => `฿${Math.round(n).toLocaleString('en-US')}`;
