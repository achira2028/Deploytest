/**
 * effects.js
 * -----------------------------------------------------------------------
 * Pure "juice" — sound effects and a win/loss confetti burst. Deliberately
 * isolated from ui.js so the core rendering module stays focused on the
 * board/HUD, and from app.js's game logic entirely: nothing here knows a
 * single rule of tic-tac-toe, it just makes noise and sparks on command.
 *
 * Sound is generated on the fly with the Web Audio API (short oscillator
 * tones) rather than loaded from audio files, so there are no external
 * assets to fetch or host. Every call here is wrapped so a failure (Web
 * Audio blocked, canvas unavailable, storage disabled) degrades silently
 * — the game must never break because a sound effect couldn't play.
 * -----------------------------------------------------------------------
 */
const Effects = (() => {
  const MUTED_STORAGE_KEY = 'tic-tac-toe-muted';

  let audioContext = null;
  let muted = loadMuted();

  /** Reads the saved mute preference, defaulting to unmuted if unavailable. */
  function loadMuted() {
    try {
      return localStorage.getItem(MUTED_STORAGE_KEY) === 'true';
    } catch (error) {
      return false;
    }
  }

  /** Persists the mute preference; silently no-ops if storage isn't available. */
  function saveMuted(value) {
    try {
      localStorage.setItem(MUTED_STORAGE_KEY, String(value));
    } catch (error) {
      // Storage unavailable — the toggle still works this session, just won't persist.
    }
  }

  /**
   * Lazily creates the AudioContext on first use (rather than at load
   * time) so its creation happens inside a real user-gesture call stack
   * — required by browsers' autoplay policies — since the first sound is
   * always triggered from a click handler.
   */
  function getAudioContext() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  }

  /** Plays one short synthesized tone. Frequency in Hz, duration in seconds. */
  function playTone(frequency, duration, waveform = 'sine', delay = 0) {
    if (muted) return;

    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = waveform;
      oscillator.frequency.value = frequency;

      const startTime = ctx.currentTime + delay;
      // Quick fade in/out avoids audible clicks at the start/end of the tone.
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.03);
    } catch (error) {
      // Web Audio unavailable/blocked — sound is a nice-to-have, never fatal.
    }
  }

  /** A short tactile blip each time a mark is placed — pitched slightly by mark. */
  function playMove(mark) {
    playTone(mark === 'X' ? 480 : 360, 0.08, 'triangle');
  }

  /** A bright ascending arpeggio for a win. */
  function playWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => playTone(freq, 0.18, 'triangle', i * 0.09));
  }

  /** A descending, lower-register phrase for a loss. */
  function playLose() {
    [392, 329.63, 261.63].forEach((freq, i) => playTone(freq, 0.22, 'sawtooth', i * 0.11));
  }

  /** A neutral two-note chime for a tie. */
  function playTie() {
    [392, 392].forEach((freq, i) => playTone(freq, 0.2, 'sine', i * 0.16));
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /**
   * A short, self-cleaning confetti burst from the center of the screen,
   * tinted with the given "r, g, b" string (matching a CSS -rgb variable).
   * Skips entirely under prefers-reduced-motion.
   */
  function confettiBurst(rgb) {
    if (prefersReducedMotion() || !rgb) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '999';
      document.body.appendChild(canvas);

      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        canvas.remove();
        return;
      }
      ctx.scale(dpr, dpr);

      const particles = Array.from({ length: 90 }, () => ({
        x: width / 2,
        y: height / 2,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 12 - 4,
        size: 4 + Math.random() * 5,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35
      }));

      const totalFrames = 100;
      let frame = 0;

      function tick() {
        frame += 1;
        ctx.clearRect(0, 0, width, height);

        const life = Math.max(0, 1 - frame / totalFrames);

        particles.forEach((particle) => {
          particle.vy += 0.35; // gravity
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.rotation += particle.spin;

          ctx.save();
          ctx.translate(particle.x, particle.y);
          ctx.rotate(particle.rotation);
          ctx.globalAlpha = life;
          ctx.fillStyle = `rgb(${rgb})`;
          ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.6);
          ctx.restore();
        });

        if (frame < totalFrames) {
          requestAnimationFrame(tick);
        } else {
          canvas.remove();
        }
      }

      requestAnimationFrame(tick);
    } catch (error) {
      // Canvas unavailable for some reason — confetti is decorative, never fatal.
    }
  }

  function isMuted() {
    return muted;
  }

  function setMuted(value) {
    muted = value;
    saveMuted(value);
  }

  return { playMove, playWin, playLose, playTie, confettiBurst, isMuted, setMuted };
})();
