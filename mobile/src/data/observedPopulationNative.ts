import { fetch as expoFetch } from 'expo/fetch';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { parseJsonHeavy, yieldToUi } from '../lib/yieldToUi';
import { APP_DATA_ORIGIN } from '../lib/automaticDataAccess';
import { decodePayloadUtf8, inflatePayloadOffThread } from './payloadInflation';
import { gunzipCooperatively } from './payload';
import { CANDIDATE_MAX_ASSET_BYTES, type CandidateAssetCodec, type CandidateAssetStorage, type CandidateAssetTransport } from './observedPopulationAssets';
import { OBSERVED_POPULATION_CAPABILITY, observedPopulationTransportUrl } from './observedPopulationChannel';
import { createObservedPopulationAdoption } from './observedPopulationAdoption';
import type { StoreGet, StoreSet } from './storeTypes';

const CHUNK = 256 * 1024;
const ROOT_NAME = 'observed-population-v1';
let nativeStorage: CandidateAssetStorage | undefined;
/** No I/O or opt-in at import. Uses the installed Expo streaming fetch, never the legacy transport. */
export function createObservedPopulationTransport(fetcher: typeof expoFetch = expoFetch): CandidateAssetTransport {
  const readBytes: CandidateAssetTransport['readBytes'] = async request => {
    const prefix = `${APP_DATA_ORIGIN}/v1/capabilities/${OBSERVED_POPULATION_CAPABILITY}/release/`;
    if (!request.url.startsWith(prefix) || request.redirect !== 'error' || !Number.isSafeInteger(request.maxBytes) ||
      request.maxBytes <= 0 || request.maxBytes > CANDIDATE_MAX_ASSET_BYTES) throw Error('Invalid candidate request');
    const canonical = `https://github.com/yanniedog/AR-local/releases/download/${request.url.slice(prefix.length)}`;
    if (observedPopulationTransportUrl(canonical, OBSERVED_POPULATION_CAPABILITY) !== request.url) throw Error('Invalid candidate route');
    const abort = new AbortController();
    const cancel = () => abort.abort();
    const timer = setTimeout(cancel, 60_000);
    request.signal?.addEventListener('abort', cancel, { once: true });
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      if (request.signal?.aborted) abort.abort();
      const response = await fetcher(request.url, { redirect: 'error', signal: abort.signal, credentials: 'omit' });
      if (!response.ok || response.redirected || response.url !== request.url || !response.body) {
        await response.body?.cancel(); throw Error('Candidate HTTP status/redirect/body rejected');
      }
      reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      for (;;) {
        if (abort.signal.aborted) throw Error('Candidate download cancelled');
        const next = await reader.read(); if (next.done) break;
        if (next.value.length > request.maxBytes - length) throw Error('Candidate response exceeds byte limit');
        length += next.value.length; chunks.push(next.value);
      }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return bytes;
    } catch (error) { await reader?.cancel().catch(() => undefined); throw error; }
    finally { reader?.releaseLock(); clearTimeout(timer); request.signal?.removeEventListener('abort', cancel); }
  };
  return { readBytes, readText: async request => decodePayloadUtf8(await readBytes(request)) };
}

export const observedPopulationCodec: CandidateAssetCodec = {
  decodeText: decodePayloadUtf8,
  yieldWork: () => yieldToUi(0),
  async decode(bytes, maxDecodedBytes) {
    const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (!gzip && bytes.length > maxDecodedBytes) throw Error('Candidate decoded size exceeds limit');
    const text = gzip ? await inflatePayloadOffThread(bytes, maxDecodedBytes) ??
      decodePayloadUtf8(await gunzipCooperatively(bytes, 64 * 1024, maxDecodedBytes)) : decodePayloadUtf8(bytes);
    return parseJsonHeavy(text);
  },
};

/** Only the private candidate namespace is accessible. Binary chunks avoid giant base64 cache copies. */
export function createObservedPopulationNativeStorage(): CandidateAssetStorage {
  if (Platform.OS === 'web') throw Error('Native candidate cache requires an installed app');
  if (nativeStorage) return nativeStorage;
  const root = new Directory(Paths.document, ROOT_NAME);
  const fileFor = (key: string) => {
    if (!/^(?:head-[01]\.json|edition-[1-9]\d*\/(?:core\.bin|details\.bin|selection\.json))$/.test(key)) throw Error('Invalid candidate cache key');
    const file = new File(root, key);
    if (!file.uri.startsWith(`${root.uri.replace(/\/$/, '')}/`)) throw Error('Candidate cache escaped namespace');
    return file;
  };
  nativeStorage = {
    async read(key, maxBytes) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > CANDIDATE_MAX_ASSET_BYTES) throw Error('Invalid cache read limit');
      const file = fileFor(key); if (!file.exists) return null;
      const size = file.size;
      if (!Number.isSafeInteger(size) || size < 0 || size > maxBytes) throw Error('Candidate cache exceeds byte limit');
      const bytes = new Uint8Array(size), handle = file.open();
      try {
        for (let offset = 0; offset < size;) {
          const chunk = handle.readBytes(Math.min(CHUNK, size - offset));
          if (!chunk.length || chunk.length > size - offset) throw Error('Candidate cache size changed');
          bytes.set(chunk, offset); offset += chunk.length; await yieldToUi(0);
        }
        if (handle.size !== size) throw Error('Candidate cache size changed');
      } finally { handle.close(); }
      return bytes;
    },
    async write(key, bytes) {
      if (bytes.length > CANDIDATE_MAX_ASSET_BYTES) throw Error('Candidate cache exceeds byte limit');
      const file = fileFor(key);
      root.create({ intermediates: true, idempotent: true });
      const parent = key.includes('/') ? new Directory(root, key.split('/')[0]) : root;
      parent.create({ intermediates: true, idempotent: true });
      file.create({ overwrite: true });
      const handle = file.open();
      try { for (let offset = 0; offset < bytes.length; offset += CHUNK) { handle.writeBytes(bytes.subarray(offset, offset + CHUNK)); await yieldToUi(0); } }
      finally { handle.close(); }
    },
    async removeEdition(sequence) {
      if (!Number.isSafeInteger(sequence) || sequence < 1) throw Error('Invalid candidate edition');
      const directory = new Directory(root, `edition-${sequence}`);
      if (!directory.uri.startsWith(`${root.uri.replace(/\/$/, '')}/edition-`)) throw Error('Candidate cleanup escaped namespace');
      if (directory.exists) directory.delete();
    },
  };
  return nativeStorage;
}

/** Concrete installed-app wiring, still dormant until the release gate authorizes explicit activation. */
export function createNativeObservedPopulationAdoption(capability: unknown, set: StoreSet, get: StoreGet) {
  if (capability !== OBSERVED_POPULATION_CAPABILITY) throw Error('Candidate capability required');
  return createObservedPopulationAdoption(capability, createObservedPopulationNativeStorage(), observedPopulationCodec,
    createObservedPopulationTransport(), set, get, Application.nativeApplicationVersion ?? '0.0.0');
}
