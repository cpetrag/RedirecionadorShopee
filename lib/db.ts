import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { normalizeShopeeUrlForCompare } from '@/lib/shopee-url';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type Link = {
  id: number;
  slug: string;
  shopee_url: string;
  sub_id: string | null;
  sub_ids: string | null;
  title: string | null;
  active: number;
  created_at: string;
};

/** Entrada simplificada — sem UA/referer/IP (agregado por dia/hora). */
export type AggregatedClickInput = {
  link_id: number;
  platform: string;
  in_app: boolean;
  is_bot: boolean;
};

export type ClickStats = {
  total: number;
  real: number;
  bots: number;
  by_platform: Record<string, number>;
  in_app: number;
};

export type DayStat = {
  date: string;
  real: number;
  bots: number;
  in_app: number;
};

export type HourStat = {
  hour: number;
  real: number;
  bots: number;
  in_app: number;
};

export type GlobalStats = ClickStats & {
  links_count: number;
  active_links: number;
};

// ─── Singleton do banco ──────────────────────────────────────────────────────

let db: Database.Database | null = null;

function getDbPath(): string {
  const dir = process.env.DB_PATH
    ? path.dirname(process.env.DB_PATH)
    : path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return process.env.DB_PATH ?? path.join(dir, 'redirect.db');
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      slug       TEXT UNIQUE NOT NULL,
      shopee_url TEXT NOT NULL,
      sub_id     TEXT,
      title      TEXT,
      active     INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_clicks (
      date       TEXT NOT NULL,
      link_id    INTEGER NOT NULL REFERENCES links(id),
      platform   TEXT NOT NULL,
      real       INTEGER DEFAULT 0,
      bots       INTEGER DEFAULT 0,
      in_app     INTEGER DEFAULT 0,
      PRIMARY KEY (date, link_id, platform)
    );

    CREATE TABLE IF NOT EXISTS hourly_clicks (
      date       TEXT NOT NULL,
      hour       INTEGER NOT NULL,
      link_id    INTEGER NOT NULL REFERENCES links(id),
      real       INTEGER DEFAULT 0,
      bots       INTEGER DEFAULT 0,
      in_app     INTEGER DEFAULT 0,
      PRIMARY KEY (date, hour, link_id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_clicks(date);
    CREATE INDEX IF NOT EXISTS idx_daily_link ON daily_clicks(link_id);
    CREATE INDEX IF NOT EXISTS idx_hourly_date ON hourly_clicks(date);
    CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
  `);
  migrateSchema(database);
}

function migrateSchema(database: Database.Database): void {
  const cols = database
    .prepare('PRAGMA table_info(links)')
    .all() as { name: string }[];

  if (!cols.some((c) => c.name === 'sub_ids')) {
    database.exec('ALTER TABLE links ADD COLUMN sub_ids TEXT');
  }

  migrateLegacyClicks(database);
}

/** Migra cliques individuais (tabela antiga) para agregados, uma única vez. */
function migrateLegacyClicks(database: Database.Database): void {
  const hasLegacy = database
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='clicks'`
    )
    .get();
  if (!hasLegacy) return;

  const legacyCount = (
    database.prepare('SELECT COUNT(*) AS c FROM clicks').get() as { c: number }
  ).c;
  if (legacyCount === 0) {
    database.exec('DROP TABLE IF EXISTS clicks');
    return;
  }

  const alreadyMigrated = (
    database.prepare('SELECT COUNT(*) AS c FROM daily_clicks').get() as {
      c: number;
    }
  ).c;
  if (alreadyMigrated > 0) return;

  database.exec(`
    INSERT INTO daily_clicks (date, link_id, platform, real, bots, in_app)
    SELECT
      date(created_at),
      link_id,
      COALESCE(platform, 'other'),
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END),
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END),
      SUM(CASE WHEN in_app = 1 AND is_bot = 0 THEN 1 ELSE 0 END)
    FROM clicks
    GROUP BY date(created_at), link_id, platform;

    INSERT INTO hourly_clicks (date, hour, link_id, real, bots, in_app)
    SELECT
      date(created_at),
      CAST(strftime('%H', created_at) AS INTEGER),
      link_id,
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END),
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END),
      SUM(CASE WHEN in_app = 1 AND is_bot = 0 THEN 1 ELSE 0 END)
    FROM clicks
    GROUP BY date(created_at), CAST(strftime('%H', created_at) AS INTEGER), link_id;

    DROP TABLE clicks;
  `);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentHour(): number {
  return new Date().getHours();
}

// ─── Queries: links ──────────────────────────────────────────────────────────

export function getLinkBySlug(slug: string): Link | undefined {
  return getDb()
    .prepare('SELECT * FROM links WHERE slug = ? AND active = 1')
    .get(slug) as Link | undefined;
}

/** Busca por slug independente de active (API / admin). */
export function findLinkBySlug(slug: string): Link | undefined {
  return getDb()
    .prepare('SELECT * FROM links WHERE slug = ?')
    .get(slug) as Link | undefined;
}

export function createLink(data: {
  slug: string;
  shopee_url: string;
  sub_id?: string | null;
  sub_ids?: string | null;
  title?: string | null;
}): Link {
  const stmt = getDb().prepare(`
    INSERT INTO links (slug, shopee_url, sub_id, sub_ids, title)
    VALUES (@slug, @shopee_url, @sub_id, @sub_ids, @title)
    RETURNING *
  `);
  return stmt.get({
    slug: data.slug,
    shopee_url: data.shopee_url,
    sub_id: data.sub_id ?? null,
    sub_ids: data.sub_ids ?? null,
    title: data.title ?? null,
  }) as Link;
}

export function slugExists(slug: string): boolean {
  const row = getDb()
    .prepare('SELECT 1 FROM links WHERE slug = ?')
    .get(slug);
  return !!row;
}

export function getLinkByShopeeUrl(shopeeUrl: string): Link | undefined {
  const normalized = normalizeShopeeUrlForCompare(shopeeUrl);
  const links = getDb().prepare('SELECT * FROM links').all() as Link[];
  return links.find(
    (link) => normalizeShopeeUrlForCompare(link.shopee_url) === normalized
  );
}

export function getAllLinks(): Link[] {
  return getDb()
    .prepare('SELECT * FROM links ORDER BY created_at DESC')
    .all() as Link[];
}

export function setLinkActive(id: number, active: boolean): Link | undefined {
  return getDb()
    .prepare('UPDATE links SET active = @active WHERE id = @id RETURNING *')
    .get({ id, active: active ? 1 : 0 }) as Link | undefined;
}

// ─── Queries: cliques agregados ──────────────────────────────────────────────

export function recordAggregatedClick(input: AggregatedClickInput): void {
  const database = getDb();
  const date = todayDate();
  const hour = currentHour();
  const platform = input.platform || 'other';
  const realInc = input.is_bot ? 0 : 1;
  const botInc = input.is_bot ? 1 : 0;
  const inAppInc = !input.is_bot && input.in_app ? 1 : 0;

  database
    .prepare(
      `INSERT INTO daily_clicks (date, link_id, platform, real, bots, in_app)
       VALUES (@date, @link_id, @platform, @realInc, @botInc, @inAppInc)
       ON CONFLICT(date, link_id, platform) DO UPDATE SET
         real = real + @realInc,
         bots = bots + @botInc,
         in_app = in_app + @inAppInc`
    )
    .run({ date, link_id: input.link_id, platform, realInc, botInc, inAppInc });

  database
    .prepare(
      `INSERT INTO hourly_clicks (date, hour, link_id, real, bots, in_app)
       VALUES (@date, @hour, @link_id, @realInc, @botInc, @inAppInc)
       ON CONFLICT(date, hour, link_id) DO UPDATE SET
         real = real + @realInc,
         bots = bots + @botInc,
         in_app = in_app + @inAppInc`
    )
    .run({ date, hour, link_id: input.link_id, realInc, botInc, inAppInc });
}

/** Fire-and-forget: não bloqueia a resposta do redirect. */
export function recordAggregatedClickAsync(input: AggregatedClickInput): void {
  setImmediate(() => {
    try {
      recordAggregatedClick(input);
    } catch (err) {
      console.error('[db] erro ao registrar clique agregado:', err);
    }
  });
}

function sumStatsFromDaily(where: string, params: Record<string, unknown>): ClickStats {
  const database = getDb();

  const totals = database
    .prepare(
      `SELECT
         COALESCE(SUM(real + bots), 0) AS total,
         COALESCE(SUM(real), 0) AS real,
         COALESCE(SUM(bots), 0) AS bots,
         COALESCE(SUM(in_app), 0) AS in_app
       FROM daily_clicks WHERE ${where}`
    )
    .get(params) as ClickStats;

  const byPlatform = database
    .prepare(
      `SELECT platform, COALESCE(SUM(real), 0) AS count
       FROM daily_clicks WHERE ${where}
       GROUP BY platform`
    )
    .all(params) as { platform: string; count: number }[];

  const byPlatformMap: Record<string, number> = {};
  for (const row of byPlatform) {
    byPlatformMap[row.platform] = row.count;
  }

  return {
    total: totals.total ?? 0,
    real: totals.real ?? 0,
    bots: totals.bots ?? 0,
    in_app: totals.in_app ?? 0,
    by_platform: byPlatformMap,
  };
}

export function getClickStats(linkId: number): ClickStats {
  return sumStatsFromDaily('link_id = @linkId', { linkId });
}

export function getGlobalStats(): GlobalStats {
  const database = getDb();

  const links = database
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active
       FROM links`
    )
    .get() as { total: number; active: number };

  const stats = sumStatsFromDaily('1=1', {});

  return {
    ...stats,
    links_count: links.total ?? 0,
    active_links: links.active ?? 0,
  };
}

export function getClicksByDay(days: number, linkId?: number): DayStat[] {
  const filter = linkId ? 'AND link_id = @linkId' : '';
  return getDb()
    .prepare(
      `SELECT
         date,
         COALESCE(SUM(real), 0) AS real,
         COALESCE(SUM(bots), 0) AS bots,
         COALESCE(SUM(in_app), 0) AS in_app
       FROM daily_clicks
       WHERE date >= date('now', '-' || @days || ' days') ${filter}
       GROUP BY date
       ORDER BY date ASC`
    )
    .all({ days, linkId }) as DayStat[];
}

/** Fluxo por hora (0–23) somando todos os dias do período. */
export function getClicksByHour(days: number, linkId?: number): HourStat[] {
  const filter = linkId ? 'AND link_id = @linkId' : '';
  return getDb()
    .prepare(
      `SELECT
         hour,
         COALESCE(SUM(real), 0) AS real,
         COALESCE(SUM(bots), 0) AS bots,
         COALESCE(SUM(in_app), 0) AS in_app
       FROM hourly_clicks
       WHERE date >= date('now', '-' || @days || ' days') ${filter}
       GROUP BY hour
       ORDER BY hour ASC`
    )
    .all({ days, linkId }) as HourStat[];
}

/** Totais por plataforma no período (substitui "cliques recentes"). */
export function getPlatformBreakdown(
  days: number,
  linkId?: number
): { platform: string; real: number; bots: number; in_app: number }[] {
  const filter = linkId ? 'AND link_id = @linkId' : '';
  return getDb()
    .prepare(
      `SELECT
         platform,
         COALESCE(SUM(real), 0) AS real,
         COALESCE(SUM(bots), 0) AS bots,
         COALESCE(SUM(in_app), 0) AS in_app
       FROM daily_clicks
       WHERE date >= date('now', '-' || @days || ' days') ${filter}
       GROUP BY platform
       ORDER BY real DESC`
    )
    .all({ days, linkId }) as {
    platform: string;
    real: number;
    bots: number;
    in_app: number;
  }[];
}
