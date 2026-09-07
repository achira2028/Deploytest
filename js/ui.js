/**
 * ui.js
 * -----------------------------------------------------------------------
 * The ONLY module allowed to touch the DOM. It knows nothing about game
 * rules or AI strategy — it just renders whatever state it's given and
 * reports raw user interactions (which cell was clicked, restart pressed,
 * first-player choice changed) back to the caller via callbacks.
 *
 * This separation means app.js can be tested/reasoned about without a
 * browser, and this file could be swapped out entirely (e.g. for a
 * canvas-based or React renderer) without touching game logic.
 * -----------------------------------------------------------------------
 */
const UI = (() => {
  let cellElements = [];
  let statusElement = null;
  let restartButton = null;
  let scoreElements = {};
  let firstPlayerButtons = {};

  /**
   * Wires up DOM references and event listeners once at startup.
   * @param {Object} handlers
   * @param {(index: number) => void} handlers.onCellClick
   * @param {() => void} handlers.onRestart
   * @param {(player: 'human' | 'ai') => void} handlers.onFirstPlayerChange
   */
  function init({ onCellClick, onRestart, onFirstPlayerChange }) {
    cellElements = Array.from(document.querySelectorAll('.cell'));
    statusElement = document.getElementById('status');
    restartButton = document.getElementById('restart-btn');

    scoreElements = {
      player: document.getElementById('score-player'),
      ai: document.getElementById('score-ai'),
      ties: document.getElementById('score-ties')
    };

    firstPlayerButtons = {
      human: document.getElementById('first-player-human'),
      ai: document.getElementById('first-player-ai')
    };

    cellElements.forEach((cell) => {
      cell.addEventListener('click', () => {
        const index = Number(cell.dataset.index);
        onCellClick(index);
      });
    });

    restartButton.addEventListener('click', onRestart);

    Object.entries(firstPlayerButtons).forEach(([player, button]) => {
      button.addEventListener('click', () => onFirstPlayerChange(player));
    });
  }

  /** Redraws all 9 cells to match the given board array. */
  function renderBoard(board) {
    board.forEach((value, index) => {
      const cell = cellElements[index];
      cell.textContent = value ?? '';
      cell.classList.toggle('x', value === 'X');
      cell.classList.toggle('o', value === 'O');
      cell.classList.toggle('taken', value !== null);
    });
  }

  /** Updates the status line (e.g. "Your turn", "Computer wins!"). */
  function setStatus(message) {
    statusElement.textContent = message;
  }

  /**
   * Adds the `.winning` class to the three cells that formed a winning
   * line — a visually distinct highlight (see .cell.winning in style.css).
   */
  function highlightWinningLine(line) {
    if (!line) return;
    line.forEach((index) => cellElements[index].classList.add('winning'));
  }

  /** Clears any winning-line highlight, used when starting a new round. */
  function clearHighlights() {
    cellElements.forEach((cell) => cell.classList.remove('winning'));
  }

  /**
   * Enables/disables click handling on the board. Used to lock the board
   * while the AI is "thinking" or after the game has ended, preventing
   * the player from queuing up invalid moves.
   */
  function setBoardInteractive(interactive) {
    cellElements.forEach((cell) => {
      cell.disabled = !interactive;
    });
  }

  /** Updates the three scoreboard tallies. */
  function renderScoreboard({ player, ai, ties }) {
    scoreElements.player.textContent = player;
    scoreElements.ai.textContent = ai;
    scoreElements.ties.textContent = ties;
  }

  /** Reflects which "first move" option is currently selected. */
  function setFirstPlayerSelection(player) {
    Object.entries(firstPlayerButtons).forEach(([key, button]) => {
      const isActive = key === player;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  return {
    init,
    renderBoard,
    setStatus,
    highlightWinningLine,
    clearHighlights,
    setBoardInteractive,
    renderScoreboard,
    setFirstPlayerSelection
  };
})();
