import { File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';
import type { FilteredSearchSnapshot } from '../data/filteredSearchSnapshot';
import { searchReportTables } from './searchReportTables';
import { searchReportHtml } from './searchReportPdf';
import { writeReportWorkbook } from './searchReportWorkbook';
import { getMandatoryEligibilityRevision } from '../data/eligibilityGate';

export class ReportCancelled extends Error { constructor() { super('Export cancelled.'); } }
export async function exportSearchReport(snapshot: FilteredSearchSnapshot, format: 'pdf' | 'xlsx', signal: AbortSignal, progress: (value: string) => void): Promise<void> {
  const revision = snapshot.eligibilityRevision;
  const checkpoint = () => { if (signal.aborted || revision !== getMandatoryEligibilityRevision()) throw new ReportCancelled(); };
  let file: File | null = null;
  try {
    checkpoint();
    if (Platform.OS === 'web' || !await isAvailableAsync()) throw Error('Local report sharing is unavailable on this device.');
    progress('Generating report…'); checkpoint();
    if (format === 'pdf') {
      const html = await searchReportHtml(snapshot, checkpoint); checkpoint();
      const result = await printToFileAsync({ html, width: 595, height: 842, margins: { top: 40, bottom: 40, left: 40, right: 40 } });
      file = new File(result.uri);
      if (!result.numberOfPages || !file.exists || file.size === 0) throw Error('PDF generation produced no readable pages.');
    } else {
      const bytes = await writeReportWorkbook(searchReportTables(snapshot), checkpoint); checkpoint();
      file = new File(Paths.cache, `search-${snapshot.publicationDate}-${Date.now()}.xlsx`);
      file.write(bytes);
      if (file.size !== bytes.length) throw Error('Workbook write was incomplete.');
    }
    checkpoint(); progress('Opening share sheet…');
    await shareAsync(file.uri, { mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', UTI: format === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet', dialogTitle: `Search results · ${snapshot.publicationDate}` });
  } finally {
    // Local reports never enter release publication paths. Do not retain private exports in cache.
    if (file?.exists) file.delete();
  }
}
