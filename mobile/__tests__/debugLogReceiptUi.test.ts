import { readFileSync } from 'fs';

const readScreen = () => readFileSync(require.resolve('../app/debug-log.tsx'), 'utf8');

describe('debug-log upload receipt recovery copy', () => {
  it('keeps SecureStore detail in the local log and shows a closed unverified status', () => {
    const screen = readScreen();

    expect(screen).toContain("uiLabel('Upload receipt unverified')");
    expect(screen).toContain("debugLog.warn('debugLogUploadReceipt', `read failed: ${errorDetail(error)}`)");
    expect(screen).toContain('if (active) setReceiptError(RECEIPT_CHECK_FAILED_MESSAGE)');
    expect(screen).toContain('!receiptLoaded || receiptError != null');
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
