document.addEventListener('DOMContentLoaded', () => {
    // 초기 게임 상태
    const gameState = {
        board: initializeBoard(),
        currentPlayer: 'white',
        selectedPiece: null,
        possibleMoves: [],
        check: false,
        checkmate: false,
        stalemate: false,
        gameOver: false,
        // 캐슬링을 위한 상태 추가
        piecesMoved: {
            whiteKing: false,
            blackKing: false,
            whiteRookLeft: false,
            whiteRookRight: false,
            blackRookLeft: false,
            blackRookRight: false
        },
        // 앙파상을 위한 상태
        lastPawnDoubleMove: null,
        // 프로모션을 위한 상태
        pendingPromotion: null,
        // 50수 규칙을 위한 상태
        halfMoveCount: 0,
        moveHistory: []
    };

    const boardElement = document.getElementById('board');
    const statusElement = document.getElementById('status');
    const resetButton = document.getElementById('reset-btn');

    // 체스 보드 초기화
    function initializeBoard() {
        const board = Array(8).fill().map(() => Array(8).fill(null));
        
        // 폰(Pawns) 배치
        for (let i = 0; i < 8; i++) {
            board[1][i] = { type: 'pawn', color: 'black' };
            board[6][i] = { type: 'pawn', color: 'white' };
        }
        
        // 룩(Rooks) 배치
        board[0][0] = { type: 'rook', color: 'black' };
        board[0][7] = { type: 'rook', color: 'black' };
        board[7][0] = { type: 'rook', color: 'white' };
        board[7][7] = { type: 'rook', color: 'white' };
        
        // 나이트(Knights) 배치
        board[0][1] = { type: 'knight', color: 'black' };
        board[0][6] = { type: 'knight', color: 'black' };
        board[7][1] = { type: 'knight', color: 'white' };
        board[7][6] = { type: 'knight', color: 'white' };
        
        // 비숍(Bishops) 배치
        board[0][2] = { type: 'bishop', color: 'black' };
        board[0][5] = { type: 'bishop', color: 'black' };
        board[7][2] = { type: 'bishop', color: 'white' };
        board[7][5] = { type: 'bishop', color: 'white' };
        
        // 퀸(Queen) 배치
        board[0][3] = { type: 'queen', color: 'black' };
        board[7][3] = { type: 'queen', color: 'white' };
        
        // 킹(King) 배치
        board[0][4] = { type: 'king', color: 'black' };
        board[7][4] = { type: 'king', color: 'white' };
        
        return board;
    }

    // 보드 렌더링
    function renderBoard() {
        boardElement.innerHTML = '';
        
        // 프로모션 선택 UI가 필요한 경우
        if (gameState.pendingPromotion) {
            renderPromotionUI();
            return;
        }
        
        // 체스판 열 라벨 (a-h)
        const colLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
                square.dataset.row = 8 - row; // 체스판은 아래에서 위로 1-8
                square.dataset.col = colLabels[col]; // 체스판은 왼쪽에서 오른쪽으로 a-h
                
                const piece = gameState.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = 'piece';
                    pieceElement.innerHTML = getPieceSymbol(piece);
                    square.appendChild(pieceElement);
                }
                
                // 선택된 칸 하이라이트
                if (gameState.selectedPiece && gameState.selectedPiece.row === row && gameState.selectedPiece.col === col) {
                    square.classList.add('selected');
                }
                
                // 가능한 이동 위치 하이라이트
                if (gameState.possibleMoves.some(move => move.row === row && move.col === col)) {
                    square.classList.add('highlighted');
                }
                
                square.addEventListener('click', () => handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }
        
        // 게임 상태 업데이트
        updateStatus();
    }

    // 체스 말 기호 가져오기
    function getPieceSymbol(piece) {
        const symbols = {
            white: {
                king: '♔',
                queen: '♕',
                rook: '♖',
                bishop: '♗',
                knight: '♘',
                pawn: '♙'
            },
            black: {
                king: '♚',
                queen: '♛',
                rook: '♜',
                bishop: '♝',
                knight: '♞',
                pawn: '♟'
            }
        };
        
        return symbols[piece.color][piece.type];
    }

    // 프로모션 UI 렌더링
    function renderPromotionUI() {
        const { row, col, color } = gameState.pendingPromotion;
        
        // 보드를 가리는 오버레이 추가
        const overlay = document.createElement('div');
        overlay.className = 'promotion-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '100';
        
        // 프로모션 선택 컨테이너
        const container = document.createElement('div');
        container.className = 'promotion-container';
        container.style.backgroundColor = 'white';
        container.style.padding = '20px';
        container.style.borderRadius = '8px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        
        // 타이틀
        const title = document.createElement('h2');
        title.textContent = '폰 승급: 새로운 기물을 선택하세요';
        title.style.marginBottom = '15px';
        container.appendChild(title);
        
        // 프로모션 옵션 컨테이너
        const options = document.createElement('div');
        options.style.display = 'flex';
        options.style.justifyContent = 'center';
        options.style.gap = '15px';
        
        // 승급 가능한 말들
        const promotionPieces = ['queen', 'rook', 'bishop', 'knight'];
        
        promotionPieces.forEach(pieceType => {
            const piece = { type: pieceType, color };
            
            const option = document.createElement('div');
            option.className = 'promotion-option';
            option.style.width = '70px';
            option.style.height = '70px';
            option.style.display = 'flex';
            option.style.justifyContent = 'center';
            option.style.alignItems = 'center';
            option.style.fontSize = '50px';
            option.style.cursor = 'pointer';
            option.style.border = '2px solid #333';
            option.style.borderRadius = '4px';
            
            option.innerHTML = getPieceSymbol(piece);
            
            option.addEventListener('click', () => handlePromotion(pieceType));
            
            options.appendChild(option);
        });
        
        container.appendChild(options);
        overlay.appendChild(container);
        boardElement.appendChild(overlay);
    }

    // 프로모션 선택 처리
    function handlePromotion(pieceType) {
        const { row, col, color } = gameState.pendingPromotion;
        
        // 선택한 말로 폰 승급
        gameState.board[row][col] = { type: pieceType, color };
        
        // 프로모션 상태 초기화
        gameState.pendingPromotion = null;
        
        // 무브 히스토리에 현재 보드 상태 저장
        gameState.moveHistory.push(JSON.stringify(gameState.board));
        
        // 턴 변경
        gameState.currentPlayer = color === 'white' ? 'black' : 'white';
        
        // 체크 상태 확인
        gameState.check = isKingInCheck(gameState.board, gameState.currentPlayer);
        
        // 체크메이트 또는 스테일메이트 확인
        checkGameEndConditions();
        
        // 보드 다시 그리기
        renderBoard();
    }

    // 클릭 핸들러
    function handleSquareClick(row, col) {
        // 게임이 끝났으면 아무것도 할 수 없음
        if (gameState.gameOver) return;
        
        // 프로모션 선택 중이면 무시
        if (gameState.pendingPromotion) return;
        
        const clickedPiece = gameState.board[row][col];
        
        // 선택된 말이 없는 경우
        if (!gameState.selectedPiece) {
            // 빈 칸을 클릭하거나 상대 말을 클릭한 경우 무시
            if (!clickedPiece || clickedPiece.color !== gameState.currentPlayer) return;
            
            // 말 선택
            gameState.selectedPiece = { row, col, ...clickedPiece };
            gameState.possibleMoves = calculatePossibleMoves(row, col, clickedPiece);
            
            // 체크 상태에서는 체크를 피하는 움직임만 허용
            if (gameState.check) {
                gameState.possibleMoves = gameState.possibleMoves.filter(move => {
                    const testBoard = JSON.parse(JSON.stringify(gameState.board));
                    
                    // 테스트 이동 실행
                    testBoard[row][col] = null;
                    testBoard[move.row][move.col] = { ...clickedPiece };
                    
                    // 이동 후 여전히 체크 상태인지 확인
                    return !isKingInCheck(testBoard, gameState.currentPlayer);
                });
            }
            
            renderBoard();
            return;
        }
        
        // 이미 선택된 말이 있는 경우
        
        // 같은 색의 다른 말을 클릭한 경우
        if (clickedPiece && clickedPiece.color === gameState.currentPlayer) {
            gameState.selectedPiece = { row, col, ...clickedPiece };
            gameState.possibleMoves = calculatePossibleMoves(row, col, clickedPiece);
            
            // 체크 상태에서는 체크를 피하는 움직임만 허용
            if (gameState.check) {
                gameState.possibleMoves = gameState.possibleMoves.filter(move => {
                    const testBoard = JSON.parse(JSON.stringify(gameState.board));
                    
                    // 테스트 이동 실행
                    testBoard[row][col] = null;
                    testBoard[move.row][move.col] = { ...clickedPiece };
                    
                    // 이동 후 여전히 체크 상태인지 확인
                    return !isKingInCheck(testBoard, gameState.currentPlayer);
                });
            }
            
            renderBoard();
            return;
        }
        
        // 가능한 이동 위치인지 확인
        const moveIsPossible = gameState.possibleMoves.some(move => move.row === row && move.col === col);
        
        if (moveIsPossible) {
            // 말 이동
            const { row: fromRow, col: fromCol, type, color } = gameState.selectedPiece;
            
            // 기존 위치에서 말 제거
            const movingPiece = gameState.board[fromRow][fromCol];
            gameState.board[fromRow][fromCol] = null;
            
            // 캡쳐 여부 확인 (기물 갱신 또는 50수 규칙 용)
            const isCapture = gameState.board[row][col] !== null;
            
            // 캐슬링 여부 확인 및 처리
            let isCastling = false;
            
            if (type === 'king' && Math.abs(col - fromCol) === 2) {
                isCastling = true;
                
                // 룩의 위치 계산 및 이동
                const rookFromCol = col > fromCol ? 7 : 0;
                const rookToCol = col > fromCol ? col - 1 : col + 1;
                
                // 룩 이동
                const rook = gameState.board[fromRow][rookFromCol];
                gameState.board[fromRow][rookFromCol] = null;
                gameState.board[fromRow][rookToCol] = rook;
            }
            
            // 앙파상 확인 및 처리
            let isEnPassant = false;
            
            if (type === 'pawn' && Math.abs(col - fromCol) === 1 && !gameState.board[row][col]) {
                // 대각선 이동인데 목적지가 비어있으면 앙파상
                isEnPassant = true;
                
                // 옆에 있는 폰 제거 (앙파상으로 잡힘)
                gameState.board[fromRow][col] = null;
            }
            
            // 폰의 더블 무브 기록 (앙파상용)
            const isPawnDoubleMove = (type === 'pawn' && Math.abs(fromRow - row) === 2);
            
            // 앙파상 상태 업데이트
            gameState.lastPawnDoubleMove = isPawnDoubleMove ? { row, col, color } : null;
            
            // 50수 규칙 카운터 업데이트
            if (type === 'pawn' || isCapture || isEnPassant) {
                // 폰 이동이나 기물 잡힘이 있으면 카운터 리셋
                gameState.halfMoveCount = 0;
            } else {
                // 그 외에는 카운터 증가
                gameState.halfMoveCount++;
            }
            
            // 무브 히스토리에 현재 보드 상태 저장
            gameState.moveHistory.push(JSON.stringify(gameState.board));
            
            // 새 위치에 말 배치
            gameState.board[row][col] = movingPiece;
            
            // 폰이 마지막 줄에 도달하면 프로모션 대기 상태로 설정
            if (movingPiece.type === 'pawn') {
                if ((movingPiece.color === 'white' && row === 0) || 
                    (movingPiece.color === 'black' && row === 7)) {
                    
                    // 프로모션 상태 설정
                    gameState.pendingPromotion = { row, col, color: movingPiece.color };
                    
                    // 선택 초기화
                    gameState.selectedPiece = null;
                    gameState.possibleMoves = [];
                    
                    // 프로모션 UI 렌더링
                    renderBoard();
                    return;
                }
            }
            
            // 이동한 말 상태 업데이트 (캐슬링 권한 추적)
            updateMovedPiecesState(fromRow, fromCol, type, color);
            
            // 턴 변경
            gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
            
            // 선택 초기화
            gameState.selectedPiece = null;
            gameState.possibleMoves = [];
            
            // 체크 상태 확인
            gameState.check = isKingInCheck(gameState.board, gameState.currentPlayer);
            
            // 체크메이트 또는 스테일메이트 확인
            checkGameEndConditions();
            
            // 보드 다시 그리기
            renderBoard();
        } else {
            // 잘못된 이동 위치 선택 시 선택 취소
            gameState.selectedPiece = null;
            gameState.possibleMoves = [];
            renderBoard();
        }
    }

    // 이동한 말 상태 업데이트 (캐슬링 권한 추적)
    function updateMovedPiecesState(row, col, type, color) {
        if (type === 'king') {
            if (color === 'white') {
                gameState.piecesMoved.whiteKing = true;
            } else {
                gameState.piecesMoved.blackKing = true;
            }
        } else if (type === 'rook') {
            if (color === 'white') {
                if (col === 0) {
                    gameState.piecesMoved.whiteRookLeft = true;
                } else if (col === 7) {
                    gameState.piecesMoved.whiteRookRight = true;
                }
            } else {
                if (col === 0) {
                    gameState.piecesMoved.blackRookLeft = true;
                } else if (col === 7) {
                    gameState.piecesMoved.blackRookRight = true;
                }
            }
        }
    }

    // 가능한 이동 위치 계산
    function calculatePossibleMoves(row, col, piece) {
        const moves = [];
        
        switch (piece.type) {
            case 'pawn':
                calculatePawnMoves(row, col, piece.color, moves);
                break;
            case 'rook':
                calculateRookMoves(row, col, piece.color, moves);
                break;
            case 'knight':
                calculateKnightMoves(row, col, piece.color, moves);
                break;
            case 'bishop':
                calculateBishopMoves(row, col, piece.color, moves);
                break;
            case 'queen':
                calculateQueenMoves(row, col, piece.color, moves);
                break;
            case 'king':
                calculateKingMoves(row, col, piece.color, moves);
                break;
        }
        
        return moves;
    }

    // 폰 이동 계산
    function calculatePawnMoves(row, col, color, moves) {
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        
        // 한 칸 전진
        if (isInBounds(row + direction, col) && !gameState.board[row + direction][col]) {
            moves.push({ row: row + direction, col });
            
            // 두 칸 전진 (첫 이동)
            if (row === startRow && !gameState.board[row + 2 * direction][col]) {
                moves.push({ row: row + 2 * direction, col });
            }
        }
        
        // 대각선 공격 (왼쪽)
        if (isInBounds(row + direction, col - 1) && 
            gameState.board[row + direction][col - 1] && 
            gameState.board[row + direction][col - 1].color !== color) {
            moves.push({ row: row + direction, col: col - 1 });
        }
        
        // 대각선 공격 (오른쪽)
        if (isInBounds(row + direction, col + 1) && 
            gameState.board[row + direction][col + 1] && 
            gameState.board[row + direction][col + 1].color !== color) {
            moves.push({ row: row + direction, col: col + 1 });
        }
        
        // 앙파상 확인
        if (gameState.lastPawnDoubleMove) {
            const { row: lpRow, col: lpCol, color: lpColor } = gameState.lastPawnDoubleMove;
            
            // 상대 폰이 내 옆에 있고, 내가 5번째 줄(흰색) 또는 4번째 줄(검은색)에 있어야 함
            if (lpColor !== color && Math.abs(col - lpCol) === 1 && row === (color === 'white' ? 3 : 4)) {
                moves.push({ row: row + direction, col: lpCol });
            }
        }
    }

    // 룩 이동 계산
    function calculateRookMoves(row, col, color, moves) {
        // 상하좌우 이동
        const directions = [
            { row: -1, col: 0 }, // 위
            { row: 1, col: 0 },  // 아래
            { row: 0, col: -1 }, // 왼쪽
            { row: 0, col: 1 }   // 오른쪽
        ];
        
        for (const dir of directions) {
            let r = row + dir.row;
            let c = col + dir.col;
            
            while (isInBounds(r, c)) {
                if (!gameState.board[r][c]) {
                    // 빈 칸
                    moves.push({ row: r, col: c });
                } else {
                    // 다른 말이 있는 경우
                    if (gameState.board[r][c].color !== color) {
                        // 상대 말이면 잡을 수 있음
                        moves.push({ row: r, col: c });
                    }
                    break; // 더 이상 이동 불가
                }
                
                r += dir.row;
                c += dir.col;
            }
        }
    }

    // 나이트 이동 계산
    function calculateKnightMoves(row, col, color, moves) {
        const knightMoves = [
            { row: -2, col: -1 },
            { row: -2, col: 1 },
            { row: -1, col: -2 },
            { row: -1, col: 2 },
            { row: 1, col: -2 },
            { row: 1, col: 2 },
            { row: 2, col: -1 },
            { row: 2, col: 1 }
        ];
        
        for (const move of knightMoves) {
            const r = row + move.row;
            const c = col + move.col;
            
            if (isInBounds(r, c)) {
                if (!gameState.board[r][c] || gameState.board[r][c].color !== color) {
                    moves.push({ row: r, col: c });
                }
            }
        }
    }

    // 비숍 이동 계산
    function calculateBishopMoves(row, col, color, moves) {
        // 대각선 이동
        const directions = [
            { row: -1, col: -1 }, // 왼쪽 위
            { row: -1, col: 1 },  // 오른쪽 위
            { row: 1, col: -1 },  // 왼쪽 아래
            { row: 1, col: 1 }    // 오른쪽 아래
        ];
        
        for (const dir of directions) {
            let r = row + dir.row;
            let c = col + dir.col;
            
            while (isInBounds(r, c)) {
                if (!gameState.board[r][c]) {
                    // 빈 칸
                    moves.push({ row: r, col: c });
                } else {
                    // 다른 말이 있는 경우
                    if (gameState.board[r][c].color !== color) {
                        // 상대 말이면 잡을 수 있음
                        moves.push({ row: r, col: c });
                    }
                    break; // 더 이상 이동 불가
                }
                
                r += dir.row;
                c += dir.col;
            }
        }
    }

    // 퀸 이동 계산
    function calculateQueenMoves(row, col, color, moves) {
        // 룩 + 비숍의 이동을 합친 것
        calculateRookMoves(row, col, color, moves);
        calculateBishopMoves(row, col, color, moves);
    }

    // 킹 이동 계산
    function calculateKingMoves(row, col, color, moves) {
        const kingMoves = [
            { row: -1, col: -1 },
            { row: -1, col: 0 },
            { row: -1, col: 1 },
            { row: 0, col: -1 },
            { row: 0, col: 1 },
            { row: 1, col: -1 },
            { row: 1, col: 0 },
            { row: 1, col: 1 }
        ];
        
        for (const move of kingMoves) {
            const r = row + move.row;
            const c = col + move.col;
            
            if (isInBounds(r, c)) {
                if (!gameState.board[r][c] || gameState.board[r][c].color !== color) {
                    moves.push({ row: r, col: c });
                }
            }
        }
        
        // 캐슬링 확인
        const kingNotMoved = color === 'white' ? !gameState.piecesMoved.whiteKing : !gameState.piecesMoved.blackKing;
        
        if (kingNotMoved && !gameState.check) {
            // 킹사이드 캐슬링
            const rookRightNotMoved = color === 'white' ? !gameState.piecesMoved.whiteRookRight : !gameState.piecesMoved.blackRookRight;
            
            if (rookRightNotMoved) {
                const isPathClear = !gameState.board[row][col+1] && !gameState.board[row][col+2];
                const isPathSafe = !isSquareAttacked(row, col+1, color) && !isSquareAttacked(row, col+2, color);
                
                if (isPathClear && isPathSafe) {
                    moves.push({ row, col: col+2 });
                }
            }
            
            // 퀸사이드 캐슬링
            const rookLeftNotMoved = color === 'white' ? !gameState.piecesMoved.whiteRookLeft : !gameState.piecesMoved.blackRookLeft;
            
            if (rookLeftNotMoved) {
                const isPathClear = !gameState.board[row][col-1] && !gameState.board[row][col-2] && !gameState.board[row][col-3];
                const isPathSafe = !isSquareAttacked(row, col-1, color) && !isSquareAttacked(row, col-2, color);
                
                if (isPathClear && isPathSafe) {
                    moves.push({ row, col: col-2 });
                }
            }
        }
    }

    // 보드 범위 내에 있는지 확인
    function isInBounds(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    // 체크 상태 확인
    function isKingInCheck(board, color) {
        // 킹의 위치 찾기
        let kingRow = -1;
        let kingCol = -1;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    kingRow = row;
                    kingCol = col;
                    break;
                }
            }
            if (kingRow !== -1) break;
        }
        
        // 킹이 없으면 체크 아님 (게임 종료 상태일 것)
        if (kingRow === -1) return false;
        
        // 상대방의 색상
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        // 상대방의 모든 말 확인
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (!piece || piece.color !== opponentColor) continue;
                
                // 각 상대 말이 킹을 공격할 수 있는지 확인
                const moves = [];
                switch (piece.type) {
                    case 'pawn':
                        // 폰은 대각선으로만 공격
                        const direction = opponentColor === 'white' ? -1 : 1;
                        if ((kingRow === row + direction && kingCol === col - 1) || 
                            (kingRow === row + direction && kingCol === col + 1)) {
                            return true;
                        }
                        break;
                    case 'rook':
                        calculateRookMoves(row, col, opponentColor, moves);
                        break;
                    case 'knight':
                        calculateKnightMoves(row, col, opponentColor, moves);
                        break;
                    case 'bishop':
                        calculateBishopMoves(row, col, opponentColor, moves);
                        break;
                    case 'queen':
                        calculateQueenMoves(row, col, opponentColor, moves);
                        break;
                    case 'king':
                        // 킹은 인접한 위치만 공격
                        calculateKingMoves(row, col, opponentColor, moves);
                        break;
                }
                
                // 계산된 이동 위치 중 킹의 위치가 있는지 확인
                if (moves.some(move => move.row === kingRow && move.col === kingCol)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // 특정 칸이 공격받고 있는지 확인
    function isSquareAttacked(row, col, defendingColor) {
        const attackingColor = defendingColor === 'white' ? 'black' : 'white';
        
        // 임시 보드에 가상의 킹을 배치
        const testBoard = JSON.parse(JSON.stringify(gameState.board));
        testBoard[row][col] = { type: 'king', color: defendingColor };
        
        // 해당 위치에 있는 킹이 체크 상태인지 확인
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = testBoard[r][c];
                if (!piece || piece.color !== attackingColor) continue;
                
                const moves = [];
                switch (piece.type) {
                    case 'pawn':
                        // 폰은 대각선으로만 공격
                        const direction = attackingColor === 'white' ? -1 : 1;
                        if ((row === r + direction && col === c - 1) || 
                            (row === r + direction && col === c + 1)) {
                            return true;
                        }
                        break;
                    case 'rook':
                        calculateRookMoves(r, c, attackingColor, moves);
                        break;
                    case 'knight':
                        calculateKnightMoves(r, c, attackingColor, moves);
                        break;
                    case 'bishop':
                        calculateBishopMoves(r, c, attackingColor, moves);
                        break;
                    case 'queen':
                        calculateQueenMoves(r, c, attackingColor, moves);
                        break;
                    case 'king':
                        // 킹은 인접한 위치만 공격
                        const kingMoves = [
                            { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
                            { row: 0, col: -1 }, { row: 0, col: 1 },
                            { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 }
                        ];
                        
                        for (const km of kingMoves) {
                            if (row === r + km.row && col === c + km.col) {
                                return true;
                            }
                        }
                        break;
                }
                
                // 계산된 이동 위치 중 해당 위치가 있는지 확인
                if (moves.some(move => move.row === row && move.col === col)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // 게임 종료 조건 확인 (체크메이트, 스테일메이트, 50수 규칙)
    function checkGameEndConditions() {
        const currentColor = gameState.currentPlayer;
        
        // 50수 규칙 확인
        if (gameState.halfMoveCount >= 100) { // 반 수 기준으로 100이면 50수
            gameState.gameOver = true;
            gameState.fiftyMoveRule = true;
            return;
        }
        
        // 3회 반복 규칙 확인
        checkForThreefoldRepetition();
        
        // 현재 플레이어의 가능한 모든 이동 계산
        let anyPossibleMoves = false;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = gameState.board[row][col];
                if (!piece || piece.color !== currentColor) continue;
                
                const moves = calculatePossibleMoves(row, col, piece);
                
                // 체크를 피하는 움직임만 필터링
                const validMoves = moves.filter(move => {
                    const testBoard = JSON.parse(JSON.stringify(gameState.board));
                    
                    // 테스트 이동 실행
                    testBoard[row][col] = null;
                    testBoard[move.row][move.col] = { ...piece };
                    
                    // 이동 후 여전히 체크 상태인지 확인
                    return !isKingInCheck(testBoard, currentColor);
                });
                
                if (validMoves.length > 0) {
                    anyPossibleMoves = true;
                    break;
                }
            }
            if (anyPossibleMoves) break;
        }
        
        // 가능한 이동이 없으면 체크메이트 또는 스테일메이트
        if (!anyPossibleMoves) {
            gameState.gameOver = true;
            
            if (gameState.check) {
                // 체크메이트
                gameState.checkmate = true;
                gameState.winner = currentColor === 'white' ? 'black' : 'white';
            } else {
                // 스테일메이트
                gameState.stalemate = true;
            }
        }
    }
    
    // 3회 반복 규칙 확인
    function checkForThreefoldRepetition() {
        const currentBoardState = JSON.stringify(gameState.board);
        
        // 현재 보드 상태가 히스토리에서 몇 번 나타났는지 계산
        let repetitionCount = 0;
        
        for (const boardState of gameState.moveHistory) {
            if (boardState === currentBoardState) {
                repetitionCount++;
            }
        }
        
        // 현재 상태를 포함해 3회 이상 반복되었으면 무승부
        if (repetitionCount >= 2) { // 이미 히스토리에 2번 있고 현재가 3번째
            gameState.gameOver = true;
            gameState.repetitionDraw = true;
        }
    }

    // 게임 상태 업데이트
    function updateStatus() {
        // 상태 요소의 모든 특수 클래스 제거
        statusElement.classList.remove('check', 'checkmate', 'draw');
        
        if (gameState.gameOver) {
            if (gameState.fiftyMoveRule) {
                statusElement.textContent = `50수 규칙: 무승부입니다.`;
                statusElement.classList.add('draw');
            } else if (gameState.repetitionDraw) {
                statusElement.textContent = `3회 반복: 무승부입니다.`;
                statusElement.classList.add('draw');
            } else if (gameState.stalemate) {
                statusElement.textContent = `스테일메이트: 무승부입니다.`;
                statusElement.classList.add('draw');
            } else {
                statusElement.textContent = `체크메이트! ${gameState.winner === 'white' ? '흰색' : '검은색'} 승리!`;
                statusElement.classList.add('checkmate');
            }
        } else if (gameState.check) {
            statusElement.textContent = `체크! ${gameState.currentPlayer === 'white' ? '흰색' : '검은색'} 차례입니다`;
            statusElement.classList.add('check');
        } else {
            statusElement.textContent = `${gameState.currentPlayer === 'white' ? '흰색' : '검은색'} 차례입니다`;
        }
    }

    // 게임 초기화
    function resetGame() {
        gameState.board = initializeBoard();
        gameState.currentPlayer = 'white';
        gameState.selectedPiece = null;
        gameState.possibleMoves = [];
        gameState.check = false;
        gameState.checkmate = false;
        gameState.stalemate = false;
        gameState.gameOver = false;
        gameState.winner = null;
        gameState.fiftyMoveRule = false;
        gameState.repetitionDraw = false;
        
        // 캐슬링 상태 초기화
        gameState.piecesMoved = {
            whiteKing: false,
            blackKing: false,
            whiteRookLeft: false,
            whiteRookRight: false,
            blackRookLeft: false,
            blackRookRight: false
        };
        
        // 앙파상 상태 초기화
        gameState.lastPawnDoubleMove = null;
        
        // 프로모션 상태 초기화
        gameState.pendingPromotion = null;
        
        // 50수 규칙 초기화
        gameState.halfMoveCount = 0;
        gameState.moveHistory = [];
        
        renderBoard();
    }

    // 리셋 버튼 이벤트 리스너
    resetButton.addEventListener('click', resetGame);

    // 초기 보드 렌더링
    renderBoard();
}); 