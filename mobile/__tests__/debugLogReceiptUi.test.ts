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

  it('removes a just-uploaded public copy without deleting a receipt that was never stored', () => {
    const screen = readScreen();

    expect(screen).toContain('await deleteDebugLogUpload(url, deleteKey)');
    expect(screen).not.toContain('await deleteDebugLogUploadAndReceipt({');
  });
});
