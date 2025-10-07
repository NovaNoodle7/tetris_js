document.addEventListener('DOMContentLoaded', () => {
    const COLS = 10;
    const ROWS = 20;
    const GRAVITY_MS = 800;
    const LOCK_DELAY_MS = 500;

    // DOM elements
    const board1 = document.getElementById('board1');
    const board2 = document.getElementById('board2');
    const gameModeSelect = document.getElementById('gameMode');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const restartBtn = document.getElementById('restartBtn');
    const difficultySelect = document.getElementById('difficultySelect');
    const score1Elem = document.getElementById('score1');
    const score2Elem = document.getElementById('score2');
    const holdPreview1 = document.getElementById('holdPreview1');
    const holdPreview2 = document.getElementById('holdPreview2');
    const nextTop1 = document.getElementById('nextTop1');
    const nextTop2 = document.getElementById('nextTop2');

    let gameRunning = false;
    let isPaused = false;
    let mode = 'pvp';
    let difficulty = 'easy';

    // Tetromino definitions and colors
    const TETROMINOES = {
        I: { color: '#6ef3ff', shapes: [
            [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
            [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
            [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
            [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]
        ]},
        O: { color: '#ffdf6e', shapes: [
            [[1,1],[1,1]], [[1,1],[1,1]], [[1,1],[1,1]], [[1,1],[1,1]]
        ]},
        T: { color: '#fe8fff', shapes: [
            [[0,1,0],[1,1,1],[0,0,0]],
            [[0,1,0],[0,1,1],[0,1,0]],
            [[0,0,0],[1,1,1],[0,1,0]],
            [[0,1,0],[1,1,0],[0,1,0]]
        ]},
        S: { color: '#7dff83', shapes: [
            [[0,1,1],[1,1,0],[0,0,0]],
            [[0,1,0],[0,1,1],[0,0,1]],
            [[0,0,0],[0,1,1],[1,1,0]],
            [[1,0,0],[1,1,0],[0,1,0]]
        ]},
        Z: { color: '#ff7d7d', shapes: [
            [[1,1,0],[0,1,1],[0,0,0]],
            [[0,0,1],[0,1,1],[0,1,0]],
            [[0,0,0],[1,1,0],[0,1,1]],
            [[0,1,0],[1,1,0],[1,0,0]]
        ]},
        J: { color: '#7aa0ff', shapes: [
            [[1,0,0],[1,1,1],[0,0,0]],
            [[0,1,1],[0,1,0],[0,1,0]],
            [[0,0,0],[1,1,1],[0,0,1]],
            [[0,1,0],[0,1,0],[1,1,0]]
        ]},
        L: { color: '#ffb36e', shapes: [
            [[0,0,1],[1,1,1],[0,0,0]],
            [[0,1,0],[0,1,0],[0,1,1]],
            [[0,0,0],[1,1,1],[1,0,0]],
            [[1,1,0],[0,1,0],[0,1,0]]
        ]}
    };

    const SRS_KICKS = {
        // Wall kicks for J,L,S,T,Z (not I)
        JLSTZ: {
            '0>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
            '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
            '1>2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
            '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
            '2>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
            '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
            '3>0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
            '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]]
        },
        I: {
            '0>1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
            '1>0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
            '1>2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
            '2>1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
            '2>3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
            '3>2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
            '3>0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
            '0>3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
        }
    };

    function createBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    }

    function forEachCell(shape, fn) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) fn(r, c);
            }
        }
    }

    function canPlace(board, piece, px, py, rot) {
        const shape = piece.shapeAt(rot);
        let ok = true;
        forEachCell(shape, (r, c) => {
            const x = px + c;
            const y = py + r;
            if (x < 0 || x >= COLS || y >= ROWS) ok = false;
            else if (y >= 0 && board[y][x]) ok = false;
        });
        return ok;
    }

    function hardDropY(board, piece) {
        let y = piece.y;
        while (canPlace(board, piece, piece.x, y + 1, piece.r)) y++;
        return y;
    }

    function mergePiece(board, piece) {
        const shape = piece.shapeAt();
        forEachCell(shape, (r, c) => {
            const x = piece.x + c;
            const y = piece.y + r;
            if (y >= 0) board[y][x] = piece.color;
        });
    }

    function clearLines(board) {
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r].every(v => v)) {
                board.splice(r, 1);
                board.unshift(Array(COLS).fill(null));
                cleared++;
                r++;
            }
        }
        return cleared;
    }

    function scoreForLines(lines) {
        return [0, 100, 300, 500, 800][lines] || 0;
    }

    // Bag randomizer
    function* bagGenerator() {
        while (true) {
            const bag = Object.keys(TETROMINOES);
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
            for (const id of bag) yield id;
        }
    }

    function createPiece(id) {
        const def = TETROMINOES[id];
        const piece = {
            id,
            r: 0,
            x: 3,
            y: -2,
            color: def.color,
            shapeAt(rot = null) {
                const rr = (rot === null ? this.r : rot) % 4;
                return def.shapes[rr];
            }
        };
        if (id === 'O') { piece.x = 4; }
        if (id === 'I') { piece.y = -1; piece.x = 3; }
        return piece;
    }

    function tryRotate(board, piece, dir) {
        const from = piece.r;
        const to = (piece.r + dir + 4) % 4;
        const group = piece.id === 'I' ? 'I' : 'JLSTZ';
        const key = `${from}>${to}`;
        const kicks = (SRS_KICKS[group][key]) || [[0,0]];
        for (const [dx, dy] of kicks) {
            if (canPlace(board, piece, piece.x + dx, piece.y + dy, to)) {
                piece.x += dx;
                piece.y += dy;
                piece.r = to;
                return true;
            }
        }
        return false;
    }

    function renderBoard(board, boardElem, activePiece = null, ghostY = null) {
        boardElem.innerHTML = '';
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const div = document.createElement('div');
                const color = board[r][c];
                if (color) {
                    div.style.background = `linear-gradient(180deg, ${color}, #0b0b12)`;
                    div.style.boxShadow = 'inset 0 0 10px rgba(0,0,0,0.6)';
                }
                boardElem.appendChild(div);
            }
        }
        if (activePiece) {
            const shape = activePiece.shapeAt();
            forEachCell(shape, (rr, cc) => {
                const x = activePiece.x + cc;
                const y = activePiece.y + rr;
                if (y >= 0) {
                    const idx = y * COLS + x;
                    const cell = boardElem.children[idx];
                    if (cell) {
                        cell.style.background = `linear-gradient(180deg, ${activePiece.color}, #0b0b12)`;
                        cell.style.boxShadow = '0 0 14px rgba(122,252,255,0.25), inset 0 0 10px rgba(0,0,0,0.6)';
                    }
                }
            });
        }
        if (ghostY !== null && activePiece) {
            const shape = activePiece.shapeAt();
            forEachCell(shape, (rr, cc) => {
                const x = activePiece.x + cc;
                const y = ghostY + rr;
                if (y >= 0) {
                    const idx = y * COLS + x;
                    const cell = boardElem.children[idx];
                    if (cell && (!cell.style.background || cell.style.background === '')) {
                        cell.style.outline = '1px dashed rgba(255,255,255,0.15)';
                    }
                }
            });
        }
    }

    function renderPreview(container, ids) {
        if (!container) return;
        container.innerHTML = '';
        ids.slice(0, 3).forEach(id => {
            const box = document.createElement('div');
            box.style.display = 'inline-block';
            box.style.width = '92px';
            box.style.height = '92px';
            box.style.marginRight = '8px';
            box.style.verticalAlign = 'top';
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(4, 20px)';
            grid.style.gridTemplateRows = 'repeat(4, 20px)';
            grid.style.gap = '2px';
            const def = TETROMINOES[id];
            const shape = def.shapes[0];
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    const cell = document.createElement('div');
                    cell.style.width = '20px';
                    cell.style.height = '20px';
                    cell.style.background = (shape[r] && shape[r][c]) ? def.color : 'transparent';
                    grid.appendChild(cell);
                }
            }
            box.appendChild(grid);
            container.appendChild(box);
        });
    }

    function renderHold(container, id) {
        if (!container) return;
        container.innerHTML = '';
        if (!id) return;
        renderPreview(container, [id]);
    }

    function renderNextOnBoard(container, id) {
        if (!container) return;
        container.innerHTML = '';
        if (!id) return;
        const def = TETROMINOES[id];
        const shape = def.shapes[0];
        const inner = document.createElement('div');
        inner.style.display = 'grid';
        inner.style.gridTemplateColumns = 'repeat(4, 20px)';
        inner.style.gridTemplateRows = 'repeat(4, 20px)';
        inner.style.gap = '2px';
        inner.style.transform = 'scale(0.6)';
        inner.style.transformOrigin = 'center';
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const cell = document.createElement('div');
                cell.style.width = '20px';
                cell.style.height = '20px';
                cell.style.background = (shape[r] && shape[r][c]) ? def.color : 'transparent';
                inner.appendChild(cell);
            }
        }
        container.appendChild(inner);
    }

    function createPlayer() {
        return {
            board: createBoard(),
            gen: bagGenerator(),
            queue: [],
            current: null,
            hold: null,
            holdUsed: false,
            score: 0,
            gravityTimer: 0,
			lockTimer: null,
			garbageQueue: 0
        };
    }

    const player1 = createPlayer();
    const player2 = createPlayer();

    // Simple bot controller for player2 in Vs Bot mode
    const bot = {
        active: false,
        targetX: null,
        targetR: null,
        decided: false,
        moveTimer: 0,
        dropTimer: 0
    };

    function evaluateBoard(board) {
        // Heuristic: lower aggregate height, fewer holes, less bumpiness
        const heights = Array(COLS).fill(0);
        let holes = 0;
        for (let c = 0; c < COLS; c++) {
            let found = false;
            for (let r = 0; r < ROWS; r++) {
                if (board[r][c]) { if (!found) { heights[c] = ROWS - r; found = true; } }
                else if (found) { holes++; }
            }
        }
        let aggregateHeight = heights.reduce((a,b)=>a+b,0);
        let bumpiness = 0;
        for (let c = 0; c < COLS-1; c++) bumpiness += Math.abs(heights[c]-heights[c+1]);
        return {score: (-0.5*aggregateHeight) + (-1.0*holes) + (-0.3*bumpiness)};
    }

    function simulatePlacement(board, piece, x, r) {
        const test = { ...piece, x, r, shapeAt: piece.shapeAt };
        if (!canPlace(board, test, test.x, test.y, test.r)) return { ok:false, value: -Infinity };
        const y = hardDropY(board, test);
        test.y = y;
        const clone = board.map(row => row.slice());
        mergePiece(clone, test);
        const cleared = clearLines(clone);
        const evalScore = evaluateBoard(clone).score + cleared * 1.5;
        return { ok:true, value: evalScore, y };
    }

    function decideBotMove(player) {
        if (!player.current) return;
        let best = { value: -Infinity, x: player.current.x, r: player.current.r };
        for (let r = 0; r < 4; r++) {
            for (let x = -2; x < COLS; x++) {
                const result = simulatePlacement(player.board, player.current, x, r);
                if (result.ok && result.value > best.value) best = { value: result.value, x, r };
            }
        }
        bot.targetX = best.x;
        bot.targetR = best.r;
        bot.decided = true;
    }

    function runBot(dt) {
        if (!bot.active || mode !== 'vsBot' || !player2.current) return;
        const speedFactor = difficulty === 'hard' ? 0.5 : difficulty === 'medium' ? 1 : 1.5;
        bot.moveTimer += dt;
        bot.dropTimer += dt;
        if (!bot.decided) decideBotMove(player2);
        const moveInterval = 70 * speedFactor;
        const dropInterval = 120 * speedFactor;
        if (player2.current.r !== bot.targetR) {
            if (bot.moveTimer >= moveInterval) {
                tryRotate(player2.board, player2.current, +1);
                bot.moveTimer = 0;
            }
            return;
        }
        if (player2.current.x !== bot.targetX) {
            if (bot.moveTimer >= moveInterval) {
                if (player2.current.x < bot.targetX) move(player2, 'right');
                else move(player2, 'left');
                bot.moveTimer = 0;
            }
        } else {
            if (bot.dropTimer >= dropInterval) {
                // Medium/Hard soft drop, Easy occasional hard drop
                if (difficulty === 'easy') {
                    if (Math.random() < 0.2) hardDrop(player2); else if (!softDrop(player2)) startLock(player2);
                } else if (difficulty === 'medium') {
                    if (!softDrop(player2)) startLock(player2);
                } else {
                    hardDrop(player2);
                }
                bot.dropTimer = 0;
            }
        }
    }

    function ensureQueue(player) {
        while (player.queue.length < 5) {
            player.queue.push(player.gen.next().value);
        }
    }

    function spawn(player) {
        ensureQueue(player);
        const id = player.queue.shift();
        player.current = createPiece(id);
        player.holdUsed = false;
        if (!canPlace(player.board, player.current, player.current.x, player.current.y, player.current.r)) {
            gameOver();
        }
        if (player === player2) { bot.decided = false; }
    }

    function holdPiece(player) {
        if (player.holdUsed || !player.current) return;
        const swap = player.hold;
        player.hold = player.current.id;
        player.holdUsed = true;
        if (swap) {
            player.current = createPiece(swap);
        } else {
            spawn(player);
        }
    }

    function softDrop(player) {
        if (!player.current) return false;
        if (canPlace(player.board, player.current, player.current.x, player.current.y + 1, player.current.r)) {
            player.current.y++;
            return true;
        } else {
            return false;
        }
    }

    function hardDrop(player) {
        if (!player.current) return;
        player.current.y = hardDropY(player.board, player.current);
        lockPiece(player);
    }

    function move(player, dir) {
        if (!player.current) return;
        const dx = dir === 'left' ? -1 : 1;
        if (canPlace(player.board, player.current, player.current.x + dx, player.current.y, player.current.r)) {
            player.current.x += dx;
        }
    }

    function rotate(player, dir) {
        if (!player.current) return;
        tryRotate(player.board, player.current, dir);
    }

    function tickGravity(player, dt) {
        player.gravityTimer += dt;
        const step = GRAVITY_MS;
        while (player.gravityTimer >= step) {
            player.gravityTimer -= step;
            if (!softDrop(player)) startLock(player);
        }
    }

    function startLock(player) {
        if (player.lockTimer !== null) return;
        player.lockTimer = 0;
    }

    function progressLock(player, dt) {
        if (player.lockTimer === null) return;
        player.lockTimer += dt;
        if (player.lockTimer >= LOCK_DELAY_MS) {
            lockPiece(player);
        }
    }

    function lockPiece(player) {
        if (!player.current) return;
        mergePiece(player.board, player.current);
        const cleared = clearLines(player.board);
        if (cleared > 0) player.score += scoreForLines(cleared);
		// Send garbage to opponent if cleared >= 2
		if (cleared >= 2) {
			const opp = (player === player1) ? player2 : player1;
			sendGarbageImmediate(opp, cleared);
		}
        player.current = null;
        player.lockTimer = null;
		spawn(player);
    }

	function sendGarbageImmediate(opponent, n) {
		for (let i = 0; i < n; i++) {
			const hole = Math.floor(Math.random() * COLS);
			opponent.board.shift();
			const row = new Array(COLS).fill('#2e2e3a');
			row[hole] = null;
			opponent.board.push(row);
		}
		// Force next piece for opponent immediately
		ensureQueue(opponent);
		const id = opponent.queue.shift();
		opponent.current = createPiece(id);
		opponent.holdUsed = false;
		opponent.lockTimer = null;
		opponent.gravityTimer = 0;
		if (!canPlace(opponent.board, opponent.current, opponent.current.x, opponent.current.y, opponent.current.r)) {
			gameOver();
		}
	}

    // Rendering and loop
    let lastTs = 0;
    function loop(ts) {
        if (!gameRunning) return;
        if (lastTs === 0) lastTs = ts;
        const dt = ts - lastTs;
        lastTs = ts;
        if (!isPaused) {
            tickGravity(player1, dt);
            tickGravity(player2, dt);
            progressLock(player1, dt);
            progressLock(player2, dt);
            runBot(dt);

            const ghost1 = player1.current ? hardDropY(player1.board, player1.current) : null;
            const ghost2 = player2.current ? hardDropY(player2.board, player2.current) : null;

            renderBoard(player1.board, board1, player1.current, ghost1);
            renderBoard(player2.board, board2, player2.current, ghost2);
            score1Elem.textContent = player1.score;
            score2Elem.textContent = player2.score;
            ensureQueue(player1);
            ensureQueue(player2);
            renderNextOnBoard(nextTop1, player1.queue[0]);
            renderNextOnBoard(nextTop2, player2.queue[0]);
            renderHold(holdPreview1, player1.hold);
            renderHold(holdPreview2, player2.hold);
        }
        // no canvas animations
        requestAnimationFrame(loop);
    }

    function startGame() {
        if (gameRunning) return;
        player1.board = createBoard();
        player2.board = createBoard();
        player1.queue = [];
        player2.queue = [];
        player1.score = 0;
        player2.score = 0;
        player1.current = null;
        player2.current = null;
		player1.hold = null; player1.holdUsed = false; player1.garbageQueue = 0;
		player2.hold = null; player2.holdUsed = false; player2.garbageQueue = 0;
        ensureQueue(player1); ensureQueue(player2);
        spawn(player1); spawn(player2);
        isPaused = false;
        gameRunning = true;
        lastTs = 0;
        bot.active = (mode === 'vsBot');
        requestAnimationFrame(loop);
    }

    function pauseGame() {
        isPaused = !isPaused;
    }

    function restartGame() {
        gameRunning = false;
        lastTs = 0;
        startGame();
    }

    function gameOver() {
        gameRunning = false;
        alert('Game Over');
    }

    // Input handling
    function handleKeyDown(e) {
        if (!gameRunning || isPaused) return;
        const key = e.key;
        // Player 1
        if (key === 'a') move(player1, 'left');
        else if (key === 'd') move(player1, 'right');
        else if (key === 'w') { if (!softDrop(player1)) startLock(player1); }
        else if (key === 's') rotate(player1, +1);
        else if (key === ' ') { hardDrop(player1); e.preventDefault(); }
        else if (key === 'Shift') holdPiece(player1);
        // Player 2
        if (mode === 'pvp') {
            if (key === 'ArrowLeft') move(player2, 'left');
            else if (key === 'ArrowRight') move(player2, 'right');
            else if (key === 'ArrowUp') { if (!softDrop(player2)) startLock(player2); }
            else if (key === 'ArrowDown') rotate(player2, +1);
            else if (key === 'Enter') hardDrop(player2);
            else if (key === 'Control') holdPiece(player2);
        }
    }

    function handleModeChange(e) {
        mode = e.target.value;
        difficultySelect.disabled = mode === 'pvp';
        bot.active = (mode === 'vsBot');
    }

    function handleDifficultyChange(e) {
        difficulty = e.target.value;
    }

    startBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', pauseGame);
    restartBtn.addEventListener('click', restartGame);
    gameModeSelect.addEventListener('change', handleModeChange);
    difficultySelect.addEventListener('change', handleDifficultyChange);
    window.addEventListener('keydown', handleKeyDown);

    // Initial render
    renderBoard(player1.board, board1);
    renderBoard(player2.board, board2);
});
