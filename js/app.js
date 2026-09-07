/**
 * app.js
 * -----------------------------------------------------------------------
 * The controller/orchestrator. This is the only module that knows about
 * BOTH the game engine/AI and the UI — it wires them together and owns
 * the game loop's state machine:
 *
 *   PLAYER_TURN -> (valid move) -> check win/tie -> AI_TURN
 *   AI_TURN     -> (AI move)    -> check win/tie -> PLAYER_TURN
 *   any turn    -> (win/tie)    -> GAME_OVER
 *
 * Invalid moves (clicking a taken cell, clicking during the AI's turn, or
 * clicking after the game has ended) are rejected before they ever reach
 * the game engine.
 *
 * It also owns several small pieces of persistent/cross-round state:
 *   - `scores` and `skinIndex`, mirrored to localStorage so they survive
 *     a page refresh (sound's own mute preference is persisted inside
 *     effects.js instead, since that's its own self-contained concern).
 *   - `firstPlayer`, the user's choice of who opens the next round.
 *   - `elapsedSeconds`, a live per-round stopwatch shown in the header.
 * -----------------------------------------------------------------------
 */
const App = (() => {
  const HUMAN_PLAYER = 'X';
  const AI_PLAYER = 'O';
  const AI_THINK_DELAY_MS = 400; // small delay so the AI's move feels intentional, not instant
  const SCORES_STORAGE_KEY = 'tic-tac-toe-scores';
  const SKIN_STORAGE_KEY = 'tic-tac-toe-skin';

  // Symbol sets the "Skin" button in the footer cycles through. Only the
  // glyphs change — the underlying board still stores plain 'X'/'O', so
  // win detection and every other rule in gameEngine.js is untouched.
  const SKINS = [
    { id: 'classic', x: 'X', o: 'O' },
    { id: 'shapes', x: '✕', o: '○' },
    { id: 'animals', x: '🐱', o: '🐶' },
    { id: 'elements', x: '🔥', o: '💧' },
    { id: 'space', x: '🌙', o: '☀️' }
  ];

  // Explicit state machine values, rather than loose booleans, so it's
  // always clear which phase the game is in and impossible to be in two
  // phases at once.
  const State = {
    PLAYER_TURN: 'PLAYER_TURN',
    AI_TURN: 'AI_TURN',
    GAME_OVER: 'GAME_OVER'
  };

  let board = GameEngine.createBoard();
  let currentState = State.PLAYER_TURN;
  let firstPlayer = HUMAN_PLAYER; // who opens the *next* round; changeable via the toggle
  let scores = loadScores();
  let skinIndex = loadSkinIndex();

  // Bumped every time a new round starts. The AI's "thinking" delay is
  // asynchronous (setTimeout), so if the player mashes "Play Again" (or
  // flips the first-player toggle) while the AI is mid-think, a stale
  // callback could land on a board that's already been reset. Each
  // takeAiTurn() call captures the round id at the moment it starts, and
  // its callback checks it's still current before touching shared state.
  let roundId = 0;

  // Simple per-round stopwatch: starts at 0 when a round begins, ticks
  // once a second, and stops the instant the round ends.
  let elapsedSeconds = 0;
  let timerIntervalId = null;

  function init() {
    UI.init({
      onCellClick: handleCellClick,
      onRestart: startRound,
      onFirstPlayerChange: handleFirstPlayerChange,
      onToggleMute: handleToggleMute,
      onCycleSkin: handleCycleSkin
    });
    UI.renderScoreboard(scores);
    UI.setFirstPlayerSelection(firstPlayer === AI_PLAYER ? 'ai' : 'human');
    UI.applySkin(SKINS[skinIndex]);
    UI.setMuted(Effects.isMuted());
    document.addEventListener('keydown', handleKeyDown);
    startRound();
  }

  /** Handles a click on a board cell — the only entry point for player moves. */
  function handleCellClick(index) {
    // Guard against every kind of invalid move.
    if (currentState !== State.PLAYER_TURN) return; // not the player's turn
    if (board[index] !== null) return;               // cell already taken

    board = GameEngine.makeMove(board, index, HUMAN_PLAYER);
    Effects.playMove(HUMAN_PLAYER);
    render();

    const status = GameEngine.getGameStatus(board);
    if (status.status !== 'in-progress') {
      endGame(status);
      return;
    }

    takeAiTurn();
  }

  /** Runs the AI's turn: lock the board, "think", move, then hand control back. */
  function takeAiTurn() {
    currentState = State.AI_TURN;
    UI.setBoardInteractive(false);
    UI.setStatus('Computer is thinking…');

    const thisRound = roundId;

    setTimeout(() => {
      if (thisRound !== roundId) return; // a new round started while we were "thinking" — discard

      const move = AI.getBestMove(board, AI_PLAYER, HUMAN_PLAYER);
      board = GameEngine.makeMove(board, move, AI_PLAYER);
      Effects.playMove(AI_PLAYER);
      render();

      const status = GameEngine.getGameStatus(board);
      if (status.status !== 'in-progress') {
        endGame(status);
        return;
      }

      currentState = State.PLAYER_TURN;
      UI.setBoardInteractive(true);
      UI.setStatus('Your turn (X)');
    }, AI_THINK_DELAY_MS);
  }

  /** Transitions to GAME_OVER, shows the result, celebrates, and records it on the scoreboard. */
  function endGame(status) {
    currentState = State.GAME_OVER;
    UI.setBoardInteractive(false);
    stopTimer();

    if (status.status === 'win') {
      UI.highlightWinningLine(status.line);
      if (status.winner === HUMAN_PLAYER) {
        scores.player += 1;
        UI.setStatus('You win! 🎉');
        Effects.playWin();
        Effects.confettiBurst(getAccentRgb('--accent-x-rgb', '34, 224, 255'));
      } else {
        scores.ai += 1;
        UI.setStatus('Computer wins!');
        Effects.playLose();
        Effects.confettiBurst(getAccentRgb('--accent-o-rgb', '255, 95, 129'));
      }
    } else {
      scores.ties += 1;
      UI.setStatus("It's a tie!");
      Effects.playTie();
    }

    saveScores(scores);
    UI.renderScoreboard(scores);
  }

  /**
   * Clears the board for a new round (used for the initial load, the
   * "Play Again" button, and whenever the first-player choice changes)
   * without ever touching the scoreboard. If the AI is set to open the
   * round, it moves immediately.
   */
  function startRound() {
    board = GameEngine.createBoard();
    roundId += 1;
    UI.clearHighlights();
    render();
    startTimer();

    if (firstPlayer === AI_PLAYER) {
      takeAiTurn();
    } else {
      currentState = State.PLAYER_TURN;
      UI.setBoardInteractive(true);
      UI.setStatus('Your turn (X)');
    }
  }

  /** Applies the user's "who goes first" choice and starts a fresh round with it. */
  function handleFirstPlayerChange(player) {
    firstPlayer = player === 'ai' ? AI_PLAYER : HUMAN_PLAYER;
    UI.setFirstPlayerSelection(player);
    startRound();
  }

  /** Cycles to the next symbol skin and redraws anything already on the board with it. */
  function handleCycleSkin() {
    skinIndex = (skinIndex + 1) % SKINS.length;
    saveSkinIndex(skinIndex);
    UI.applySkin(SKINS[skinIndex]);
    render();
  }

  /** Flips the mute preference and reflects it on the speaker icon. */
  function handleToggleMute() {
    const nextMuted = !Effects.isMuted();
    Effects.setMuted(nextMuted);
    UI.setMuted(nextMuted);
  }

  /**
   * Keyboard shortcuts: digits 1-9 play the matching cell (in reading
   * order, top-left to bottom-right — same order as the board renders),
   * and R restarts the round. Cells are native <button>s, so Tab/arrow
   * focus plus Enter/Space already work for free without any code here.
   */
  function handleKeyDown(event) {
    if (event.key >= '1' && event.key <= '9') {
      handleCellClick(Number(event.key) - 1);
      return;
    }

    if (event.key === 'r' || event.key === 'R') {
      startRound();
    }
  }

  /** Formats a whole number of seconds as "MM:SS". */
  function formatElapsed(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  /** Resets and (re)starts the per-round stopwatch shown in the header. */
  function startTimer() {
    stopTimer();
    elapsedSeconds = 0;
    UI.setTimer(formatElapsed(elapsedSeconds));
    timerIntervalId = setInterval(() => {
      elapsedSeconds += 1;
      UI.setTimer(formatElapsed(elapsedSeconds));
    }, 1000);
  }

  /** Stops the stopwatch, if running. Safe to call even when it isn't. */
  function stopTimer() {
    if (timerIntervalId !== null) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  /**
   * Reads a CSS custom property (e.g. an "-rgb" triplet) straight from the
   * stylesheet, so confetti colors always stay in sync with the theme
   * instead of duplicating hex/rgb values between CSS and JS.
   */
  function getAccentRgb(cssVariableName, fallback) {
    try {
      const value = getComputedStyle(document.documentElement).getPropertyValue(cssVariableName).trim();
      return value || fallback;
    } catch (error) {
      return fallback;
    }
  }

  /** Reads saved scores from localStorage, tolerating missing/corrupt/unavailable storage. */
  function loadScores() {
    try {
      const raw = localStorage.getItem(SCORES_STORAGE_KEY);
      if (!raw) return { player: 0, ai: 0, ties: 0 };

      const parsed = JSON.parse(raw);
      return {
        player: Number.isFinite(parsed.player) ? parsed.player : 0,
        ai: Number.isFinite(parsed.ai) ? parsed.ai : 0,
        ties: Number.isFinite(parsed.ties) ? parsed.ties : 0
      };
    } catch (error) {
      // Corrupted JSON or storage disabled (e.g. private browsing) — start fresh rather than crash.
      return { player: 0, ai: 0, ties: 0 };
    }
  }

  /** Persists scores to localStorage; silently no-ops if storage isn't available. */
  function saveScores(currentScores) {
    try {
      localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(currentScores));
    } catch (error) {
      // Storage full/blocked — the game still works, scores just won't survive a refresh.
    }
  }

  /** Reads the saved skin index, tolerating missing/corrupt/unavailable/out-of-range values. */
  function loadSkinIndex() {
    try {
      const index = Number(localStorage.getItem(SKIN_STORAGE_KEY));
      return Number.isInteger(index) && index >= 0 && index < SKINS.length ? index : 0;
    } catch (error) {
      return 0;
    }
  }

  /** Persists the selected skin index; silently no-ops if storage isn't available. */
  function saveSkinIndex(index) {
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, String(index));
    } catch (error) {
      // Storage full/blocked — the choice just won't survive a refresh.
    }
  }

  function render() {
    UI.renderBoard(board);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
