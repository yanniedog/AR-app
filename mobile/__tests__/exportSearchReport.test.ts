import { exportSearchReport, ReportCancelled } from '../src/lib/exportSearchReport';
import { getMandatoryEligibilityRevision, installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { EMPTY_PROFILE } from '../src/data/profile';
import type { FilteredSearchSnapshot } from '../src/data/filteredSearchSnapshot';
const mockFiles: { uri: string; exists: boolean; size: number; delete: jest.Mock; write: jest.Mock }[] = [];
const mockPrint = jest.fn(), mockShare = jest.fn(), mockAvailable = jest.fn();
jest.mock('expo-file-system', () => ({ Paths: { cache: 'cache' }, File: class {
  uri: string; exists = true; size = 100;
  delete = jest.fn(() => { this.exists = false; });
  write = jest.fn((bytes: Uint8Array) => { this.size = bytes.length; });
  constructor(...parts: string[]) { this.uri = parts.join('/'); mockFiles.push(this); }
} }));
jest.mock('expo-print', () => ({ printToFileAsync: (...args: unknown[]) => mockPrint(...args) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => mockAvailable(), shareAsync: (...args: unknown[]) => mockShare(...args) }));
jest.mock('../src/lib/searchReportPdf', () => ({ searchReportHtml: async () => '<html>Verified test</html>' }));
jest.mock('../src/lib/searchReportTables', () => ({ searchReportTables: () => [] }));
jest.mock('../src/lib/searchReportWorkbook', () => ({ writeReportWorkbook: async () => new Uint8Array([1, 2, 3]) }));
const snapshot = () => ({ publicationDate: '2026-09-16', eligibilityRevision: getMandatoryEligibilityRevision() } as FilteredSearchSnapshot);
beforeEach(() => { jest.clearAllMocks(); mockFiles.length = 0; mockAvailable.mockResolvedValue(true); mockPrint.mockResolvedValue({ uri: 'cache/report.pdf', numberOfPages: 2 }); mockShare.mockResolvedValue(undefined); });

test.each(['pdf', 'xlsx'] as const)('%s shares a local file and cleans it after the share sheet returns', async format => {
  await exportSearchReport(snapshot(), format, new AbortController().signal, jest.fn());
  expect(mockShare).toHaveBeenCalledTimes(1); expect(mockFiles[0].delete).toHaveBeenCalledTimes(1);
  expect(mockFiles[0].exists).toBe(false);
});
test('cancellation during native PDF generation discards the file without sharing', async () => {
  const abort = new AbortController();
  mockPrint.mockImplementation(async () => { abort.abort(); return { uri: 'cache/report.pdf', numberOfPages: 2 }; });
  await expect(exportSearchReport(snapshot(), 'pdf', abort.signal, jest.fn())).rejects.toBeInstanceOf(ReportCancelled);
  expect(mockShare).not.toHaveBeenCalled(); expect(mockFiles[0].delete).toHaveBeenCalled();
});
test('changed requirements after capture cannot share a stale snapshot', async () => {
  const old = snapshot(); installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null));
  await expect(exportSearchReport(old, 'pdf', new AbortController().signal, jest.fn())).rejects.toBeInstanceOf(ReportCancelled);
  expect(mockPrint).not.toHaveBeenCalled(); expect(mockShare).not.toHaveBeenCalled();
});
test('changed requirements during native PDF generation discard the completed file', async () => {
  mockPrint.mockImplementation(async () => { installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)); return { uri: 'cache/report.pdf', numberOfPages: 2 }; });
  await expect(exportSearchReport(snapshot(), 'pdf', new AbortController().signal, jest.fn())).rejects.toBeInstanceOf(ReportCancelled);
  expect(mockShare).not.toHaveBeenCalled(); expect(mockFiles[0].delete).toHaveBeenCalled();
});
test('empty native output and share failures are explicit and cleaned', async () => {
  mockPrint.mockResolvedValue({ uri: 'cache/report.pdf', numberOfPages: 0 });
  await expect(exportSearchReport(snapshot(), 'pdf', new AbortController().signal, jest.fn())).rejects.toThrow('no readable pages');
  expect(mockFiles[0].delete).toHaveBeenCalled(); expect(mockShare).not.toHaveBeenCalled();
  mockShare.mockRejectedValue(Error('share unavailable'));
  await expect(exportSearchReport(snapshot(), 'xlsx', new AbortController().signal, jest.fn())).rejects.toThrow('share unavailable');
  expect(mockFiles[1].delete).toHaveBeenCalled();
});
test('unavailable sharing generates no file', async () => {
  mockAvailable.mockResolvedValue(false);
  await expect(exportSearchReport(snapshot(), 'pdf', new AbortController().signal, jest.fn())).rejects.toThrow('unavailable');
  expect(mockPrint).not.toHaveBeenCalled(); expect(mockFiles).toHaveLength(0);
});
