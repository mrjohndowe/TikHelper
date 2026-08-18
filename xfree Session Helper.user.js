// ==UserScript==
// @name         xfree Session Helper
// @version      0.5.0
// @description  Sessionhelper for xfree with xtoys integration
// @match        https://xfree.com/*
// @match        https://*.xfree.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BRAND = '#cf3e44';
  const DEBUG = false;
  let sessionRuntimeToken = 0;
  let countdownStateToken = 0;

  function debug(...args) {
    if (DEBUG) {
      console.log('[RedFabber]', ...args);
    }
  }

  const STORAGE_KEYS = {
    active: 'redfabber_session_active',
    startedAt: 'redfabber_session_started_at',
    endsAt: 'redfabber_session_ends_at',
    durationMinutes: 'redfabber_session_duration_minutes',
    minMinutes: 'redfabber_session_min_minutes',
    maxMinutes: 'redfabber_session_max_minutes',
    countdownUrl: 'redfabber_countdown_url',
    countdownDurationSeconds: 'redfabber_countdown_duration_seconds',
    countdownPlayed: 'redfabber_countdown_played',
    postRunSeconds: 'redfabber_post_run_seconds',
    closeTabAfterSession: 'redfabber_close_tab_after_session',
    endingHandled: 'redfabber_ending_handled',
    fakeCountdowns: 'redfabber_fake_countdowns',
    surpriseMode: 'redfabber_surprise_mode',
    hideTimer: 'redfabber_hide_timer',
    autoScrollEnabled: 'redfabber_auto_scroll_enabled',
    spokenCountdownEnabled: 'redfabber_spoken_countdown_enabled',
    countdownActive: 'redfabber_countdown_active',
    countdownType: 'redfabber_countdown_type',
    countdownEndsAt: 'redfabber_countdown_ends_at'
  };

  const DEFAULTS = {
    minMinutes: 15,
    maxMinutes: 30,
    scrollSeconds: 60,
    postRunSeconds: 0,
    closeTabAfterSession: false,
    fakeCountdowns: false,
    autoScrollEnabled: true
  };

  const COUNTDOWN_SOUNDS = [
    {
      url: 'https://github.com/TikHelper/TikHelper/raw/refs/heads/main/Countdown_f_f-10-1.mp3',
      durationSeconds: 11
    },
    {
      url: 'https://github.com/TikHelper/TikHelper/raw/refs/heads/main/Countdown_f_f-10-2.mp3',
      durationSeconds: 11
    },
    {
      url: 'https://github.com/TikHelper/TikHelper/raw/refs/heads/main/Countdown_f_f-10.mp3',
      durationSeconds: 11
    },
    {
      url: 'https://github.com/TikHelper/TikHelper/raw/refs/heads/main/Countdown_f_f-11.mp3',
      durationSeconds: 12
    },
    {
      url: 'https://github.com/TikHelper/TikHelper/raw/refs/heads/main/Countdown_f_f-14-2.mp3',
      durationSeconds: 15
    },
    {
      url: 'https://github.com/TikHelper/TikHelper/raw/refs/heads/main/Countdown_f_f-14.mp3.mp3',
      durationSeconds: 15
    },
    {
      url: 'https://github.com/TikHelper/TikHelper/raw/refs/heads/main/Countdown_f_f-8.mp3',
      durationSeconds: 9
    },
    {
      url: 'https://github.com/TikHelper/TikHelper/raw/refs/heads/main/Countdown_f_f-9.mp3',
      durationSeconds: 10
    },
  ];

  function getNumber(key, fallback) {
    const rawValue = localStorage.getItem(key);

    if (rawValue === null || rawValue === '') {
      return fallback;
    }

    const value = Number(rawValue);
    return Number.isFinite(value) ? value : fallback;
  }

  function setSessionState(state) {
    debug('Saving session state:', state);

    Object.entries(state).forEach(([key, value]) => {
      const storageKey = STORAGE_KEYS[key];

      if (!storageKey) {
        console.warn('[RedFabber] Unknown storage key:', key, value);
        return;
      }

      localStorage.setItem(storageKey, String(value));
      debug('localStorage set:', storageKey, String(value));
    });
  }

  function clearSessionState() {
    sessionRuntimeToken++;
    debug('Clearing session state');
    localStorage.setItem(STORAGE_KEYS.active, 'false');
    localStorage.removeItem(STORAGE_KEYS.startedAt);
    localStorage.removeItem(STORAGE_KEYS.endsAt);
    localStorage.removeItem(STORAGE_KEYS.durationMinutes);
    localStorage.removeItem(STORAGE_KEYS.countdownUrl);
    localStorage.removeItem(STORAGE_KEYS.countdownDurationSeconds);
    localStorage.removeItem(STORAGE_KEYS.countdownPlayed);
    localStorage.removeItem(STORAGE_KEYS.endingHandled);
  }

  function isSessionActive() {
    const active = localStorage.getItem(STORAGE_KEYS.active) === 'true';
    const endsAt = Number(localStorage.getItem(STORAGE_KEYS.endsAt));

    if (!active) return false;

    if (!Number.isFinite(endsAt) || Date.now() >= endsAt) {
      clearSessionState();
      return false;
    }

    return true;
  }

  function getRemainingMs() {
    const endsAt = Number(localStorage.getItem(STORAGE_KEYS.endsAt));
    return Math.max(0, endsAt - Date.now());
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function formatPostRunTime(ms) {
    return `-${formatTime(ms)}`;
  }

  function randomInteger(min, max) {
    const lower = Math.ceil(Math.min(min, max));
    const upper = Math.floor(Math.max(min, max));

    return Math.floor(Math.random() * (upper - lower + 1)) + lower;
  }

  function pickRandomCountdownSound() {
    const index = Math.floor(Math.random() * COUNTDOWN_SOUNDS.length);
    const sound = COUNTDOWN_SOUNDS[index];

    debug('Countdown candidates:', COUNTDOWN_SOUNDS);
    debug('Selected countdown index:', index);
    debug('Selected countdown sound:', sound);

    return sound;
  }

  function playFakeCountdown(url, durationSeconds) {
    debug('Starting fake countdown:', { url, durationSeconds });

    const safeDurationSeconds = Math.max(1, Number(durationSeconds) || 0);
    const fakeCountdownToken = setCountdownState(true, 'fake', safeDurationSeconds);

    const audio = new Audio(url);
    audio.volume = 1;

    const fakeClearDelayMs = Math.max(1000, (safeDurationSeconds - 2) * 1000);

    window.setTimeout(() => {
      clearCountdownState('fake', fakeCountdownToken);
    }, fakeClearDelayMs);

    audio.addEventListener('ended', () => {
      debug('Fake countdown audio ended early; XToys fake state remains until planned fake interruption.');
    });
    audio.addEventListener('error', () => {
      console.warn('[RedFabber] Fake countdown audio error; XToys fake state remains until planned fake interruption.');
    });

    audio.play().then(() => {
      debug('Fake countdown playing');

      window.setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
        debug('Fake countdown interrupted 2 seconds before end');
      }, fakeClearDelayMs);
    }).catch(error => {
      console.warn('[RedFabber] Fake countdown failed; XToys fake state remains until planned fake interruption:', error);
    });
  }

  function maybeTriggerFakeCountdown() {
    const enabled = localStorage.getItem(STORAGE_KEYS.fakeCountdowns) === 'true' && localStorage.getItem(STORAGE_KEYS.spokenCountdownEnabled) !== 'false';

    if (!enabled) return;

    const shouldTrigger = Math.random() < 0.45;

    if (!shouldTrigger) {
      debug('No fake countdown this session');
      return;
    }

    const endsAt = Number(localStorage.getItem(STORAGE_KEYS.endsAt));
    const now = Date.now();
    const remainingMs = endsAt - now;

    const triggerBeforeEndMs = randomInteger(30, Math.max(31, Math.floor(remainingMs / 1000) - 20)) * 1000;

    debug('Fake countdown scheduled', {
      triggerBeforeEndMs,
      triggerInSeconds: Math.floor(triggerBeforeEndMs / 1000)
    });

    const fakeCountdownToken = sessionRuntimeToken;

    window.setTimeout(() => {
      if (fakeCountdownToken !== sessionRuntimeToken) return;
      if (!isSessionActive()) return;

      const sound = pickRandomCountdownSound();
      playFakeCountdown(sound.url, sound.durationSeconds);
    }, Math.max(5000, remainingMs - triggerBeforeEndMs));
  }

  function playCountdownSound() {
    if (localStorage.getItem(STORAGE_KEYS.countdownPlayed) === 'true') {
      debug('Countdown already played. Skipping.');
      return;
    }

    const url = localStorage.getItem(STORAGE_KEYS.countdownUrl);

    if (!url) {
      console.warn('[RedFabber] Countdown URL missing in localStorage.');
      return;
    }

    const countdownDurationSeconds = Math.max(
      1,
      Number(localStorage.getItem(STORAGE_KEYS.countdownDurationSeconds)) || 0
    );

    debug('Starting countdown sound:', {
      url,
      countdownDurationSeconds
    });

    localStorage.setItem(STORAGE_KEYS.countdownPlayed, 'true');
    debug('localStorage set:', STORAGE_KEYS.countdownPlayed, 'true');

    // Important for XToys:
    // This is a persistent state, not just an audio event.
    // It stays c=1 for the planned countdown duration, even if the browser
    // fires audio ended/error/play-rejected too early.
    const realCountdownToken = setCountdownState(true, 'real', countdownDurationSeconds);

    window.setTimeout(() => {
      clearCountdownState('real', realCountdownToken);
    }, countdownDurationSeconds * 1000);

    const spokenCountdownEnabled = localStorage.getItem(STORAGE_KEYS.spokenCountdownEnabled) !== 'false';

    if (!spokenCountdownEnabled) {
      debug('Spoken countdown disabled; XToys countdown state still active for planned duration.');
      return;
    }

    const audio = new Audio();
    audio.volume = 1;
    audio.preload = 'auto';
    audio.src = url;

    audio.addEventListener('loadstart', () => debug('Countdown audio loadstart'));
    audio.addEventListener('canplay', () => debug('Countdown audio canplay'));
    audio.addEventListener('playing', () => debug('Countdown audio playing'));
    audio.addEventListener('ended', () => {
      debug('Countdown audio ended; XToys countdown state remains until planned timer ends.');
    });
    audio.addEventListener('error', () => {
      console.warn('[RedFabber] Countdown audio error; XToys countdown state remains until planned timer ends:', audio.error, url);
    });

    audio.play().then(() => {
      debug('Countdown audio play() resolved');
    }).catch(error => {
      console.warn('[RedFabber] Countdown audio play() rejected; XToys countdown state remains until planned timer ends:', error);
      localStorage.setItem(STORAGE_KEYS.countdownPlayed, 'false');
    });
  }


  function setCountdownState(active, type = 'none', durationSeconds = 0) {
    countdownStateToken++;

    const normalizedType = active ? type : 'none';
    const safeDurationSeconds = Math.max(0, Number(durationSeconds) || 0);
    const endsAt = active && safeDurationSeconds > 0
      ? Date.now() + safeDurationSeconds * 1000
      : 0;

    localStorage.setItem(STORAGE_KEYS.countdownActive, active ? 'true' : 'false');
    localStorage.setItem(STORAGE_KEYS.countdownType, normalizedType);

    if (endsAt > 0) {
      localStorage.setItem(STORAGE_KEYS.countdownEndsAt, String(endsAt));
    } else {
      localStorage.removeItem(STORAGE_KEYS.countdownEndsAt);
    }

    debug('Countdown state changed:', {
      active,
      type: normalizedType,
      durationSeconds: safeDurationSeconds,
      endsAt,
      countdownStateToken
    });

    return countdownStateToken;
  }

  function clearCountdownState(expectedType = null, expectedToken = null) {
    const currentType = localStorage.getItem(STORAGE_KEYS.countdownType) || 'none';

    if (expectedType && currentType !== expectedType) {
      debug('Countdown clear ignored because countdown type changed:', {
        expectedType,
        currentType
      });
      return;
    }

    if (expectedToken !== null && expectedToken !== countdownStateToken) {
      debug('Countdown clear ignored because countdown token changed:', {
        expectedToken,
        countdownStateToken
      });
      return;
    }

    setCountdownState(false, 'none', 0);
  }

  function getXtoysMonitorState() {
    const active = isSessionActive();
    const remainingMs = active ? getRemainingMs() : 0;

    const countdownActive = localStorage.getItem(STORAGE_KEYS.countdownActive) === 'true';
    const countdownType = localStorage.getItem(STORAGE_KEYS.countdownType) || 'none';
    const countdownEndsAt = Number(localStorage.getItem(STORAGE_KEYS.countdownEndsAt)) || 0;
    const countdownRemainingMs = countdownActive
      ? Math.max(0, countdownEndsAt - Date.now())
      : 0;

    const startedAt = Number(localStorage.getItem(STORAGE_KEYS.startedAt)) || 0;
    const endsAt = Number(localStorage.getItem(STORAGE_KEYS.endsAt)) || 0;
    const durationSeconds = startedAt > 0 && endsAt > startedAt
      ? Math.max(0, Math.round((endsAt - startedAt) / 1000))
      : 0;

    return {
      sessionActive: active,
      remainingMs,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      remainingText: formatTime(remainingMs),
      durationSeconds,
      countdownActive,
      countdownType,
      realCountdownActive: countdownActive && countdownType === 'real',
      fakeCountdownActive: countdownActive && countdownType === 'fake',
      countdownRemainingMs,
      countdownRemainingSeconds: Math.ceil(countdownRemainingMs / 1000),
      timestamp: Date.now()
    };
  }

  function createXtoysWebpageMonitor() {
    if (document.getElementById('xtoys-redfabber-monitor')) return;

    const monitor = document.createElement('div');
    monitor.id = 'xtoys-redfabber-monitor';
    monitor.setAttribute('aria-hidden', 'false');
    monitor.style.cssText = [
      'position:fixed',
      'left:12px',
      'bottom:12px',
      'z-index:2147483647',
      'padding:8px 10px',
      'border-radius:10px',
      'background:rgba(0,0,0,.88)',
      'color:#00ff7f',
      'font:12px/1.35 monospace',
      'white-space:pre',
      'box-shadow:0 8px 30px rgba(0,0,0,.35)',
      'pointer-events:none'
    ].join(';');

    document.body.appendChild(monitor);

    if (typeof DEBUG !== 'undefined' && !DEBUG) {
      monitor.style.display = 'none';
    }

    window.redfabberXtoysMonitor = {
      getState: getXtoysMonitorState
    };

    window.setInterval(() => {
      const state = getXtoysMonitorState();

      const monitorLine = [
        'RF',
        `r=${state.remainingSeconds}`,
        `d=${state.durationSeconds}`,
        `c=${state.countdownActive ? 1 : 0}`,
        `t=${state.countdownType}`,
        `cr=${state.countdownRemainingSeconds}`,
        `ts=${state.timestamp}`
      ].join('|');

      monitor.textContent = monitorLine;
      monitor.title = JSON.stringify(state);
      monitor.setAttribute('data-rf-monitor-line', monitorLine);
      monitor.setAttribute('data-rf-remaining-seconds', String(state.remainingSeconds));
      monitor.setAttribute('data-rf-duration-seconds', String(state.durationSeconds));
      monitor.setAttribute('data-rf-countdown-active', String(state.countdownActive ? 1 : 0));
      monitor.setAttribute('data-rf-countdown-type', state.countdownType);

      window.redfabberXtoysMonitorLine = monitorLine;

      if (!window.redfabberOriginalTitle) {
        window.redfabberOriginalTitle = document.title || '';
      }
      document.title = monitorLine;

      let plain = document.getElementById('rf-monitor-plain');
      if (!plain) {
        plain = document.createElement('div');
        plain.id = 'rf-monitor-plain';
        plain.style.cssText = [
          'position:fixed',
          'left:12px',
          'bottom:48px',
          'z-index:2147483647',
          'padding:6px 8px',
          'border-radius:8px',
          'background:#111',
          'color:#fff',
          'font:12px monospace',
          'white-space:pre',
          'pointer-events:none'
        ].join(';');
        document.body.appendChild(plain);

        if (typeof DEBUG !== 'undefined' && !DEBUG) {
          plain.style.display = 'none';
        }
      }

      plain.textContent = monitorLine;

      const debugVisible = typeof DEBUG !== 'undefined' ? DEBUG : true;
      monitor.style.display = debugVisible ? '' : 'none';
      plain.style.display = debugVisible ? '' : 'none';

      window.dispatchEvent(new CustomEvent('xtoys:redfabber-monitor', {
        detail: state
      }));
    }, 250);
  }

  function createPanel() {
    if (document.getElementById('redfabber-session-panel')) return;
    if (isSessionActive()) return;

    const savedMin = getNumber(STORAGE_KEYS.minMinutes, DEFAULTS.minMinutes);
    const savedMax = getNumber(STORAGE_KEYS.maxMinutes, DEFAULTS.maxMinutes);

    const panel = document.createElement('div');
    panel.id = 'redfabber-session-panel';
    panel.innerHTML = `
      <div class="rf-head">
        <strong>RedFabber</strong>
        <span>Session helper</span>
      </div>

      <div class="rf-row">
        <label>
          Min.
          <input id="rf-min" type="number" min="1" step="1" value="${savedMin}">
        </label>
        <label>
          Max.
          <input id="rf-max" type="number" min="1" step="1" value="${savedMax}">
        </label>
      </div>

      <label style="display:grid;gap:6px;margin-bottom:12px;color:#aaa;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">
          Scroll interval
          <input id="rf-scroll" type="number" min="5" step="1" value="${getNumber('redfabber_scroll_seconds', DEFAULTS.scrollSeconds)}">
        </label>

        <label style="display:grid;gap:6px;margin-bottom:12px;color:#aaa;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">
          Run after end
          <input id="rf-post-run" type="number" min="0" step="1" value="${getNumber(STORAGE_KEYS.postRunSeconds, DEFAULTS.postRunSeconds)}">
        </label>

        <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;color:#aaa;font-size:12px;font-weight:700;letter-spacing:.01em;text-transform:none;">
          <input id="rf-close-tab" type="checkbox" ${localStorage.getItem(STORAGE_KEYS.closeTabAfterSession) === 'true' ? 'checked' : ''} style="width:auto;height:auto;">
          Close tab after post-run
        </label>

        <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;color:#aaa;font-size:12px;font-weight:700;letter-spacing:.01em;text-transform:none;">
          <input id="rf-initial-scroll" type="checkbox" ${localStorage.getItem(STORAGE_KEYS.autoScrollEnabled) !== 'false' ? 'checked' : ''} style="width:auto;height:auto;">
          Auto Scroll from start
        </label>

        <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;color:#aaa;font-size:12px;font-weight:700;letter-spacing:.01em;text-transform:none;">
          <input id="rf-spoken-countdown" type="checkbox" ${localStorage.getItem(STORAGE_KEYS.spokenCountdownEnabled) !== 'false' ? 'checked' : ''} style="width:auto;height:auto;">
          Spoken Countdown
        </label>

        <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;color:#aaa;font-size:12px;font-weight:700;letter-spacing:.01em;text-transform:none;">
          <input id="rf-fake-countdowns" type="checkbox" ${localStorage.getItem(STORAGE_KEYS.fakeCountdowns) === 'true' ? 'checked' : ''} style="width:auto;height:auto;">
          Fake Countdown
        </label>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button id="rf-start" type="button">Start Session</button>
        <button id="rf-surprise" type="button" style="background:#222;border:1px solid #333;">Surprise me</button>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'redfabber-session-style';
    style.textContent = `
      #redfabber-session-panel {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        width: 240px;
        padding: 14px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(18,18,18,.92);
        color: #fff;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 18px 44px rgba(0,0,0,.38);
        backdrop-filter: blur(12px);
      }

      #redfabber-session-panel .rf-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 12px;
      }

      #redfabber-session-panel .rf-head strong {
        font-size: 15px;
        letter-spacing: -.02em;
      }

      #redfabber-session-panel .rf-head span {
        color: #aaa;
        font-size: 11px;
      }

      #redfabber-session-panel .rf-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 12px;
      }

      #redfabber-session-panel label {
        display: grid;
        gap: 6px;
        color: #aaa;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .06em;
      }

      #redfabber-session-panel input {
        width: 100%;
        height: 36px;
        padding: 0 10px;
        border: 1px solid #333;
        border-radius: 10px;
        background: #0e0e0e;
        color: #fff;
        font: inherit;
        font-size: 14px;
        outline: none;
      }

      #redfabber-session-panel input:focus {
        border-color: ${BRAND};
        box-shadow: 0 0 0 3px rgba(207,62,68,.18);
      }

      #redfabber-session-panel button {
        width: 100%;
        height: 40px;
        border: 0;
        border-radius: 999px;
        background: ${BRAND};
        color: #fff;
        cursor: pointer;
        font: inherit;
        font-size: 14px;
        font-weight: 800;
      }

      #redfabber-session-panel button:hover {
        filter: brightness(1.06);
      }

      #redfabber-session-toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(18,18,18,.94);
        color: #fff;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
        box-shadow: 0 18px 44px rgba(0,0,0,.38);
      }

      #redfabber-session-toast button {
        border: 0;
        border-radius: 999px;
        background: ${BRAND};
        color: #fff;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        padding: 7px 10px;
      }

      #redfabber-session-toast strong {
        color: ${BRAND};
      }
    `;

    document.documentElement.appendChild(style);
    document.body.appendChild(panel);

    function startConfiguredSession({
      min,
      max,
      scrollSeconds,
      postRunSeconds,
      closeTabAfterSession,
      fakeCountdowns,
      autoScrollEnabled,
      spokenCountdownEnabled,
      surpriseMode,
      hideTimer
    }) {
      const durationMinutes = randomInteger(min, max);
      const countdownSound = pickRandomCountdownSound();
      const startedAt = Date.now();
      const endsAt = startedAt + durationMinutes * 60 * 1000;

      debug('Session start requested');
      debug('Configured min/max minutes:', min, max);
      debug('Selected session duration minutes:', durationMinutes);
      debug('Selected countdown sound:', countdownSound);
      debug('Post-run seconds:', postRunSeconds);
      debug('Close tab after session:', closeTabAfterSession);
      debug('Fake countdowns enabled:', fakeCountdowns);
      debug('Auto-scroll from start:', autoScrollEnabled);
      debug('Spoken countdown enabled:', spokenCountdownEnabled);
      debug('Surprise mode:', surpriseMode);
      debug('Hide timer:', hideTimer);
      debug('Session starts at:', new Date(startedAt).toISOString());
      debug('Session ends at:', new Date(endsAt).toISOString());

      localStorage.setItem(STORAGE_KEYS.minMinutes, String(min));
      localStorage.setItem(STORAGE_KEYS.maxMinutes, String(max));
      localStorage.setItem('redfabber_scroll_seconds', String(scrollSeconds));
      localStorage.setItem(STORAGE_KEYS.postRunSeconds, String(postRunSeconds));
      localStorage.setItem(STORAGE_KEYS.closeTabAfterSession, String(closeTabAfterSession));
      localStorage.setItem(STORAGE_KEYS.fakeCountdowns, String(fakeCountdowns));
      localStorage.setItem(STORAGE_KEYS.autoScrollEnabled, String(autoScrollEnabled));
      localStorage.setItem(STORAGE_KEYS.spokenCountdownEnabled, String(spokenCountdownEnabled));

      setSessionState({
        active: true,
        startedAt,
        endsAt,
        durationMinutes,
        countdownUrl: countdownSound.url,
        countdownDurationSeconds: countdownSound.durationSeconds,
        countdownPlayed: false,
        postRunSeconds,
        closeTabAfterSession,
        endingHandled: false,
        autoScrollEnabled,
        spokenCountdownEnabled,
        fakeCountdowns,
        surpriseMode,
        hideTimer
      });

      panel.remove();
      showRunningToast();
      maybeTriggerFakeCountdown();
      startSessionWatcher();
    }

    document.getElementById('rf-start').addEventListener('click', () => {
      const min = Math.max(1, Number(document.getElementById('rf-min').value) || DEFAULTS.minMinutes);
      const max = Math.max(1, Number(document.getElementById('rf-max').value) || DEFAULTS.maxMinutes);
      const scrollSeconds = Math.max(5, Number(document.getElementById('rf-scroll').value) || DEFAULTS.scrollSeconds);
      const postRunSeconds = Math.max(0, Number(document.getElementById('rf-post-run').value) || DEFAULTS.postRunSeconds);
      const closeTabAfterSession = document.getElementById('rf-close-tab').checked;
      const autoScrollEnabled = document.getElementById('rf-initial-scroll').checked;
      const spokenCountdownEnabled = document.getElementById('rf-spoken-countdown').checked;
      const fakeCountdowns = document.getElementById('rf-fake-countdowns').checked;

      startConfiguredSession({
        min,
        max,
        scrollSeconds,
        postRunSeconds,
        closeTabAfterSession,
        fakeCountdowns,
        autoScrollEnabled,
        spokenCountdownEnabled,
        surpriseMode: false,
        hideTimer: false
      });
    });

    document.getElementById('rf-surprise').addEventListener('click', () => {
      const scrollSeconds = Math.max(5, Number(document.getElementById('rf-scroll').value) || DEFAULTS.scrollSeconds);
      const closeTabAfterSession = document.getElementById('rf-close-tab').checked;
      const autoScrollEnabled = document.getElementById('rf-initial-scroll').checked;
      const spokenCountdownEnabled = document.getElementById('rf-spoken-countdown').checked;
      const fakeCountdowns = document.getElementById('rf-fake-countdowns').checked;

      startConfiguredSession({
        min: 5,
        max: 60,
        scrollSeconds,
        postRunSeconds: randomInteger(10, 600),
        closeTabAfterSession,
        fakeCountdowns,
        autoScrollEnabled,
        spokenCountdownEnabled,
        surpriseMode: true,
        hideTimer: true
      });
    });
  }

  function showRunningToast() {
    if (!isSessionActive()) return;
    if (document.getElementById('redfabber-session-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'redfabber-session-toast';
    const hideTimer = localStorage.getItem(STORAGE_KEYS.hideTimer) === 'true';

    toast.innerHTML = `
      <span>${hideTimer ? 'Session active' : `Session active · <strong id="rf-remaining">${formatTime(getRemainingMs())}</strong>`}</span>
      <button id="rf-toggle-scroll" type="button">Scroll On</button>
      <button id="rf-pause-scroll" type="button">Pause 10s</button>
      <button id="rf-stop-session" type="button" style="background:#7a1f23;">STOP</button>
    `;

    document.body.appendChild(toast);

    document.getElementById('rf-stop-session')?.addEventListener('click', () => {
      hardStopSession();
    });

    document.getElementById('rf-pause-scroll')?.addEventListener('click', () => {
      localStorage.setItem('redfabber_scroll_pause_until', String(Date.now() + 10000));
      const button = document.getElementById('rf-pause-scroll');
      if (button) button.textContent = 'Paused';
    });

    const toggleButton = document.getElementById('rf-toggle-scroll');

    if (toggleButton) {
      const enabled = localStorage.getItem(STORAGE_KEYS.autoScrollEnabled) !== 'false';
      toggleButton.textContent = enabled ? 'Scroll On' : 'Scroll Off';
      toggleButton.style.background = enabled ? BRAND : '#333';

      toggleButton.addEventListener('click', () => {
        const currentlyEnabled = localStorage.getItem(STORAGE_KEYS.autoScrollEnabled) !== 'false';
        const nextValue = !currentlyEnabled;

        localStorage.setItem(STORAGE_KEYS.autoScrollEnabled, String(nextValue));
        toggleButton.textContent = nextValue ? 'Scroll On' : 'Scroll Off';
        toggleButton.style.background = nextValue ? BRAND : '#333';

        debug('Auto-scroll toggled:', nextValue);
      });
    }
  }

  function removeRunningToast() {
    document.getElementById('redfabber-session-toast')?.remove();
  }

  function hardStopSession() {
    debug('Hard stop requested via fapstop()');
    sessionRuntimeToken++;
    clearCountdownState(null);
    clearSessionState();
    removeRunningToast();
    document.getElementById('redfabber-session-panel')?.remove();
    createPanel();
    console.log('[RedFabber] Session stopped.');
  }

  window.fapstop = hardStopSession;
  debug('Console command registered: fapstop()');

  const NAV_MESSAGE_MARKER = 'redfabber-xfree-nav-v2';

  function isXfreeHostname(hostname) {
    return hostname === 'xfree.com' || hostname.endsWith('.xfree.com');
  }

  function getAccessibleDocuments() {
    const docs = [];
    const seen = new Set();

    function visit(doc) {
      if (!doc || seen.has(doc)) return;

      seen.add(doc);
      docs.push(doc);

      let frames = [];

      try {
        frames = Array.from(doc.querySelectorAll('iframe, frame'));
      } catch (error) {
        return;
      }

      for (const frame of frames) {
        try {
          const childDocument = frame.contentDocument || frame.contentWindow?.document;

          if (childDocument) {
            visit(childDocument);
          }
        } catch (error) {
          // Cross-origin frame. A matching xfree userscript running inside the
          // frame can still receive the navigation message registered below.
        }
      }
    }

    visit(document);
    return docs;
  }

  function getSearchRoots(doc) {
    const roots = [doc];
    const seen = new Set(roots);

    function scan(root) {
      let elements = [];

      try {
        elements = Array.from(root.querySelectorAll('*'));
      } catch (error) {
        return;
      }

      for (const element of elements) {
        if (element.shadowRoot && !seen.has(element.shadowRoot)) {
          seen.add(element.shadowRoot);
          roots.push(element.shadowRoot);
          scan(element.shadowRoot);
        }
      }
    }

    scan(doc);
    return roots;
  }

  function queryAllDeep(doc, selector) {
    const found = [];
    const seen = new Set();

    for (const root of getSearchRoots(doc)) {
      let matches = [];

      try {
        matches = Array.from(root.querySelectorAll(selector));
      } catch (error) {
        continue;
      }

      for (const match of matches) {
        if (!seen.has(match)) {
          seen.add(match);
          found.push(match);
        }
      }
    }

    return found;
  }

  function isVisibleControl(element) {
    if (!element || element.nodeType !== 1) return false;

    const control = element.closest?.('button, a, [role="button"], [role="link"], input') || element;

    if (control.matches?.('[disabled], [aria-disabled="true"], [hidden]')) {
      return false;
    }

    const style = control.ownerDocument.defaultView?.getComputedStyle(control);

    if (style && (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity) === 0 ||
      style.pointerEvents === 'none'
    )) {
      return false;
    }

    const rect = control.getBoundingClientRect();

    return rect.width > 1 && rect.height > 1;
  }

  function normalizeControl(element) {
    return element?.closest?.('button, a, [role="button"], [role="link"], input') || element || null;
  }

  function controlSignature(element) {
    if (!element) return '';

    const control = normalizeControl(element);
    const parts = [
      control.tagName,
      control.id,
      control.className,
      control.getAttribute?.('aria-label'),
      control.getAttribute?.('title'),
      control.getAttribute?.('name'),
      control.getAttribute?.('data-action'),
      control.getAttribute?.('data-testid'),
      control.getAttribute?.('data-test'),
      control.getAttribute?.('data-tooltip'),
      control.getAttribute?.('data-direction'),
      control.getAttribute?.('rel'),
      control.getAttribute?.('href'),
      control.textContent
    ];

    try {
      const icons = control.querySelectorAll(
        'svg, use, path, i, app-icon, [data-icon], [icon], [aria-label]'
      );

      for (const icon of icons) {
        parts.push(
          icon.getAttribute?.('aria-label'),
          icon.getAttribute?.('title'),
          icon.getAttribute?.('class'),
          icon.getAttribute?.('data-icon'),
          icon.getAttribute?.('icon'),
          icon.getAttribute?.('href'),
          icon.getAttribute?.('xlink:href')
        );
      }
    } catch (error) {
      // Ignore malformed/custom controls.
    }

    return parts
      .filter(value => value !== null && value !== undefined)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function scoreControl(element, action) {
    const signature = controlSignature(element);

    if (!signature) return -Infinity;

    let score = 0;

    if (action === 'next') {
      const strong = [
        /\bnext\b/,
        /\bnext[-_ ]?(post|item|media|video|image|slide|page)\b/,
        /\bchevron[-_ ]?down\b/,
        /\barrow[-_ ]?down\b/,
        /\bnavigate[-_ ]?next\b/,
        /\bscroll[-_ ]?down\b/,
        /\badvance\b/,
        /\bforward\b/
      ];

      for (const pattern of strong) {
        if (pattern.test(signature)) score += 25;
      }

      if (/\bdown\b/.test(signature) && !/\bdownload\b/.test(signature)) score += 12;
      if (/\bswiper-button-next\b/.test(signature)) score += 30;
      if (/\b(previous|prev|back|up|close|delete|download)\b/.test(signature)) score -= 35;
    } else {
      const strong = [
        /\bclose\b/,
        /\bdismiss\b/,
        /\bmodal[-_ ]?close\b/,
        /\bviewer[-_ ]?close\b/,
        /\bexit\b/,
        /\bxmark\b/,
        /\btimes\b/
      ];

      for (const pattern of strong) {
        if (pattern.test(signature)) score += 25;
      }

      if (/aria-label x\b/.test(signature) || /\bicon x\b/.test(signature)) score += 14;
      if (/\b(next|previous|prev|download|share|like)\b/.test(signature)) score -= 30;
    }

    const control = normalizeControl(element);

    if (control?.tagName === 'BUTTON') score += 4;
    if (control?.getAttribute?.('role') === 'button') score += 3;
    if (isVisibleControl(control)) score += 4;
    else score -= 100;

    return score;
  }

  function findXfreeDownControl(doc) {
    const selectors = [
      '.arrows .arrow--down:not(.arrow--disabled) .feed__button--arrow',
      '.arrow--down:not(.arrow--disabled) .feed__button--arrow',
      '.arrows .arrow--down:not(.arrow--disabled)',
      '.arrow--down:not(.arrow--disabled)'
    ];

    for (const selector of selectors) {
      const matches = queryAllDeep(doc, selector);

      for (const match of matches) {
        if (isVisibleControl(match)) {
          return match;
        }
      }
    }

    return null;
  }

  function findSemanticControl(doc, action) {
    if (action === 'next') {
      const xfreeDownControl = findXfreeDownControl(doc);

      if (xfreeDownControl) {
        debug('Found xfree down arrow:', xfreeDownControl);
        return xfreeDownControl;
      }
    }

    const directSelectors = action === 'next'
      ? [
          '.arrows .arrow--down:not(.arrow--disabled) .feed__button--arrow',
          '.arrow--down:not(.arrow--disabled) .feed__button--arrow',
          '.arrows .arrow--down:not(.arrow--disabled)',
          '.arrow--down:not(.arrow--disabled)',
          'button[aria-label*="next" i]',
          'a[aria-label*="next" i]',
          '[role="button"][aria-label*="next" i]',
          'button[title*="next" i]',
          'a[title*="next" i]',
          '[data-testid*="next" i]',
          '[data-action*="next" i]',
          '[class*="swiper-button-next" i]',
          '[class*="chevron-down" i]',
          '[class*="arrow-down" i]',
          '[data-direction="down" i]',
          '[aria-label*="down" i]',
          '[title*="down" i]',
          'a.control.control--right app-icon[icon="chevron-down"]',
          'a.control--right app-icon[icon="chevron-down"]',
          'a.control--right .control__icon--down',
          'a.control.control--right'
        ]
      : [
          'button[aria-label*="close" i]',
          'a[aria-label*="close" i]',
          '[role="button"][aria-label*="close" i]',
          'button[title*="close" i]',
          'a[title*="close" i]',
          '[data-testid*="close" i]',
          '[data-action*="close" i]',
          '[class*="modal-close" i]',
          '[class*="viewer-close" i]',
          '[class*="close-button" i]',
          'a.control.control--close app-icon[icon="x"]',
          'a.control--close app-icon[icon="x"]',
          'a.control--close .control__icon--up',
          'a.control.control--close'
        ];

    const directCandidates = [];

    for (const selector of directSelectors) {
      for (const match of queryAllDeep(doc, selector)) {
        const normalized = normalizeControl(match);

        if (normalized && isVisibleControl(normalized)) {
          directCandidates.push(normalized);
        }
      }
    }

    if (directCandidates.length > 0) {
      directCandidates.sort((a, b) => scoreControl(b, action) - scoreControl(a, action));
      return directCandidates[0];
    }

    const genericCandidates = queryAllDeep(
      doc,
      'button, a[href], [role="button"], [role="link"], input[type="button"], input[type="submit"]'
    ).filter(isVisibleControl);

    let best = null;
    let bestScore = action === 'next' ? 14 : 18;

    for (const candidate of genericCandidates) {
      const score = scoreControl(candidate, action);

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    debug(`Best ${action} control score:`, bestScore, best, best ? controlSignature(best) : '');
    return best;
  }

  function activateControl(control) {
    if (!control) return false;

    const normalized = normalizeControl(control);

    if (!normalized || !isVisibleControl(normalized)) {
      return false;
    }

    try {
      normalized.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'auto'
      });
    } catch (error) {
      // Not every custom element implements scrollIntoView cleanly.
    }

    try {
      normalized.focus({ preventScroll: true });
    } catch (error) {
      // Focus is best effort.
    }

    try {
      normalized.click();
      debug('Activated control:', normalized, controlSignature(normalized));
      return true;
    } catch (error) {
      debug('Native click failed:', error);
      return false;
    }
  }

  function findBestScrollableElement(doc) {
    const view = doc.defaultView || window;
    const scrollingElement = doc.scrollingElement || doc.documentElement || doc.body;
    let best = scrollingElement;
    let bestScore = 0;

    function scoreScrollable(element) {
      if (!element || element.nodeType !== 1) return -1;

      const clientHeight = element.clientHeight || 0;
      const scrollHeight = element.scrollHeight || 0;
      const extra = scrollHeight - clientHeight;

      if (clientHeight < 80 || extra < 80) return -1;

      let overflowY = '';

      try {
        overflowY = view.getComputedStyle(element).overflowY;
      } catch (error) {
        // Ignore style access failures.
      }

      const overflowBonus = /auto|scroll|overlay/.test(overflowY) ? 1000000 : 0;
      const area = Math.max(1, element.clientWidth || 1) * clientHeight;

      return overflowBonus + Math.min(extra, 1000000) + Math.min(area, 1000000);
    }

    if (scrollingElement) {
      bestScore = scoreScrollable(scrollingElement);
    }

    let elements = [];

    try {
      elements = Array.from(doc.querySelectorAll('main, section, article, div, ul, [role="main"], [role="feed"], [class*="feed" i], [class*="scroll" i], [class*="viewer" i]'));
    } catch (error) {
      elements = [];
    }

    for (const element of elements) {
      const score = scoreScrollable(element);

      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    }

    return best;
  }

  function scrollDocumentStep(doc) {
    const scroller = findBestScrollableElement(doc);

    if (!scroller) return false;

    const beforeTop = Number(scroller.scrollTop) || 0;
    const amount = Math.max(
      240,
      Math.floor((scroller.clientHeight || doc.defaultView?.innerHeight || window.innerHeight) * 0.9)
    );

    try {
      scroller.scrollBy({
        top: amount,
        left: 0,
        behavior: 'smooth'
      });
    } catch (error) {
      scroller.scrollTop = beforeTop + amount;
    }

    debug('Scrolled xfree container:', {
      scroller,
      beforeTop,
      amount,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight
    });

    return true;
  }

  function tryLocalAction(action) {
    const control = findSemanticControl(document, action);

    if (activateControl(control)) {
      return true;
    }

    if (action === 'next') {
      return scrollDocumentStep(document);
    }

    return false;
  }

  function broadcastNavigationToFrames(action) {
    let sent = false;

    let frames = [];

    try {
      frames = Array.from(document.querySelectorAll('iframe, frame'));
    } catch (error) {
      return false;
    }

    for (const frame of frames) {
      let frameIsXfree = false;

      try {
        const rawSrc = frame.getAttribute('src') || '';

        if (!rawSrc || rawSrc === 'about:blank' || rawSrc.startsWith('javascript:')) {
          frameIsXfree = true;
        } else {
          const frameUrl = new URL(rawSrc, location.href);
          frameIsXfree = isXfreeHostname(frameUrl.hostname);
        }
      } catch (error) {
        frameIsXfree = false;
      }

      if (!frameIsXfree) continue;

      try {
        if (frame.contentWindow) {
          frame.contentWindow.postMessage({
            marker: NAV_MESSAGE_MARKER,
            action
          }, '*');
          sent = true;
        }
      } catch (error) {
        // A WindowProxy can usually receive postMessage even cross-origin,
        // but ignore browsers that reject access entirely.
      }
    }

    return sent;
  }

  function registerFrameNavigationBridge() {
    window.addEventListener('message', event => {
      const data = event.data;

      if (!data || data.marker !== NAV_MESSAGE_MARKER) return;
      if (!['next', 'close'].includes(data.action)) return;

      const fromParent = event.source === window.parent || event.source === window.top;

      if (!fromParent) return;

      let handled = tryLocalAction(data.action);

      if (!handled) {
        handled = broadcastNavigationToFrames(data.action);
      }

      try {
        event.source?.postMessage({
          marker: NAV_MESSAGE_MARKER,
          type: 'result',
          action: data.action,
          handled
        }, '*');
      } catch (error) {
        // Result reporting is optional.
      }
    });
  }

  function tryActionAcrossAccessibleDocuments(action, allowScrollFallback = true) {
    const docs = getAccessibleDocuments();

    for (const doc of docs) {
      const control = findSemanticControl(doc, action);

      if (activateControl(control)) {
        return true;
      }
    }

    if (action === 'next' && allowScrollFallback) {
      for (const doc of docs) {
        if (scrollDocumentStep(doc)) {
          return true;
        }
      }
    }

    return false;
  }

  function closeCurrentView() {
    if (tryActionAcrossAccessibleDocuments('close')) {
      return true;
    }

    if (broadcastNavigationToFrames('close')) {
      debug('Close request forwarded to xfree frame.');
      return true;
    }

    debug('No close control found.');
    return false;
  }

  function finishSession() {
    if (localStorage.getItem(STORAGE_KEYS.endingHandled) === 'true') return;

    localStorage.setItem(STORAGE_KEYS.endingHandled, 'true');

    const postRunSeconds = Number(localStorage.getItem(STORAGE_KEYS.postRunSeconds)) || 0;
    const closeTabAfterSession = localStorage.getItem(STORAGE_KEYS.closeTabAfterSession) === 'true';

    debug('Session time reached. Finish behavior:', {
      postRunSeconds,
      closeTabAfterSession
    });

    const executeFinishAction = () => {
      debug('Executing finish action');
      clearSessionState();
      removeRunningToast();

      if (postRunSeconds <= 0) {
        debug('Post-run is 0. Session ended silently.');
        createPanel();
        return;
      }

      if (closeTabAfterSession) {
        debug('Trying to close tab. Browsers only allow this for script-opened windows/tabs.');
        window.close();

        window.setTimeout(() => {
          if (!window.closed) {
            debug('Tab could not be closed by script. Falling back to close current view.');
            closeCurrentView();
            createPanel();
          }
        }, 500);

        return;
      }

      closeCurrentView();
      createPanel();
    };

    if (postRunSeconds > 0) {
      debug(`Waiting post-run seconds before final action: ${postRunSeconds}`);

      const postRunEndsAt = Date.now() + postRunSeconds * 1000;
      const toastLabel = document.querySelector('#redfabber-session-toast span');

      if (toastLabel) {
        toastLabel.innerHTML = `Post-run · <strong id="rf-remaining">${formatPostRunTime(postRunEndsAt - Date.now())}</strong>`;
      }

      const postRunToken = sessionRuntimeToken;

      const postRunInterval = window.setInterval(() => {
        if (postRunToken !== sessionRuntimeToken) {
          window.clearInterval(postRunInterval);
          return;
        }
        const currentRemaining = Math.max(0, postRunEndsAt - Date.now());
        const currentRemainingElement = document.getElementById('rf-remaining');

        if (currentRemainingElement) {
          currentRemainingElement.textContent = formatPostRunTime(currentRemaining);
        }

        if (currentRemaining <= 0) {
          window.clearInterval(postRunInterval);
        }
      }, 250);

      window.setTimeout(() => {
        if (postRunToken !== sessionRuntimeToken) return;
        executeFinishAction();
      }, postRunSeconds * 1000);
    } else {
      executeFinishAction();
    }
  }

  function triggerScrollStep() {
    // 1. Prefer xfree's actual feed arrow structure.
    for (const doc of getAccessibleDocuments()) {
      const downControl = findXfreeDownControl(doc);

      if (downControl && activateControl(downControl)) {
        debug('Clicked exact xfree down arrow:', downControl);
        return true;
      }
    }

    // 2. Fall back to semantic next/down detection in the page or any
    //    same-origin frame.
    if (tryActionAcrossAccessibleDocuments('next', false)) {
      return true;
    }

    // 3. If the viewer lives on another xfree subdomain, let the copy of this
    //    userscript running inside that frame perform the action locally.
    if (broadcastNavigationToFrames('next')) {
      debug('Next request forwarded to xfree frame.');
      return true;
    }

    // 4. No usable next control: scroll the largest real scroll container.
    const docs = getAccessibleDocuments();

    for (const doc of docs) {
      if (scrollDocumentStep(doc)) {
        return true;
      }
    }

    debug('No xfree next control or scrollable container found.');
    return false;
  }

  function getPauseUntil() {
    return Number(localStorage.getItem('redfabber_scroll_pause_until')) || 0;
  }

  function isScrollPaused() {
    return Date.now() < getPauseUntil();
  }

  function attachManualScrollReset(onManualActivity) {
    const docs = getAccessibleDocuments();
    const handler = () => onManualActivity();

    docs.forEach(doc => {
      try {
        doc.addEventListener('wheel', handler, { passive: true });
        doc.addEventListener('touchmove', handler, { passive: true });
        doc.addEventListener('keydown', event => {
          const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Space', 'Home', 'End'];
          if (keys.includes(event.code) || keys.includes(event.key)) handler();
        });
      } catch (error) {
        // Ignore inaccessible documents.
      }
    });
  }


  function parseTimeLeftText(text) {
    if (typeof text !== 'string') return null;

    const clean = text.trim();
    if (!clean) return null;

    const parts = clean.split(':').map(part => Number(part.trim()));

    if (
      parts.length < 2 ||
      parts.length > 3 ||
      parts.some(part => !Number.isFinite(part) || part < 0)
    ) {
      return null;
    }

    if (parts.length === 2) {
      return Math.max(0, parts[0] * 60 + parts[1]);
    }

    return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }

  function getVisibleTimeLeftElement() {
    const selectors = [
      '.video-control.video-control--timeleft .timeleft',
      '.video-control--timeleft .timeleft',
      '.timeleft'
    ];

    for (const doc of getAccessibleDocuments()) {
      const view = doc.defaultView || window;
      const viewportWidth = view.innerWidth || doc.documentElement?.clientWidth || 0;
      const viewportHeight = view.innerHeight || doc.documentElement?.clientHeight || 0;

      for (const selector of selectors) {
        for (const element of queryAllDeep(doc, selector)) {
          try {
            const rect = element.getBoundingClientRect();
            const style = view.getComputedStyle(element);

            if (
              rect.width <= 0 ||
              rect.height <= 0 ||
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              Number(style.opacity) === 0
            ) {
              continue;
            }

            const visibleWidth = Math.max(
              0,
              Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
            );

            const visibleHeight = Math.max(
              0,
              Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
            );

            if (visibleWidth <= 0 || visibleHeight <= 0) {
              continue;
            }

            if (parseTimeLeftText(element.textContent || '') !== null) {
              return element;
            }
          } catch (error) {}
        }
      }
    }

    return null;
  }

  function getXfreeTimeLeftState() {
    const element = getVisibleTimeLeftElement();
    if (!element) return null;

    const text = (element.textContent || '').trim();
    const seconds = parseTimeLeftText(text);

    if (seconds === null) return null;

    return { element, text, seconds };
  }

  function getVideoMediaKey(video) {
    if (!video) return '';

    const source = (
      video.currentSrc ||
      video.getAttribute('src') ||
      video.querySelector?.('source[src]')?.getAttribute('src') ||
      ''
    );

    const poster = video.getAttribute?.('poster') || '';

    return `${source}|${poster}`;
  }

  function getVisibleVideo() {
    let bestVideo = null;
    let bestScore = -Infinity;

    for (const doc of getAccessibleDocuments()) {
      const view = doc.defaultView || window;
      const viewportWidth = view.innerWidth || doc.documentElement?.clientWidth || 0;
      const viewportHeight = view.innerHeight || doc.documentElement?.clientHeight || 0;

      for (const video of queryAllDeep(doc, 'video')) {
        try {
          const rect = video.getBoundingClientRect();
          const style = view.getComputedStyle(video);

          if (
            rect.width <= 1 ||
            rect.height <= 1 ||
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            Number(style.opacity) === 0
          ) {
            continue;
          }

          const visibleWidth = Math.max(
            0,
            Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
          );

          const visibleHeight = Math.max(
            0,
            Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
          );

          const visibleArea = visibleWidth * visibleHeight;

          if (visibleArea <= 0) {
            continue;
          }

          const elementArea = Math.max(1, rect.width * rect.height);
          const visibleRatio = visibleArea / elementArea;
          const duration = Number(video.duration);

          let score = visibleArea * Math.max(0.25, visibleRatio);

          // Prefer the video xfree is actually playing.
          if (!video.paused && !video.ended) score += 1_000_000;
          if (Number.isFinite(duration) && duration > 0) score += 100_000;
          if (visibleRatio >= 0.5) score += 50_000;

          if (score > bestScore) {
            bestScore = score;
            bestVideo = video;
          }
        } catch (error) {
          // Ignore videos that cannot be inspected.
        }
      }
    }

    return bestVideo;
  }

  function getVideoTiming(video) {
    if (!video) return null;

    const duration = Number(video.duration);
    const currentTime = Math.max(0, Number(video.currentTime) || 0);
    const playbackRate = Math.abs(Number(video.playbackRate)) || 1;

    if (!Number.isFinite(duration) || duration <= 0) {
      return null;
    }

    const remainingMediaSeconds = Math.max(0, duration - currentTime);
    const remainingWallSeconds = remainingMediaSeconds / playbackRate;

    return {
      duration,
      currentTime,
      playbackRate,
      remainingMediaSeconds,
      remainingWallSeconds,
      mediaKey: getVideoMediaKey(video)
    };
  }

  function startSessionWatcher() {
    const runtimeToken = sessionRuntimeToken;
    let lastScrollAt = Date.now();

    let trackedVideo = null;
    let trackedVideoKey = '';
    let trackedVideoDuration = 0;
    let videoScrollDeadline = 0;

    let lastTimeLeftSeconds = null;
    let lastTimeLeftText = '';
    let zeroSeenAt = 0;

    function resetVideoTracking() {
      trackedVideo = null;
      trackedVideoKey = '';
      trackedVideoDuration = 0;
      videoScrollDeadline = 0;
    }

    function resetTimeLeftTracking() {
      lastTimeLeftSeconds = null;
      lastTimeLeftText = '';
      zeroSeenAt = 0;
    }

    attachManualScrollReset(() => {
      lastScrollAt = Date.now();
      resetVideoTracking();
      resetTimeLeftTracking();
    });

    const interval = window.setInterval(() => {
      if (runtimeToken !== sessionRuntimeToken) {
        window.clearInterval(interval);
        return;
      }

      if (!isSessionActive()) {
        window.clearInterval(interval);
        finishSession();
        return;
      }

      const hideTimer = localStorage.getItem(STORAGE_KEYS.hideTimer) === 'true';
      const remaining = document.getElementById('rf-remaining');

      if (!hideTimer && remaining) {
        remaining.textContent = formatTime(getRemainingMs());
      }

      const fallbackScrollSeconds =
        Number(localStorage.getItem('redfabber_scroll_seconds')) ||
        DEFAULTS.scrollSeconds;

      const remainingMs = getRemainingMs();
      const countdownDurationSeconds =
        Number(localStorage.getItem(STORAGE_KEYS.countdownDurationSeconds)) || 0;
      const countdownPlayed =
        localStorage.getItem(STORAGE_KEYS.countdownPlayed) === 'true';

      if (
        countdownDurationSeconds > 0 &&
        !countdownPlayed &&
        remainingMs <= countdownDurationSeconds * 1000
      ) {
        playCountdownSound();
      }

      const pauseButton = document.getElementById('rf-pause-scroll');

      if (pauseButton && isScrollPaused()) {
        const secondsLeft = Math.ceil((getPauseUntil() - Date.now()) / 1000);
        pauseButton.textContent = `${secondsLeft}s`;
      } else if (pauseButton) {
        pauseButton.textContent = 'Pause 10s';
      }

      const autoScrollEnabled =
        localStorage.getItem(STORAGE_KEYS.autoScrollEnabled) !== 'false';

      if (!autoScrollEnabled || isScrollPaused()) {
        return;
      }

      // Preferred xfree timing source:
      // <div class="video-control video-control--timeleft">
      //   <span class="timeleft">12:38</span>
      // </div>
      const timeLeftState = getXfreeTimeLeftState();

      if (timeLeftState) {
        resetVideoTracking();

        if (
          timeLeftState.seconds !== lastTimeLeftSeconds ||
          timeLeftState.text !== lastTimeLeftText
        ) {
          debug('xfree time-left:', {
            text: timeLeftState.text,
            seconds: timeLeftState.seconds
          });

          lastTimeLeftSeconds = timeLeftState.seconds;
          lastTimeLeftText = timeLeftState.text;
        }

        if (timeLeftState.seconds <= 0) {
          if (!zeroSeenAt) {
            zeroSeenAt = Date.now();
          }

          // Debounce 0:00 slightly so xfree changing media doesn't double-click.
          if (Date.now() - zeroSeenAt >= 250) {
            debug('xfree time-left reached 0:00. Advancing feed.');
            triggerScrollStep();
            lastScrollAt = Date.now();
            resetTimeLeftTracking();
          }
        } else {
          zeroSeenAt = 0;
        }

        return;
      }

      resetTimeLeftTracking();

      // Fallback #1: use the real <video> timing if the xfree time-left
      // control is unavailable or hidden.
      const activeVideo = getVisibleVideo();
      const timing = getVideoTiming(activeVideo);

      if (activeVideo && timing) {
        const mediaChanged =
          activeVideo !== trackedVideo ||
          timing.mediaKey !== trackedVideoKey ||
          Math.abs(timing.duration - trackedVideoDuration) > 0.25;

        if (mediaChanged || videoScrollDeadline <= 0) {
          trackedVideo = activeVideo;
          trackedVideoKey = timing.mediaKey;
          trackedVideoDuration = timing.duration;

          videoScrollDeadline =
            Date.now() + Math.max(250, timing.remainingWallSeconds * 1000);

          debug('Video fallback auto-scroll scheduled:', {
            duration: timing.duration,
            currentTime: timing.currentTime,
            playbackRate: timing.playbackRate,
            remainingSeconds: timing.remainingWallSeconds
          });
        }

        if (Date.now() >= videoScrollDeadline) {
          debug('Video fallback duration completed. Advancing xfree feed.');
          triggerScrollStep();
          lastScrollAt = Date.now();
          resetVideoTracking();
        }

        return;
      }

      // Fallback #2: image/non-video posts use the configured scroll interval.
      resetVideoTracking();

      if (Date.now() - lastScrollAt >= fallbackScrollSeconds * 1000) {
        triggerScrollStep();
        lastScrollAt = Date.now();
      }
    }, 250);
  }

  function getXfreeDiagnostics() {
    const docs = getAccessibleDocuments();

    return {
      url: location.href,
      hostname: location.hostname,
      isTopFrame: window.top === window.self,
      accessibleDocuments: docs.length,
      iframeCount: document.querySelectorAll('iframe, frame').length,
      nextControl: findSemanticControl(document, 'next'),
      closeControl: findSemanticControl(document, 'close'),
      scrollableElement: findBestScrollableElement(document),
      timeLeft: getXfreeTimeLeftState(),
      activeVideo: getVisibleVideo(),
      activeVideoTiming: getVideoTiming(getVisibleVideo()),
      monitorState: getXtoysMonitorState()
    };
  }

  window.rfnext = triggerScrollStep;
  window.rfclose = closeCurrentView;
  window.rfdiag = getXfreeDiagnostics;

  registerFrameNavigationBridge();

  function init() {
    // Matching xfree subframes also run this userscript so the bridge can
    // control cross-origin xfree viewers. Only the top page renders the UI.
    if (window.top !== window.self) {
      debug('xfree frame bridge ready:', location.href);
      return;
    }

    createXtoysWebpageMonitor();

    if (isSessionActive()) {
      showRunningToast();
      startSessionWatcher();
      return;
    }

    createPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
