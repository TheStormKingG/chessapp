import { expect, test } from 'vitest';
import { emptyProgress } from '@/data';
import { pathNodes, activeLesson } from './progress';

test('first lesson is active, the rest locked, checkpoint always attemptable', () => {
  const nodes = pathNodes(emptyProgress());
  expect(nodes[0]).toMatchObject({ kind: 'lesson', id: '1.1.1', state: 'active' });
  expect(nodes[1]).toMatchObject({ kind: 'lesson', id: '1.1.2', state: 'locked' });
  const cp = nodes.find((n) => n.kind === 'checkpoint' && n.unit === '1.1');
  expect(cp).toMatchObject({ state: 'available' });
});

test('completing lessons advances the active node; passing the checkpoint unlocks the next unit', () => {
  const p = emptyProgress();
  p.lessons['1.1.1'] = { stars: 3, completed: true };
  let nodes = pathNodes(p);
  expect(nodes[0]).toMatchObject({ state: 'done' });
  expect(nodes[1]).toMatchObject({ state: 'active' });
  p.units['1.1'] = { passed: true, attempts: 1, testedOut: false };
  nodes = pathNodes(p);
  expect(nodes.find((n) => n.kind === 'lesson' && n.id === '1.2.1')).toMatchObject({ state: 'active' });
  expect(nodes.find((n) => n.kind === 'checkpoint' && n.unit === '1.1')).toMatchObject({ state: 'passed' });
});

test('units not yet built are shown as coming', () => {
  const n = pathNodes(emptyProgress()).find((n) => n.kind === 'lesson' && n.id === '1.3.1');
  expect(n).toMatchObject({ state: 'coming' });
});

test('passing a unit early marks its unfinished lessons tested out, not active', () => {
  const p = emptyProgress();
  p.units['1.1'] = { passed: true, attempts: 1, testedOut: true };
  const nodes = pathNodes(p);
  expect(nodes[0]).toMatchObject({ id: '1.1.1', state: 'testedOut' });
  expect(nodes.filter((n) => n.kind === 'lesson' && n.state === 'active')).toHaveLength(1);
  expect(activeLesson(p)).toMatchObject({ id: '1.2.1' });
});

test('there is never more than one active node', () => {
  for (const p of [emptyProgress(), (() => { const q = emptyProgress(); q.lessons['1.1.1'] = { stars: 1, completed: true }; return q; })()]) {
    expect(pathNodes(p).filter((n) => n.state === 'active')).toHaveLength(1);
  }
});

test('finishing everything built leaves no active lesson', () => {
  const p = emptyProgress();
  p.units['1.1'] = { passed: true, attempts: 1, testedOut: false };
  p.units['1.2'] = { passed: true, attempts: 1, testedOut: false };
  expect(activeLesson(p)).toBeNull();
});
