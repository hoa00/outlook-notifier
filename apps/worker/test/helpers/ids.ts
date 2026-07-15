export function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
