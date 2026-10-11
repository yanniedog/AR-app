import { readFileSync } from 'fs';

const readScreen = () => readFileSync(require.resolve('../app/debug-log.tsx'), 'utf8');

describe('debug-log upload receipt recovery copy', () => {
  it('keeps SecureStore detail in the local log and shows stable user-facing guidance', () => {
    const screen = readScreen();

    expect(screen).toContain('A previous public upload could not be checked.');
    expect(screen).toContain("debugLog.warn('debugLogUploadReceipt'");
    expect(screen).not.toContain(
      'setReceiptError(error instanceof Error ? error.message : String(error))',
    );
  });

  it('removes only the new public copy if its deletion receipt cannot be stored', () => {
    const service = readFileSync(require.resolve('../src/lib/debugLogSharing.ts'), 'utf8');

    expect(service).toContain('await deleteDebugLogUpload(receipt.url, receipt.deleteKey)');
    expect(service).not.toContain('await deleteDebugLogUploadAndReceipt(');
  });

  it('keeps receipt copying unavailable until successful verification is persisted', () => {
    const screen = readScreen();
    expect(screen).toContain('if (!uploadReceipt.verified) return;');
    expect(screen).toContain('disabled={uploadBusy || !uploadReceipt.verified}');
  });
});
