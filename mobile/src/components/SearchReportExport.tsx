import React, { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText, Button, Row } from './ui';
import { useStore } from '../data/store';
import { australianPublicationDate, captureFilteredSearchSnapshot, type SearchReportRequest } from '../data/filteredSearchSnapshot';
import { verifiedCatalogueDetails } from '../data/detailsCatalogue';
import { verifiedCoreContents } from '../data/sectionIntegrity';
import { exportSearchReport, ReportCancelled } from '../lib/exportSearchReport';

function acceptOlder(date: string, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    let done = false;
    const finish = (value: boolean) => { if (!done) { done = true; signal.removeEventListener('abort', cancel); resolve(value); } };
    const cancel = () => finish(false); signal.addEventListener('abort', cancel, { once: true });
    Alert.alert('Today’s publication unavailable', `Export the publication dated ${date}?`, [
      { text: 'Cancel', style: 'cancel', onPress: cancel }, { text: `Use ${date}`, onPress: () => finish(true) },
    ], { cancelable: true, onDismiss: cancel });
  });
}

export function SearchReportExport({ request, disabled = false }: { request: SearchReportRequest; disabled?: boolean }) {
  const [opened, setOpened] = useState(false), [progress, setProgress] = useState('');
  const controller = useRef<AbortController | null>(null);
  const requestIdentity = JSON.stringify(request);
  useEffect(() => () => { controller.current?.abort(); }, [requestIdentity]);
  const run = async (format: 'pdf' | 'xlsx') => {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    const check = () => { if (abort.signal.aborted) throw new ReportCancelled(); };
    try {
      setProgress('Checking publication…');
      await useStore.getState().refresh({ manual: true }); check();
      await useStore.getState().ensureDetails({ forProductView: true }); check();
      if (request.deepSearch) { await useStore.getState().ensureSearchIndex(); check(); }
      const state = useStore.getState();
      const details = verifiedCatalogueDetails(state.core, state.coreIntegrity, state.manifest, state.details);
      if (!state.core || !state.manifest || !details || !verifiedCoreContents(state.coreIntegrity)) throw Error('The publication could not be verified. Retry when evidence is available.');
      const snapshot = captureFilteredSearchSnapshot({ core: state.core, manifest: state.manifest, details, profile: state.prefs.profileFilters, request, searchIndex: state.searchIndex });
      if (snapshot.publicationDate !== australianPublicationDate() && !await acceptOlder(snapshot.publicationDate, abort.signal)) throw new ReportCancelled();
      check();
      await exportSearchReport(snapshot, format, abort.signal, setProgress);
    } catch (error) {
      if (!(error instanceof ReportCancelled)) Alert.alert('Export failed', error instanceof Error ? error.message : 'No report was exported.');
    } finally { controller.current = null; setProgress(''); }
  };
  return <View style={{ gap: 6 }}>
    {progress ? <><AppText variant="small">{progress}</AppText><Button title="Cancel export" variant="secondary" onPress={() => controller.current?.abort()} /></> : <>
      <Button title="Export results" variant="secondary" disabled={disabled} onPress={() => setOpened(value => !value)} />
      {opened && <Row><Button title="PDF" disabled={disabled} onPress={() => void run('pdf')} /><Button title="Excel (.xlsx)" disabled={disabled} onPress={() => void run('xlsx')} /></Row>}
    </>}
  </View>;
}
