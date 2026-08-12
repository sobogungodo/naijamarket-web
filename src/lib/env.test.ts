describe('env.db credential reconciliation', () => {
  const KEYS = ['AZURE_SQL_SERVER', 'DATABASE_SERVER', 'SQL_SERVER',
    'AZURE_SQL_DATABASE', 'DATABASE_NAME', 'SQL_DATABASE',
    'AZURE_SQL_USER', 'DATABASE_USER', 'SQL_USERNAME', 'SQL_USER',
    'AZURE_SQL_PASSWORD', 'DATABASE_PASSWORD', 'SQL_PASSWORD'];
  const clear = () => KEYS.forEach((k) => delete process.env[k]);
  beforeEach(clear);
  afterAll(clear);

  function loadDb() { jest.resetModules(); return require('./env').env.db; }

  test('prefers AZURE_SQL_* over DATABASE_* over SQL_*', () => {
    process.env.SQL_SERVER = 'sql-host'; process.env.DATABASE_SERVER = 'db-host'; process.env.AZURE_SQL_SERVER = 'azure-host';
    expect(loadDb().server).toBe('azure-host');
  });
  test('falls back to DATABASE_* when AZURE_SQL_* unset', () => {
    process.env.DATABASE_NAME = 'db-name';
    expect(loadDb().database).toBe('db-name');
  });
  test('falls back to the irregular SQL_* names (SQL_USERNAME)', () => {
    process.env.SQL_USERNAME = 'sqluser';
    expect(loadDb().user).toBe('sqluser');
  });
  test('uses the existing defaults when nothing is set', () => {
    const db = loadDb();
    expect(db.server).toBe('naijafood.database.windows.net');
    expect(db.database).toBe('naijafoodmarket-live');
    expect(db.user).toBe('');
    expect(db.password).toBe('');
  });
  test('skips a defined-but-empty AZURE_SQL_* value and falls through like ||', () => {
    process.env.AZURE_SQL_SERVER = '';
    process.env.DATABASE_SERVER = 'db-host';
    expect(loadDb().server).toBe('db-host');
  });
  test('an empty AZURE_SQL_* with everything else unset/empty falls all the way to default', () => {
    process.env.AZURE_SQL_SERVER = '';
    process.env.DATABASE_SERVER = '';
    process.env.SQL_SERVER = '';
    expect(loadDb().server).toBe('naijafood.database.windows.net');
  });
  test('DATABASE_* beats SQL_* in the middle tier (3-tier order, not just fallback-exists)', () => {
    process.env.DATABASE_NAME = 'db-name';
    process.env.SQL_DATABASE = 'sql-name';
    expect(loadDb().database).toBe('db-name');
  });
});

describe('req/opt', () => {
  test('req throws on unset', () => {
    delete process.env.__X; const { req } = require('./env');
    expect(() => req('__X')).toThrow(/__X/);
  });
  test('opt returns fallback', () => {
    delete process.env.__Y; const { opt } = require('./env');
    expect(opt('__Y', 'def')).toBe('def');
  });
});
