import path from 'node:path';

import { BUILTIN_RULES } from '../../shared/games';
import { generateSampleSnapshot } from '../../shared/sample';
import type { Draw, GameRules, GameSlug, GameSnapshot, DataSource } from '../../shared/types';
import type { Config, SourceName } from './config';
import { mergeRules } from './howToPlay/mergeRules';
import { parseHowToPlay } from './howToPlay/parseHowToPlay';
import type { HttpClient } from './http';
import { loadImportedDraws } from './sources/fileImport';
import { TheLottApi, type OpenDrawInfo } from './sources/thelottApi';
import { emptyState, type SnapshotStore, type StoreState } from './store';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface ServiceDeps {
  config: Config;
  http: HttpClient;
  store: SnapshotStore;
  log: Logger;
  now?: () => Date;
}

export interface GameStatus {
  slug: GameSlug;
  source: DataSource | null;
  rulesSource: GameSnapshot['rulesSource'] | null;
  fetchedAt: string | null;
  draws: number;
  stale: boolean;
  lastError: string | null;
}

const RULES_RECHECK_MS = 24 * 60 * 60_000;
const OPEN_DRAWS_TTL_MS = 10 * 60_000;
const OPEN_DRAWS_RETRY_MS = 2 * 60_000;
/** Sample data is a fallback, so it is retried much sooner than real data. */
const SAMPLE_TTL_MS = 5 * 60_000;
/** After a refresh attempt on stale data, wait this long before trying again. */
const RETRY_COOLDOWN_MS = 60_000;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface SourceResult {
  source: DataSource;
  draws: Draw[];
  /** Only needed when `draws` is empty by design (raffle games). */
  lastDrawDate?: string | null;
}

export class GameDataService {
  private state: StoreState = emptyState();
  private readonly inflight = new Map<GameSlug, Promise<GameSnapshot>>();
  private readonly lastError = new Map<GameSlug, string>();
  private readonly lastAttempt = new Map<GameSlug, number>();
  private readonly api: TheLottApi;
  private openDraws: { at: number; data: Map<GameSlug, OpenDrawInfo> } | null = null;
  private openDrawsFailedAt = 0;
  private openDrawsInflight: Promise<Map<GameSlug, OpenDrawInfo> | null> | null = null;

