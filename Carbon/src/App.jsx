
import React, { useState, useEffect, useMemo, useRef } from 'react';

// --- CONFIG & UTILS ---
// NOTE: In production, DO NOT hardcode keys. Use env vars (e.g., Vercel) and proxy requests server-side.
const API_URL_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

// If you're using Vite, you can set VITE_GEMINI_API_KEY in env and reference it below.
const apiKey =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) ||
  '';

const obliqueStrategies = [
  'Honor thy error as a hidden intention.',
  'Look closely at the most embarrassing details and amplify.',
  'Make it ugly.',
  'What would your closest friend do?',
  'Use an old idea.',
  'Work at a different speed.',
  'Discard a density.',
  'Bridges -build -burn.',
];

const pressureStyles = [
  { key: 'GENTLE', name: 'Gentle', desc: 'Empathic reframing, clear next step, low friction.' },
  { key: 'BRUTAL', name: 'Brutal', desc: 'Confrontational constraint, no comfort, push the nerve.' },
  { key: 'TECHNICAL', name: 'Technical', desc: 'Craft-first: rhythm, structure, form, devices.' },
  { key: 'ABSTRACT', name: 'Abstract', desc: 'Metaphor-only, oblique, image-led, no literal language.' },
];

const vesselHints = {
  Song: 'For Songwriters: focus on imagery, rhythm, or a specific melodic hook idea.',
  Script: 'For Scriptwriters: focus on stage directions, subtext, and playable action.',
  Novel: 'For Novelists: focus on scene, POV, sensory detail, and conflict beat.',
  Poem: 'For Poets: focus on form, sound, line breaks, and one sharp image.',
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatSeconds(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Lightweight intensity heuristic (NOT clinical)
function inferIntensity(text) {
  const t = (text || '').toLowerCase();
  const strongWords = [
    'panic',
    'hopeless',
    'worthless',
    'depressed',
    'suic',
    'hate',
    'rage',
    'destroy',
    'break',
    'empty',
    "can't",
    'cannot',
    'never',
    'alone',
    'grief',
    'mourning',
    'trauma',
  ];
  let score = 0;
  for (const w of strongWords) if (t.includes(w)) score += 2;
  score += (t.match(/!/g) || []).length * 0.5;
  score += clamp(Math.floor(t.length / 120), 0, 6) * 0.5;

  if (score >= 6) return { level: 'HIGH', label: 'High intensity' };
  if (score >= 3) return { level: 'MED', label: 'Medium intensity' };
  return { level: 'LOW', label: 'Low intensity' };
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function callGemini({ systemPrompt, userQuery }) {
  if (!apiKey) {
    return 'No API key found. Set VITE_GEMINI_API_KEY (or proxy the request server-side).';
  }
  try {
    const response = await fetch(`${API_URL_BASE}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }),
    });
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'The pressure failed. Try again.';
  } catch {
    return 'Connection to the Oracle lost. Use your own silence as the prompt.';
  }
}

async function generateCreativePrompt({ feeling, medium, pressureStyle, intensity }) {
  const styleBlurb =
    {
      GENTLE: 'Tone: empathic, spare, direct. No pep-talk.',
      BRUTAL: 'Tone: sharp, disruptive, slightly confrontational. No comfort.',
      TECHNICAL: 'Tone: craft editor. Give constraints and technique, not feelings.',
      ABSTRACT: 'Tone: oblique. Speak in metaphor and image only.',
    }[pressureStyle] || '';

  const intensityBlurb =
    {
      LOW: 'User intensity: low. You can be brisk and clean.',
      MED: 'User intensity: medium. Be steady, specific, and grounding.',
      HIGH: 'User intensity: high. Be careful: concise, anchored, no escalation.',
    }[intensity] || '';

  const systemPrompt = `You are "The Press" in the Carbon Assistant. Your job: take a user's raw, vulnerable emotion (the Carbon) and a creative medium (the Vessel) and apply Pressure.
Rules:
1) Do NOT write the song/script/story/poem for them.
2) Do NOT be overly cheerful. Be empathetic but disruptive.
3) Output ONE concrete, actionable starting prompt that reframes their feeling into a technical or metaphorical challenge.
4) Be concise (one paragraph max).
5) ${vesselHints[medium] || ''}
6) ${styleBlurb}
7) ${intensityBlurb}
8) Include ONE constraint (limit, form, rule, or device).`;

  const userQuery = `Feeling: "${feeling}". Vessel: "${medium}". Apply pressure.`;

  return callGemini({ systemPrompt, userQuery });
}

async function generateMorePressure({ medium, pressureStyle, intensity, feeling, prompt, draft }) {
  const styleBlurb =
    {
      GENTLE: 'Tone: empathic, spare, direct. No pep-talk.',
      BRUTAL: 'Tone: sharp, disruptive, slightly confrontational. No comfort.',
      TECHNICAL: 'Tone: craft editor. Give constraints and technique, not feelings.',
      ABSTRACT: 'Tone: oblique. Speak in metaphor and image only.',
    }[pressureStyle] || '';

  const intensityBlurb =
    {
      LOW: 'User intensity: low. You can be brisk and clean.',
      MED: 'User intensity: medium. Be steady, specific, and grounding.',
      HIGH: 'User intensity: high. Be careful: concise, anchored, no escalation.',
    }[intensity] || '';

  const systemPrompt = `You are "The Press" in the Carbon Assistant.
