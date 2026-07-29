// ─── Enterprise Policy & Rules Platform — condition language (Phase 3.6) ─────
//
// The declarative predicate language policies are written in. Conditions
// are plain JSON-serializable data — adding or changing a policy is a
// CONFIGURATION change, never a code change.
//
// The evaluator COMPARES values that the Digital Twin and the Domain
// Intelligence Platform already hold. It never calculates: no arithmetic,
// no scoring, no inference — reads and comparisons only.

/** A dot path into the fact view, e.g. 'riskScore' or 'intelligence.risk.escalationLevel'. */
export type FactPath = string;

export type ComparisonOp =
  | 'eq' | 'neq'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in'          // value is an array of allowed values
  | 'contains'    // fact is an array containing value
  | 'exists';     // fact is present and non-null (value ignored)

export interface Comparison {
  path: FactPath;
  op: ComparisonOp;
  value?: unknown;
}

/** Composable predicate: a comparison, or a boolean combination of them. */
export type Condition =
  | Comparison
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

/** Resolve a dot path against a read-only fact view. */
export function resolvePath(facts: unknown, path: FactPath): unknown {
  let current: unknown = facts;
  const segments = path.split('.');
  for (let i = 0; i < segments.length; i++) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segments[i]];
  }
  return current;
}

function compare(fact: unknown, op: ComparisonOp, value: unknown): boolean {
  switch (op) {
    case 'exists': return fact !== undefined && fact !== null;
    case 'eq': return fact === value;
    case 'neq': return fact !== value;
    case 'gt': return typeof fact === 'number' && typeof value === 'number' && fact > value;
    case 'gte': return typeof fact === 'number' && typeof value === 'number' && fact >= value;
    case 'lt': return typeof fact === 'number' && typeof value === 'number' && fact < value;
    case 'lte': return typeof fact === 'number' && typeof value === 'number' && fact <= value;
    case 'in': return Array.isArray(value) && value.indexOf(fact) !== -1;
    case 'contains': return Array.isArray(fact) && fact.indexOf(value) !== -1;
    default: return false;
  }
}

/**
 * Evaluate a condition against a fact view. A comparison on a missing fact
 * is FALSE (except 'exists') — policies decide on evidence that is present,
 * they never invent it.
 */
export function evaluateCondition(condition: Condition, facts: unknown): boolean {
  if ('all' in condition) return condition.all.every(c => evaluateCondition(c, facts));
  if ('any' in condition) return condition.any.some(c => evaluateCondition(c, facts));
  if ('not' in condition) return !evaluateCondition(condition.not, facts);
  const fact = resolvePath(facts, condition.path);
  if (fact === undefined && condition.op !== 'exists') return false;
  return compare(fact, condition.op, condition.value);
}

/** Structural validation — reject, never repair (enterprise validation ethos). */
export function validateCondition(condition: unknown, where: string): void {
  if (condition === null || typeof condition !== 'object') {
    throw new Error(`${where}: condition must be an object`);
  }
  const c = condition as Record<string, unknown>;
  if ('all' in c || 'any' in c) {
    const list = (c.all ?? c.any) as unknown;
    if (!Array.isArray(list) || list.length === 0) throw new Error(`${where}: all/any requires a non-empty array`);
    list.forEach((sub, i) => validateCondition(sub, `${where}[${i}]`));
    return;
  }
  if ('not' in c) { validateCondition(c.not, `${where}.not`); return; }
  if (typeof c.path !== 'string' || c.path.length === 0) throw new Error(`${where}: comparison requires a path`);
  const ops: ComparisonOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'exists'];
  if (ops.indexOf(c.op as ComparisonOp) === -1) throw new Error(`${where}: unknown op '${String(c.op)}'`);
}
