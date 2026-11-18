import { createCustomerSync } from '../src/data/customerSync';
import { validateSyncDocument, type SyncDocument } from '../src/data/customerSyncMerge';

function setup(local: SyncDocument, remote: SyncDocument | null, base: SyncDocument = {}) {
  let stored = { accountId: null as string | null, document: local, base };
  const repository = { load: jest.fn(async () => stored), validate: jest.fn((document: SyncDocument) => { validateSyncDocument(document); }), commit: jest.fn(async (accountId: string, document: SyncDocument, nextBase: SyncDocument) => { stored = { accountId, document, base: nextBase }; }) };
  const transport = { read: jest.fn(async () => remote ? { id: 'file', etag: 'etag', document: remote } : null), write: jest.fn(async (_accountId: string, document: SyncDocument) => ({ id: 'file', etag: 'new', document })) };
  return { repository, transport, sync: createCustomerSync('account', repository, transport, () => undefined) };
}

test('empty installation restores instead of uploading defaults', async () => {
  const { repository, transport, sync } = setup({}, { balance: '650000' });
  expect((await sync.run()).status).toBe('synced');
  expect(transport.write).not.toHaveBeenCalled();
  expect(repository.commit).toHaveBeenCalledWith('account', { balance: '650000' }, { balance: '650000' }, {});
});

test('conflicting current values cannot overwrite either copy without selection', async () => {
  const { repository, transport, sync } = setup({ rate: '6.74' }, { rate: '6.70' });
  expect(await sync.run()).toEqual({ status: 'conflict', paths: ['/rate'] });
  expect(transport.write).not.toHaveBeenCalled(); expect(repository.commit).not.toHaveBeenCalled();
  expect((await sync.run({ '/rate': 'google' })).status).toBe('synced');
});

test('offline and revoked-access failures retain local state', async () => {
  const { repository, transport, sync } = setup({ balance: '650000' }, null);
  transport.read.mockRejectedValueOnce(new Error('offline'));
  await expect(sync.run()).rejects.toThrow('offline');
  expect(repository.commit).not.toHaveBeenCalled();
  expect((await sync.run()).status).toBe('synced');
});

test('disconnect invalidates in-flight work before local restoration', async () => {
  const { repository, transport, sync } = setup({}, { balance: '650000' });
  transport.read.mockImplementationOnce(async () => { sync.disconnect(); return { id: 'file', etag: 'etag', document: { balance: '650000' } }; });
  await expect(sync.run()).rejects.toThrow('connection changed');
  expect(repository.commit).not.toHaveBeenCalled();
});

test('account mismatch prevents network or upload', async () => {
  const { repository, transport, sync } = setup({ balance: '650000' }, null);
  repository.load.mockResolvedValueOnce({ accountId: 'other', document: {}, base: {} });
  await expect(sync.run()).rejects.toThrow('account changed');
  expect(transport.read).not.toHaveBeenCalled();
});

test('disconnect during the final local read prevents an upload', async () => {
  const { repository, transport, sync } = setup({ balance: '650000' }, null);
  repository.load.mockImplementationOnce(async () => ({ accountId: null, document: { balance: '650000' }, base: {} }))
    .mockImplementationOnce(async () => { sync.disconnect(); return { accountId: null, document: { balance: '650000' }, base: {} }; });
  await expect(sync.run()).rejects.toThrow('connection changed');
  expect(transport.write).not.toHaveBeenCalled(); expect(repository.commit).not.toHaveBeenCalled();
});

test('domain admission rejects a malformed remote snapshot before upload or local commit', async () => {
  const { repository, transport, sync } = setup({ balance: '650000' }, { malformed: true });
  repository.validate.mockImplementation(document => { if (document.malformed) throw new Error('Invalid customer schema'); });
  await expect(sync.run()).rejects.toThrow('Invalid customer schema');
  expect(transport.write).not.toHaveBeenCalled(); expect(repository.commit).not.toHaveBeenCalled();
});
