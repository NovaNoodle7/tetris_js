const COLS = 10, ROWS = 20;
const EMPTY = 0;
const SCORE_TABLE = { 1: 100, 2: 300, 3: 500, 4: 800 };
const COLORS = { I: 'cI', O: 'cO', T: 'cT', S: 'cS', Z: 'cZ', J: 'cJ', L: 'cL' };

// Game state management
let gameMode = 'menu'; // 'menu', 'single', 'vs'
let humanGame = null;
let botGame = null;
let gameStatus = 'ready'; // 'ready', 'playing', 'paused', 'gameOver'

// Game mode selection
document.getElementById('single-player-btn').onclick = () => {
    gameMode = 'single';
    showGameArea('single-player-mode');
};

document.getElementById('vs-bot-btn').onclick = () => {
    gameMode = 'vs';
    showGameArea('vs-mode');
    initializeVSGame();
};

document.getElementById('back-to-menu').onclick = () => {
    gameMode = 'menu';
    showGameArea('mode-selection');
    stopAllGames();
};

function showGameArea(mode) {
    document.getElementById('mode-selection').style.display = 'none';
    document.getElementById('single-player-mode').style.display = 'none';
    document.getElementById('vs-mode').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
    document.getElementById(mode).style.display = 'block';
}

// Tetris Game Class
class TetrisGame {
    constructor(boardId, nextBoardId, scoreId, levelId, linesId) {
        this.boardId = boardId;
        this.nextBoardId = nextBoardId;
        this.scoreId = scoreId;
        this.levelId = levelId;
        this.linesId = linesId;
        
        this.board = this.createInitGameBoard();
        this.bag = [];
        this.cur = null;
        this.nextPiece = null;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = 800;
        this.timer = null;
        this.paused = false;
        this.gameOver = false;
        this.isBot = false;
        
        this.buildBoardDOM();
        this.buildNextDOM();
        this.updateStats();
    }

    createInitGameBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
    }

    makeNewBag() {
        const shuffledShape = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        for (let i = shuffledShape.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [shuffledShape[i], shuffledShape[j]] = [shuffledShape[j], shuffledShape[i]];
        }
        this.bag = shuffledShape;
    }

    spawn() {
        if (this.bag.length === 0) this.makeNewBag();
        const TYPE = this.nextPiece ?? this.bag.pop();

        this.cur = { type: TYPE, x: 3, y: 0, r: 0 };

        if (this.bag.length === 0) this.makeNewBag();
        this.nextPiece = this.bag.pop();

        if (!this.canPlace(this.cur.type, this.cur.x, this.cur.y, this.cur.r)) {
            this.gameOver = true;
            this.stop();
            return false;
        }
        this.drawShapeToNextPieceBoard();
        return true;
    }

    drawShapeToNextPieceBoard() {
        const type = this.nextPiece;
        const shape = SHAPES[type][0];
        this.drawNextStepShape(this.nextBoardId, shape, COLORS[type], shape[0].length, shape.length);
    }

    drawNextStepShape(nextBoardId, shape, colorClass, gridW, gridH) {
        const nextBoard = document.getElementById(nextBoardId);
        const cells = nextBoard.children;
        for (let i = 0; i < gridW * gridH; i++) cells[i].className = 'next-cell';
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    const indexOfCell = y * gridW + x;
                    const cell = cells[indexOfCell];
                    if (cell) {
                        // Convert colorClass (cI, cO, etc.) to piece type (I, O, etc.)
                        const pieceType = colorClass.replace('c', '');
                        cell.className = `next-cell ${pieceType}`;
                    }
                }
            }
        }
    }

    shapeAtRotate(type, r) {
        return SHAPES[type][r % SHAPES[type].length];
    }

    rotateCW() {
        if (this.gameOver || this.paused) return;
        const nr = (this.cur.r + 1) % SHAPES[this.cur.type].length;
        const kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0]];
        for (const [kx, ky] of kicks) {
            if (this.canPlace(this.cur.type, this.cur.x + kx, this.cur.y + ky, nr)) {
                this.cur.r = nr;
                this.cur.x += kx;
                this.cur.y += ky;
                this.render();
                return;
            }
        }
    }

    canPlace(type, x, y, r) {
        let shape = this.shapeAtRotate(type, r);
        for (let sy = 0; sy < shape.length; sy++) {
            for (let sx = 0; sx < shape[sy].length; sx++) {
                if (!shape[sy][sx]) continue;
                const nx = x + sx, ny = y + sy;
                if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return false;
                if (this.board[ny][nx] !== EMPTY) return false;
            }
        }
        return true;
    }

    lockPiece() {
        const s = this.shapeAtRotate(this.cur.type, this.cur.r);
        for (let sy = 0; sy < s.length; sy++) {
            for (let sx = 0; sx < s[sy].length; sx++) {
                if (!s[sy][sx]) continue;
                const nx = this.cur.x + sx, ny = this.cur.y + sy;
                if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
                    this.board[ny][nx] = this.cur.type;
                }
            }
        }
        const cleared = this.clearLines();
        if (cleared > 0) {
            this.score += SCORE_TABLE[cleared] || 0;
            this.lines += cleared;

            const newLevel = Math.floor(this.lines / 10) + 1;
            if (newLevel !== this.level) {
                this.level = newLevel;
                this.dropInterval = Math.max(120, 800 - (this.level - 1) * 60);
                this.restartLoopIfRunning();
            }
            this.updateStats();
        }
        return this.spawn();
    }

    clearLines() {
        let cleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (this.board[y].every(value => value !== EMPTY)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(COLS).fill(EMPTY));
                cleared++;
                y++;
            }
        }
        return cleared;
    }

    tick() {
        if (this.paused || this.gameOver) return;
        if (!this.move(0, 1)) {
            if (!this.lockPiece()) {
                // Game over
                this.gameOver = true;
                this.stop();
                return false;
            }
        }
        return true;
    }

    move(dx, dy) {
        if (this.gameOver || this.paused) return;
        const nx = this.cur.x + dx, ny = this.cur.y + dy;
        if (this.canPlace(this.cur.type, nx, ny, this.cur.r)) {
            this.cur.x = nx;
            this.cur.y = ny;
            this.render();
            return true;
        }
        return false;
    }

    hardDrop() {
        if (this.gameOver || this.paused) return;
        while (this.move(0, 1)) { }
        return this.lockPiece();
    }

    togglePause() {
        if (this.paused) {
            this.paused = false;
            this.restartLoopIfRunning();
        } else {
            this.paused = true;
            this.stop();
        }
    }

    stop() {
        clearInterval(this.timer);
        this.timer = null;
    }

    restartLoopIfRunning() {
        this.stop();
        this.timer = setInterval(() => this.tick(), this.dropInterval);
    }

    reset() {
        this.stop();
        this.board = this.createInitGameBoard();
        this.bag = [];
        this.cur = null;
        this.nextPiece = null;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = 800;
        this.paused = false;
        this.gameOver = false;
        this.updateStats();
        this.buildBoardDOM();
        this.buildNextDOM();
    }

    start() {
        if (this.timer) return;
        if (!this.cur) {
            this.makeNewBag();
            this.spawn();
        }
        this.paused = false;
        this.gameOver = false;
        this.timer = setInterval(() => this.tick(), this.dropInterval);
    }

    updateStats() {
        document.getElementById(this.scoreId).textContent = this.score;
        document.getElementById(this.linesId).textContent = this.lines;
        document.getElementById(this.levelId).textContent = this.level;
    }

    buildBoardDOM() {
        const mainGameBoard = document.getElementById(this.boardId);
        mainGameBoard.innerHTML = '';
        for (let i = 0; i < ROWS * COLS; i++) {
            const d = document.createElement('div');
            d.className = 'cell';
            mainGameBoard.appendChild(d);
        }
    }

    buildNextDOM() {
        const nextBoard = document.getElementById(this.nextBoardId);
        nextBoard.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const d = document.createElement('div');
            d.className = 'next-cell';
            nextBoard.appendChild(d);
        }
    }

    render() {
        const mainGameBoard = document.getElementById(this.boardId);
        const cells = mainGameBoard.children;
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const idx = y * COLS + x;
                const el = cells[idx];
                const v = this.board[y][x];
                el.className = 'cell ' + (v ? COLORS[v] : '');
            }
        }
        if (this.cur) {
            const s = this.shapeAtRotate(this.cur.type, this.cur.r);
            for (let sy = 0; sy < s.length; sy++) {
                for (let sx = 0; sx < s[sy].length; sx++) {
                    if (!s[sy][sx]) continue;
                    const nx = this.cur.x + sx, ny = this.cur.y + sy;
                    if (ny >= 0) {
                        const idx = ny * COLS + nx;
                        const el = cells[idx];
                        if (el) el.classList.add(COLORS[this.cur.type]);
                    }
                }
            }
        }
    }

    // AI Bot Logic
    calculateBestMove() {
        if (!this.cur || this.gameOver) return null;

        let bestScore = -Infinity;
        let bestMove = null;
        const piece = this.cur.type;
        const rotations = SHAPES[piece].length;

        for (let rotation = 0; rotation < rotations; rotation++) {
            for (let x = 0; x < COLS; x++) {
                // Find the lowest valid Y position
                let y = 0;
                while (y < ROWS && this.canPlace(piece, x, y, rotation)) {
                    y++;
                }
                y--;

                if (y >= 0) {
                    const score = this.evaluatePosition(piece, x, y, rotation);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = { x, y, rotation };
                    }
                }
            }
        }

        return bestMove;
    }

    evaluatePosition(piece, x, y, rotation) {
        // Simulate placing the piece
        const tempBoard = this.board.map(row => [...row]);
        const shape = this.shapeAtRotate(piece, rotation);
        
        for (let sy = 0; sy < shape.length; sy++) {
            for (let sx = 0; sx < shape[sy].length; sx++) {
                if (shape[sy][sx]) {
                    const nx = x + sx, ny = y + sy;
                    if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
                        tempBoard[ny][nx] = piece;
                    }
                }
            }
        }

        // Calculate various factors
        const height = this.calculateHeight(tempBoard);
        const holes = this.calculateHoles(tempBoard);
        const lines = this.calculateLinesCleared(tempBoard);
        const bumpiness = this.calculateBumpiness(tempBoard);

        // Weighted scoring system
        return lines * 1000 - height * 0.5 - holes * 10 - bumpiness * 0.1;
    }

    calculateHeight(board) {
        let maxHeight = 0;
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                if (board[y][x] !== EMPTY) {
                    maxHeight = Math.max(maxHeight, ROWS - y);
                    break;
                }
            }
        }
        return maxHeight;
    }

    calculateHoles(board) {
        let holes = 0;
        for (let x = 0; x < COLS; x++) {
            let blockFound = false;
            for (let y = 0; y < ROWS; y++) {
                if (board[y][x] !== EMPTY) {
                    blockFound = true;
                } else if (blockFound) {
                    holes++;
                }
            }
        }
        return holes;
    }

    calculateLinesCleared(board) {
        let cleared = 0;
        for (let y = 0; y < ROWS; y++) {
            if (board[y].every(value => value !== EMPTY)) {
                cleared++;
            }
        }
        return cleared;
    }

    calculateBumpiness(board) {
        const heights = [];
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                if (board[y][x] !== EMPTY) {
                    heights.push(ROWS - y);
                    break;
                }
            }
        }
        
        let bumpiness = 0;
        for (let i = 1; i < heights.length; i++) {
            bumpiness += Math.abs(heights[i] - heights[i - 1]);
        }
        return bumpiness;
    }

    makeBotMove() {
        if (!this.isBot || this.gameOver || this.paused) return;

        const bestMove = this.calculateBestMove();
        if (!bestMove) return;

        // Move to the best position
        const targetX = bestMove.x;
        const targetRotation = bestMove.rotation;

        // Rotate to target rotation
        while (this.cur.r !== targetRotation) {
            this.rotateCW();
        }

        // Move to target X position
        while (this.cur.x !== targetX) {
            if (this.cur.x < targetX) {
                this.move(1, 0);
            } else {
                this.move(-1, 0);
            }
        }

        // Hard drop
        this.hardDrop();
    }
}

