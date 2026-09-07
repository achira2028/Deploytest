/**
 * ai.js
 * -----------------------------------------------------------------------
 * The computer opponent, implemented with the Minimax algorithm.
 * Depends only on GameEngine (for board rules) — it has no idea the DOM
 * exists. This separation means the AI can be unit-tested by simply
 * calling AI.getBestMove(board, 'O', 'X') on a plain array.
 *
 * WHY MINIMAX IS UNBEATABLE:
 * Tic-Tac-Toe is a small, fully-observable, zero-sum game. Minimax
 * recursively plays out EVERY possible sequence of remaining moves to
 * the end of the game, assuming both players always pick their best
 * possible move. Because it exhaustively searches the entire game tree
 * (at most 9! = 362,880 board states, trivial for a computer), it never
 * misses a winning or blocking move — the AI can therefore only win or
 * draw, never lose.
 * -----------------------------------------------------------------------
 */
const AI = (() => {
  // Scores from the AI's perspective. A win is good (+10), a loss is bad
  // (-10), a tie is neutral (0).
  const SCORE_WIN = 10;
  const SCORE_LOSE = -10;
  const SCORE_TIE = 0;

  /**
   * Recursively scores a board position.
   *
   * @param {Array} board          Current hypothetical board.
   * @param {number} depth         How many moves deep this branch is from
   *                                the real current position. Used to make
   *                                the AI prefer FASTER wins and SLOWER
   *                                losses (see scoring note below).
   * @param {boolean} isMaximizing True when it's the AI's simulated turn
   *                                (trying to maximize the score), false
   *                                when it's the human's simulated turn
   *                                (trying to minimize the score).
   * @param {string} aiPlayer      Mark used by the AI, e.g. 'O'.
   * @param {string} humanPlayer   Mark used by the human, e.g. 'X'.
   * @returns {number} The score of this board from the AI's perspective.
   */
  function minimax(board, depth, isMaximizing, aiPlayer, humanPlayer) {
    const status = GameEngine.getGameStatus(board);

    // --- Base cases: the recursion bottoms out at a finished game ---
    if (status.status === 'win') {
      // Subtracting/adding `depth` biases the AI toward winning as soon
      // as possible and delaying a loss as long as possible, even though
      // every path from a "perfect" opponent still ends in a tie.
      return status.winner === aiPlayer ? SCORE_WIN - depth : SCORE_LOSE + depth;
    }
    if (status.status === 'tie') {
      return SCORE_TIE;
    }

    const availableMoves = GameEngine.getAvailableMoves(board);

    if (isMaximizing) {
      // AI's simulated turn: try every open cell, keep the highest score.
      let bestScore = -Infinity;
      for (const move of availableMoves) {
        const nextBoard = GameEngine.makeMove(board, move, aiPlayer);
        const score = minimax(nextBoard, depth + 1, false, aiPlayer, humanPlayer);
        bestScore = Math.max(bestScore, score);
      }
      return bestScore;
    } else {
      // Human's simulated turn: assume they play optimally AGAINST the AI,
      // i.e. they pick whatever minimizes the AI's score.
      let bestScore = Infinity;
      for (const move of availableMoves) {
        const nextBoard = GameEngine.makeMove(board, move, humanPlayer);
        const score = minimax(nextBoard, depth + 1, true, aiPlayer, humanPlayer);
        bestScore = Math.min(bestScore, score);
      }
      return bestScore;
    }
  }

  /**
   * Picks the AI's move for the given board: tries every legal move,
   * scores the resulting position with minimax, and returns the move
   * with the highest score (ties broken by move order).
   */
  function getBestMove(board, aiPlayer, humanPlayer) {
    const availableMoves = GameEngine.getAvailableMoves(board);

    // Minor optimization: on a completely empty board every first move is
    // equivalent by symmetry, so skip the (still-fast, but unnecessary)
    // full-tree search and just take a corner.
    if (availableMoves.length === 9) {
      return 0;
    }

    let bestScore = -Infinity;
    let bestMove = availableMoves[0];

    for (const move of availableMoves) {
      const nextBoard = GameEngine.makeMove(board, move, aiPlayer);
      // depth starts at 0 for the move being evaluated; the next ply
      // (the human's reply) is the human's simulated turn, hence `false`.
      const score = minimax(nextBoard, 0, false, aiPlayer, humanPlayer);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  return { getBestMove };
})();
