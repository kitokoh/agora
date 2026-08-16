import { describe, expect, it } from 'vitest';
import { initObservability, getTracer, getMeter } from '../src/index.js';

describe('observability bootstrap (issue #17)', () => {
  it('initializes without exporting (test mode) and returns a handle', async () => {
    const handle = initObservability({
      serviceName: 'test-service',
      exportOnlyInProduction: true,
      isProduction: false,
    });
    expect(handle.shutdown).toBeTypeOf('function');

    // Tracer + meter are available through the global providers.
    const tracer = getTracer('test-service');
    expect(tracer).toBeDefined();

    const meter = getMeter('test-service');
    expect(meter).toBeDefined();

    // A span can be created and ended without an exporter in test mode.
    const span = tracer.startSpan('test-span');
    span.setAttribute('test', 'true');
    span.end();

    await handle.shutdown();
  });

  it('creates separate handles per call', () => {
    const a = initObservability({ serviceName: 'a' });
    const b = initObservability({ serviceName: 'b' });
    expect(a).not.toBe(b);
    void a.shutdown();
    void b.shutdown();
  });
});