  constructor(private readonly deps: ServiceDeps) {
    this.api = new TheLottApi(deps.http, deps.config);
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private get live(): boolean {
    return this.deps.config.sourceOrder.includes('thelott');
  }

  async init(): Promise<void> {
    this.state = await this.deps.store.load((error) => this.deps.log.warn(error.message));
    const count = Object.keys(this.state.snapshots).length;
    this.deps.log.info(`Loaded ${count} cached game snapshot(s)`);
  }

  private isFresh(snapshot: GameSnapshot): boolean {
    const age = this.now().getTime() - Date.parse(snapshot.fetchedAt);
    const ttl = snapshot.source === 'sample' ? Math.min(SAMPLE_TTL_MS, this.deps.config.cacheTtlMs) : this.deps.config.cacheTtlMs;
    return age < ttl;
  }

  /** Fresh cache is served as is; stale cache is served while a refresh runs in the background. */
  async getSnapshot(slug: GameSlug): Promise<GameSnapshot> {
    const cached = this.state.snapshots[slug];
    if (cached && this.isFresh(cached)) return cached;
    if (cached) {
      const coolingDown = this.now().getTime() - (this.lastAttempt.get(slug) ?? 0) < RETRY_COOLDOWN_MS;
      if (!coolingDown) this.refresh(slug).catch(() => undefined); // already logged and recorded by refresh()
      return cached;
    }
    return this.refresh(slug);
  }

  status(): GameStatus[] {
    return (Object.keys(BUILTIN_RULES) as GameSlug[]).map((slug) => {
      const snapshot = this.state.snapshots[slug];
      return {
        slug,
        source: snapshot?.source ?? null,
        rulesSource: snapshot?.rulesSource ?? null,
        fetchedAt: snapshot?.fetchedAt ?? null,
        draws: snapshot?.draws.length ?? 0,
        stale: snapshot ? !this.isFresh(snapshot) : true,
        lastError: this.lastError.get(slug) ?? null,
      };
    });
  }

  refresh(slug: GameSlug): Promise<GameSnapshot> {
    const running = this.inflight.get(slug);
    if (running) return running;
    const task = this.doRefresh(slug)
      .catch((error) => {
        this.lastError.set(slug, message(error));
        this.deps.log.error(`Refresh of ${slug} failed: ${message(error)}`);
        throw error;
      })
      .finally(() => this.inflight.delete(slug));
    this.inflight.set(slug, task);
    return task;
  }

  /** Jackpots and draw days for every game, fetched once and shared by all refreshes. */
  private getOpenDraws(): Promise<Map<GameSlug, OpenDrawInfo> | null> {
    if (!this.live) return Promise.resolve(null);
    const nowMs = this.now().getTime();
    if (this.openDraws && nowMs - this.openDraws.at < OPEN_DRAWS_TTL_MS) return Promise.resolve(this.openDraws.data);
    if (nowMs - this.openDrawsFailedAt < OPEN_DRAWS_RETRY_MS) return Promise.resolve(this.openDraws?.data ?? null);
    this.openDrawsInflight ??= this.api
      .fetchOpenDraws(Object.keys(BUILTIN_RULES) as GameSlug[])
      .then((data) => {
        this.openDraws = { at: this.now().getTime(), data };
        return data;
      })
      .catch((error) => {
        this.openDrawsFailedAt = this.now().getTime();
        this.deps.log.warn(`Could not read jackpots from The Lott: ${message(error)}`);
        return this.openDraws?.data ?? null;
      })
      .finally(() => {
        this.openDrawsInflight = null;
      });
    return this.openDrawsInflight;
  }

  /** Confirm the built-in rules against the how-to-play page (at most once a day per game). */
  private async resolveRules(slug: GameSlug, liveDrawDays: string[]): Promise<{ rules: GameRules; source: GameSnapshot['rulesSource'] }> {
    const previous = this.state.snapshots[slug];
    const builtin = BUILTIN_RULES[slug];
    const checkedAt = this.state.rulesCheckedAt[slug];
    const recentlyChecked = checkedAt !== undefined && this.now().getTime() - Date.parse(checkedAt) < RULES_RECHECK_MS;

    if (this.live && builtin.kind === 'pick' && !recentlyChecked) {
      try {
        const html = await this.deps.http.getText(builtin.howToPlayUrl);
        const merged = mergeRules(builtin, parseHowToPlay(html), liveDrawDays);
        for (const change of merged.changes) this.deps.log.warn(`${slug} rules differ from built-in: ${change}`);
        this.state.rulesCheckedAt[slug] = this.now().toISOString();
        return { rules: merged.rules, source: merged.source };
      } catch (error) {
        this.deps.log.warn(`Could not check ${slug} rules: ${message(error)}`);
      }
    }
    if (previous && previous.rulesSource === 'scraped') return { rules: previous.rules, source: 'scraped' };
    return { rules: mergeRules(builtin, { divisions: [] }, liveDrawDays).rules, source: 'builtin' };
  }

  private async fromSource(
    name: SourceName,
    rules: GameRules,
    previous: GameSnapshot | undefined,
  ): Promise<SourceResult | null> {
    switch (name) {
      case 'import': {
        const draws = await loadImportedDraws(path.join(this.deps.config.dataDir, 'imports'), rules);
        return draws ? { source: 'import', draws } : null;
      }
      case 'thelott': {
        // Lucky Lotteries results are raffle numbers we do not model: only the date and jackpot are used.
        if (rules.slug === 'lucky-lotteries-super' || rules.slug === 'lucky-lotteries-mega') {
          return { source: 'thelott', draws: [], lastDrawDate: await this.api.fetchLastDrawDate(rules) };
        }
        const known = previous?.source === 'thelott' ? previous.draws : [];
        const draws = await this.api.fetchHistory(rules, this.deps.config.historyDraws, known);
        return draws.length > 0 ? { source: 'thelott', draws } : null;
      }
      case 'sample': {
        const sample = generateSampleSnapshot(rules, { now: this.now(), draws: this.deps.config.historyDraws });
        return { source: 'sample', draws: sample.draws };
      }
    }
  }

  private async doRefresh(slug: GameSlug): Promise<GameSnapshot> {
    this.lastAttempt.set(slug, this.now().getTime());
    const previous = this.state.snapshots[slug];
    const open = await this.getOpenDraws();
    const { rules, source: rulesSource } = await this.resolveRules(slug, open?.get(slug)?.drawDays ?? []);

    const problems: string[] = [];
    let chosen: SourceResult | null = null;
    for (const name of this.deps.config.sourceOrder) {
      try {
        chosen = await this.fromSource(name, rules, previous);
        if (chosen) break;
      } catch (error) {
        problems.push(`${name}: ${message(error)}`);
        this.deps.log.warn(`${slug}: source "${name}" failed: ${message(error)}`);
      }
    }

    // Never replace real data with sample data because of a temporary upstream problem.
    if ((!chosen || chosen.source === 'sample') && previous && previous.source !== 'sample') {
      this.lastError.set(slug, problems.join('; ') || 'no source returned data');
      this.deps.log.warn(`${slug}: keeping previous ${previous.source} data`);
      return previous;
    }
    if (!chosen) {
      throw new Error(`No data source produced ${slug}: ${problems.join('; ') || 'none configured'}`);
    }

    if (problems.length === 0) this.lastError.delete(slug);
    else this.lastError.set(slug, problems.join('; '));

    const snapshot: GameSnapshot = {
      slug,
      rules,
      rulesSource,
      source: chosen.source,
      fetchedAt: this.now().toISOString(),
      draws: chosen.draws,
      lastDrawDate: chosen.draws[0]?.date ?? chosen.lastDrawDate ?? null,
      jackpot: open ? (open.get(slug)?.jackpot ?? null) : null,
    };
    this.state.snapshots[slug] = snapshot;
    await this.deps.store.save(this.state);
    this.deps.log.info(`${slug}: ${snapshot.draws.length} draws from ${snapshot.source}`);
    return snapshot;
  }
}
