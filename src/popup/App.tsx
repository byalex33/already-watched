import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, request } from '../shared/messaging';
import type { DisplayMode, Reply, Settings, Summary } from '../shared/types';

function Toggle({ label, description, checked, disabled, onChange }: { label: string; description?: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle-row"><span><span className="setting-label">{label}</span>{description && <span className="description">{description}</span>}</span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><span className="switch" aria-hidden="true" /></label>;
}
function ContentFilterSettings({ settings, onSave }: { settings: Settings; onSave: (patch: Partial<Settings>) => Promise<boolean | undefined> }) {
  const [minimum, setMinimum] = useState(String(settings.minimumViews));
  const [terms, setTerms] = useState(settings.blockedTitleTerms.join('\n'));
  const [dirty, setDirty] = useState(false);
  const [savingFilters, setSavingFilters] = useState(false);
  useEffect(() => {
    if (!dirty) { setMinimum(String(settings.minimumViews)); setTerms(settings.blockedTitleTerms.join('\n')); }
  }, [settings.minimumViews, settings.blockedTitleTerms, dirty]);
  return <section className="settings-section content-filters"><h2>Title and view filters</h2>
    <form onSubmit={event => {
      event.preventDefault(); setSavingFilters(true);
      void onSave({ minimumViews: Number(minimum), blockedTitleTerms: terms.split('\n').map(term => term.trim()).filter(Boolean) })
        .then(saved => { if (saved) setDirty(false); }).finally(() => setSavingFilters(false));
    }}>
      <label className="setting-label" htmlFor="minimum-views">Minimum views</label>
      <input id="minimum-views" type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required value={minimum} disabled={savingFilters} onChange={event => { setMinimum(event.target.value); setDirty(true); }} aria-describedby="views-hint" />
      <p className="hint" id="views-hint">Hide videos with fewer views. Use 0 to turn this off. Counts must be in English; videos without a readable count stay visible.</p>
      <label className="setting-label" htmlFor="blocked-titles">Words to hide from titles</label>
      <textarea id="blocked-titles" rows={4} value={terms} disabled={savingFilters} onChange={event => { setTerms(event.target.value); setDirty(true); }} placeholder={'reaction\nlove island\n#shorts'} aria-describedby="titles-hint" />
      <p className="hint" id="titles-hint">Add one word or phrase per line. Matches any part of a title, regardless of capitals. Up to 200 entries, 300 characters each.</p>
      <button disabled={!dirty || savingFilters} type="submit">{savingFilters ? 'Saving…' : 'Save filters'}</button>
      <p className="hint">These filters hide matching videos while the extension is enabled. Turn on “Include Shorts” to filter Shorts too.</p>
    </form>
  </section>;
}
const MODES: { value: DisplayMode; label: string; description: string }[] = [
  { value: 'badge', label: 'Show a badge', description: 'Keep videos visible with a watched label.' }, { value: 'dim', label: 'Dim videos', description: 'Fade watched videos in the feed.' },
  { value: 'hide', label: 'Hide videos', description: 'Remove watched videos from the feed.' }, { value: 'badge-dim', label: 'Dim and show a badge', description: 'Fade videos and add a watched label.' },
  { value: 'hide-refill', label: 'Hide and load more', description: 'Try to load more videos to fill the gaps.' }
];
export function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [threshold, setThreshold] = useState(70);
  const pendingSave = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const data = await request<Summary>({ type: 'summary' });
    setSummary(data);
    if (!pendingSave.current) {
      setSettings(data.settings); settingsRef.current = data.settings; setThreshold(data.settings.threshold);
    }
  }, []);
  useEffect(() => {
    void refresh().catch(e => setError(errorMessage(e)));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listener = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh().catch(e => setError(errorMessage(e))); }, 200);
    };
    chrome.storage.onChanged.addListener(listener);
    const interval = setInterval(listener, 10_000);
    return () => { chrome.storage.onChanged.removeListener(listener); if (timer) clearTimeout(timer); clearInterval(interval); };
  }, [refresh]);
  async function update(patch: Partial<Settings>): Promise<boolean | undefined> {
    if (!settingsRef.current) return;
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next; setSettings(next); setError(''); setSaving(true); pendingSave.current = true;
    const current = ++sequence.current;
    try { await request({ type: 'settings', settings: patch }); return true; }
    catch (e) { setError(errorMessage(e)); return false; }
    finally {
      if (current === sequence.current) { pendingSave.current = false; setSaving(false); await refresh().catch(e => setError(errorMessage(e))); }
    }
  }
  async function scan(): Promise<void> {
    setBusy(true); setError(''); setStatus('Scanning the current page…');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || !/^https:\/\/(www\.)?youtube\.com\//.test(tab.url)) throw new Error('Open a YouTube feed or history page, then try again.');
      let reply: Reply<{ imported: number; detected: number }>;
      try { reply = await chrome.tabs.sendMessage(tab.id, { type: 'scan-page' }); }
      catch { throw new Error('Reload the YouTube tab to connect the extension, then scan again.'); }
      if (!reply?.ok) throw new Error(reply && !reply.ok ? reply.error : 'YouTube did not respond. Reload the tab and try again.');
      setStatus(`${reply.data.imported} video${reply.data.imported === 1 ? '' : 's'} imported. ${reply.data.detected} matching progress bar${reply.data.detected === 1 ? '' : 's'} found.`);
      await refresh();
    } catch (e) { setStatus(''); setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function clearHistory(): Promise<void> {
    setBusy(true); setError('');
    try { await request({ type: 'clear' }); setStatus('Watched history and statistics cleared.'); setConfirmClear(false); await refresh(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  if (!settings || !summary) return <main className="loading"><span className="eyebrow">Already Watched</span><p>{error || 'Loading settings…'}</p>{error && <button onClick={() => { setError(''); void refresh().catch(e => setError(errorMessage(e))); }}>Try again</button>}</main>;
  return <main>
    <header><div className="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16Z" /><path d="m11 16 3 3 7-7" /></svg></div><div><h1>Already Watched</h1><p>Manage watched videos on YouTube.</p></div><span className={`live-dot ${settings.enabled ? '' : 'paused'}`} title={settings.enabled ? 'Enabled' : 'Paused'} /></header>
    <section className="enable-panel"><Toggle label="Enable Already Watched" description={settings.enabled ? 'Tracking and filters are on.' : 'Tracking and filtering are paused.'} checked={settings.enabled} onChange={enabled => { void update({ enabled }); }} /></section>
    <section className="stats" aria-label="Local statistics"><div><strong>{summary.watchedCount.toLocaleString()}</strong><span>watched videos</span></div><div><strong>{summary.filteredToday.toLocaleString()}</strong><span>filtered today</span></div><div><strong>{summary.filteredAllTime.toLocaleString()}</strong><span>filtered in total</span></div></section>
    <section className="settings-section"><div className="section-heading"><h2>Watched videos</h2><span>{saving ? 'Saving…' : 'Saved automatically'}</span></div>
      <div className="mode-grid" role="radiogroup" aria-label="Watched-video display mode">{MODES.map(mode => <label key={mode.value} className={`mode ${mode.value === 'hide-refill' ? 'mode-refill' : ''} ${settings.displayMode === mode.value ? 'selected' : ''}`}><input type="radio" name="display-mode" checked={settings.displayMode === mode.value} onChange={() => { void update({ displayMode: mode.value }); }} /><span className="mode-copy"><span className="setting-label">{mode.label}</span><span className="description">{mode.description}</span></span></label>)}</div>
      <p className="hint">{settings.displayMode === 'hide-refill' ? 'Tries up to 5 more page loads. YouTube may not have more videos to show.' : settings.displayMode === 'hide' ? 'Choose another option to show watched videos again.' : 'Use the button on a thumbnail to mark a video as watched or unwatched.'}</p>
      <div className="threshold-heading"><label htmlFor="threshold">Mark as watched after</label><output htmlFor="threshold">{threshold}%</output></div>
      <input id="threshold" className="range" type="range" min="10" max="100" step="1" value={threshold} onChange={event => { const value = Number(event.target.value); setThreshold(value); void update({ threshold: value }); }} />
      <div className="range-labels"><span>10%</span><span>100%</span></div>
      <p className="hint">The percentage of a video you play. Skipped sections don’t count.</p>
    </section>
    <ContentFilterSettings settings={settings} onSave={update} />
    <section className="toggles"><h2>Feed filters</h2>
      <Toggle label="Hide playlists and Mixes" description="Hide playlist and Mix cards. Keep individual videos." checked={settings.hidePlaylists} onChange={hidePlaylists => { void update({ hidePlaylists }); }} />
      <Toggle label="Hide livestreams on Home" description="Hide videos that are live now on the Home page." checked={settings.hideHomeLivestreams} onChange={hideHomeLivestreams => { void update({ hideHomeLivestreams }); }} />
      <Toggle label="Hide Shorts on Home" description="Hide Shorts cards and sections on the Home page." checked={settings.hideHomeShorts} onChange={hideHomeShorts => { void update({ hideHomeShorts }); }} />
      <Toggle label="Hide games and topic suggestions" description="Hide Playables and “Explore more topics” sections." checked={settings.hidePromotionalSections} onChange={hidePromotionalSections => { void update({ hidePromotionalSections }); }} />
    </section>
    <section className="toggles"><h2>Watch tracking</h2>
      <Toggle label="Use YouTube progress bars" description="Mark videos as watched when their progress bar reaches the percentage above." checked={settings.useYouTubeProgress} onChange={useYouTubeProgress => { void update({ useYouTubeProgress }); }} />
      <Toggle label="Include Shorts" description="Track and filter Shorts where supported." checked={settings.applyToShorts} onChange={applyToShorts => { void update({ applyToShorts }); }} />
      <Toggle label="Show the date watched" checked={settings.showWatchedDate} onChange={showWatchedDate => { void update({ showWatchedDate }); }} />
    </section>
    <section className="history-section"><h2>History</h2><p>Add watched videos from the YouTube page you have open. Only loaded videos with enough progress count.</p><button className="scan-button" disabled={busy} onClick={() => { void scan(); }}><span aria-hidden="true">↻</span> Scan current page</button>
      <div className="history-meta"><span>{summary.totalMarked.toLocaleString()} total marks · {(summary.storageBytes / 1024 / 1024).toFixed(2)} MB used</span><button className="text-button" disabled={busy} onClick={() => setConfirmClear(true)}>Clear watched history</button></div>
      {confirmClear && <div className="confirmation" role="alert"><p>Clear saved history, manual changes, and statistics? This cannot be undone. Videos may still be marked watched using YouTube progress bars.</p><div><button className="danger" disabled={busy} onClick={() => { void clearHistory(); }}>Clear history</button><button disabled={busy} onClick={() => setConfirmClear(false)}>Keep history</button></div></div>}
      {status && <p className="notice" role="status">{status}</p>}{(error || summary.error) && <p className="error" role="alert">{error || summary.error}</p>}
    </section>
    <footer><p className="privacy-note"><svg aria-hidden="true" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="2" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>History and settings are saved on this device.</p><p>Already Watched is open source. <a href="https://github.com/byalex33/already-watched" target="_blank" rel="noreferrer">Help contribute on GitHub ↗</a></p></footer>
  </main>;
}
