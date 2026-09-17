/** Routes where an activity is in progress and must not be interrupted (F-OF-5). */
const ACTIVITY = [/^\/lesson\//, /^\/checkpoint\//, /^\/play\/game\/?$/];

export function isActivityRoute(pathname: string): boolean {
  return ACTIVITY.some((r) => r.test(pathname));
}
