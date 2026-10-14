export function csvCell(value: string, userControlled: boolean): string {
  const safe = userControlled && /^[\s\p{Cc}]*[=+\-@]/u.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}
