import { assertGoogleRecoveryAvailable } from './googleRecovery';
import { customerSyncValuesEqual, validateSyncDocument, type SyncDocument } from './customerSyncMerge';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const NAME = 'ar-customer-inputs-v1.json';
const MAX_BYTES = 1024 * 1024;
export const CUSTOMER_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export interface GoogleCustomerSession { accountId: string; accessToken: string }
export interface GoogleCustomerFile { id: string; etag: string; document: SyncDocument }
export interface CustomerDriveDependencies {
  /** Production authorizer must reacquire short-lived tokens without storing them in app data. */
  authorize: () => Promise<GoogleCustomerSession>;
  fetch: typeof fetch;
  assertAvailable?: () => void;
}

/** No AR server, broad Drive scope, credentials in URLs, or private error bodies. */
export function createGoogleCustomerFile(deps: CustomerDriveDependencies) {
  async function request(accountId: string, url: string, init: RequestInit = {}): Promise<Response> {
    (deps.assertAvailable ?? assertGoogleRecoveryAvailable)();
    const session = await deps.authorize();
    (deps.assertAvailable ?? assertGoogleRecoveryAvailable)();
    if (!session.accountId || session.accountId !== accountId || !session.accessToken) throw new Error('Google account changed.');
    const response = await deps.fetch(url, {
      ...init, redirect: 'error', headers: { ...init.headers, Authorization: `Bearer ${session.accessToken}` },
    });
    if (!response.ok) throw new Error(response.status === 412 ? 'Google inputs changed. Sync again.' : `Google sync failed (${response.status}).`);
    return response;
  }
  async function read(accountId: string): Promise<GoogleCustomerFile | null> {
    const query = new URLSearchParams({ spaces: 'appDataFolder', q: `name = '${NAME}' and trashed = false`, fields: 'files(id),nextPageToken', pageSize: '2' });
    const listing = await (await request(accountId, `${API}?${query}`)).json() as { files?: { id: string }[]; nextPageToken?: string };
    if (!Array.isArray(listing.files) || listing.nextPageToken || listing.files.length > 1) throw new Error('Google inputs require review.');
    if (!listing.files.length) return null;
    const id = listing.files[0]?.id;
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid Google file identity.');
    const response = await request(accountId, `${API}/${id}?alt=media`);
    const etag = response.headers.get('etag');
    if (!etag || Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('Invalid Google inputs.');
    const text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Google inputs exceed the size limit.');
    let value: { version?: unknown; accountId?: unknown; data?: unknown };
    try { value = JSON.parse(text); } catch { throw new Error('Invalid Google inputs.'); }
    if (!value || value.version !== 1 || value.accountId !== accountId) throw new Error('Invalid Google inputs.');
    return { id, etag, document: validateSyncDocument(value.data) };
  }
  async function write(accountId: string, document: SyncDocument, previous: GoogleCustomerFile | null): Promise<GoogleCustomerFile> {
    validateSyncDocument(document);
    const body = JSON.stringify({ version: 1, accountId, data: document });
    if (new TextEncoder().encode(body).length > MAX_BYTES) throw new Error('Customer inputs exceed the size limit.');
    if (previous) {
      if (!/^[A-Za-z0-9_-]+$/.test(previous.id) || !previous.etag) throw new Error('Invalid Google file identity.');
      await request(accountId, `${UPLOAD}/${previous.id}?uploadType=media`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'If-Match': previous.etag }, body,
      });
    } else {
      // Re-read before creating: a fresh installation must never replace existing inputs.
      if (await read(accountId)) throw new Error('Google inputs changed. Sync again.');
      const boundary = 'ar_customer_inputs_boundary';
      await request(accountId, `${UPLOAD}?uploadType=multipart`, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: NAME, parents: ['appDataFolder'] })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`,
      });
    }
    const verified = await read(accountId);
    // Equality is semantic: Google may change JSON whitespace or property order.
    if (!verified || !customerSyncValuesEqual(verified.document, document)) throw new Error('Google sync could not be verified.');
    return verified;
  }
  return { read, write };
}
