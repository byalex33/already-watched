import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, request } from '../shared/messaging';
import type { DisplayMode, Reply, Settings, Summary } from '../shared/types';

function Toggle({ label, description, checked, disabled, onChange }: { label: string; description?: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle-row"><span><span className="setting-label">{label}</span>{description && <span className="description">{description}</span>}</span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><span className="switch" aria-hidden="true" /></label>;
}
const MODES: { value: DisplayMode; label: string; symbol: string }[] = [
  { value: 'badge', label: 'Badge', symbol: '✓' }, { value: 'dim', label: 'Dim', symbol: '◐' },
  { value: 'hide', label: 'Hide', symbol: '−' }, { value: 'badge-dim', label: 'Badge + Dim', symbol: '◐✓' },
  { value: 'hide-refill', label: 'Hide + refill', symbol: '↻' }
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
  async function update(patch: Partial<Settings>): Promise<void> {
    if (!settingsRef.current) return;
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next; setSettings(next); setError(''); setSaving(true); pendingSave.current = true;
    const current = ++sequence.current;
    try { await request({ type: 'settings', settings: next }); }
    catch (e) { setError(errorMessage(e)); }
    finally {
      if (current === sequence.current) { pendingSave.current = false; setSaving(false); await refresh().catch(e => setError(errorMessage(e))); }
    }
  }
  async function scan(): Promise<void> {
    setBusy(true); setError(''); setStatus('Scanning the current page…');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || !/^https:\/\/(www\.)?youtube\.com\//.test(tab.url)) throw new Error('Open a YouTube feed or history page, then scan from the extension popup.');
      let reply: Reply<{ imported: number; detected: number }>;
      try { reply = await chrome.tabs.sendMessage(tab.id, { type: 'scan-page' }); }
      catch { throw new Error('Reload the YouTube tab to connect the extension, then scan again.'); }
      if (!reply?.ok) throw new Error(reply && !reply.ok ? reply.error : 'YouTube did not respond. Reload the tab and try again.');
      setStatus(`${reply.data.imported} video${reply.data.imported === 1 ? '' : 's'} imported. ${reply.data.detected} qualifying progress indicator${reply.data.detected === 1 ? '' : 's'} found.`);
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
  if (!settings || !summary) return <main className="loading"><span className="eyebrow">ALREADY WATCHED</span><p>{error || 'Getting your local settings…'}</p>{error && <button onClick={() => { setError(''); void refresh().catch(e => setError(errorMessage(e))); }}>Try again</button>}</main>;
  return <main>
    <header><div className="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16Z" /><path d="m11 16 3 3 7-7" /></svg></div><div><h1>Already Watched<span className="brand-dot">.</span></h1><p>A little less déjà vu.</p></div><span className={`live-dot ${settings.enabled ? '' : 'paused'}`} title={settings.enabled ? 'Enabled' : 'Paused'} /></header>
    <section className="enable-panel"><Toggle label={settings.enabled ? 'A fresher feed, enabled' : 'Taking a break'} description={settings.enabled ? 'Your watched videos stand out.' : 'Tracking and filtering are paused.'} checked={settings.enabled} onChange={enabled => { void update({ enabled }); }} /></section>
    <section className="stats" aria-label="Local statistics"><div><strong>{summary.watchedCount.toLocaleString()}</strong><span>in your history</span></div><div><strong>{summary.filteredToday.toLocaleString()}</strong><span>filtered today</span></div><div><strong>{summary.filteredAllTime.toLocaleString()}</strong><span>filtered all-time</span></div></section>
    <section className="settings-section"><div className="section-heading"><h2>Make watched videos…</h2><span>{saving ? 'Saving…' : 'Auto-saved'}</span></div>
      <div className="mode-grid" role="radiogroup" aria-label="Watched-video display mode">{MODES.map(mode => <label key={mode.value} className={`mode ${mode.value === 'hide-refill' ? 'mode-refill' : ''} ${settings.displayMode === mode.value ? 'selected' : ''}`}><input type="radio" name="display-mode" checked={settings.displayMode === mode.value} onChange={() => { void update({ displayMode: mode.value }); }} /><span className="mode-symbol" aria-hidden="true">{mode.symbol}</span><span>{mode.label}</span></label>)}</div>
      <p className="hint">{settings.displayMode === 'hide-refill' ? 'Hides watched cards and tries up to 5 extra loads when the feed is short. Replacements depend on YouTube and your known watch history.' : settings.displayMode === 'hide' ? 'Hidden cards leave the feed. Switch modes to see them again.' : 'Watched videos stay clickable. Hover a thumbnail to mark or undo.'}</p>
      <div className="threshold-heading"><label htmlFor="threshold">Count as watched at</label><output htmlFor="threshold">{threshold}%</output></div>
      <input id="threshold" className="range" type="range" min="10" max="100" step="1" value={threshold} onChange={event => { const value = Number(event.target.value); setThreshold(value); void update({ threshold: value }); }} />
      <div className="range-labels"><span>10% · a glimpse</span><span>100% · the whole thing</span></div>
      <p className="hint">Based on playback observed by the extension, excluding skips.</p>
    </section>
    <section className="toggles">
      <Toggle label="Hide playlists and Mixes" description="Removes playlist cards and YouTube’s auto-generated Mixes. Individual videos stay available." checked={settings.hidePlaylists} onChange={hidePlaylists => { void update({ hidePlaylists }); }} />
      <Toggle label="Hide Shorts on Home" description="Removes Shorts shelves and cards from the Home feed only." checked={settings.hideHomeShorts} onChange={hideHomeShorts => { void update({ hideHomeShorts }); }} />
      <Toggle label="Hide Playables and topic suggestions" description="Hides YouTube Playables, “Instant games, no downloads”, and “Explore more topics” sections." checked={settings.hidePromotionalSections} onChange={hidePromotionalSections => { void update({ hidePromotionalSections }); }} />
      <Toggle label="Use YouTube progress bars as watched indicators" description="Uses the same percentage threshold. No watch date is assumed." checked={settings.useYouTubeProgress} onChange={useYouTubeProgress => { void update({ useYouTubeProgress }); }} />
      <Toggle label="Apply to Shorts" description="Includes supported Shorts cards and players." checked={settings.applyToShorts} onChange={applyToShorts => { void update({ applyToShorts }); }} />
      <Toggle label="Show watched date when available" checked={settings.showWatchedDate} onChange={showWatchedDate => { void update({ showWatchedDate }); }} />
    </section>
    <section className="history-section"><h2>Your history, on this device</h2><p>Bring in videos with a qualifying YouTube progress bar from the currently rendered page.</p><button className="scan-button" disabled={busy} onClick={() => { void scan(); }}><span aria-hidden="true">↻</span> Scan current YouTube page for watched videos</button>
      <div className="history-meta"><span>{summary.totalMarked.toLocaleString()} total marks · {(summary.storageBytes / 1024 / 1024).toFixed(2)} MB used</span><button className="text-button" disabled={busy} onClick={() => setConfirmClear(true)}>Clear watched history</button></div>
      {confirmClear && <div className="confirmation" role="alert"><p>Clear all local history, manual overrides, and statistics? This cannot be undone. YouTube progress-bar hints may still appear.</p><div><button className="danger" disabled={busy} onClick={() => { void clearHistory(); }}>Clear history</button><button disabled={busy} onClick={() => setConfirmClear(false)}>Keep history</button></div></div>}
      {status && <p className="notice" role="status">{status}</p>}{(error || summary.error) && <p className="error" role="alert">{error || summary.error}</p>}
    </section>
    <footer><svg aria-hidden="true" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="2" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>Only on your device. No accounts. No tracking.</footer>
  </main>;
}
