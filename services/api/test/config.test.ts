import { describe, expect, it } from 'vitest';
import { loadConfig, ConfigError } from '../src/config.js';

describe('config', () => {
  it('applies defaults for local development', () => {
    const config = loadConfig({ NODE_ENV: 'development' });
    expect(config.PORT).toBe(4000);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.DATABASE_URL).toContain('localhost:5432');
    expect(config.REDIS_URL).toContain('localhost:6379');
  });

  it('parses explicit environment values', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
      PORT: '8080',
      HOST: '127.0.0.1',
      DATABASE_URL: 'postgresql://u:p@db:5432/x',
    });
    expect(config.PORT).toBe(8080);
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.LOG_LEVEL).toBe('warn');
    expect(config.DATABASE_URL).toBe('postgresql://u:p@db:5432/x');
  });

  it('rejects invalid values with a ConfigError', () => {
    expect(() => loadConfig({ NODE_ENV: 'nope', PORT: 'abc' })).toThrow(ConfigError);
  });

  it('rejects out-of-range ports', () => {
    expect(() => loadConfig({ PORT: '99999' })).toThrow(ConfigError);
  });
});
