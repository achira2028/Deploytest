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
 * It also owns two small pieces of persistent/cross-round state:
 *   - `scores`, mirrored to localStorage so wins/losses/ties survive a
 *     page refresh.
 *   - `firstPlayer`, the user's choice of who opens the next round.
 * -----------------------------------------------------------------------
 */
const App = (() => {
  const HUMAN_PLAYER = 'X';
  const AI_PLAYER = 'O';
  const AI_THINK_DELAY_MS = 400; // small delay so the AI's move feels intentional, not instant
  const SCORES_STORAGE_KEY = 'tic-tac-toe-scores';

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

  // Bumped every time a new round starts. The AI's "thinking" delay is
  // asynchronous (setTimeout), so if the player mashes "Play Again" (or
  // flips the first-player toggle) while the AI is mid-think, a stale
  // callback could land on a board that's already been reset. Each
  // takeAiTurn() call captures the round id at the moment it starts, and
  // its callback checks it's still current before touching shared state.
  let roundId = 0;

  function init() {
    UI.init({
      onCellClick: handleCellClick,
      onRestart: startRound,
      onFirstPlayerChange: handleFirstPlayerChange
    });
    UI.renderScoreboard(scores);
    UI.setFirstPlayerSelection(firstPlayer === AI_PLAYER ? 'ai' : 'human');
    startRound();
  }

  /** Handles a click on a board cell — the only entry point for player moves. */
  function handleCellClick(index) {
    // Guard against every kind of invalid move.
    if (currentState !== State.PLAYER_TURN) return; // not the player's turn
    if (board[index] !== null) return;               // cell already taken

    board = GameEngine.makeMove(board, index, HUMAN_PLAYER);
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

  /** Transitions to GAME_OVER, shows the result, and records it on the scoreboard. */
  function endGame(status) {
    currentState = State.GAME_OVER;
    UI.setBoardInteractive(false);

    if (status.status === 'win') {
      UI.highlightWinningLine(status.line);
      if (status.winner === HUMAN_PLAYER) {
        scores.player += 1;
        UI.setStatus('You win! 🎉');
      } else {
        scores.ai += 1;
        UI.setStatus('Computer wins!');
      }
    } else {
      scores.ties += 1;
      UI.setStatus("It's a tie!");
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

  function render() {
    UI.renderBoard(board);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
