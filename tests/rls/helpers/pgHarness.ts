/**
 * Harness Postgres éphémère pour les tests d'isolation RLS (gate `rls-isolation`, 03_SECURITY §2).
 *
 * Pourquoi un vrai Postgres : les policies RLS sont du SQL natif non simulable. Ce harness
 * démarre un cluster jetable (`initdb` + `pg_ctl`), applique le shim `auth` (test-only) puis
 * les migrations et policies versionnées, et expose des connexions par rôle :
 *   - asService() : superuser → équivalent `service_role` (BYPASSRLS), pour le seed.
 *   - asUser(uid) : `SET ROLE authenticated` + `request.jwt.claims.sub = uid`, RLS appliquée.
 *
 * Le gate doit être RÉELLEMENT actif : si aucun binaire serveur Postgres n'est trouvable
 * (et pas de DATABASE_URL), on ÉCHOUE bruyamment — jamais de skip silencieux (cf §8 incidents).
 */
import { Client } from 'pg';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase/migrations');
const POLICIES_DIR = join(REPO_ROOT, 'supabase/policies');
const SHIM_SQL = join(HERE, 'auth-shim.sql');

const SUPERUSER = 'medinfo_super';

export type QueryResult = { rows: any[]; rowCount: number | null };
export type Query = (text: string, params?: any[]) => Promise<QueryResult>;

export interface RlsHarness {
  /** Exécute en tant que service_role (RLS contournée). Effets persistés. */
  asService<T>(fn: (q: Query) => Promise<T>): Promise<T>;
  /** Exécute en tant que `authenticated` pour `uid` (RLS appliquée). Transaction annulée à la fin. */
  asUser<T>(uid: string, fn: (q: Query) => Promise<T>): Promise<T>;
  stop(): Promise<void>;
}

const runningAsRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const PG_RUN_USER = process.env.PG_TEST_USER ?? 'postgres';

/** Localise le répertoire des binaires serveur Postgres (initdb/pg_ctl/postgres). */
function findPgBinDir(): string | null {
  if (process.env.PG_BINDIR && existsSync(join(process.env.PG_BINDIR, 'initdb'))) {
    return process.env.PG_BINDIR;
  }
  const base = '/usr/lib/postgresql';
  if (existsSync(base)) {
    const versions = readdirSync(base)
      .filter((v) => existsSync(join(base, v, 'bin/initdb')))
      .sort((a, b) => Number(b) - Number(a));
    if (versions.length > 0) return join(base, versions[0], 'bin');
  }
  // Dernier recours : binaires sur le PATH.
  const probe = spawnSync('initdb', ['--version']);
  if (probe.status === 0) return '';
  return null;
}

/** Exécute un binaire PG, en se déposant sur l'utilisateur `postgres` si on tourne en root. */
function runPg(binDir: string, bin: string, args: string[]): void {
  const exe = binDir ? join(binDir, bin) : bin;
  if (runningAsRoot) {
    execFileSync('runuser', ['-u', PG_RUN_USER, '--', exe, ...args], { stdio: 'pipe' });
  } else {
    execFileSync(exe, args, { stdio: 'pipe' });
  }
}

async function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => res(port));
    });
  });
}

function readSqlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'));
}

async function applySqlBundles(client: Client): Promise<void> {
  const bundles = [readFileSync(SHIM_SQL, 'utf8'), ...readSqlFiles(MIGRATIONS_DIR), ...readSqlFiles(POLICIES_DIR)];
  for (const sql of bundles) {
    if (sql.trim()) await client.query(sql);
  }
}

/** Démarre le harness contre DATABASE_URL si fourni, sinon contre un cluster éphémère local. */
export async function startRlsHarness(): Promise<RlsHarness> {
  const externalUrl = process.env.RLS_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (externalUrl) {
    return startAgainst({ connectionString: externalUrl });
  }

  const binDir = findPgBinDir();
  if (binDir === null) {
    throw new Error(
      'rls-isolation: aucun binaire serveur Postgres trouvé (initdb) et pas de DATABASE_URL. ' +
        'Installez postgresql ou exportez DATABASE_URL. Le gate RLS ne peut pas être contourné.',
    );
  }

  // Base traversable directement sous /tmp : l'utilisateur `postgres` doit pouvoir
  // entrer dans le chemin (TMPDIR root en mode 700 le lui interdirait).
  const base = mkdtempSync('/tmp/medinfo-rls-');
  chmodSync(base, 0o711);
  const dataDir = join(base, 'data');
  const sockDir = join(base, 'sock');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(sockDir, { recursive: true });
  if (runningAsRoot) {
    // Le cluster tourne sous `postgres` : lui donner la propriété des répertoires.
    execFileSync('chown', ['-R', `${PG_RUN_USER}:${PG_RUN_USER}`, base]);
  }

  runPg(binDir, 'initdb', ['-D', dataDir, '--auth=trust', '--username', SUPERUSER, '--no-sync']);

  const port = await freePort();
  const logFile = join(sockDir, 'server.log');
  runPg(binDir, 'pg_ctl', [
    '-D',
    dataDir,
    '-l',
    logFile,
    '-o',
    `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories=${sockDir} -c fsync=off`,
    '-w',
    'start',
  ]);

  const stopCluster = () => {
    try {
      runPg(binDir, 'pg_ctl', ['-D', dataDir, '-m', 'immediate', '-w', 'stop']);
    } catch {
      /* déjà arrêté */
    }
    rmSync(base, { recursive: true, force: true });
  };

  try {
    const harness = await startAgainst(
      { host: '127.0.0.1', port, user: SUPERUSER, database: 'postgres' },
      stopCluster,
    );
    return harness;
  } catch (err) {
    stopCluster();
    throw err;
  }
}

async function startAgainst(
  connection: Record<string, unknown>,
  onStop?: () => void,
): Promise<RlsHarness> {
  const admin = new Client(connection);
  await admin.connect();
  await applySqlBundles(admin);

  const wrap = (client: Client): Query => async (text, params) => {
    const r = await client.query(text, params);
    return { rows: r.rows, rowCount: r.rowCount };
  };

  return {
    async asService(fn) {
      // superuser → contourne la RLS, comme service_role.
      const client = new Client(connection);
      await client.connect();
      try {
        return await fn(wrap(client));
      } finally {
        await client.end();
      }
    },
    async asUser(uid, fn) {
      const client = new Client(connection);
      await client.connect();
      try {
        await client.query('BEGIN');
        await client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: uid, role: 'authenticated' }),
        ]);
        await client.query('SET LOCAL ROLE authenticated');
        const result = await fn(wrap(client));
        await client.query('ROLLBACK');
        return result;
      } finally {
        await client.end();
      }
    },
    async stop() {
      await admin.end();
      onStop?.();
    },
  };
}
