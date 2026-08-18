// ==UserScript==
// @name         xfree Session Helper
// @version      0.1.0
// @description  Sessionhelper for xfree with xtoys integration
// @match        https://xfree.com/*
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
    const value = Number(localStorage.getItem(key));
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

  function getAccessibleDocuments() {
    const docs = [document];
    const frames = Array.from(document.querySelectorAll('iframe'));

    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i];

      try {
        const frameWindow = frame.contentWindow;
        const frameDocument = frame.contentDocument || frameWindow?.document;

        if (frameDocument) {
          docs.unshift(frameDocument);
        }
      } catch (error) {
        // Cross-origin iframes are not script-accessible.
      }
    }

    return docs;
  }

  function findDownControl(doc) {
    return (
      doc.querySelector('a.control.control--right app-icon[icon="chevron-down"]')?.closest('a.control.control--right') ||
      doc.querySelector('a.control--right app-icon[icon="chevron-down"]')?.closest('a') ||
      doc.querySelector('a.control--right .control__icon--down')?.closest('a') ||
      doc.querySelector('a.control.control--right')
    );
  }

  function findCloseControl(doc) {
    return (
      doc.querySelector('a.control.control--close app-icon[icon="x"]')?.closest('a.control.control--close') ||
      doc.querySelector('a.control--close app-icon[icon="x"]')?.closest('a') ||
      doc.querySelector('a.control--close .control__icon--up')?.closest('a') ||
      doc.querySelector('a.control.control--close')
    );
  }

  function closeCurrentView() {
    const docs = getAccessibleDocuments();

    for (const doc of docs) {
      const closeControl = findCloseControl(doc);

      if (closeControl) {
        debug('Clicking close control:', closeControl);
        closeControl.click();
        return true;
      }
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
    const docs = getAccessibleDocuments();

    for (const doc of docs) {
      const downControl = findDownControl(doc);

      if (downControl) {
        downControl.click();
        return;
      }
    }

    window.scrollBy({
      top: window.innerHeight * 0.9,
      behavior: 'smooth'
    });
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

  function startSessionWatcher() {
    const runtimeToken = sessionRuntimeToken;
    let lastScrollAt = Date.now();

    attachManualScrollReset(() => {
      lastScrollAt = Date.now();
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

      const mediaDurationSeconds = Number(localStorage.getItem('redfabber_scroll_seconds')) || DEFAULTS.scrollSeconds;
      const remainingMs = getRemainingMs();
      const countdownDurationSeconds = Number(localStorage.getItem(STORAGE_KEYS.countdownDurationSeconds)) || 0;
      const countdownPlayed = localStorage.getItem(STORAGE_KEYS.countdownPlayed) === 'true';

      if (countdownDurationSeconds > 0 && !countdownPlayed && remainingMs <= countdownDurationSeconds * 1000) {
        debug('Countdown trigger reached:', {
          remainingMs,
          remainingSeconds: Math.ceil(remainingMs / 1000),
          countdownDurationSeconds,
          countdownUrl: localStorage.getItem(STORAGE_KEYS.countdownUrl)
        });

        playCountdownSound();
      }

      const pauseButton = document.getElementById('rf-pause-scroll');

      if (pauseButton && isScrollPaused()) {
        const secondsLeft = Math.ceil((getPauseUntil() - Date.now()) / 1000);
        pauseButton.textContent = `${secondsLeft}s`;
      } else if (pauseButton) {
        pauseButton.textContent = 'Pause 10s';
      }

      const autoScrollEnabled = localStorage.getItem(STORAGE_KEYS.autoScrollEnabled) !== 'false';

      if (autoScrollEnabled && !isScrollPaused() && Date.now() - lastScrollAt >= mediaDurationSeconds * 1000) {
        triggerScrollStep();
        lastScrollAt = Date.now();
      }
    }, 1000);
  }

  function init() {
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