Goal: deepen the existing pressure WITHOUT writing the work.
Rules:
1) Do NOT write the piece for them.
2) Output ONE new pressure prompt (one paragraph max).
3) The new prompt must be DIFFERENT: new angle, new constraint.
4) Include exactly ONE constraint and one "cut": one thing to remove or avoid.
5) ${vesselHints[medium] || ''}
6) ${styleBlurb}
7) ${intensityBlurb}`;

  const userQuery = `Context:
Feeling: "${feeling}"
Vessel: ${medium}
Previous Pressure: "${prompt}"
Current Draft (may be empty):
<<<
${draft || ''}
>>>

Give ONE stronger follow-up pressure prompt.`;

  return callGemini({ systemPrompt, userQuery });
}


const STORAGE_KEY = 'carbon_history_v2';
const STORAGE_MODE_KEY = 'carbon_storage_mode_v1'; // 'LOCAL' | 'CLOUD'

// --- CLOUD STORAGE (Vercel Functions) ---
// Uses /api/entries (GET/POST). DB creds stay server-side in Vercel env vars.
async function apiHealth() {
  const r = await fetch('/api/health');
  if (!r.ok) throw new Error('API health check failed');
  return r.json();
}

function mapDbRowToEntry(row) {
  // Row comes from: id, created_at, feeling, intensity, medium, pressure_style, prompt, draft
  return {
    id: String(row.id),
    feeling: row.feeling || '',
    intensity: row.intensity || 'LOW',
    medium: row.medium || '',
    pressureStyle: row.pressure_style || 'GENTLE',
    prompt: row.prompt || '',
    draft: row.draft || '',
    playground: '', // not stored in DB in this version
    metrics: {
      timeSpentSec: 0,
      revisionCount: 0,
      draftChars: (row.draft || '').length,
    },
    createdAt: row.created_at || new Date().toISOString(),
    labelTime: row.created_at ? new Date(row.created_at).toLocaleString() : new Date().toLocaleString(),
    _source: 'CLOUD',
  };
}

async function apiGetEntries() {
  const r = await fetch('/api/entries', { method: 'GET' });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || 'Failed to fetch entries');
  const rows = Array.isArray(j.rows) ? j.rows : [];
  return rows.map(mapDbRowToEntry);
}

async function apiCreateEntry(payload) {
  const r = await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || 'Failed to create entry');
  return j;
}


export default function App() {
  const [step, setStep] = useState('INTAKE'); // INTAKE | VESSEL | WORKSHOP | PLAYGROUND | ARCHIVE_DETAIL
  const [feeling, setFeeling] = useState('');
  const [medium, setMedium] = useState('');
  const [pressureStyle, setPressureStyle] = useState('GENTLE');
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState('');
  const [playgroundText, setPlaygroundText] = useState('');
  const [history, setHistory] = useState([]);
  const [storageMode, setStorageMode] = useState('LOCAL'); // LOCAL | CLOUD
  const [cloudStatus, setCloudStatus] = useState({ ok: null, msg: '' });
  const [loading, setLoading] = useState(false);
  const [oracle, setOracle] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Workshop metrics
  const [workshopStart, setWorkshopStart] = useState(null);
  const [revisionCount, setRevisionCount] = useState(0);
  const lastDraftRef = useRef('');

  // Timers
  const [timerMode, setTimerMode] = useState('NONE'); // NONE | 90S | 5M | 10M
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerEndsAt, setTimerEndsAt] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());

  // Archive detail
  const [activeEntryId, setActiveEntryId] = useState(null);

  const intensity = useMemo(() => inferIntensity(feeling).level, [feeling]);
  const intensityLabel = useMemo(() => inferIntensity(feeling).label, [feeling]);

  const draftRef = useRef(null);
  const playgroundRef = useRef(null);

  
  // Load storage mode + history
  useEffect(() => {
    const mode = localStorage.getItem(STORAGE_MODE_KEY);
    if (mode === 'CLOUD' || mode === 'LOCAL') setStorageMode(mode);
    const saved = safeJsonParse(localStorage.getItem(STORAGE_KEY) || '[]', []);
    if (Array.isArray(saved)) setHistory(saved);
  }, []);

  // If CLOUD mode, verify API + fetch
  useEffect(() => {
    if (storageMode !== 'CLOUD') return;

    let cancelled = false;
    (async () => {
      try {
        setCloudStatus({ ok: null, msg: 'Checking API…' });
        await apiHealth();
        if (cancelled) return;
        setCloudStatus({ ok: true, msg: 'Cloud connected' });

        const entries = await apiGetEntries();
        if (cancelled) return;
        setHistory(entries);
      } catch (e) {
        if (cancelled) return;
        setCloudStatus({ ok: false, msg: e?.message || 'Cloud unavailable — using local storage' });
        // Fall back to local
        setStorageMode('LOCAL');
        localStorage.setItem(STORAGE_MODE_KEY, 'LOCAL');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storageMode]);

  // Persist history only in LOCAL mode
  useEffect(() => {
    if (storageMode !== 'LOCAL') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history, storageMode]);

  // Persist selected mode
  useEffect(() => {
    localStorage.setItem(STORAGE_MODE_KEY, storageMode);
  }, [storageMode]);
// Timer tick
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [timerRunning]);

  // Auto-stop timer on end
  useEffect(() => {
    if (!timerRunning || !timerEndsAt) return;
    if (Date.now() >= timerEndsAt) {
      setTimerRunning(false);
      setTimerEndsAt(null);
    }
  }, [nowTick, timerRunning, timerEndsAt]);

  const timerRemaining = useMemo(() => {
    if (!timerRunning || !timerEndsAt) return 0;
    return Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
  }, [timerRunning, timerEndsAt, nowTick]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech Recognition not supported');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setFeeling((prev) => (prev ? prev + ' ' + transcript : transcript));
    };
    recognition.start();
  };

  const handleIntake = () => {
    if (feeling.trim().length > 5) setStep('VESSEL');
  };

  const applyPressure = async (selectedMedium) => {
    setMedium(selectedMedium);
    setLoading(true);
    const p = await generateCreativePrompt({
      feeling,
      medium: selectedMedium,
      pressureStyle,
      intensity,
    });
    setPrompt(p);
    setLoading(false);
    setStep('WORKSHOP');
    setWorkshopStart(Date.now());
    setRevisionCount(0);
    lastDraftRef.current = '';
  };

  const applyMorePressure = async () => {
    if (!medium) return;
    setLoading(true);
    const p2 = await generateMorePressure({
      feeling,
      medium,
      pressureStyle,
      intensity,
      prompt,
      draft,
    });
    setPrompt(p2);
    setLoading(false);
  };

  
  const saveToVault = async () => {
    const started = workshopStart || Date.now();
    const timeSpentSec = Math.max(0, Math.floor((Date.now() - started) / 1000));

    // Build a "session entry" shape (LOCAL) and a payload (CLOUD)
    const localId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const localEntry = {
      id: localId,
      feeling,
      intensity,
      medium,
      pressureStyle,
      prompt,
      draft,
      playground: playgroundText,
      metrics: {
        timeSpentSec,
        revisionCount,
        draftChars: (draft || '').length,
      },
      createdAt: new Date().toISOString(),
      labelTime: new Date().toLocaleString(),
      _source: 'LOCAL',
    };

    try {
      if (storageMode === 'CLOUD') {
        setLoading(true);
        // Save to DB via Vercel Function
        await apiCreateEntry({
          feeling,
          intensity,
          medium,
          pressureStyle,
          prompt,
          draft,
        });

        // Refresh cloud history
        const entries = await apiGetEntries();
        setHistory(entries);
        setLoading(false);
      } else {
        // LOCAL: prepend
        setHistory([localEntry, ...history]);
      }
    } catch (e) {
      // If cloud save fails, fall back to local to avoid losing the work
      setLoading(false);
      setCloudStatus({ ok: false, msg: e?.message || 'Cloud save failed — saved locally instead' });
      setStorageMode('LOCAL');
      localStorage.setItem(STORAGE_MODE_KEY, 'LOCAL');
      setHistory([localEntry, ...history]);
    }

    // Reset session
    setStep('INTAKE');
    setFeeling('');
    setDraft('');
    setPrompt('');
    setMedium('');
    setPlaygroundText('');
    setWorkshopStart(null);
    setRevisionCount(0);
    lastDraftRef.current = '';
    setTimerRunning(false);
    setTimerEndsAt(null);
    setTimerMode('NONE');
  };


  const triggerOracle = () => {
    const strategy = obliqueStrategies[Math.floor(Math.random() * obliqueStrategies.length)];
    setOracle(strategy);
    setTimeout(() => setOracle(''), 5000);
  };

  const insertSnippet = (snippet) => {
    setDraft((prev) => (prev ? prev + '\n' + snippet : snippet));
    setTimeout(() => draftRef.current?.focus(), 0);
  };

  const insertSelectedFromPlayground = () => {
    const el = playgroundRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = (playgroundText || '').slice(start, end).trim();
    if (!selected) return;
    insertSnippet(selected);
  };

  const insertAllFromPlayground = () => {
    if (!playgroundText.trim()) return;
    insertSnippet(playgroundText.trim());
  };

  const startTimer = (mode) => {
    setTimerMode(mode);
    const seconds = mode === '90S' ? 90 : mode === '5M' ? 300 : mode === '10M' ? 600 : 0;
    if (!seconds) return;
    setTimerRunning(true);
    setTimerEndsAt(Date.now() + seconds * 1000);
  };

  const stopTimer = () => {
    setTimerRunning(false);
    setTimerEndsAt(null);
    setTimerMode('NONE');
  };

  // Revision count (simple: increments when draft changes meaningfully)
  useEffect(() => {
    if (step !== 'WORKSHOP') return;
    const current = draft || '';
    const prev = lastDraftRef.current || '';
    if (current !== prev) {
      const delta = Math.abs(current.length - prev.length);
      if (delta >= 3 || (current.length > 0 && prev.length === 0)) {
        setRevisionCount((c) => c + 1);
      }
      lastDraftRef.current = current;
    }
  }, [draft, step]);

  const openEntry = (id) => {
    setActiveEntryId(id);
    setStep('ARCHIVE_DETAIL');
  };

  const activeEntry = useMemo(
    () => history.find((h) => h.id === activeEntryId) || null,
    [history, activeEntryId]
  );

  const loadEntryToWorkshop = (entry) => {
    setFeeling(entry.feeling || '');
    setMedium(entry.medium || '');
    setPressureStyle(entry.pressureStyle || 'GENTLE');
    setPrompt(entry.prompt || '');
    setDraft(entry.draft || '');
    setPlaygroundText(entry.playground || '');
    setStep('WORKSHOP');
    setWorkshopStart(Date.now());
    setRevisionCount(0);
    lastDraftRef.current = entry.draft || '';
    setActiveEntryId(null);
  };

  const reapplyPressureToDraft = async () => {
    if (!medium) return;
    setLoading(true);
    const p = await generateMorePressure({
      feeling,
      medium,
      pressureStyle,
      intensity,
      prompt: prompt || '(none)',
      draft,
    });
    setPrompt(p);
    setLoading(false);
  };

  const exportArchive = () => {
    const payload = { exportedAt: new Date().toISOString(), entries: history };
    downloadText(`carbon-archive-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
  };

  const exportCurrentSession = () => {
    const lines = [
      `CARBON SESSION — ${new Date().toLocaleString()}`,
      '',
      `Intensity: ${intensity}`,
      `Pressure Style: ${pressureStyle}`,
      `Vessel: ${medium || '(none)'}`,
      '',
      'FEELING',
      `${feeling || ''}`,
      '',
      'PRESSURE',
      `${prompt || ''}`,
      '',
      'DRAFT',
      `${draft || ''}`,
    ];
    downloadText(`carbon-session-${new Date().toISOString().slice(0, 10)}.txt`, lines.join('\n'));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 font-sans selection:bg-violet-500/40 overflow-x-hidden">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-900/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-6 py-12 lg:py-20">
        <header className="flex justify-between items-end mb-10 px-2 gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-[0.2em] text-white uppercase leading-none">Carbon</h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-[0.4em] uppercase">
              Vulnerability Synthesis — write the first honest line
            </p>
          </div>

          <div className="flex items-end gap-3">
            <button
              onClick={exportArchive}
              className="hidden sm:inline-flex px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 backdrop-blur-md text-[10px] font-mono tracking-wider text-zinc-400 hover:text-white hover:border-zinc-700 uppercase"
              title="Export your archive as JSON"
            >
              Export Archive
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full border border-zinc-800 bg-zinc-900/40 backdrop-blur-md">
              <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Storage</span>
              <button
                onClick={() => setStorageMode('LOCAL')}
                className={`px-2 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all ${
                  storageMode === 'LOCAL' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
                title="Store entries on this device (localStorage)"
              >
                Local
              </button>
              <button
                onClick={() => setStorageMode('CLOUD')}
                className={`px-2 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all ${
                  storageMode === 'CLOUD' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
                title="Store entries in your database via Vercel Functions"
              >
                Cloud
              </button>
              <span className={`ml-2 text-[9px] font-mono uppercase tracking-widest ${
                cloudStatus.ok === true ? 'text-emerald-400' : cloudStatus.ok === false ? 'text-amber-400' : 'text-zinc-600'
              }`}>
                {storageMode === 'CLOUD' ? (cloudStatus.msg || '…') : 'Local'}
              </span>
            </div>

            <button
              onClick={triggerOracle}
              className="group relative px-5 py-2 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900/50 backdrop-blur-md transition-all hover:border-violet-500/50 min-w-[140px]"
            >
              <span className="relative z-10 text-[10px] font-mono tracking-wider text-zinc-400 group-hover:text-violet-300 uppercase">
                {oracle || 'THE ORACLE'}
              </span>
            </button>
          </div>
        </header>

        <main className="relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-zinc-700/50 to-transparent rounded-[2.5rem] pointer-events-none opacity-50" />
          <div className="relative bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800/50 p-8 md:p-12 rounded-[2.5rem] shadow-2xl">
            {loading ? (
              <div className="py-24 flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-t-2 border-violet-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-xl">💎</div>
                </div>
                <p className="text-violet-400 font-mono text-[10px] tracking-[0.5em] animate-pulse uppercase">
                  Crystallizing...
                </p>
              </div>
            ) : (
              <div className="transition-all duration-500 ease-out">
                {step === 'INTAKE' && (
                  <div className="space-y-8">
                    <div className="flex justify-between items-center gap-3">
                      <div>
                        <h2 className="text-2xl font-light text-white tracking-tight">Unload</h2>
                        <p className="text-[10px] font-mono tracking-[0.35em] uppercase text-zinc-600 mt-1">
                          {intensityLabel}
                        </p>
                      </div>
                      <button
                        onClick={startListening}
                        className={`p-3 rounded-full transition-all duration-300 ${
                          isListening ? 'bg-red-500 text-white' : 'bg-zinc-800/50 text-zinc-400'
                        }`}
                        title="Voice input"
                      >
                        🎤
                      </button>
                    </div>

                    <textarea
                      className="w-full bg-transparent border-none focus:ring-0 outline-none py-2 resize-none h-40 text-xl md:text-2xl font-light text-zinc-300 placeholder:text-zinc-700 leading-relaxed italic"
                      placeholder={isListening ? 'Listening...' : "Describe the weight you're carrying..."}
                      value={feeling}
                      onChange={(e) => setFeeling(e.target.value)}
                    />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono tracking-[0.35em] uppercase text-zinc-600">Pressure style</span>
                        <span className="text-[10px] text-zinc-500">
                          {pressureStyles.find((s) => s.key === pressureStyle)?.desc}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {pressureStyles.map((s) => (
                          <button
                            key={s.key}
                            onClick={() => setPressureStyle(s.key)}
                            className={`px-3 py-2 rounded-xl border text-[10px] font-mono uppercase tracking-widest transition-all ${
                              pressureStyle === s.key
                                ? 'border-violet-500/60 bg-violet-500/10 text-violet-200'
                                : 'border-zinc-800 bg-zinc-950/20 text-zinc-400 hover:text-white hover:border-zinc-700'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleIntake}
                      disabled={feeling.length <= 5}
                      className="w-full py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-xs rounded-2xl transition-all hover:scale-[1.01] disabled:opacity-20"
                    >
                      Choose Expression
                    </button>

                    {history.length > 0 && (
                      <button
                        onClick={() => setStep('ARCHIVE_DETAIL')}
                        className="w-full py-4 border border-zinc-800 rounded-2xl text-zinc-400 hover:bg-zinc-800/40 transition-all text-xs font-mono uppercase tracking-widest"
                      >
                        Open Archive
                      </button>
                    )}
                  </div>
                )}

                {step === 'VESSEL' && (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-light text-white tracking-tight">Choose Expression</h2>
                        <p className="text-[10px] font-mono tracking-[0.35em] uppercase text-zinc-600 mt-1">
                          Style: {pressureStyles.find((s) => s.key === pressureStyle)?.name} • {intensityLabel}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep('INTAKE')}
                        className="px-4 py-2 rounded-full border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 text-[10px] font-mono uppercase tracking-widest"
                      >
                        Back
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {['Song', 'Script', 'Novel', 'Poem'].map((v) => (
                        <button
                          key={v}
                          onClick={() => applyPressure(v)}
                          className="p-6 bg-zinc-800/30 border border-zinc-700/50 rounded-2xl hover:border-violet-500 hover:bg-violet-500/5 text-left group"
                        >
                          <span className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-violet-400">
                            Vessel
                          </span>
                          <span className="text-xl font-bold tracking-tight text-zinc-200">{v}</span>
                          <span className="block text-[10px] text-zinc-600 mt-3 leading-relaxed">{vesselHints[v]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 'WORKSHOP' && (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-xl font-light text-white tracking-tight">First Cut</h3>
                        <p className="text-[10px] font-mono tracking-[0.35em] uppercase text-zinc-600">
                          {medium || '—'} • {pressureStyles.find((s) => s.key === pressureStyle)?.name} • rev {revisionCount}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={exportCurrentSession}
                          className="px-4 py-2 rounded-full border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 text-[10px] font-mono uppercase tracking-widest"
                          title="Export this session as text"
                        >
                          Export
                        </button>
                        <button
                          onClick={() => setStep('INTAKE')}
                          className="px-4 py-2 rounded-full border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 text-[10px] font-mono uppercase tracking-widest"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="relative p-7 bg-zinc-950/50 border border-zinc-800/50 rounded-3xl overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <h4 className="text-[10px] uppercase tracking-[0.3em] text-violet-400 font-bold font-mono">THE PRESSURE</h4>
                        <button
                          onClick={applyMorePressure}
                          className="px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-[10px] font-mono uppercase tracking-widest hover:bg-violet-500/20"
                          title="Generate a stronger follow-up pressure prompt"
                        >
                          Apply More Pressure
                        </button>
                      </div>
                      <p className="text-lg text-zinc-300 leading-relaxed font-serif italic">"{prompt}"</p>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        onClick={() => {
                          setStep('PLAYGROUND');
                          setTimerRunning(false);
                          setTimerEndsAt(null);
                          setTimerMode('NONE');
                        }}
                        className="px-4 py-1.5 bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-widest rounded-full border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                      >
                        ⚡ Enter Playground
                      </button>

                      <button
                        onClick={reapplyPressureToDraft}
                        className="px-4 py-1.5 bg-zinc-800/40 text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded-full border border-zinc-700/40 hover:bg-zinc-800/70 transition-all"
                        title="Ask The Press to pressure-test your current draft"
                      >
                        Return Pressure
                      </button>

                      <div className="h-4 w-[1px] bg-zinc-800 mx-2" />

                      {medium === 'Script' && (
                        <button onClick={() => insertSnippet('INT. ')} className="text-[10px] font-mono text-zinc-500 hover:text-white uppercase">
                          Slugline
                        </button>
                      )}

                      {medium === 'Song' && (
                        <>
                          <button onClick={() => insertSnippet('[HOOK]')} className="text-[10px] font-mono text-zinc-500 hover:text-white uppercase">
                            Hook
                          </button>
                          <button onClick={() => insertSnippet('[VERSE]')} className="text-[10px] font-mono text-zinc-500 hover:text-white uppercase">
                            Verse
                          </button>
                        </>
                      )}

                      {medium === 'Poem' && (
                        <button onClick={() => insertSnippet('—')} className="text-[10px] font-mono text-zinc-500 hover:text-white uppercase">
                          Break
                        </button>
                      )}
                    </div>

                    <textarea
                      ref={draftRef}
                      className={`w-full bg-zinc-950/30 border border-zinc-800 focus:border-violet-500/50 rounded-3xl p-8 h-72 outline-none transition-all text-zinc-200 placeholder:text-zinc-800 leading-relaxed ${
                        medium === 'Script' ? 'font-mono' : 'font-sans'
                      }`}
                      placeholder={`Begin the ${medium?.toLowerCase() || 'piece'}...`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />

                    <div className="grid grid-cols-4 gap-4">
                      <button
                        onClick={saveToVault}
                        className="col-span-3 py-5 bg-violet-600 text-white font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-violet-500 transition-all"
                      >
                        Crystallize & Save
                      </button>
                      <button
                        onClick={() => setStep('INTAKE')}
                        className="py-5 border border-zinc-800 rounded-2xl text-zinc-500 hover:bg-zinc-800 flex items-center justify-center"
                        title="Start over"
                      >
                        ↺
                      </button>
                    </div>
                  </div>
                )}

                {step === 'PLAYGROUND' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-amber-500/20 pb-4 gap-3">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-amber-500 font-mono">The Void Playground</h3>
                        <p className="text-[10px] text-zinc-600 font-mono tracking-[0.35em] uppercase mt-1">
                          Write garbage. Keep the one line that bites.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPlaygroundText('');
                          setStep('WORKSHOP');
                          stopTimer();
                        }}
                        className="text-[10px] font-bold text-zinc-500 hover:text-white tracking-widest"
                      >
                        TERMINATE [ESC]
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono tracking-[0.35em] uppercase text-zinc-600 mr-2">Sprint</span>

                      <button
                        onClick={() => startTimer('90S')}
                        className={`px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-widest ${
                          timerMode === '90S' && timerRunning
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                            : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        90s
                      </button>
                      <button
                        onClick={() => startTimer('5M')}
                        className={`px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-widest ${
                          timerMode === '5M' && timerRunning
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                            : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        5m
                      </button>
                      <button
                        onClick={() => startTimer('10M')}
                        className={`px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-widest ${
                          timerMode === '10M' && timerRunning
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                            : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        10m
                      </button>

                      {timerRunning && (
                        <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-amber-300">
                          {formatSeconds(timerRemaining)} left
                        </span>
                      )}

                      {timerMode !== 'NONE' && (
                        <button
                          onClick={stopTimer}
                          className="ml-auto px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 text-[10px] font-mono uppercase tracking-widest"
                        >
                          Stop
                        </button>
                      )}
                    </div>

                    <textarea
                      ref={playgroundRef}
                      className="w-full bg-[#080808] border border-zinc-900 text-zinc-400 rounded-3xl p-8 h-[28rem] outline-none font-medium text-lg leading-relaxed placeholder:text-zinc-900"
                      placeholder="Write fast. Keep the nerve. Highlight a line and extract it."
                      value={playgroundText}
                      onChange={(e) => setPlaygroundText(e.target.value)}
                      autoFocus
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={insertSelectedFromPlayground}
                        className="px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-mono uppercase tracking-widest hover:bg-amber-500/20"
                      >
                        Extract Selection → Draft
                      </button>
                      <button
                        onClick={insertAllFromPlayground}
                        className="px-4 py-2 rounded-full border border-zinc-800 text-zinc-400 text-[10px] font-mono uppercase tracking-widest hover:text-white hover:border-zinc-700"
                      >
                        Insert All → Draft
                      </button>
                      <button
                        onClick={() => setStep('WORKSHOP')}
                        className="ml-auto px-4 py-2 rounded-full border border-zinc-800 text-zinc-500 text-[10px] font-mono uppercase tracking-widest hover:text-white hover:border-zinc-700"
                      >
                        Back to Workshop
                      </button>
                    </div>
                  </div>
                )}

                {step === 'ARCHIVE_DETAIL' && (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-light text-white tracking-tight">Archive</h3>
                        <p className="text-[10px] font-mono tracking-[0.35em] uppercase text-zinc-600 mt-1">
                          {history.length} entries • stored locally
                        </p>
                      </div>
                      <button
                        onClick={() => setStep('INTAKE')}
                        className="px-4 py-2 rounded-full border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 text-[10px] font-mono uppercase tracking-widest"
                      >
                        Close
                      </button>
                    </div>

                    {activeEntry ? (
                      <div className="space-y-4">
                        <div className="p-6 rounded-3xl border border-zinc-800/60 bg-zinc-950/30">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                                {activeEntry.medium} • {pressureStyles.find((s) => s.key === activeEntry.pressureStyle)?.name}
                              </div>
                              <div className="text-[10px] text-zinc-600 font-mono mt-1">
                                {activeEntry.labelTime} • intensity {activeEntry.intensity}
                              </div>
                            </div>
                            <button
                              onClick={() => setActiveEntryId(null)}
                              className="px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 text-[10px] font-mono uppercase tracking-widest"
                            >
                              Back
                            </button>
                          </div>

                          <div className="mt-5 space-y-4">
                            <div>
                              <div className="text-[10px] font-mono tracking-[0.35em] uppercase text-zinc-600">Feeling</div>
                              <p className="text-sm text-zinc-300 mt-2 whitespace-pre-wrap">{activeEntry.feeling}</p>
                            </div>
                            <div>
                              <div className="text-[10px] font-mono tracking-[0.35em] uppercase text-zinc-600">Pressure</div>
                              <p className="text-sm text-zinc-300 mt-2 whitespace-pre-wrap italic">"{activeEntry.prompt}"</p>
                            </div>
                            <div>
                              <div className="text-[10px] font-mono tracking-[0.35em] uppercase text-zinc-600">Draft</div>
                              <p className="text-sm text-zinc-300 mt-2 whitespace-pre-wrap">{activeEntry.draft || '—'}</p>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                              <button
                                onClick={() => loadEntryToWorkshop(activeEntry)}
                                className="px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-[10px] font-mono uppercase tracking-widest hover:bg-violet-500/20"
                              >
                                Re-open in Workshop
                              </button>
                              <button
                                onClick={() => {
                                  const lines = [
                                    `CARBON ARCHIVE ENTRY — ${activeEntry.labelTime}`,
                                    '',
                                    `Intensity: ${activeEntry.intensity}`,
                                    `Pressure Style: ${activeEntry.pressureStyle}`,
                                    `Vessel: ${activeEntry.medium}`,
                                    '',
                                    'FEELING',
                                    `${activeEntry.feeling || ''}`,
                                    '',
                                    'PRESSURE',
                                    `${activeEntry.prompt || ''}`,
                                    '',
                                    'DRAFT',
                                    `${activeEntry.draft || ''}`,
                                  ];
                                  downloadText(`carbon-entry-${activeEntry.id}.txt`, lines.join('\n'));
                                }}
                                className="px-4 py-2 rounded-full border border-zinc-800 text-zinc-400 text-[10px] font-mono uppercase tracking-widest hover:text-white hover:border-zinc-700"
                              >
                                Export Entry
                              </button>
                            </div>

                            {activeEntry.metrics && (
                              <div className="mt-3 grid grid-cols-3 gap-3">
                                <div className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/30">
                                  <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Time</div>
                                  <div className="text-sm text-zinc-200 mt-1">{formatSeconds(activeEntry.metrics.timeSpentSec)}</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/30">
                                  <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Revisions</div>
                                  <div className="text-sm text-zinc-200 mt-1">{activeEntry.metrics.revisionCount}</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/30">
                                  <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Chars</div>
                                  <div className="text-sm text-zinc-200 mt-1">{activeEntry.metrics.draftChars}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {history.length === 0 ? (
                          <div className="p-8 rounded-3xl border border-zinc-800/60 bg-zinc-950/20 text-zinc-500">No entries yet.</div>
                        ) : (
                          history.map((h) => (
                            <button
                              key={h.id}
                              onClick={() => openEntry(h.id)}
                              className="group text-left bg-zinc-900/30 border border-zinc-800/50 p-6 rounded-3xl hover:border-violet-500/30 transition-all"
                            >
                              <div className="flex justify-between items-start mb-3 gap-3">
                                <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">
                                  {h.medium} • {pressureStyles.find((s) => s.key === h.pressureStyle)?.name}
                                </span>
                                <span className="text-[9px] text-zinc-600 font-mono">{h.labelTime}</span>
                              </div>
                              <p className="text-sm font-medium text-zinc-400 line-clamp-3 leading-relaxed">{h.draft || 'Unwritten Diamond...'}</p>
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-700">intensity {h.intensity}</span>
                                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-700">{h.metrics?.draftChars ?? 0} chars</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {history.length > 0 && step !== 'PLAYGROUND' && step !== 'ARCHIVE_DETAIL' && (
          <section className="mt-16 space-y-8">
            <div className="flex items-center gap-4 px-2">
              <h2 className="text-[10px] uppercase tracking-[0.5em] text-zinc-600 font-black font-mono">Recent Archive</h2>
              <div className="h-[1px] flex-1 bg-zinc-900" />
              <button
                onClick={() => setStep('ARCHIVE_DETAIL')}
                className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-white"
              >
                Open
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {history.slice(0, 4).map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    setActiveEntryId(h.id);
                    setStep('ARCHIVE_DETAIL');
                  }}
                  className="group text-left bg-zinc-900/30 border border-zinc-800/50 p-6 rounded-3xl hover:border-violet-500/30 transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">{h.medium}</span>
                    <span className="text-[9px] text-zinc-600 font-mono">{h.labelTime}</span>
                  </div>
                  <p className="text-sm font-medium text-zinc-400 line-clamp-3 leading-relaxed">{h.draft || 'Unwritten Diamond...'}</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
