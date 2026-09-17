import { clearDeviceData } from './clearDeviceData';
import { db } from '@/data';

test('clearing device data removes the database and every chessapp key in localStorage', async () => {
  localStorage.setItem('chessapp-settings', '{"state":{"textEntry":true}}');
  localStorage.setItem('chessapp.install.dismissedAt', '123');
  localStorage.setItem('chessapp.coolDownDismissed', '2026-09-17');
  localStorage.setItem('unrelated-key', 'keep me');

  await clearDeviceData();

  expect(localStorage.getItem('chessapp-settings')).toBeNull();
  expect(localStorage.getItem('chessapp.install.dismissedAt')).toBeNull();
  expect(localStorage.getItem('chessapp.coolDownDismissed')).toBeNull();
  expect(localStorage.getItem('unrelated-key')).toBe('keep me');
  expect(db.isOpen()).toBe(false);
});
