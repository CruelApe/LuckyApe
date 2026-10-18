/** Join class names, skipping falsy values: cn('a', cond && 'b') */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
