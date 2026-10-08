import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { errorMessage, request } from '../shared/messaging';
import { rerunPercent, SHARE_MIN_VISITS, sharePost, trackedDays } from '../shared/share-post';
import type { DisplayMode, HomeSummary, Reply, Settings, Summary } from '../shared/types';

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
  return <form className="content-filters" onSubmit={event => {
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
      <p className="hint">These filters hide matching recommendations and search results while the extension is enabled. Turn on “Include Shorts” to filter Shorts too.</p>
    </form>;
}
function SelectRow({ id, label, description, value, options, onChange }: { id: string; label: string; description: string; value: number; options: [number, string][]; onChange: (value: number) => void }) {
  // Keep a stored value selectable even when it is not one of the presets.
  const choices = options.some(([option]) => option === value) ? options : [...options, [value, String(value)] as [number, string]].sort((a, b) => a[0] - b[0]);
  return <div className="select-row"><label htmlFor={id}><span className="setting-label">{label}</span><span className="description">{description}</span></label>
    <select id={id} value={value} onChange={event => onChange(Number(event.target.value))}>{choices.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></div>;
}
const REPEAT_OPTIONS: [number, string][] = [[0, 'Off'], [1, 'After 1 visit'], ...[2, 3, 4, 5, 7, 10].map(n => [n, `After ${n} visits`] as [number, string])];
const CHANNEL_OPTIONS: [number, string][] = [[0, 'No limit'], [1, '1 video'], ...[2, 3, 4, 5].map(n => [n, `${n} videos`] as [number, string])];
function HomeStatsSection({ home }: { home: HomeSummary }) {
  const [copied, setCopied] = useState(false);
  const ready = home.visits >= SHARE_MIN_VISITS;
  const post = ready ? sharePost(home) : '';
  const figures: [string, string][] = [
    [home.visits.toLocaleString(), 'Home visits'], [home.served.toLocaleString(), 'recommendations'], [home.distinct.toLocaleString(), 'different videos'],
    [`${rerunPercent(home)}%`, 'reruns'], [home.watched.toLocaleString(), 'already watched'], [trackedDays(home.since).toLocaleString(), 'days tracked']
  ];
  async function copy(): Promise<void> {
    try { await navigator.clipboard.writeText(post); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { document.querySelector<HTMLTextAreaElement>('#share-post')?.select(); }
  }
  return <div className="home-stats">
    <p className="hint">Everything YouTube put on your Home page, including videos the extension hid. A rerun is a video it already showed on an earlier visit, or one you’d watched.</p>
    <div className="figure-grid">{figures.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    {home.top.length > 0 && <><h3>Shown most often</h3><ol className="top-videos">{home.top.map(video => <li key={video.videoId} title={video.title}><span>{video.served}×</span> {video.title}</li>)}</ol></>}
    {ready
      ? <><label className="setting-label share-label" htmlFor="share-post">Share your numbers</label><textarea id="share-post" rows={10} readOnly value={post} />
        <div className="share-actions"><button type="button" className="primary" onClick={() => { void copy(); }}>{copied ? 'Copied' : 'Copy post'}</button><a className="button" href={`https://x.com/intent/post?text=${encodeURIComponent(post)}`} target="_blank" rel="noreferrer">Post on X ↗</a></div></>
      : <p className="hint">Sharing unlocks after {SHARE_MIN_VISITS} Home visits ({home.visits}/{SHARE_MIN_VISITS} so far).</p>}
  </div>;
}
const MODES: { value: DisplayMode; label: string; description: string }[] = [
  { value: 'badge', label: 'Show a badge', description: 'Keep videos visible with a watched label.' }, { value: 'dim', label: 'Dim videos', description: 'Fade watched videos in the feed.' },
  { value: 'hide', label: 'Hide videos', description: 'Hide watched Home and watch-page recommendations.' }, { value: 'badge-dim', label: 'Dim and show a badge', description: 'Fade videos and add a watched label.' },
  { value: 'hide-refill', label: 'Hide and load more', description: 'Try to load more videos to fill the gaps.' }
];
const OPEN_KEY = 'aw-open-sections';
// Which groups are expanded is a per-browser convenience; it is fine if storage is unavailable.
function useOpenGroups(): [Set<string>, (id: string, open: boolean) => void] {
  const [open, setOpen] = useState<Set<string>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]');
      return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []);
    } catch { return new Set(); }
  });
  const toggle = useCallback((id: string, value: boolean) => setOpen(previous => {
    if (previous.has(id) === value) return previous;
    const next = new Set(previous);
    if (value) next.add(id); else next.delete(id);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next])); } catch { /* Not remembered this time. */ }
    return next;
  }), []);
  return [open, toggle];
}
function Group({ id, title, summary, open, onToggle, children }: { id: string; title: string; summary: string; open: Set<string>; onToggle: (id: string, open: boolean) => void; children: ReactNode }) {
  return <details className="group" open={open.has(id)} onToggle={event => onToggle(id, event.currentTarget.open)}>
    <summary><span className="group-title"><h2>{title}</h2><span className="group-summary">{summary}</span></span><span className="chevron" aria-hidden="true" /></summary>
    <div className="group-body">{children}</div>
  </details>;
}
const countOn = (flags: boolean[]): string => {
  const on = flags.filter(Boolean).length;
  return on ? `${on} of ${flags.length} on` : 'All off';
};
const plural = (count: number, word: string): string => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;
const TABS = [{ id: 'feed', label: 'Feed' }, { id: 'filters', label: 'Filters' }, { id: 'stats', label: 'Stats' }, { id: 'history', label: 'History' }] as const;
type TabId = typeof TABS[number]['id'];
function Tabs({ current, onChange }: { current: TabId; onChange: (tab: TabId) => void }) {
  // Arrow keys move between tabs; only the selected tab is in the Tab order.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const index = TABS.findIndex(tab => tab.id === current);
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: TABS.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const tab = TABS[(next + TABS.length) % TABS.length]!;
    onChange(tab.id);
    document.getElementById(`tab-${tab.id}`)?.focus();
  }
  return <div className="tabs" role="tablist" aria-label="Sections" onKeyDown={onKeyDown}>{TABS.map(tab => <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" aria-selected={tab.id === current} aria-controls={`panel-${tab.id}`} tabIndex={tab.id === current ? 0 : -1} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</div>;
}
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
  const [tab, setTab] = useState<TabId>('feed');
  const [openGroups, toggleGroup] = useOpenGroups();
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
  const group = { open: openGroups, onToggle: toggleGroup };
  const panels: Record<TabId, ReactNode> = {
    feed: <>
      <Group id="display" title="Watched recommendations" summary={`${MODES.find(mode => mode.value === settings.displayMode)?.label ?? ''} · ${threshold}%`} {...group}>
        <div className="mode-grid" role="radiogroup" aria-label="Watched-video display mode">{MODES.map(mode => <label key={mode.value} className={`mode ${mode.value === 'hide-refill' ? 'mode-refill' : ''} ${settings.displayMode === mode.value ? 'selected' : ''}`}><input type="radio" name="display-mode" checked={settings.displayMode === mode.value} onChange={() => { void update({ displayMode: mode.value }); }} /><span className="mode-copy"><span className="setting-label">{mode.label}</span><span className="description">{mode.description}</span></span></label>)}</div>
        <p className="hint">{settings.displayMode === 'hide-refill' ? 'Tries up to 5 more page loads. YouTube may not have more videos to show.' : settings.displayMode === 'hide' ? 'Choose another option to show watched videos again.' : 'Use the button on a thumbnail to mark a video as watched or unwatched.'}</p>
        <div className="threshold-heading"><label htmlFor="threshold">Mark as watched after</label><output htmlFor="threshold">{threshold}%</output></div>
        <input id="threshold" className="range" type="range" min="10" max="100" step="1" value={threshold} onChange={event => { const value = Number(event.target.value); setThreshold(value); void update({ threshold: value }); }} />
        <div className="range-labels"><span>10%</span><span>100%</span></div>
        <p className="hint">The percentage of a video you play. Skipped sections don’t count.</p>
      </Group>
      <Group id="home-feed" title="Home feed" summary={`${settings.hideRepeatsAfter ? `Hide after ${plural(settings.hideRepeatsAfter, 'visit')}` : 'Repeats shown'} · ${settings.channelCap ? `${settings.channelCap} per channel` : 'No channel limit'}`} {...group}>
        <SelectRow id="hide-repeats" label="Hide repeated recommendations" description="Hide a Home video once it has been on screen this many visits without you opening it." value={settings.hideRepeatsAfter} options={REPEAT_OPTIONS} onChange={hideRepeatsAfter => { void update({ hideRepeatsAfter }); }} />
        <SelectRow id="channel-cap" label="Videos per channel" description="Limit how many videos one channel can fill on Home." value={settings.channelCap} options={CHANNEL_OPTIONS} onChange={channelCap => { void update({ channelCap }); }} />
        <p className="hint">A video counts as shown when most of it is on screen. Videos that leave Home for 30 days are forgotten, so they can come back.</p>
      </Group>
    </>,
    filters: <>
      <Group id="feed-filters" title="Feed filters" summary={countOn([settings.hidePlaylists, settings.hideHomeLivestreams, settings.hideHomeShorts, settings.hidePromotionalSections])} {...group}>
        <div className="toggle-list">
          <Toggle label="Hide playlists and Mixes" description="Hide playlist and Mix cards. Keep individual videos." checked={settings.hidePlaylists} onChange={hidePlaylists => { void update({ hidePlaylists }); }} />
          <Toggle label="Hide livestreams on Home" description="Hide videos that are live now on the Home page." checked={settings.hideHomeLivestreams} onChange={hideHomeLivestreams => { void update({ hideHomeLivestreams }); }} />
          <Toggle label="Hide Shorts on Home" description="Hide Shorts cards and sections on the Home page." checked={settings.hideHomeShorts} onChange={hideHomeShorts => { void update({ hideHomeShorts }); }} />
          <Toggle label="Hide games and topic suggestions" description="Hide Playables and “Explore more topics” sections." checked={settings.hidePromotionalSections} onChange={hidePromotionalSections => { void update({ hidePromotionalSections }); }} />
        </div>
      </Group>
      <Group id="content-filters" title="Title and view filters" summary={[settings.minimumViews > 0 && `Under ${plural(settings.minimumViews, 'view')}`, settings.blockedTitleTerms.length > 0 && plural(settings.blockedTitleTerms.length, 'word')].filter(Boolean).join(' · ') || 'Off'} {...group}>
        <ContentFilterSettings settings={settings} onSave={update} />
      </Group>
      <Group id="search" title="Search" summary={countOn([settings.hideWatchedInSearch, settings.hideSearchShorts])} {...group}>
        <div className="toggle-list">
          <Toggle label="Hide watched videos in Search" description="Off keeps watched search results visible. Independent of recommendation display and Shorts filtering." checked={settings.hideWatchedInSearch} onChange={hideWatchedInSearch => { void update({ hideWatchedInSearch }); }} />
          <Toggle label="Hide Shorts in Search" description="Hide Shorts cards and sections in search results." checked={settings.hideSearchShorts} onChange={hideSearchShorts => { void update({ hideSearchShorts }); }} />
        </div>
        <p className="hint">History, Liked Videos, playlists, subscriptions and channel pages always keep videos visible.</p>
      </Group>
      <Group id="watch-tracking" title="Watch tracking" summary={countOn([settings.useYouTubeProgress, settings.applyToShorts, settings.showWatchedDate])} {...group}>
        <div className="toggle-list">
          <Toggle label="Use YouTube progress bars" description="Mark videos as watched when their progress bar reaches the percentage set on the Feed tab." checked={settings.useYouTubeProgress} onChange={useYouTubeProgress => { void update({ useYouTubeProgress }); }} />
          <Toggle label="Include Shorts" description="Track and filter Shorts where supported." checked={settings.applyToShorts} onChange={applyToShorts => { void update({ applyToShorts }); }} />
          <Toggle label="Show the date watched" checked={settings.showWatchedDate} onChange={showWatchedDate => { void update({ showWatchedDate }); }} />
        </div>
      </Group>
    </>,
    stats: <>
      <Group id="filtering" title="Filtering" summary={`${summary.filteredAllTime.toLocaleString()} filtered in total`} {...group}>
        <div className="figure-grid"><div><strong>{summary.filteredToday.toLocaleString()}</strong><span>filtered today</span></div><div><strong>{summary.filteredAllTime.toLocaleString()}</strong><span>filtered in total</span></div><div><strong>{summary.totalMarked.toLocaleString()}</strong><span>total marks</span></div></div>
      </Group>
      <Group id="home-stats" title="Your Home feed, by the numbers" summary={`${plural(summary.home.visits, 'visit')} · ${rerunPercent(summary.home)}% reruns`} {...group}>
        <HomeStatsSection home={summary.home} />
      </Group>
    </>,
    history: <>
      <section className="history-section"><h2>History</h2><p>Add watched videos from the YouTube page you have open. Only loaded videos with enough progress count.</p><button className="scan-button" disabled={busy} onClick={() => { void scan(); }}><span aria-hidden="true">↻</span> Scan current page</button>
        <div className="history-meta"><span>{summary.totalMarked.toLocaleString()} total marks · {(summary.storageBytes / 1024 / 1024).toFixed(2)} MB used</span><button className="text-button" disabled={busy} onClick={() => setConfirmClear(true)}>Clear watched history</button></div>
        {confirmClear && <div className="confirmation" role="alert"><p>Clear saved history, manual changes, Home feed counts, and statistics? This cannot be undone. Videos may still be marked watched using YouTube progress bars.</p><div><button className="danger" disabled={busy} onClick={() => { void clearHistory(); }}>Clear history</button><button disabled={busy} onClick={() => setConfirmClear(false)}>Keep history</button></div></div>}
        {status && <p className="notice" role="status">{status}</p>}
      </section>
    </>
  };
  return <main>
    <div className="top-bar">
      <header><div className="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16Z" /><path d="m11 16 3 3 7-7" /></svg></div>
        <div className="header-copy"><h1>Already Watched</h1><p aria-live="polite">{saving ? 'Saving…' : settings.enabled ? 'Tracking and filters are on.' : 'Tracking and filtering are paused.'}</p></div>
        <label className="header-switch"><input type="checkbox" role="switch" aria-label="Enable Already Watched" checked={settings.enabled} onChange={event => { void update({ enabled: event.target.checked }); }} /><span className="switch" aria-hidden="true" /></label>
      </header>
      <section className="stat-strip" aria-label="Local statistics"><div><strong>{summary.watchedCount.toLocaleString()}</strong><span>watched videos</span></div><div><strong>{summary.filteredToday.toLocaleString()}</strong><span>filtered today</span></div><div><strong>{rerunPercent(summary.home)}%</strong><span>Home reruns</span></div></section>
      <Tabs current={tab} onChange={setTab} />
    </div>
    {(error || summary.error) && <p className="error" role="alert">{error || summary.error}</p>}
    <div className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>{panels[tab]}</div>
    <footer><p>Version {chrome.runtime.getManifest?.().version ?? 'preview'}</p><p className="privacy-note"><svg aria-hidden="true" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="2" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>History and settings are saved on this device.</p><p>Already Watched is open source. <a href="https://github.com/byalex33/already-watched" target="_blank" rel="noreferrer">Help contribute on GitHub ↗</a></p></footer>
  </main>;
}
