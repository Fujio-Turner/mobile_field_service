import * as fs from 'fs';
import * as path from 'path';
import { log, redactFields, resetLogLevel, setLogLevel } from '../../src/log/logger';

afterEach(() => {
  resetLogLevel();
});

describe('logger redaction', () => {
  it('strips secrets, bodies, coords, and nested objects', () => {
    const out = redactFields({
      op: 'StartWork',
      docId: 'woout:1',
      password: 'x',
      sessionId: 's',
      identifier: 'tech.jon',
      body: 'secret note',
      tracking: { '1': [1, 2] },
      email: 'a@b.c',
      street: '1 Main',
      phone: '860',
      lat: 41.7,
      lon: -72.6,
      err: new Error('boom'),
    });
    expect(out.password).toBeUndefined();
    expect(out.sessionId).toBeUndefined();
    expect(out.identifier).toBeUndefined();
    expect(out.body).toBeUndefined();
    expect(out.tracking).toBeUndefined();
    expect(out.email).toBeUndefined();
    expect(out.street).toBeUndefined();
    expect(out.phone).toBeUndefined();
    expect(out.lat).toBeUndefined();
    expect(out.lon).toBeUndefined();
    expect(out.err).toBe('boom');
    expect(out.docId).toBe('woout:1');
  });

  it('emits JSON lines without PII fields', () => {
    setLogLevel('info');
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    log.info('mfs.wo.start', { op: 'StartWork', docId: 'woout:1', email: 'nope', password: 'secret' });
    expect(spy).toHaveBeenCalled();
    const line = JSON.parse(String(spy.mock.calls[0][0]));
    expect(line.event).toBe('mfs.wo.start');
    expect(line.level).toBe('info');
    expect(line.appVer).toEqual(expect.any(String));
    expect(line.ts).toEqual(expect.any(Number));
    expect(line.email).toBeUndefined();
    expect(line.password).toBeUndefined();
    expect(JSON.stringify(line)).not.toMatch(/secret/);
    spy.mockRestore();
  });

  it('drops debug when minLevel is info', () => {
    setLogLevel('info');
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    log.debug('mfs.internal', { op: 'Explain' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('src/ops and src/db logging', () => {
  it('does not call console.log', () => {
    const root = path.join(__dirname, '../../src');
    for (const dir of ['ops', 'db']) {
      for (const file of listTs(path.join(root, dir))) {
        const text = fs.readFileSync(file, 'utf8');
        expect({ file, consoleLog: /\bconsole\.log\s*\(/.test(text) }).toEqual({ file, consoleLog: false });
      }
    }
  });
});

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...listTs(p));
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(p);
  }
  return out;
}
