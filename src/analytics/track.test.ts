import { describe, expect, it, vi, afterEach } from 'vitest';
import { reportError, setSink, track, type Sink } from './track';

const consoleSink: Sink = {
  track: () => undefined,
  error: () => undefined,
};

function spySink() {
  const sink = { track: vi.fn(), error: vi.fn() };
  setSink(sink);
  return sink;
}

afterEach(() => {
  setSink(consoleSink);
});

describe('analytics adapter', () => {
  it('delivers events to the installed sink', () => {
    const sink = spySink();
    track('x', { a: 1 });
    expect(sink.track).toHaveBeenCalledWith('x', { a: 1 });
  });

  it('allows an event without properties', () => {
    const sink = spySink();
    track('lesson_started');
    expect(sink.track).toHaveBeenCalledWith('lesson_started', undefined);
  });

  it('delivers errors with their context to the installed sink', () => {
    const sink = spySink();
    const boom = new Error('engine unavailable');
    reportError(boom, { where: 'engine' });
    expect(sink.error).toHaveBeenCalledWith(boom, { where: 'engine' });
  });

  it('does not throw before a sink is installed', () => {
    setSink(consoleSink);
    expect(() => {
      track('noop');
    }).not.toThrow();
  });
});
