/** Dictionary encoding changes representation only; source decimal lexemes and
 * document identities retain their exact string values. */
export const CRITERIA_TREE_LIMITS = { keys: 256, keyBytes: 256, strings: 65_536, stringBytes: 8192,
  depth: 64, nodes: 500_000, totalNodes: 4_000_000 };
const HOSTILE = new Set(['__proto__', 'prototype', 'constructor']);
const ownMap = (): Record<string, unknown> => Object.create(null) as Record<string, unknown>;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
function requireWire(value: unknown): asserts value { if (!value) throw new Error('Invalid or excessive compact criteria'); }
function table(value: unknown, maximum: number, bytes: number, keys = false): string[] {
  requireWire(Array.isArray(value) && value.length <= maximum);
  const seen = new Set<string>(), encoder = new TextEncoder();
  for (const entry of value) {
    requireWire(typeof entry === 'string' && encoder.encode(entry).length <= bytes && !seen.has(entry)
      && (!keys || entry.length > 0 && !HOSTILE.has(entry)));
    seen.add(entry);
  }
  return value as string[];
}
function index(value: string, maximum: number): number {
  requireWire(/^(?:0|[1-9a-z][0-9a-z]*)$/.test(value) && value.length <= 10);
  const numeric = parseInt(value, 36);
  requireWire(Number.isSafeInteger(numeric) && numeric >= 0 && numeric < maximum && numeric.toString(36) === value);
  return numeric;
}
export interface CriteriaDecodeBudget { nodes: number }

/** Iterative expansion shares pooled strings and bounds object/array growth.
 * No evaluation, value coercion or recursive dictionary interpretation. */
export async function decodeCriteriaProducts(shard: Record<string, unknown>, budget: CriteriaDecodeBudget,
  checkpoint: () => Promise<void>): Promise<Record<string, unknown>> {
  requireWire(shard.schema_version === 1 || shard.schema_version === 2);
  const compact = shard.schema_version === 2;
  if (!compact) requireWire(shard.keyTable === undefined && shard.stringTable === undefined);
  const keys = compact ? table(shard.keyTable, CRITERIA_TREE_LIMITS.keys, CRITERIA_TREE_LIMITS.keyBytes, true) : [];
  const strings = compact ? table(shard.stringTable, CRITERIA_TREE_LIMITS.strings, CRITERIA_TREE_LIMITS.stringBytes) : [];
  requireWire(object(shard.products));
  const holder = ownMap();
  type Task = { value: unknown; parent: Record<string, unknown> | unknown[]; key: string | number; depth: number; routes?: boolean };
  const tasks: Task[] = [{ value: shard.products, parent: holder, key: 'products', depth: 0, routes: true }];
  let nodes = 0;
  while (tasks.length) {
    const task = tasks.pop()!;
    requireWire(++nodes <= CRITERIA_TREE_LIMITS.nodes && ++budget.nodes <= CRITERIA_TREE_LIMITS.totalNodes
      && task.depth <= CRITERIA_TREE_LIMITS.depth);
    if (nodes % 2048 === 0) await checkpoint();
    const value = task.value;
    let decoded: unknown = value;
    if (typeof value === 'string') {
      if (compact && value.startsWith('~')) decoded = value.startsWith('~~') ? value.slice(1) : strings[index(value.slice(1), strings.length)];
    } else if (Array.isArray(value)) {
      requireWire(nodes + tasks.length + value.length <= CRITERIA_TREE_LIMITS.nodes
        && budget.nodes + tasks.length + value.length <= CRITERIA_TREE_LIMITS.totalNodes);
      decoded = new Array(value.length);
      for (let i = value.length - 1; i >= 0; i--) tasks.push({ value: value[i], parent: decoded as unknown[], key: i, depth: task.depth + 1 });
    } else if (object(value)) {
      const result = ownMap(); decoded = result;
      requireWire(nodes + tasks.length + Object.keys(value).length <= CRITERIA_TREE_LIMITS.nodes
        && budget.nodes + tasks.length + Object.keys(value).length <= CRITERIA_TREE_LIMITS.totalNodes);
      for (const [encoded, child] of Object.entries(value)) {
        const key = compact && !task.routes ? keys[index(encoded, keys.length)] : encoded;
        requireWire(!HOSTILE.has(key) && !Object.hasOwn(result, key));
        result[key] = undefined;
        tasks.push({ value: child, parent: result, key, depth: task.depth + 1 });
      }
    } else requireWire(value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value));
    if (Array.isArray(task.parent)) task.parent[task.key as number] = decoded;
    else task.parent[task.key] = decoded;
  }
  await checkpoint();
  return holder.products as Record<string, unknown>;
}
