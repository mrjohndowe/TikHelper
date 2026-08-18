// ==UserScript==
// @name         xfree Session Helper
// @version      0.2.0
// @description  Session helper for xfree with XToys integration
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
      url: 'https://github.com/Mrjohndowe/TikHelper/raw/refs/heads/main/Countdown_f_f-10-1.mp3',
      durationSeconds: 11
    },
    {
      url: 'https://github.com/Mrjohndowe/TikHelper/raw/refs/heads/main/Countdown_f_f-10-2.mp3',
      durationSeconds: 11
    },
    {
      url: 'https://github.com/Mrjohndowe/TikHelper/raw/refs/heads/main/Countdown_f_f-10.mp3',
      durationSeconds: 11
    },
    {
      url: 'https://github.com/Mrjohndowe/TikHelper/raw/refs/heads/main/Countdown_f_f-11.mp3',
      durationSeconds: 12
    },
    {
      url: 'https://github.com/Mrjohndowe/TikHelper/raw/refs/heads/main/Countdown_f_f-14-2.mp3',
      durationSeconds: 15
    },
    {
      url: 'https://github.com/Mrjohndowe/TikHelper/raw/refs/heads/main/Countdown_f_f-14.mp3.mp3',
      durationSeconds: 15
    },
    {
      url: 'https://github.com/Mrjohndowe/TikHelper/raw/refs/heads/main/Countdown_f_f-8.mp3',
      durationSeconds: 9
    },
    {
      url: 'https://github.com/Mrjohndowe/TikHelper/raw/refs/heads/main/Countdown_f_f-9.mp3',
      durationSeconds: 10
    }
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
    Object.entries(state).forEach(([key, value]) => {
      const storageKey = STORAGE_KEYS[key];

      if (storageKey) {
        localStorage.setItem(storageKey, String(value));
      }
    });
  }

  function clearSessionState() {
    sessionRuntimeToken++;

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
    const active =
      localStorage.getItem(STORAGE_KEYS.active) === 'true';

    const endsAt =
      Number(localStorage.getItem(STORAGE_KEYS.endsAt));

    if (!active) return false;

    if (!Number.isFinite(endsAt) || Date.now() >= endsAt) {
      clearSessionState();
      return false;
    }

    return true;
  }

  function getRemainingMs() {
    const endsAt =
      Number(localStorage.getItem(STORAGE_KEYS.endsAt));

    return Math.max(0, endsAt - Date.now());
  }

  function formatTime(ms) {
    const totalSeconds =
      Math.max(0, Math.ceil(ms / 1000));

    const minutes =
      Math.floor(totalSeconds / 60);

    const seconds =
      totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function formatPostRunTime(ms) {
    return `-${formatTime(ms)}`;
  }

  function randomInteger(min, max) {
    const lower =
      Math.ceil(Math.min(min, max));

    const upper =
      Math.floor(Math.max(min, max));

    return Math.floor(
      Math.random() * (upper - lower + 1)
    ) + lower;
  }

  function pickRandomCountdownSound() {
    return COUNTDOWN_SOUNDS[
      Math.floor(Math.random() * COUNTDOWN_SOUNDS.length)
    ];
  }

  function setCountdownState(
    active,
    type = 'none',
    durationSeconds = 0
  ) {
    countdownStateToken++;

    const normalizedType =
      active ? type : 'none';

    const safeDurationSeconds =
      Math.max(0, Number(durationSeconds) || 0);

    const endsAt =
      active && safeDurationSeconds > 0
        ? Date.now() + safeDurationSeconds * 1000
        : 0;

    localStorage.setItem(
      STORAGE_KEYS.countdownActive,
      active ? 'true' : 'false'
    );

    localStorage.setItem(
      STORAGE_KEYS.countdownType,
      normalizedType
    );

    if (endsAt > 0) {
      localStorage.setItem(
        STORAGE_KEYS.countdownEndsAt,
        String(endsAt)
      );
    } else {
      localStorage.removeItem(
        STORAGE_KEYS.countdownEndsAt
      );
    }

    return countdownStateToken;
  }

  function clearCountdownState(
    expectedType = null,
    expectedToken = null
  ) {
    const currentType =
      localStorage.getItem(
        STORAGE_KEYS.countdownType
      ) || 'none';

    if (
      expectedType &&
      currentType !== expectedType
    ) {
      return;
    }

    if (
      expectedToken !== null &&
      expectedToken !== countdownStateToken
    ) {
      return;
    }

    setCountdownState(false, 'none', 0);
  }

  function playFakeCountdown(url, durationSeconds) {
    const safeDurationSeconds =
      Math.max(1, Number(durationSeconds) || 0);

    const token =
      setCountdownState(
        true,
        'fake',
        safeDurationSeconds
      );

    const audio = new Audio(url);
    audio.volume = 1;

    const stopDelay =
      Math.max(
        1000,
        (safeDurationSeconds - 2) * 1000
      );

    window.setTimeout(() => {
      clearCountdownState('fake', token);
    }, stopDelay);

    audio.play().then(() => {
      window.setTimeout(() => {
        audio.pause();

        try {
          audio.currentTime = 0;
        } catch (error) {}
      }, stopDelay);
    }).catch(error => {
      console.warn(
        '[RedFabber] Fake countdown audio failed:',
        error
      );
    });
  }

  function maybeTriggerFakeCountdown() {
    const enabled =
      localStorage.getItem(
        STORAGE_KEYS.fakeCountdowns
      ) === 'true' &&
      localStorage.getItem(
        STORAGE_KEYS.spokenCountdownEnabled
      ) !== 'false';

    if (!enabled) return;

    if (Math.random() >= 0.45) {
      return;
    }

    const endsAt =
      Number(
        localStorage.getItem(
          STORAGE_KEYS.endsAt
        )
      );

    const remainingMs =
      endsAt - Date.now();

    const maximum =
      Math.max(
        31,
        Math.floor(remainingMs / 1000) - 20
      );

    const triggerBeforeEndMs =
      randomInteger(30, maximum) * 1000;

    const token =
      sessionRuntimeToken;

    window.setTimeout(() => {
      if (token !== sessionRuntimeToken) return;
      if (!isSessionActive()) return;

      const sound =
        pickRandomCountdownSound();

      playFakeCountdown(
        sound.url,
        sound.durationSeconds
      );
    }, Math.max(
      5000,
      remainingMs - triggerBeforeEndMs
    ));
  }

  function playCountdownSound() {
    if (
      localStorage.getItem(
        STORAGE_KEYS.countdownPlayed
      ) === 'true'
    ) {
      return;
    }

    const url =
      localStorage.getItem(
        STORAGE_KEYS.countdownUrl
      );

    if (!url) return;

    const durationSeconds =
      Math.max(
        1,
        Number(
          localStorage.getItem(
            STORAGE_KEYS.countdownDurationSeconds
          )
        ) || 0
      );

    localStorage.setItem(
      STORAGE_KEYS.countdownPlayed,
      'true'
    );

    const token =
      setCountdownState(
        true,
        'real',
        durationSeconds
      );

    window.setTimeout(() => {
      clearCountdownState(
        'real',
        token
      );
    }, durationSeconds * 1000);

    const spoken =
      localStorage.getItem(
        STORAGE_KEYS.spokenCountdownEnabled
      ) !== 'false';

    if (!spoken) return;

    const audio = new Audio(url);
    audio.volume = 1;
    audio.preload = 'auto';

    audio.play().catch(error => {
      console.warn(
        '[RedFabber] Countdown audio failed:',
        error
      );

      localStorage.setItem(
        STORAGE_KEYS.countdownPlayed,
        'false'
      );
    });
  }

  function getXtoysMonitorState() {
    const active =
      isSessionActive();

    const remainingMs =
      active ? getRemainingMs() : 0;

    const countdownActive =
      localStorage.getItem(
        STORAGE_KEYS.countdownActive
      ) === 'true';

    const countdownType =
      localStorage.getItem(
        STORAGE_KEYS.countdownType
      ) || 'none';

    const countdownEndsAt =
      Number(
        localStorage.getItem(
          STORAGE_KEYS.countdownEndsAt
        )
      ) || 0;

    const startedAt =
      Number(
        localStorage.getItem(
          STORAGE_KEYS.startedAt
        )
      ) || 0;

    const endsAt =
      Number(
        localStorage.getItem(
          STORAGE_KEYS.endsAt
        )
      ) || 0;

    const durationSeconds =
      startedAt > 0 && endsAt > startedAt
        ? Math.round(
            (endsAt - startedAt) / 1000
          )
        : 0;

    const countdownRemainingMs =
      countdownActive
        ? Math.max(
            0,
            countdownEndsAt - Date.now()
          )
        : 0;

    return {
      sessionActive: active,
      remainingMs,
      remainingSeconds:
        Math.ceil(remainingMs / 1000),
      remainingText:
        formatTime(remainingMs),
      durationSeconds,
      countdownActive,
      countdownType,
      realCountdownActive:
        countdownActive &&
        countdownType === 'real',
      fakeCountdownActive:
        countdownActive &&
        countdownType === 'fake',
      countdownRemainingSeconds:
        Math.ceil(
          countdownRemainingMs / 1000
        ),
      timestamp: Date.now()
    };
  }
    function createXtoysWebpageMonitor() {
    if (
      document.getElementById(
        'xtoys-redfabber-monitor'
      )
    ) {
      return;
    }

    const monitor =
      document.createElement('div');

    monitor.id =
      'xtoys-redfabber-monitor';

    monitor.style.cssText = `
      position:fixed;
      left:12px;
      bottom:12px;
      z-index:2147483647;
      padding:8px 10px;
      background:#111;
      color:#00ff7f;
      font:12px monospace;
      pointer-events:none;
      display:${DEBUG ? 'block' : 'none'};
    `;

    document.body.appendChild(monitor);

    window.redfabberXtoysMonitor = {
      getState: getXtoysMonitorState
    };

    window.setInterval(() => {
      const state =
        getXtoysMonitorState();

      const line = [
        'RF',
        `r=${state.remainingSeconds}`,
        `d=${state.durationSeconds}`,
        `c=${state.countdownActive ? 1 : 0}`,
        `t=${state.countdownType}`,
        `cr=${state.countdownRemainingSeconds}`,
        `ts=${state.timestamp}`
      ].join('|');

      monitor.textContent = line;

      monitor.setAttribute(
        'data-rf-monitor-line',
        line
      );

      monitor.setAttribute(
        'data-rf-remaining-seconds',
        String(state.remainingSeconds)
      );

      monitor.setAttribute(
        'data-rf-duration-seconds',
        String(state.durationSeconds)
      );

      monitor.setAttribute(
        'data-rf-countdown-active',
        state.countdownActive ? '1' : '0'
      );

      monitor.setAttribute(
        'data-rf-countdown-type',
        state.countdownType
      );

      window.redfabberXtoysMonitorLine =
        line;

      if (
        !window.redfabberOriginalTitle
      ) {
        window.redfabberOriginalTitle =
          document.title || '';
      }

      document.title = line;

      window.dispatchEvent(
        new CustomEvent(
          'xtoys:redfabber-monitor',
          {
            detail: state
          }
        )
      );
    }, 250);
  }

  function createPanel() {
    if (
      document.getElementById(
        'redfabber-session-panel'
      )
    ) {
      return;
    }

    if (isSessionActive()) return;

    const savedMin =
      getNumber(
        STORAGE_KEYS.minMinutes,
        DEFAULTS.minMinutes
      );

    const savedMax =
      getNumber(
        STORAGE_KEYS.maxMinutes,
        DEFAULTS.maxMinutes
      );

    const panel =
      document.createElement('div');

    panel.id =
      'redfabber-session-panel';

    panel.innerHTML = `
      <div class="rf-head">
        <strong>RedFabber</strong>
        <span>xfree helper</span>
      </div>

      <div class="rf-row">
        <label>
          Min.
          <input
            id="rf-min"
            type="number"
            min="1"
            step="1"
            value="${savedMin}"
          >
        </label>

        <label>
          Max.
          <input
            id="rf-max"
            type="number"
            min="1"
            step="1"
            value="${savedMax}"
          >
        </label>
      </div>

      <label class="rf-field">
        Scroll interval
        <input
          id="rf-scroll"
          type="number"
          min="5"
          step="1"
          value="${getNumber(
            'redfabber_scroll_seconds',
            DEFAULTS.scrollSeconds
          )}"
        >
      </label>

      <label class="rf-field">
        Run after end
        <input
          id="rf-post-run"
          type="number"
          min="0"
          step="1"
          value="${getNumber(
            STORAGE_KEYS.postRunSeconds,
            DEFAULTS.postRunSeconds
          )}"
        >
      </label>

      <label class="rf-check">
        <input
          id="rf-close-tab"
          type="checkbox"
          ${
            localStorage.getItem(
              STORAGE_KEYS.closeTabAfterSession
            ) === 'true'
              ? 'checked'
              : ''
          }
        >
        Close tab after post-run
      </label>

      <label class="rf-check">
        <input
          id="rf-initial-scroll"
          type="checkbox"
          ${
            localStorage.getItem(
              STORAGE_KEYS.autoScrollEnabled
            ) !== 'false'
              ? 'checked'
              : ''
          }
        >
        Auto Scroll from start
      </label>

      <label class="rf-check">
        <input
          id="rf-spoken-countdown"
          type="checkbox"
          ${
            localStorage.getItem(
              STORAGE_KEYS.spokenCountdownEnabled
            ) !== 'false'
              ? 'checked'
              : ''
          }
        >
        Spoken Countdown
      </label>

      <label class="rf-check">
        <input
          id="rf-fake-countdowns"
          type="checkbox"
          ${
            localStorage.getItem(
              STORAGE_KEYS.fakeCountdowns
            ) === 'true'
              ? 'checked'
              : ''
          }
        >
        Fake Countdown
      </label>

      <div class="rf-buttons">
        <button
          id="rf-start"
          type="button"
        >
          Start Session
        </button>

        <button
          id="rf-surprise"
          type="button"
          class="rf-secondary"
        >
          Surprise me
        </button>
      </div>
    `;

    if (
      !document.getElementById(
        'redfabber-session-style'
      )
    ) {
      const style =
        document.createElement('style');

      style.id =
        'redfabber-session-style';

      style.textContent = `
        #redfabber-session-panel {
          position:fixed;
          right:18px;
          bottom:18px;
          z-index:2147483647;
          width:250px;
          padding:14px;
          border-radius:18px;
          border:1px solid rgba(255,255,255,.14);
          background:rgba(18,18,18,.94);
          color:#fff;
          font-family:system-ui,-apple-system,
            BlinkMacSystemFont,"Segoe UI",sans-serif;
          box-shadow:0 18px 44px rgba(0,0,0,.38);
          backdrop-filter:blur(12px);
        }

        #redfabber-session-panel .rf-head {
          display:flex;
          justify-content:space-between;
          align-items:baseline;
          margin-bottom:12px;
        }

        #redfabber-session-panel .rf-head span {
          color:#aaa;
          font-size:11px;
        }

        #redfabber-session-panel .rf-row {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-bottom:12px;
        }

        #redfabber-session-panel label,
        #redfabber-session-panel .rf-field {
          display:grid;
          gap:6px;
          color:#aaa;
          font-size:11px;
          font-weight:700;
          margin-bottom:12px;
        }

        #redfabber-session-panel input[type="number"] {
          box-sizing:border-box;
          width:100%;
          height:36px;
          padding:0 10px;
          border:1px solid #333;
          border-radius:10px;
          background:#0e0e0e;
          color:#fff;
          font:inherit;
          font-size:14px;
        }

        #redfabber-session-panel .rf-check {
          display:flex;
          align-items:center;
          gap:8px;
          text-transform:none;
          font-size:12px;
        }

        #redfabber-session-panel .rf-check input {
          width:auto;
        }

        #redfabber-session-panel .rf-buttons {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:8px;
        }

        #redfabber-session-panel button,
        #redfabber-session-toast button {
          border:0;
          border-radius:999px;
          background:${BRAND};
          color:#fff;
          cursor:pointer;
          font-weight:800;
        }

        #redfabber-session-panel button {
          height:40px;
        }

        #redfabber-session-panel
        button.rf-secondary {
          background:#222;
          border:1px solid #333;
        }

        #redfabber-session-toast {
          position:fixed;
          right:18px;
          bottom:18px;
          z-index:2147483647;
          display:flex;
          align-items:center;
          gap:8px;
          padding:10px 12px;
          border-radius:14px;
          background:rgba(18,18,18,.95);
          color:#fff;
          font-family:system-ui,-apple-system,
            BlinkMacSystemFont,"Segoe UI",sans-serif;
          font-size:13px;
          box-shadow:0 18px 44px rgba(0,0,0,.38);
        }

        #redfabber-session-toast button {
          padding:7px 10px;
          font-size:12px;
        }

        #redfabber-session-toast strong {
          color:${BRAND};
        }
      `;

      document.documentElement.appendChild(
        style
      );
    }

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
      const durationMinutes =
        randomInteger(min, max);

      const countdownSound =
        pickRandomCountdownSound();

      const startedAt =
        Date.now();

      const endsAt =
        startedAt +
        durationMinutes * 60 * 1000;

      localStorage.setItem(
        STORAGE_KEYS.minMinutes,
        String(min)
      );

      localStorage.setItem(
        STORAGE_KEYS.maxMinutes,
        String(max)
      );

      localStorage.setItem(
        'redfabber_scroll_seconds',
        String(scrollSeconds)
      );

      localStorage.setItem(
        STORAGE_KEYS.postRunSeconds,
        String(postRunSeconds)
      );

      localStorage.setItem(
        STORAGE_KEYS.closeTabAfterSession,
        String(closeTabAfterSession)
      );

      localStorage.setItem(
        STORAGE_KEYS.fakeCountdowns,
        String(fakeCountdowns)
      );

      localStorage.setItem(
        STORAGE_KEYS.autoScrollEnabled,
        String(autoScrollEnabled)
      );

      localStorage.setItem(
        STORAGE_KEYS.spokenCountdownEnabled,
        String(spokenCountdownEnabled)
      );

      setSessionState({
        active: true,
        startedAt,
        endsAt,
        durationMinutes,
        countdownUrl:
          countdownSound.url,
        countdownDurationSeconds:
          countdownSound.durationSeconds,
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

    document
      .getElementById('rf-start')
      .addEventListener('click', () => {
        const min =
          Math.max(
            1,
            Number(
              document.getElementById(
                'rf-min'
              ).value
            ) ||
            DEFAULTS.minMinutes
          );

        const max =
          Math.max(
            1,
            Number(
              document.getElementById(
                'rf-max'
              ).value
            ) ||
            DEFAULTS.maxMinutes
          );

        const scrollSeconds =
          Math.max(
            5,
            Number(
              document.getElementById(
                'rf-scroll'
              ).value
            ) ||
            DEFAULTS.scrollSeconds
          );

        const postRunSeconds =
          Math.max(
            0,
            Number(
              document.getElementById(
                'rf-post-run'
              ).value
            ) || 0
          );

        startConfiguredSession({
          min,
          max,
          scrollSeconds,
          postRunSeconds,
          closeTabAfterSession:
            document.getElementById(
              'rf-close-tab'
            ).checked,
          fakeCountdowns:
            document.getElementById(
              'rf-fake-countdowns'
            ).checked,
          autoScrollEnabled:
            document.getElementById(
              'rf-initial-scroll'
            ).checked,
          spokenCountdownEnabled:
            document.getElementById(
              'rf-spoken-countdown'
            ).checked,
          surpriseMode: false,
          hideTimer: false
        });
      });

    document
      .getElementById('rf-surprise')
      .addEventListener('click', () => {
        startConfiguredSession({
          min: 5,
          max: 60,
          scrollSeconds:
            Math.max(
              5,
              Number(
                document.getElementById(
                  'rf-scroll'
                ).value
              ) ||
              DEFAULTS.scrollSeconds
            ),
          postRunSeconds:
            randomInteger(10, 600),
          closeTabAfterSession:
            document.getElementById(
              'rf-close-tab'
            ).checked,
          fakeCountdowns:
            document.getElementById(
              'rf-fake-countdowns'
            ).checked,
          autoScrollEnabled:
            document.getElementById(
              'rf-initial-scroll'
            ).checked,
          spokenCountdownEnabled:
            document.getElementById(
              'rf-spoken-countdown'
            ).checked,
          surpriseMode: true,
          hideTimer: true
        });
      });
  }
    function showRunningToast() {
    if (!isSessionActive()) return;

    if (
      document.getElementById(
        'redfabber-session-toast'
      )
    ) {
      return;
    }

    const toast =
      document.createElement('div');

    toast.id =
      'redfabber-session-toast';

    const hideTimer =
      localStorage.getItem(
        STORAGE_KEYS.hideTimer
      ) === 'true';

    toast.innerHTML = `
      <span>
        ${
          hideTimer
            ? 'Session active'
            : `Session active · <strong id="rf-remaining">${formatTime(
                getRemainingMs()
              )}</strong>`
        }
      </span>

      <button
        id="rf-toggle-scroll"
        type="button"
      >
        Scroll On
      </button>

      <button
        id="rf-pause-scroll"
        type="button"
      >
        Pause 10s
      </button>

      <button
        id="rf-stop-session"
        type="button"
        style="background:#7a1f23;"
      >
        STOP
      </button>
    `;

    document.body.appendChild(toast);

    document
      .getElementById('rf-stop-session')
      ?.addEventListener(
        'click',
        hardStopSession
      );

    document
      .getElementById('rf-pause-scroll')
      ?.addEventListener('click', () => {
        localStorage.setItem(
          'redfabber_scroll_pause_until',
          String(Date.now() + 10000)
        );
      });

    const toggle =
      document.getElementById(
        'rf-toggle-scroll'
      );

    if (toggle) {
      function updateToggle() {
        const enabled =
          localStorage.getItem(
            STORAGE_KEYS.autoScrollEnabled
          ) !== 'false';

        toggle.textContent =
          enabled
            ? 'Scroll On'
            : 'Scroll Off';

        toggle.style.background =
          enabled
            ? BRAND
            : '#333';
      }

      updateToggle();

      toggle.addEventListener(
        'click',
        () => {
          const current =
            localStorage.getItem(
              STORAGE_KEYS.autoScrollEnabled
            ) !== 'false';

          localStorage.setItem(
            STORAGE_KEYS.autoScrollEnabled,
            String(!current)
          );

          updateToggle();
        }
      );
    }
  }

  function removeRunningToast() {
    document
      .getElementById(
        'redfabber-session-toast'
      )
      ?.remove();
  }

  function hardStopSession() {
    sessionRuntimeToken++;

    clearCountdownState();

    clearSessionState();

    removeRunningToast();

    document
      .getElementById(
        'redfabber-session-panel'
      )
      ?.remove();

    createPanel();

    console.log(
      '[RedFabber] Session stopped.'
    );
  }

  window.fapstop =
    hardStopSession;

  const NAV_MESSAGE_MARKER =
    'redfabber-xfree-nav-v2';

  function isXfreeHostname(hostname) {
    return (
      hostname === 'xfree.com' ||
      hostname.endsWith('.xfree.com')
    );
  }

  function getAccessibleDocuments() {
    const docs = [];
    const seen = new Set();

    function visit(doc) {
      if (!doc || seen.has(doc)) {
        return;
      }

      seen.add(doc);
      docs.push(doc);

      let frames = [];

      try {
        frames =
          Array.from(
            doc.querySelectorAll(
              'iframe, frame'
            )
          );
      } catch (error) {
        return;
      }

      for (const frame of frames) {
        try {
          const childDocument =
            frame.contentDocument ||
            frame.contentWindow?.document;

          if (childDocument) {
            visit(childDocument);
          }
        } catch (error) {
          // Cross-origin frame.
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
        elements =
          Array.from(
            root.querySelectorAll('*')
          );
      } catch (error) {
        return;
      }

      for (const element of elements) {
        if (
          element.shadowRoot &&
          !seen.has(element.shadowRoot)
        ) {
          seen.add(element.shadowRoot);

          roots.push(
            element.shadowRoot
          );

          scan(
            element.shadowRoot
          );
        }
      }
    }

    scan(doc);

    return roots;
  }

  function queryAllDeep(doc, selector) {
    const found = [];
    const seen = new Set();

    for (
      const root of getSearchRoots(doc)
    ) {
      let matches = [];

      try {
        matches =
          Array.from(
            root.querySelectorAll(
              selector
            )
          );
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

  function normalizeControl(element) {
    return (
      element?.closest?.(
        'button, a, [role="button"], [role="link"], input'
      ) ||
      element ||
      null
    );
  }

  function isVisibleControl(element) {
    if (
      !element ||
      element.nodeType !== 1
    ) {
      return false;
    }

    const control =
      normalizeControl(element);

    if (
      control.matches?.(
        '[disabled], [aria-disabled="true"], [hidden]'
      )
    ) {
      return false;
    }

    try {
      const style =
        control.ownerDocument
          .defaultView
          ?.getComputedStyle(control);

      if (
        style &&
        (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          Number(style.opacity) === 0 ||
          style.pointerEvents === 'none'
        )
      ) {
        return false;
      }
    } catch (error) {}

    const rect =
      control.getBoundingClientRect();

    return (
      rect.width > 1 &&
      rect.height > 1
    );
  }

  function controlSignature(element) {
    if (!element) return '';

    const control =
      normalizeControl(element);

    const parts = [
      control.tagName,
      control.id,
      control.className,
      control.getAttribute?.(
        'aria-label'
      ),
      control.getAttribute?.(
        'title'
      ),
      control.getAttribute?.(
        'name'
      ),
      control.getAttribute?.(
        'data-action'
      ),
      control.getAttribute?.(
        'data-testid'
      ),
      control.getAttribute?.(
        'data-test'
      ),
      control.getAttribute?.(
        'data-tooltip'
      ),
      control.getAttribute?.(
        'data-direction'
      ),
      control.getAttribute?.(
        'rel'
      ),
      control.getAttribute?.(
        'href'
      ),
      control.textContent
    ];

    try {
      const icons =
        control.querySelectorAll(
          'svg, use, path, i, app-icon, [data-icon], [icon], [aria-label]'
        );

      for (const icon of icons) {
        parts.push(
          icon.getAttribute?.(
            'aria-label'
          ),
          icon.getAttribute?.(
            'title'
          ),
          icon.getAttribute?.(
            'class'
          ),
          icon.getAttribute?.(
            'data-icon'
          ),
          icon.getAttribute?.(
            'icon'
          ),
          icon.getAttribute?.(
            'href'
          ),
          icon.getAttribute?.(
            'xlink:href'
          )
        );
      }
    } catch (error) {}

    return parts
      .filter(
        value =>
          value !== null &&
          value !== undefined
      )
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function scoreControl(
    element,
    action
  ) {
    const signature =
      controlSignature(element);

    if (!signature) {
      return -Infinity;
    }

    let score = 0;

    if (action === 'next') {
      const goodPatterns = [
        /\bnext\b/,
        /\bnext[-_ ]?(post|item|media|video|image|slide|page)\b/,
        /\bchevron[-_ ]?down\b/,
        /\barrow[-_ ]?down\b/,
        /\bnavigate[-_ ]?next\b/,
        /\bscroll[-_ ]?down\b/,
        /\badvance\b/,
        /\bforward\b/,
        /\bswiper-button-next\b/
      ];

      for (
        const pattern of goodPatterns
      ) {
        if (
          pattern.test(signature)
        ) {
          score += 25;
        }
      }

      if (
        /\bdown\b/.test(signature) &&
        !/\bdownload\b/.test(signature)
      ) {
        score += 12;
      }

      if (
        /\b(previous|prev|back|up|close|delete|download)\b/
          .test(signature)
      ) {
        score -= 40;
      }
    }

    if (action === 'close') {
      const goodPatterns = [
        /\bclose\b/,
        /\bdismiss\b/,
        /\bmodal[-_ ]?close\b/,
        /\bviewer[-_ ]?close\b/,
        /\bexit\b/,
        /\bxmark\b/,
        /\btimes\b/
      ];

      for (
        const pattern of goodPatterns
      ) {
        if (
          pattern.test(signature)
        ) {
          score += 25;
        }
      }

      if (
        /\b(next|previous|prev|download|share|like)\b/
          .test(signature)
      ) {
        score -= 35;
      }
    }

    const control =
      normalizeControl(element);

    if (
      control?.tagName === 'BUTTON'
    ) {
      score += 4;
    }

    if (
      control?.getAttribute?.(
        'role'
      ) === 'button'
    ) {
      score += 3;
    }

    if (
      isVisibleControl(control)
    ) {
      score += 4;
    } else {
      score -= 100;
    }

    return score;
  }
    function findSemanticControl(
    doc,
    action
  ) {
    const selectors =
      action === 'next'
        ? [
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

    const candidates = [];

    for (
      const selector of selectors
    ) {
      for (
        const element of
        queryAllDeep(
          doc,
          selector
        )
      ) {
        const control =
          normalizeControl(element);

        if (
          control &&
          isVisibleControl(control)
        ) {
          candidates.push(
            control
          );
        }
      }
    }

    if (candidates.length) {
      candidates.sort(
        (a, b) =>
          scoreControl(b, action) -
          scoreControl(a, action)
      );

      return candidates[0];
    }

    const generic =
      queryAllDeep(
        doc,
        [
          'button',
          'a[href]',
          '[role="button"]',
          '[role="link"]',
          'input[type="button"]',
          'input[type="submit"]'
        ].join(',')
      ).filter(
        isVisibleControl
      );

    let best = null;

    let bestScore =
      action === 'next'
        ? 14
        : 18;

    for (
      const candidate of generic
    ) {
      const score =
        scoreControl(
          candidate,
          action
        );

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    debug(
      `Best ${action} candidate`,
      bestScore,
      best
    );

    return best;
  }

  function activateControl(control) {
    if (!control) {
      return false;
    }

    const normalized =
      normalizeControl(control);

    if (
      !normalized ||
      !isVisibleControl(normalized)
    ) {
      return false;
    }

    try {
      normalized.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'auto'
      });
    } catch (error) {}

    try {
      normalized.focus({
        preventScroll: true
      });
    } catch (error) {}

    try {
      normalized.click();

      debug(
        'Clicked xfree control:',
        normalized
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  function findBestScrollableElement(
    doc
  ) {
    const view =
      doc.defaultView || window;

    const normalScroller =
      doc.scrollingElement ||
      doc.documentElement ||
      doc.body;

    let best =
      normalScroller;

    let bestScore = -1;

    function score(element) {
      if (
        !element ||
        element.nodeType !== 1
      ) {
        return -1;
      }

      const height =
        element.clientHeight || 0;

      const scrollHeight =
        element.scrollHeight || 0;

      const extra =
        scrollHeight - height;

      if (
        height < 80 ||
        extra < 80
      ) {
        return -1;
      }

      let overflowY = '';

      try {
        overflowY =
          view.getComputedStyle(
            element
          ).overflowY;
      } catch (error) {}

      const overflowBonus =
        /auto|scroll|overlay/
          .test(overflowY)
          ? 1000000
          : 0;

      const area =
        Math.max(
          1,
          element.clientWidth || 1
        ) *
        height;

      return (
        overflowBonus +
        Math.min(extra, 1000000) +
        Math.min(area, 1000000)
      );
    }

    if (normalScroller) {
      bestScore =
        score(normalScroller);
    }

    let elements = [];

    try {
      elements =
        Array.from(
          doc.querySelectorAll(
            [
              'main',
              'section',
              'article',
              'div',
              'ul',
              '[role="main"]',
              '[role="feed"]',
              '[class*="feed" i]',
              '[class*="scroll" i]',
              '[class*="viewer" i]',
              '[class*="content" i]'
            ].join(',')
          )
        );
    } catch (error) {}

    for (
      const element of elements
    ) {
      const candidateScore =
        score(element);

      if (
        candidateScore > bestScore
      ) {
        bestScore =
          candidateScore;

        best =
          element;
      }
    }

    return best;
  }

  function scrollDocumentStep(doc) {
    const scroller =
      findBestScrollableElement(doc);

    if (!scroller) {
      return false;
    }

    const amount =
      Math.max(
        240,
        Math.floor(
          (
            scroller.clientHeight ||
            doc.defaultView?.innerHeight ||
            window.innerHeight
          ) * 0.9
        )
      );

    try {
      scroller.scrollBy({
        top: amount,
        left: 0,
        behavior: 'smooth'
      });
    } catch (error) {
      scroller.scrollTop +=
        amount;
    }

    debug(
      'Scrolled xfree element:',
      scroller
    );

    return true;
  }

  function tryActionAcrossAccessibleDocuments(
    action,
    allowScrollFallback = true
  ) {
    const docs =
      getAccessibleDocuments();

    for (const doc of docs) {
      const control =
        findSemanticControl(
          doc,
          action
        );

      if (
        activateControl(control)
      ) {
        return true;
      }
    }

    if (
      action === 'next' &&
      allowScrollFallback
    ) {
      for (const doc of docs) {
        if (
          scrollDocumentStep(doc)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function broadcastNavigationToFrames(
    action
  ) {
    let sent = false;

    let frames = [];

    try {
      frames =
        Array.from(
          document.querySelectorAll(
            'iframe, frame'
          )
        );
    } catch (error) {
      return false;
    }

    for (const frame of frames) {
      let allowed = false;

      try {
        const src =
          frame.getAttribute('src') || '';

        if (
          !src ||
          src === 'about:blank'
        ) {
          allowed = true;
        } else {
          const url =
            new URL(
              src,
              location.href
            );

          allowed =
            isXfreeHostname(
              url.hostname
            );
        }
      } catch (error) {}

      if (!allowed) {
        continue;
      }

      try {
        frame.contentWindow
          ?.postMessage(
            {
              marker:
                NAV_MESSAGE_MARKER,
              action
            },
            '*'
          );

        sent = true;
      } catch (error) {}
    }

    return sent;
  }

  function registerFrameNavigationBridge() {
    window.addEventListener(
      'message',
      event => {
        const data =
          event.data;

        if (
          !data ||
          data.marker !==
            NAV_MESSAGE_MARKER
        ) {
          return;
        }

        if (
          !['next', 'close']
            .includes(data.action)
        ) {
          return;
        }

        const fromParent =
          event.source ===
            window.parent ||
          event.source ===
            window.top;

        if (!fromParent) {
          return;
        }

        let handled =
          tryActionAcrossAccessibleDocuments(
            data.action,
            data.action === 'next'
          );

        if (!handled) {
          handled =
            broadcastNavigationToFrames(
              data.action
            );
        }

        try {
          event.source?.postMessage(
            {
              marker:
                NAV_MESSAGE_MARKER,
              type: 'result',
              action: data.action,
              handled
            },
            '*'
          );
        } catch (error) {}
      }
    );
  }

  function triggerScrollStep() {
    // First try a real Next / Down button.
    if (
      tryActionAcrossAccessibleDocuments(
        'next',
        false
      )
    ) {
      return true;
    }

    // Then tell xfree subdomain frames
    // to navigate themselves.
    if (
      broadcastNavigationToFrames(
        'next'
      )
    ) {
      return true;
    }

    // Final fallback: find the actual
    // scrollable viewer/feed.
    for (
      const doc of
      getAccessibleDocuments()
    ) {
      if (
        scrollDocumentStep(doc)
      ) {
        return true;
      }
    }

    console.warn(
      '[RedFabber] Could not find next control or scrollable xfree viewer.'
    );

    return false;
  }

  function closeCurrentView() {
    if (
      tryActionAcrossAccessibleDocuments(
        'close',
        false
      )
    ) {
      return true;
    }

    if (
      broadcastNavigationToFrames(
        'close'
      )
    ) {
      return true;
    }

    return false;
  }

  function getPauseUntil() {
    return (
      Number(
        localStorage.getItem(
          'redfabber_scroll_pause_until'
        )
      ) || 0
    );
  }

  function isScrollPaused() {
    return (
      Date.now() <
      getPauseUntil()
    );
  }

  function attachManualScrollReset(
    callback
  ) {
    const handler =
      () => callback();

    for (
      const doc of
      getAccessibleDocuments()
    ) {
      try {
        doc.addEventListener(
          'wheel',
          handler,
          { passive: true }
        );

        doc.addEventListener(
          'touchmove',
          handler,
          { passive: true }
        );

        doc.addEventListener(
          'keydown',
          event => {
            const keys = [
              'ArrowDown',
              'ArrowUp',
              'PageDown',
              'PageUp',
              'Space',
              'Home',
              'End'
            ];

            if (
              keys.includes(
                event.code
              ) ||
              keys.includes(
                event.key
              )
            ) {
              handler();
            }
          }
        );
      } catch (error) {}
    }
  }
    function finishSession() {
    if (
      localStorage.getItem(
        STORAGE_KEYS.endingHandled
      ) === 'true'
    ) {
      return;
    }

    localStorage.setItem(
      STORAGE_KEYS.endingHandled,
      'true'
    );

    const postRunSeconds =
      Number(
        localStorage.getItem(
          STORAGE_KEYS.postRunSeconds
        )
      ) || 0;

    const closeTab =
      localStorage.getItem(
        STORAGE_KEYS.closeTabAfterSession
      ) === 'true';

    const finish = () => {
      clearSessionState();
      removeRunningToast();

      if (
        postRunSeconds <= 0
      ) {
        createPanel();
        return;
      }

      if (closeTab) {
        window.close();

        window.setTimeout(() => {
          if (!window.closed) {
            closeCurrentView();
            createPanel();
          }
        }, 500);

        return;
      }

      closeCurrentView();
      createPanel();
    };

    if (
      postRunSeconds <= 0
    ) {
      finish();
      return;
    }

    const postRunEndsAt =
      Date.now() +
      postRunSeconds * 1000;

    const label =
      document.querySelector(
        '#redfabber-session-toast span'
      );

    if (label) {
      label.innerHTML =
        `Post-run · <strong id="rf-remaining">${formatPostRunTime(
          postRunEndsAt - Date.now()
        )}</strong>`;
    }

    const token =
      sessionRuntimeToken;

    const interval =
      window.setInterval(() => {
        if (
          token !==
          sessionRuntimeToken
        ) {
          clearInterval(interval);
          return;
        }

        const remaining =
          Math.max(
            0,
            postRunEndsAt -
              Date.now()
          );

        const element =
          document.getElementById(
            'rf-remaining'
          );

        if (element) {
          element.textContent =
            formatPostRunTime(
              remaining
            );
        }

        if (
          remaining <= 0
        ) {
          clearInterval(interval);
        }
      }, 250);

    window.setTimeout(() => {
      if (
        token !==
        sessionRuntimeToken
      ) {
        return;
      }

      finish();
    }, postRunSeconds * 1000);
  }

  function startSessionWatcher() {
    const runtimeToken =
      sessionRuntimeToken;

    let lastScrollAt =
      Date.now();

    attachManualScrollReset(
      () => {
        lastScrollAt =
          Date.now();
      }
    );

    const interval =
      window.setInterval(() => {
        if (
          runtimeToken !==
          sessionRuntimeToken
        ) {
          clearInterval(interval);
          return;
        }

        if (!isSessionActive()) {
          clearInterval(interval);
          finishSession();
          return;
        }

        const hideTimer =
          localStorage.getItem(
            STORAGE_KEYS.hideTimer
          ) === 'true';

        const remainingElement =
          document.getElementById(
            'rf-remaining'
          );

        if (
          !hideTimer &&
          remainingElement
        ) {
          remainingElement.textContent =
            formatTime(
              getRemainingMs()
            );
        }

        const scrollSeconds =
          Number(
            localStorage.getItem(
              'redfabber_scroll_seconds'
            )
          ) ||
          DEFAULTS.scrollSeconds;

        const remainingMs =
          getRemainingMs();

        const countdownDuration =
          Number(
            localStorage.getItem(
              STORAGE_KEYS
                .countdownDurationSeconds
            )
          ) || 0;

        const countdownPlayed =
          localStorage.getItem(
            STORAGE_KEYS.countdownPlayed
          ) === 'true';

        if (
          countdownDuration > 0 &&
          !countdownPlayed &&
          remainingMs <=
            countdownDuration * 1000
        ) {
          playCountdownSound();
        }

        const pauseButton =
          document.getElementById(
            'rf-pause-scroll'
          );

        if (
          pauseButton &&
          isScrollPaused()
        ) {
          const secondsLeft =
            Math.ceil(
              (
                getPauseUntil() -
                Date.now()
              ) / 1000
            );

          pauseButton.textContent =
            `${secondsLeft}s`;
        } else if (pauseButton) {
          pauseButton.textContent =
            'Pause 10s';
        }

        const autoScroll =
          localStorage.getItem(
            STORAGE_KEYS.autoScrollEnabled
          ) !== 'false';

        if (
          autoScroll &&
          !isScrollPaused() &&
          Date.now() -
            lastScrollAt >=
            scrollSeconds * 1000
        ) {
          triggerScrollStep();

          lastScrollAt =
            Date.now();
        }
      }, 1000);
  }

  function getXfreeDiagnostics() {
    const docs =
      getAccessibleDocuments();

    return {
      url:
        location.href,

      hostname:
        location.hostname,

      isTopFrame:
        window.top === window.self,

      accessibleDocuments:
        docs.length,

      iframeCount:
        document.querySelectorAll(
          'iframe, frame'
        ).length,

      nextControl:
        findSemanticControl(
          document,
          'next'
        ),

      closeControl:
        findSemanticControl(
          document,
          'close'
        ),

      scrollableElement:
        findBestScrollableElement(
          document
        ),

      monitorState:
        getXtoysMonitorState()
    };
  }

  // Console test commands:
  //
  // rfnext()
  // rfclose()
  // rfdiag()
  // fapstop()

  window.rfnext =
    triggerScrollStep;

  window.rfclose =
    closeCurrentView;

  window.rfdiag =
    getXfreeDiagnostics;

  registerFrameNavigationBridge();

  function init() {
    /*
     * The userscript also runs inside matching
     * xfree subdomain frames so the parent page
     * can tell a cross-origin xfree viewer to
     * perform Next/Close locally.
     *
     * Only the top page gets the RedFabber UI.
     */
    if (
      window.top !== window.self
    ) {
      debug(
        'xfree frame bridge active:',
        location.href
      );

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

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init
    );
  } else {
    init();
  }
})();