// Shape definitions
const rotBase = (mat3) => {
    const to4 = (shape) => {
        const topLine = [0, 0, 0, 0];
        return [
            [...topLine],
            [0, ...shape[0]],
            [0, ...shape[1]],
            [0, ...shape[2]],
        ];
    };
    const base = to4(mat3);

    const rotateshapt = (shape) => {
        const shapeRank = shape.length, output = Array.from({ length: shapeRank }, () => Array(shapeRank).fill(0));
        for (let y = 0; y < shapeRank; y++) for (let x = 0; x < shapeRank; x++) output[x][shapeRank - 1 - y] = shape[y][x];
        return output;
    };
    return [base, rotateshapt(base), rotateshapt(rotateshapt(base)), rotateshapt(rotateshapt(rotateshapt(base)))];
};

const SHAPES = {
    L: rotBase([[0, 0, 1], [1, 1, 1], [0, 0, 0]]),
    S: rotBase([[0, 1, 1], [1, 1, 0], [0, 0, 0]]),
    T: rotBase([[0, 1, 0], [1, 1, 1], [0, 0, 0]]),
    J: rotBase([[1, 0, 0], [1, 1, 1], [0, 0, 0]]),
    Z: rotBase([[1, 1, 0], [0, 1, 1], [0, 0, 0]]),
    O: [
        [[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
    ],
    I: [
        [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
        [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
        [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
    ]
};

// Initialize games
function initializeVSGame() {
    humanGame = new TetrisGame('human-board', 'human-next-board', 'human-score', 'human-level', 'human-lines');
    botGame = new TetrisGame('bot-board', 'bot-next-board', 'bot-score', 'bot-level', 'bot-lines');
    botGame.isBot = true;
    updateGameStatus('Ready to Start');
}

function stopAllGames() {
    if (humanGame) humanGame.stop();
    if (botGame) botGame.stop();
    humanGame = null;
    botGame = null;
}

function updateGameStatus(status) {
    document.getElementById('game-status').textContent = status;
}

// Event listeners
document.addEventListener('keydown', (e) => {
    if (gameMode === 'single' && humanGame) {
        handleSinglePlayerInput(e);
    } else if (gameMode === 'vs' && humanGame) {
        handleVSInput(e);
    }
});

function handleSinglePlayerInput(e) {
    if (humanGame.gameOver) return;
    switch (e.key) {
        case 'a': humanGame.move(-1, 0); break;
        case 'd': humanGame.move(1, 0); break;
        case 'f': humanGame.move(0, 1); break;
        case 's': humanGame.rotateCW(); break;
        case 'z': e.preventDefault(); humanGame.hardDrop(); break;
        case 'p': case 'P': humanGame.togglePause(); break;
        case 'r': case 'R': humanGame.reset(); humanGame.start(); break;
    }
}

function handleVSInput(e) {
    if (humanGame.gameOver) return;
    switch (e.key) {
        case 'a': humanGame.move(-1, 0); break;
        case 'd': humanGame.move(1, 0); break;
        case 'f': humanGame.move(0, 1); break;
        case 's': humanGame.rotateCW(); break;
        case 'z': e.preventDefault(); humanGame.hardDrop(); break;
        case 'p': case 'P': toggleVSPause(); break;
        case 'r': case 'R': resetVSGame(); break;
    }
}

// Single player controls
document.getElementById('startBtn').onclick = () => {
    if (!humanGame) {
        humanGame = new TetrisGame('game-board', 'nextPiece-board', 'score', 'level', 'lines');
    }
    if (!humanGame.cur) humanGame.reset();
    humanGame.start();
};

document.getElementById('pauseBtn').onclick = () => {
    if (humanGame) humanGame.togglePause();
};

document.getElementById('resetBtn').onclick = () => {
    if (humanGame) {
        humanGame.reset();
        humanGame.start();
    }
};

// VS mode controls
document.getElementById('vs-startBtn').onclick = () => {
    if (!humanGame || !botGame) return;
    humanGame.start();
    botGame.start();
    gameStatus = 'playing';
    updateGameStatus('Battle in Progress');
    
    // Start bot AI loop
    const botInterval = setInterval(() => {
        if (botGame.gameOver || humanGame.gameOver) {
            clearInterval(botInterval);
            checkWinner();
        } else if (!botGame.paused) {
            botGame.makeBotMove();
        }
    }, 200); // Bot makes a move every 200ms
};

document.getElementById('vs-pauseBtn').onclick = () => {
    toggleVSPause();
};

document.getElementById('vs-resetBtn').onclick = () => {
    resetVSGame();
};

function toggleVSPause() {
    if (!humanGame || !botGame) return;
    if (humanGame.paused && botGame.paused) {
        humanGame.togglePause();
        botGame.togglePause();
        updateGameStatus('Battle in Progress');
    } else {
        humanGame.togglePause();
        botGame.togglePause();
        updateGameStatus('Battle Paused');
    }
}

function resetVSGame() {
    if (humanGame) humanGame.reset();
    if (botGame) botGame.reset();
    updateGameStatus('Ready to Start');
}

function checkWinner() {
    if (humanGame.gameOver && botGame.gameOver) {
        if (humanGame.score > botGame.score) {
            updateGameStatus('Human Wins!');
        } else if (botGame.score > humanGame.score) {
            updateGameStatus('Bot Wins!');
        } else {
            updateGameStatus('Tie Game!');
        }
    } else if (humanGame.gameOver) {
        updateGameStatus('Bot Wins!');
    } else if (botGame.gameOver) {
        updateGameStatus('Human Wins!');
    }
}

// Initialize the game
// Game is initialized when mode is selected