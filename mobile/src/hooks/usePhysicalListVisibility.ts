import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useWindowDimensions, type View } from 'react-native';
import { PerformanceAuditReadinessContext } from './performanceAuditReadinessContext';

export interface WindowRect { x: number; y: number; width: number; height: number }
/** Require a usable touch-sized intersection inside the actual list and window. */
export function physicallyVisible(row: WindowRect, viewport: WindowRect, window: { width: number; height: number }) {
  if (![row, viewport].every(rect => Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0)) return false;
  const width = Math.min(row.x + row.width, viewport.x + viewport.width, window.width) - Math.max(row.x, viewport.x, 0);
  const height = Math.min(row.y + row.height, viewport.y + viewport.height, window.height) - Math.max(row.y, viewport.y, 0);
  return row.width >= 48 && row.height >= 48 && width >= 48 && height >= 48;
}

const PHYSICAL_VISIBILITY_RETRY_MS = 120;
const PHYSICAL_VISIBILITY_LOST_CALLBACK_MS = 600;
const PHYSICAL_VISIBILITY_RETRY_LIMIT = 16;

/** Native viewability is only a measurement trigger, never audit visibility proof. */
export function usePhysicalListVisibility<Row>(revision: string, rows: readonly Row[], unobscured: boolean,
  key: (row: Row, index: number) => string,
  onMeasured: (info: { viewableItems: { item: Row; index: number; key: string; isViewable: true }[] }) => void) {
  const registry = useContext(PerformanceAuditReadinessContext);
  const captureGeneration = useSyncExternalStore(registry.subscribeCapture, registry.getCaptureGeneration, registry.getCaptureGeneration);
  const active = registry.isCapturing();
  const window = useWindowDimensions();
  const viewport = useRef<View>(null);
  const cells = useRef(new Map<Row, View>());
  const current = useRef({ revision, rows, unobscured, window, onMeasured, key, active });
  current.current = { revision, rows, unobscured, window, onMeasured, key, active };
  const identity = JSON.stringify([revision, captureGeneration, unobscured, window.width, window.height]);
  const [result, setResult] = useState<{ identity: string; rows: readonly Row[]; count: number } | null>(null);
  const identityRef = useRef(identity); identityRef.current = identity;
  const serial = useRef(0);
  const mounted = useRef(true);
  const registrationFrame = useRef<number | null>(null);
  const publicationFrame = useRef<number | null>(null);
  const stopPublication = useCallback(() => {
    if (publicationFrame.current !== null) cancelAnimationFrame(publicationFrame.current);
    publicationFrame.current = null;
  }, []);
  // A screen returning under a navigation transition can be measured while it
  // is still detached or offset: the native callback is then lost or reports
  // nothing on screen, and no later event would ask again. Re-measure a
  // bounded number of times until a row is physically visible.
  const retry = useRef<{ timer: ReturnType<typeof setTimeout> | null; attempts: number }>({ timer: null, attempts: 0 });
  const stopRetry = useCallback(() => {
    if (retry.current.timer !== null) clearTimeout(retry.current.timer);
    retry.current.timer = null;
  }, []);
  const rerun = useRef<(revoke: boolean) => void>(() => {});
  const run = useCallback((revoke: boolean) => {
    const snapshot = current.current, measuredIdentity = identityRef.current, id = ++serial.current;
    stopRetry();
    stopPublication();
    if (!snapshot.active || !mounted.current) return;
    if (revoke) {
      retry.current.attempts = 0;
      // Revoke old proof before any asynchronous native callback can be lost.
      setResult(previous => previous === null ? previous : null);
      snapshot.onMeasured({ viewableItems: [] });
    }
    // Armed for a lost native callback; an empty result re-arms the short wait.
    // A measurement still in flight is never superseded by its own retry.
    const again = (waitMs: number) => {
      stopRetry();
      if (!snapshot.unobscured || snapshot.rows.length === 0 || retry.current.attempts >= PHYSICAL_VISIBILITY_RETRY_LIMIT) return;
      retry.current.timer = setTimeout(() => {
        retry.current.timer = null;
        if (!mounted.current || serial.current !== id || identityRef.current !== measuredIdentity) return;
        retry.current.attempts += 1;
        rerun.current(false);
      }, waitMs);
    };
    again(PHYSICAL_VISIBILITY_LOST_CALLBACK_MS);
    if (!viewport.current) return;
    const valid = () => mounted.current && identityRef.current === measuredIdentity && serial.current === id && current.current.revision === snapshot.revision && current.current.rows === snapshot.rows;
    const publish = (viewableItems: { item: Row; index: number; key: string; isViewable: true }[], complete = true) => {
      if (!valid()) return;
      // Positive proof ends the retry chain; an empty result asks again soon.
      // Partial positive evidence keeps the lost-callback retry armed so a
      // requested target that has not answered can still be measured later.
      if (complete) {
        stopPublication();
        if (viewableItems.length > 0) stopRetry(); else again(PHYSICAL_VISIBILITY_RETRY_MS);
      }
      setResult(previous => previous?.identity === measuredIdentity && previous.rows === snapshot.rows && previous.count === viewableItems.length ? previous : { identity: measuredIdentity, rows: snapshot.rows, count: viewableItems.length });
      snapshot.onMeasured({ viewableItems });
    };
    if (!snapshot.unobscured) { publish([]); return; }
    viewport.current.measureInWindow((x, y, width, height) => {
      if (!valid()) return;
      const bounds = { x, y, width, height };
      const entries = [...cells.current].filter(([row]) => snapshot.rows.includes(row));
      if (!entries.length) { publish([]); return; }
      let pending = entries.length;
      const visible: { item: Row; index: number; key: string; isViewable: true }[] = [];
      entries.forEach(([row, node]) => node.measureInWindow((cx, cy, cw, ch) => {
        if (!valid()) return;
        if (cells.current.get(row) === node && physicallyVisible({ x: cx, y: cy, width: cw, height: ch }, bounds, snapshot.window)) {
          const index = snapshot.rows.indexOf(row);
          visible.push({ item: row, index, key: snapshot.key(row, index), isViewable: true });
          // Native measurement can silently omit a detached/recycled cell's
          // callback when returning to a frozen screen. Its absence must not
          // suppress independent positive proof from a measured visible cell.
          // Only measured rows are published; an unmeasured target stays pending.
          // Coalesce native callbacks within a frame so a measurement pass
          // cannot force a full Rates render for every positive cell.
          if (pending > 1 && publicationFrame.current === null) {
            publicationFrame.current = requestAnimationFrame(() => {
              publicationFrame.current = null;
              publish([...visible], false);
            });
          }
        }
        if (--pending === 0) publish(visible);
      }));
    });
  }, [stopRetry, stopPublication]);
  rerun.current = run;
  const measure = useCallback(() => run(true), [run]);
  const register = useCallback((row: Row, node: View | null) => {
    if (cells.current.get(row) === node || (!node && !cells.current.has(row))) return;
    if (node) cells.current.set(row, node); else cells.current.delete(row);
    if (current.current.active) {
      serial.current++;
      stopPublication();
      setResult(previous => previous === null ? previous : null);
      current.current.onMeasured({ viewableItems: [] });
      if (registrationFrame.current !== null) cancelAnimationFrame(registrationFrame.current);
      registrationFrame.current = requestAnimationFrame(() => { registrationFrame.current = null; measure(); });
    }
  }, [measure, stopPublication]);
  const refs = useRef(new Map<Row, (node: View | null) => void>());
  const refFor = useCallback((row: Row) => {
    let callback = refs.current.get(row);
    if (!callback) { callback = node => register(row, node); refs.current.set(row, callback); }
    return callback;
  }, [register]);
  useEffect(() => { for (const row of refs.current.keys()) if (!rows.includes(row)) refs.current.delete(row); }, [rows]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stopRetry(); stopPublication(); if (registrationFrame.current !== null) cancelAnimationFrame(registrationFrame.current); }; }, [stopRetry, stopPublication]);
  const cancel = useCallback(() => { serial.current++; stopRetry(); stopPublication(); }, [stopRetry, stopPublication]);
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(measure);
    return () => { cancelAnimationFrame(frame); cancel(); };
  }, [active, identity, revision, rows, unobscured, window.width, window.height, measure, cancel]);
  return { active, viewport, register, refFor, measure, visibleCount: result?.identity === identity && result.rows === rows ? result.count : null };
}
