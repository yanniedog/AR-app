import { createGoogleCustomerFile } from '../src/data/googleDriveCustomerFile';
import { googleRecoveryAvailable } from '../src/data/googleRecovery';

function response(value: unknown, etag = '"revision-1"', status = 200): Response {
  return { ok: status < 400, status, headers: { get: (name: string) => name === 'etag' ? etag : null },
    json: async () => value, text: async () => JSON.stringify(value) } as Response;
}
const session = { accountId: 'google-sub', accessToken: 'short-lived-token' };
function setup(...responses: Response[]) {
  const fetcher = jest.fn(); responses.forEach(value => fetcher.mockResolvedValueOnce(value));
  const authorize = jest.fn(async () => session);
  return { fetcher, authorize, drive: createGoogleCustomerFile({ fetch: fetcher, authorize, assertAvailable: () => undefined }) };
}

test('production gate prevents authorization and network before prerequisites', async () => {
  const authorize = jest.fn(), fetcher = jest.fn();
  expect(googleRecoveryAvailable()).toBe(false);
  await expect(createGoogleCustomerFile({ authorize, fetch: fetcher }).read(session.accountId)).rejects.toThrow('pending approval');
  expect(authorize).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
});

test('reads private app-data only and binds identity before each request', async () => {
  const { drive, fetcher, authorize } = setup(response({ files: [{ id: 'file-id' }] }), response({ version: 1, accountId: session.accountId, data: { loan: '650000' } }));
  expect(await drive.read(session.accountId)).toEqual({ id: 'file-id', etag: '"revision-1"', document: { loan: '650000' } });
  expect(authorize).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][0]).toContain('spaces=appDataFolder');
  expect(fetcher.mock.calls.every(([url, init]) => !url.includes(session.accessToken) && init.redirect === 'error')).toBe(true);
});

test('account switching cannot read or overwrite another account', async () => {
  const { drive, fetcher } = setup();
  await expect(drive.read('other-account')).rejects.toThrow('account changed');
  expect(fetcher).not.toHaveBeenCalled();
});

test('revocation while authorizing prevents the subsequent network request', async () => {
  let available = true;
  const fetcher = jest.fn();
  const authorize = jest.fn(async () => { available = false; return session; });
  const drive = createGoogleCustomerFile({ authorize, fetch: fetcher, assertAvailable: () => { if (!available) throw new Error('Connection revoked'); } });
  await expect(drive.read(session.accountId)).rejects.toThrow('Connection revoked');
  expect(fetcher).not.toHaveBeenCalled();
});

test('multiple files and wrong-account content fail without choosing an arbitrary snapshot', async () => {
  await expect(setup(response({ files: [{ id: 'a' }, { id: 'b' }] })).drive.read(session.accountId)).rejects.toThrow('require review');
  await expect(setup(response({ files: [{ id: 'a' }] }), response({ version: 1, accountId: 'other', data: {} })).drive.read(session.accountId)).rejects.toThrow('Invalid Google inputs');
});

test('conditional updates fail on concurrent changes without leaking response bodies', async () => {
  const { drive, fetcher } = setup(response({ privateLoan: 'must not appear in errors' }, '', 412));
  await expect(drive.write(session.accountId, { rate: '6.74' }, { id: 'file-id', etag: '"old"', document: {} })).rejects.toThrow('changed. Sync again');
  expect(fetcher.mock.calls[0][1].headers['If-Match']).toBe('"old"');
});

test('fresh installs re-read before creation and never replace an existing file', async () => {
  const { drive, fetcher } = setup(response({ files: [{ id: 'a' }] }), response({ version: 1, accountId: session.accountId, data: { loan: '650000' } }));
  await expect(drive.write(session.accountId, {}, null)).rejects.toThrow('changed. Sync again');
  expect(fetcher.mock.calls.every(([, init]) => !init.method)).toBe(true);
});

test('successful writes require verified readback', async () => {
  const { drive } = setup(response({}), response({ files: [{ id: 'a' }] }), response({ version: 1, accountId: session.accountId, data: { rate: '6.74' } }));
  expect((await drive.write(session.accountId, { rate: '6.74' }, { id: 'a', etag: '"old"', document: {} })).document).toEqual({ rate: '6.74' });
});
