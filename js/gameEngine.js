/**
 * gameEngine.js
 * -----------------------------------------------------------------------
 * Pure game-state logic for Tic-Tac-Toe. Contains NO DOM references and
 * NO AI logic — it only knows how to represent a board, apply moves, and
 * evaluate whether the game has been won or tied.
 *
 * Keeping this isolated means the same engine could power a CLI version,
 * a unit test suite, or the AI's lookahead search without ever touching
 * the browser.
 * -----------------------------------------------------------------------
 */
const GameEngine = (() => {
  // Every triple of board indices that counts as a winning line.
  const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  /** Returns a fresh 9-cell board, all cells empty (null). */
  function createBoard() {
    return Array(9).fill(null);
  }

  /** Indices of every empty cell on the given board. */
  function getAvailableMoves(board) {
    const moves = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i] === null) moves.push(i);
    }
    return moves;
  }

  /**
   * Returns a NEW board with `player` placed at `index`.
   * The board is never mutated in place — this keeps the minimax search
   * (which explores many hypothetical boards) simple and bug-free, since
   * every branch works on its own copy.
   */
  function makeMove(board, index, player) {
    const next = board.slice();
    next[index] = player;
    return next;
  }

  /**
   * Checks the board for a winner.
   * Returns { winner: 'X' | 'O', line: [a, b, c] } or null if no winner yet.
   */
  function checkWinner(board) {
    for (const line of WINNING_COMBINATIONS) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line };
      }
    }
    return null;
  }

  /** True if every cell is filled (used to detect a tie once no winner exists). */
  function isBoardFull(board) {
    return board.every((cell) => cell !== null);
  }

  /**
   * Single source of truth for "what state is the game in right now?"
   * Returns one of:
   *   { status: 'win', winner: 'X' | 'O', line: [a,b,c] }
   *   { status: 'tie' }
   *   { status: 'in-progress' }
   */
  function getGameStatus(board) {
    const result = checkWinner(board);
    if (result) return { status: 'win', winner: result.winner, line: result.line };
    if (isBoardFull(board)) return { status: 'tie' };
    return { status: 'in-progress' };
  }

  return {
    createBoard,
    getAvailableMoves,
    makeMove,
    checkWinner,
    isBoardFull,
    getGameStatus,
    WINNING_COMBINATIONS
  };
})();
