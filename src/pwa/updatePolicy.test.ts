import { describe, expect, it } from 'vitest';
import { shouldApplyUpdate } from './updatePolicy';

/**
 * F-OF-5: "An update to the app shows an 'update available' notice and applies
 * on the next launch, never mid-lesson." The policy below is what makes
 * "applies on the next launch" true without the learner clicking anything.
 */
describe('shouldApplyUpdate', () => {
  it('does not apply when no worker is waiting', () => {
    expect(shouldApplyUpdate({ waiting: false, pathname: '/', launching: true })).toBe(false);
  });

  it('applies at launch, outside an activity, with no interaction', () => {
    expect(shouldApplyUpdate({ waiting: true, pathname: '/', launching: true })).toBe(true);
  });

  it.each(['/lesson/L1-1', '/checkpoint/U1', '/play/game'])(
    'never applies at launch while %s is the restored route',
    (pathname) => {
      expect(shouldApplyUpdate({ waiting: true, pathname, launching: true })).toBe(false);
    },
  );

  it('does not apply once the launch window has closed, even off an activity route', () => {
    expect(shouldApplyUpdate({ waiting: true, pathname: '/lessons', launching: false })).toBe(false);
  });
});
