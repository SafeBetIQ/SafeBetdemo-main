// ─── Pilot Regulator-Plane Persistence — durable backends (Milestone 4.1) ────
//
// PILOT-ONLY, NON-PRODUCTION durable storage backends for the regulator plane.
// An in-memory backend (tests / domain) and a durable append-only file backend
// (JSONL journal + directory layout) that genuinely survives process restart.
// No production endpoint or credential is used. No plaintext PII is persisted.

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SbNatRecord, AssignmentEvent } from '../registry.ts';
import type { ChainedAuditEntry } from './model.ts';
import { PILOT_STORE_SCHEMA_VERSION } from './model.ts';

/** The durable persistence backend contract (append-only streams + reads). */
export interface PersistenceBackend {
  appendRecord(record: SbNatRecord): void;
  appendAssignment(ev: AssignmentEvent): void;
  appendAuditEntry(entry: ChainedAuditEntry): void;
  /** Latest record per SB-NAT (last write wins). */
  readRecords(): SbNatRecord[];
  readAssignments(): AssignmentEvent[];
  readAuditEntries(): ChainedAuditEntry[];
  location(): string;
  schemaVersion(): string;
}

/** In-memory backend (tests / domain). Deterministic; no durability across processes. */
export class InMemoryBackend implements PersistenceBackend {
  private readonly records = new Map<string, SbNatRecord>();
  private readonly assignments: AssignmentEvent[] = [];
  private readonly audit: ChainedAuditEntry[] = [];
  appendRecord(record: SbNatRecord): void { this.records.set(record.sbNat, record); }
  appendAssignment(ev: AssignmentEvent): void { this.assignments.push(ev); }
  appendAuditEntry(entry: ChainedAuditEntry): void { this.audit.push(entry); }
  readRecords(): SbNatRecord[] { return Array.from(this.records.values()); }
  readAssignments(): AssignmentEvent[] { return this.assignments.slice(); }
  readAuditEntries(): ChainedAuditEntry[] { return this.audit.slice(); }
  location(): string { return 'in-memory'; }
  schemaVersion(): string { return PILOT_STORE_SCHEMA_VERSION; }
}

const RECORDS_FILE = 'sbnat_records.jsonl';
const ASSIGNMENTS_FILE = 'assignment_events.jsonl';
const AUDIT_FILE = 'audit_chain.jsonl';
const SCHEMA_FILE = 'schema_version.json';
export const DURABLE_STORE_FILES = [RECORDS_FILE, ASSIGNMENTS_FILE, AUDIT_FILE, SCHEMA_FILE];

/**
 * Durable, append-only file backend. Each stream is a JSONL file under a
 * pilot-only base directory; writes are appended (never rewritten). Records are
 * projected latest-per-SB-NAT on read. Survives process restart: a fresh backend
 * over the same directory reads all prior state.
 */
export class DurableFileBackend implements PersistenceBackend {
  private readonly baseDir: string;
  constructor(baseDir: string) {
    this.baseDir = baseDir;
    if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true });
    const schemaPath = join(baseDir, SCHEMA_FILE);
    if (!existsSync(schemaPath)) writeFileSync(schemaPath, JSON.stringify({ schemaVersion: PILOT_STORE_SCHEMA_VERSION, target: 'pilot-nonproduction', createdAt: new Date().toISOString() }));
  }
  private path(f: string): string { return join(this.baseDir, f); }
  private appendLine(file: string, obj: unknown): void { appendFileSync(this.path(file), JSON.stringify(obj) + '\n'); }
  private readLines<T>(file: string): T[] {
    const p = this.path(file);
    if (!existsSync(p)) return [];
    return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as T);
  }
  appendRecord(record: SbNatRecord): void { this.appendLine(RECORDS_FILE, record); }
  appendAssignment(ev: AssignmentEvent): void { this.appendLine(ASSIGNMENTS_FILE, ev); }
  appendAuditEntry(entry: ChainedAuditEntry): void { this.appendLine(AUDIT_FILE, entry); }
  readRecords(): SbNatRecord[] {
    const byId = new Map<string, SbNatRecord>();
    for (const r of this.readLines<SbNatRecord>(RECORDS_FILE)) byId.set(r.sbNat, r);  // last write wins
    return Array.from(byId.values());
  }
  readAssignments(): AssignmentEvent[] { return this.readLines<AssignmentEvent>(ASSIGNMENTS_FILE); }
  readAuditEntries(): ChainedAuditEntry[] { return this.readLines<ChainedAuditEntry>(AUDIT_FILE); }
  location(): string { return this.baseDir; }
  schemaVersion(): string {
    const p = this.path(SCHEMA_FILE);
    return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')).schemaVersion as string) : PILOT_STORE_SCHEMA_VERSION;
  }
  /** Copy every store file to a backup directory (backup foundation). */
  backupTo(targetDir: string): string {
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    for (const f of readdirSync(this.baseDir)) copyFileSync(this.path(f), join(targetDir, f));
    return targetDir;
  }
}
