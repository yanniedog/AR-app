import templateSchema from './executable-template-v1.schema.json';
import assetSchema from './executable-asset-v1.schema.json';
import { dayNumber } from '../../lib/productTermsEngine/calendar';
// Small interpreter for the frozen schemas: no generated code or runtime schema adoption.
type Schema = { [key: string]: any };
export function assertWire(value: unknown, kind: 'template' | 'asset'): void {
  let nodes = 0;
  const root: Schema = kind === 'template' ? templateSchema : assetSchema;
  function valid(v: any, s: Schema, document: Schema, depth: number): boolean {
    if (++nodes > 100000 || depth > 64) return false;
    if (s.$ref) {
      if (s.$ref === 'executable-template-v1.schema.json') return valid(v, templateSchema, templateSchema, depth + 1);
      if (!s.$ref.startsWith('#/')) return false;
      const target = s.$ref.slice(2).split('/').reduce((o: Schema, k: string) => o?.[k], document);
      return !!target && valid(v, target, document, depth + 1);
    }
    if (s.oneOf && s.oneOf.filter((x: Schema) => valid(v, x, document, depth + 1)).length !== 1) return false;
    if (s.anyOf && !s.anyOf.some((x: Schema) => valid(v, x, document, depth + 1))) return false;
    if ('const' in s && v !== s.const) return false;
    if (s.enum && !s.enum.includes(v)) return false;
    const type = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    if (s.type && !(Array.isArray(s.type) ? s.type : [s.type]).some((t: string) => t === type || (t === 'integer' && Number.isSafeInteger(v)))) return false;
    if (typeof v === 'number' && (!Number.isFinite(v) || (s.minimum !== undefined && v < s.minimum) || (s.maximum !== undefined && v > s.maximum))) return false;
    if (typeof v === 'string') {
      const length = [...v].length;
      if ((s.minLength !== undefined && length < s.minLength) || (s.maxLength !== undefined && length > s.maxLength) || (s.pattern && !new RegExp(s.pattern).test(v))) return false;
      if (s.format === 'date') { try { dayNumber(v); } catch { return false; } }
      if (s.format === 'date-time' && !Number.isFinite(Date.parse(v))) return false;
    }
    if (Array.isArray(v)) {
      if ((s.minItems !== undefined && v.length < s.minItems) || (s.maxItems !== undefined && v.length > s.maxItems) || (s.uniqueItems && new Set(v.map(x => JSON.stringify(x))).size !== v.length)) return false;
      if (s.items && !v.every(x => valid(x, s.items, document, depth + 1))) return false;
    } else if (v && typeof v === 'object') {
      if (s.required?.some((k: string) => !Object.hasOwn(v, k))) return false;
      for (const k of Object.keys(v)) {
        if (s.properties && Object.hasOwn(s.properties, k)) { if (!valid(v[k], s.properties[k], document, depth + 1)) return false; }
        else if (s.additionalProperties === false) return false;
      }
    }
    return true;
  }
  if (!valid(value, root, root, 0)) throw new Error('Executable contract wire is invalid');
}
