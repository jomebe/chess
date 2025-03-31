// 소켓 연결 설정
const socket = io();

// 전역 변수
let playerColor = null;
let currentRoomId = null;
let isReady = false;
let isMyTurn = false;
let isBoardFlipped = false;

// 게임 상태
const gameState = {
    board: null,
    currentPlayer: 'white',
    selectedPiece: null,
    possibleMoves: [],
    check: false,
    checkmate: false,
    stalemate: false,
    gameOver: false,
    piecesMoved: {
        whiteKing: false,
        blackKing: false,
        whiteRookLeft: false,
        whiteRookRight: false,
        blackRookLeft: false,
        blackRookRight: false
    },
    lastPawnDoubleMove: null,
    pendingPromotion: null,
    halfMoveCount: 0,
    moveHistory: []
};

// DOM 요소
const lobbyElement = document.getElementById('lobby');
const gameContainerElement = document.getElementById('game-container');
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const roomNameInput = document.getElementById('room-name');
const createRoomButton = document.getElementById('create-room-btn');
const roomListElement = document.getElementById('room-list');
const refreshRoomsButton = document.getElementById('refresh-rooms-btn');
const readyButton = document.getElementById('ready-btn');
const resetButton = document.getElementById('reset-btn');
const leaveButton = document.getElementById('leave-btn');
const roomNameDisplay = document.getElementById('room-name-display');
const chatMessagesElement = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessageButton = document.getElementById('send-message-btn');
const whiteStatusElement = document.getElementById('white-status');
const blackStatusElement = document.getElementById('black-status');
const notificationElement = document.getElementById('notification');
const gameInfoElement = statusElement; // 상태 표시 요소 사용
const myStatusElement = document.getElementById('my-status');

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    refreshRooms();
});

// 이벤트 리스너 초기화
function initEventListeners() {
    // 로비 이벤트
    createRoomButton.addEventListener('click', createRoom);
    refreshRoomsButton.addEventListener('click', refreshRooms);
    
    // 게임 이벤트
    readyButton.addEventListener('click', toggleReady);
    resetButton.addEventListener('click', resetGame);
    leaveButton.addEventListener('click', leaveRoom);
    
    // 채팅 이벤트
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    sendMessageButton.addEventListener('click', sendMessage);
}

// 소켓 이벤트 리스너
socket.on('roomList', (rooms) => {
    renderRoomList(rooms);
});

socket.on('roomCreated', (data) => {
    console.log('방 생성됨:', data);
    currentRoomId = data.roomId;
    playerColor = data.color;
    isBoardFlipped = playerColor === 'black';
    isMyTurn = playerColor === 'white'; // 흰색이 항상 먼저 시작
    
    console.log(`내 색상: ${playerColor}, 내 턴: ${isMyTurn}, 보드 뒤집힘: ${isBoardFlipped}`);
    
    joinGameRoom(currentRoomId);
    showNotification(`방이 생성되었습니다. 당신은 ${playerColor === 'white' ? '흰색' : '검은색'} 말을 사용합니다.`, 'success');
});

socket.on('joinedRoom', (data) => {
    console.log('방 참가됨:', data);
    currentRoomId = data.roomId;
    playerColor = data.color;
    isBoardFlipped = (playerColor === 'black');
    
    // 게임 상태 설정
    if (data.gameState) {
        Object.assign(gameState, data.gameState);
        console.log('기존 게임 상태 로드:', gameState);
    }
    
    // 흰색 플레이어의 턴으로 시작 (기존 게임 상태가 없는 경우)
    if (!data.gameState) {
        isMyTurn = (playerColor === 'white');
    } else {
        // 기존 게임 상태가 있는 경우 현재 플레이어에 따라 설정
        isMyTurn = (gameState.currentPlayer === playerColor);
    }
    
    console.log(`방 참가 후 턴 설정: 현재 플레이어=${gameState.currentPlayer}, 내 색상=${playerColor}, 내 턴=${isMyTurn}`);
    
    joinGameRoom(data.roomId);
    showNotification(`방에 참가했습니다. 당신은 ${playerColor === 'white' ? '흰색' : '검은색'} 말을 사용합니다.`, 'success');
});

socket.on('joinedAsSpectator', (data) => {
    currentRoomId = data.roomId;
    playerColor = 'spectator';
    
    // 게임 상태 설정
    if (data.gameState) {
        Object.assign(gameState, data.gameState);
    }
    
    joinGameRoom(data.roomId);
    showNotification('관전자로 참가했습니다', 'info');
});

socket.on('opponentJoined', (data) => {
    updatePlayerStatus(data.color, '대기 중');
    addSystemMessage('상대방이 입장했습니다.');
    showNotification('상대방이 입장했습니다', 'info');
});

socket.on('spectatorJoined', (data) => {
    addSystemMessage('관전자가 입장했습니다.');
});

socket.on('playerReady', (data) => {
    const statusText = data.ready ? '준비 완료' : '대기 중';
    const color = getPlayerColorById(data.playerId);
    updatePlayerStatus(color, statusText);
    
    if (data.playerId === socket.id) {
        isReady = data.ready;
        readyButton.innerHTML = isReady ? 
            '<i class="fas fa-times"></i> 준비 취소' : 
            '<i class="fas fa-check"></i> 준비';
        readyButton.classList.toggle('not-ready', isReady);
    }
    
    addSystemMessage(`${color === 'white' ? '흰색' : '검은색'} 플레이어가 ${data.ready ? '준비 완료' : '준비 취소'}했습니다.`);
});

socket.on('gameReady', () => {
    statusElement.textContent = '두 플레이어가 모두 게임에 참가했습니다. 준비 버튼을 눌러 게임을 시작하세요.';
});

socket.on('gameStart', (data) => {
    console.log('게임 시작:', data);
    
    // 게임 상태 설정
    if (data.gameState) {
        Object.assign(gameState, data.gameState);
    }
    
    // 자신의 턴인지 확인
    isMyTurn = (gameState.currentPlayer === playerColor);
    console.log(`게임 시작: 현재 플레이어 = ${gameState.currentPlayer}, 내 색상 = ${playerColor}, isMyTurn = ${isMyTurn}`);
    
    startGame();
    showNotification('게임이 시작되었습니다', 'success');
    addSystemMessage('게임이 시작되었습니다.');
});

socket.on('pieceMoved', (moveData) => {
    console.log('상대방의 말 이동 이벤트 수신:', moveData);
    
    // 게임 상태 업데이트
    Object.assign(gameState, moveData.gameState);
    
    // 턴 상태 업데이트 (중요)
    isMyTurn = (gameState.currentPlayer === playerColor);
    
    console.log(`상대방 이동 후: 현재 플레이어=${gameState.currentPlayer}, 내 색상=${playerColor}, 내 턴=${isMyTurn}`);
    
    // 보드 다시 그리기
    renderBoard();
    
    // 턴 메시지 업데이트
    if (isMyTurn) {
        updateStatusMessage('당신의 차례입니다.');
        showNotification('당신의 차례입니다.', 'info');
    } else {
        updateStatusMessage('상대방의 차례입니다.');
    }
    
    renderGameStatus();
});

socket.on('chatMessage', (message) => {
    addChatMessage(message);
});

socket.on('opponentLeft', () => {
    showNotification('상대방이 게임을 나갔습니다', 'warning');
    addSystemMessage('상대방이 게임을 나갔습니다.');
    updatePlayerStatus(playerColor === 'white' ? 'black' : 'white', '연결 끊김');
});

socket.on('spectatorLeft', (data) => {
    addSystemMessage('관전자가 나갔습니다.');
});

socket.on('error', (errorMessage) => {
    showNotification(errorMessage, 'error');
});

// 게임 종료 이벤트
socket.on('gameOver', (data) => {
    const { reason, winner, draw } = data;
    
    // 게임 상태 업데이트
    gameState.gameOver = true;
    
    if (draw) {
        gameState.draw = true;
        if (reason === 'fifty_move_rule') {
            gameState.fiftyMoveRule = true;
        } else if (reason === 'threefold_repetition') {
            gameState.repetitionDraw = true;
        }
    } else if (winner) {
        gameState.winner = winner;
        if (reason === 'checkmate') {
            gameState.checkmate = true;
        } else if (reason === 'stalemate') {
            gameState.stalemate = true;
        } else if (reason === 'player_left') {
            gameState.playerLeft = true;
        } else if (reason === 'resign') {
            gameState.resigned = true;
        }
    }
    
    // 게임 상태 화면 업데이트
    renderBoard();
    
    // 알림 메시지 표시
    let message = '';
    if (draw) {
        message = '무승부입니다!';
    } else {
        const winnerText = winner === 'white' ? '흰색' : '검은색';
        
        if (reason === 'player_left') {
            message = `상대 플레이어가 게임을 나갔습니다. ${winnerText} 플레이어의 승리입니다!`;
        } else if (reason === 'resign') {
            message = `상대 플레이어가 기권했습니다. ${winnerText} 플레이어의 승리입니다!`;
        } else {
            message = `${winnerText} 플레이어의 승리입니다!`;
        }
    }
    
    showNotification(message, draw ? 'info' : 'success');
    addSystemMessage(message);
});

// resetGame 이벤트 핸들러 추가
socket.on('resetGame', () => {
    // 게임 상태 초기화
    resetGame();
    
    // 오버레이 제거
    const overlay = document.querySelector('.game-over-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    // 준비 상태 초기화
    isReady = false;
    readyButton.disabled = false;
    readyButton.innerHTML = '<i class="fas fa-check"></i> 준비';
    readyButton.classList.remove('not-ready');
    
    // 게임 상태 메시지 업데이트
    updateStatusMessage('게임이 초기화되었습니다. 준비 버튼을 눌러 새 게임을 시작하세요.');
    
    // 알림 메시지 표시
    showNotification('게임이 초기화되었습니다.', 'info');
    addSystemMessage('게임이 초기화되었습니다.');
});

// 상대 플레이어가 나갔을 때 이벤트 처리
socket.on('playerLeft', (data) => {
    const { color } = data;
    
    // 자신의 색상과 비교하여 상대방이 나간 경우에만 처리
    if (color !== playerColor) {
        console.log(`상대 플레이어(${color})가 게임을 나갔습니다.`);
        
        // 알림 표시
        showNotification(`상대 플레이어(${color === 'white' ? '흰색' : '검은색'})가 게임을 나갔습니다.`, 'warning');
        addSystemMessage(`상대 플레이어(${color === 'white' ? '흰색' : '검은색'})가 게임을 나갔습니다.`);
        
        // 게임 진행 중이었다면 상대방의 기권으로 승리 처리
        if (gameState && !gameState.gameOver) {
            updateStatusMessage(`상대 플레이어가 나갔습니다. 당신의 승리입니다!`);
        } else {
            updateStatusMessage(`상대 플레이어가 나갔습니다. 다른 플레이어를 기다리세요.`);
        }
        
        // 플레이어 상태 업데이트
        updatePlayerStatus(color, 'waiting');
    }
});

// 방 관련 함수
function createRoom() {
    const roomName = roomNameInput.value.trim();
    if (!roomName) {
        showNotification('방 이름을 입력해주세요', 'warning');
        return;
    }
    
    const color = 'white'; // 방 생성자는 항상 흰색
    console.log(`방 생성 요청: 이름=${roomName}, 색상=${color}`);
    socket.emit('createRoom', { name: roomName, color });
}

function refreshRooms() {
    socket.emit('getRooms');
}

function renderRoomList(rooms) {
    roomListElement.innerHTML = '';
    
    if (rooms.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-rooms';
        emptyMessage.textContent = '생성된 방이 없습니다. 새 방을 만들어보세요!';
        roomListElement.appendChild(emptyMessage);
        return;
    }
    
    rooms.forEach(room => {
        const roomItem = document.createElement('div');
        roomItem.className = 'room-item';
        roomItem.innerHTML = `
            <div class="room-name">${room.name}</div>
            <div class="room-players">${room.white ? '흰색: 참가 ' : '흰색: 빈자리 '}${room.black ? '검은색: 참가' : '검은색: 빈자리'}</div>
        `;
        
        roomItem.addEventListener('click', () => {
            joinRoom(room.id);
        });
        
        roomListElement.appendChild(roomItem);
    });
}

function joinRoom(roomId) {
    const color = 'black'; // 참가자는 항상 검은색
    console.log(`방 참가 요청: roomId=${roomId}, 색상=${color}`);
    socket.emit('joinRoom', { roomId, color });
}

// UI 전환
function joinGameRoom(roomId) {
    // 로비 숨기기
    lobbyElement.classList.add('hidden');
    
    // 게임 컨테이너 표시
    gameContainerElement.classList.remove('hidden');
    
    // 방 정보 표시
    roomNameDisplay.textContent = roomId;
    
    // 플레이어 상태 초기화
    updatePlayerStatus('white', playerColor === 'white' ? '대기 중' : '대기 중');
    updatePlayerStatus('black', playerColor === 'black' ? '대기 중' : '대기 중');
    
    // 게임 상태 초기화
    resetGame();
    
    // 보드 렌더링
    renderBoard();
}

// 게임 관련 함수
function toggleReady() {
    if (playerColor === 'spectator') return;
    
    // 현재 준비 상태 반전
    isReady = !isReady;
    
    // 버튼 상태 즉시 업데이트 (서버 응답 기다리지 않고)
    readyButton.innerHTML = isReady ? 
        '<i class="fas fa-times"></i> 준비 취소' : 
        '<i class="fas fa-check"></i> 준비';
    readyButton.classList.toggle('not-ready', isReady);
    
    // 내 상태 표시 업데이트
    const myStatus = isReady ? '준비 완료' : '대기 중';
    updatePlayerStatus(playerColor, myStatus);
    
    // 상태 알림 표시
    showNotification(isReady ? '준비 완료!' : '준비 취소됨', isReady ? 'success' : 'info');
    
    // 서버에 상태 변경 전송
    socket.emit('ready', { roomId: currentRoomId });
}

function startGame() {
    // 게임 시작 상태로 UI 업데이트
    isReady = false;
    readyButton.disabled = true;
    resetButton.disabled = false;
    
    // 턴 확인
    isMyTurn = (gameState.currentPlayer === playerColor);
    console.log(`게임 시작 함수: 현재 플레이어 = ${gameState.currentPlayer}, 내 색상 = ${playerColor}, isMyTurn = ${isMyTurn}`);
    
    // 상태 메시지 업데이트
    statusElement.textContent = `게임이 시작되었습니다. ${gameState.currentPlayer === 'white' ? '흰색' : '검은색'} 차례입니다.`;
    
    // 보드 렌더링
    renderBoard();
    
    // 자신의 턴이면 알림 표시
    if (isMyTurn) {
        showNotification('당신의 턴입니다!', 'info');
    }
}

function leaveRoom() {
    // 기본 상태로 UI 리셋
    playerColor = null;
    currentRoomId = null;
    isReady = false;
    isMyTurn = false;
    
    // 로비로 돌아가기
    gameContainerElement.classList.add('hidden');
    lobbyElement.classList.remove('hidden');
    
    // 채팅창 비우기
    chatMessagesElement.innerHTML = '';
    
    // 소켓 연결 리셋 (자동으로 disconnect 이벤트 발생)
    socket.disconnect();
    socket.connect();
    
    // 방 목록 새로고침
    refreshRooms();
}

function resetGame() {
    // 게임 상태 초기화
    gameState.board = initializeBoard();
    gameState.currentPlayer = 'white';
    gameState.selectedPiece = null;
    gameState.possibleMoves = [];
    gameState.check = false;
    gameState.checkmate = false;
    gameState.stalemate = false;
    gameState.gameOver = false;
    gameState.piecesMoved = {
        whiteKing: false,
        blackKing: false,
        whiteRookLeft: false,
        whiteRookRight: false,
        blackRookLeft: false,
        blackRookRight: false
    };
    gameState.lastPawnDoubleMove = null;
    gameState.pendingPromotion = null;
    gameState.halfMoveCount = 0;
    gameState.moveHistory = [];
    
    // UI 업데이트
    renderBoard();
}

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
    // 턴 상태 확인
    isMyTurn = (gameState.currentPlayer === playerColor);
    console.log(`보드 렌더링: 현재 플레이어=${gameState.currentPlayer}, 내 색상=${playerColor}, 내 턴=${isMyTurn}`);
    
    boardElement.innerHTML = '';
    
    // 프로모션 선택 UI가 필요한 경우
    if (gameState.pendingPromotion) {
        renderPromotionUI();
        return;
    }
    
    // 체크메이트 또는 스테일메이트가 발생했는지 확인
    if (gameState.checkmate || gameState.stalemate) {
        renderGameOverOverlay();
    }
    
    // 체스판 전체 컨테이너
    const boardContainer = document.createElement('div');
    boardContainer.className = 'board';
    
    // 체스판 열 라벨 (a-h)
    const colLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    // 보드에 모든 칸 추가
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            // 흑색 플레이어일 경우 보드 뒤집기
            const actualRow = isBoardFlipped ? 7 - row : row;
            const actualCol = isBoardFlipped ? 7 - col : col;
            
            const square = document.createElement('div');
            square.className = `square ${(actualRow + actualCol) % 2 === 0 ? 'white' : 'black'}`;
            square.dataset.row = 8 - actualRow; // 체스판은 아래에서 위로 1-8
            square.dataset.col = colLabels[actualCol]; // 체스판은 왼쪽에서 오른쪽으로 a-h
            
            const piece = gameState.board[actualRow][actualCol];
            if (piece) {
                const pieceElement = document.createElement('div');
                pieceElement.className = `piece ${piece.color}-${piece.type}`;
                pieceElement.innerHTML = getPieceSymbol(piece);
                
                // 체크 또는 체크메이트 상태의 킹 표시
                if (piece.type === 'king') {
                    if (gameState.check && piece.color === gameState.currentPlayer) {
                        square.classList.add('king-check');
                    } else if (gameState.checkmate && piece.color === gameState.currentPlayer) {
                        square.classList.add('king-checkmate');
                    }
                }
                
                square.appendChild(pieceElement);
            }
            
            // 선택된 칸 하이라이트
            if (gameState.selectedPiece && gameState.selectedPiece.row === actualRow && gameState.selectedPiece.col === actualCol) {
                square.classList.add('selected');
            }
            
            // 가능한 이동 위치 하이라이트
            if (gameState.possibleMoves.some(move => move.row === actualRow && move.col === actualCol)) {
                square.classList.add('highlighted');
                // 이동 위치에 말이 있는 경우 (캡처 가능) 추가 스타일
                if (piece) {
                    square.classList.add('has-piece');
                }
            }
            
            // 모든 칸에 클릭 이벤트 추가 (턴 및 관전자 여부는 handleSquareClick 함수 안에서 확인)
            square.addEventListener('click', () => handleSquareClick(actualRow, actualCol));
            
            boardContainer.appendChild(square);
        }
    }
    
    boardElement.appendChild(boardContainer);
    
    // 게임 상태 업데이트
    renderGameStatus();
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

// 게임 상태 업데이트
function renderGameStatus() {
    // 게임 정보 요소 업데이트
    let statusText = '';
    
    if (gameState.gameOver) {
        if (gameState.checkmate) {
            statusText = `체크메이트! ${gameState.winner === 'white' ? '흰색' : '검은색'} 승리`;
        } else if (gameState.stalemate) {
            statusText = '스테일메이트! 무승부';
        } else if (gameState.fiftyMoveRule) {
            statusText = '50수 규칙: 무승부';
        } else if (gameState.repetitionDraw) {
            statusText = '3회 반복: 무승부';
        } else if (gameState.draw) {
            statusText = '무승부';
        } else if (gameState.winner) {
            statusText = `${gameState.winner === 'white' ? '흰색' : '검은색'} 승리`;
        }
    } else if (gameState.check) {
        statusText = `체크! ${gameState.currentPlayer === 'white' ? '흰색' : '검은색'} 차례입니다`;
    } else {
        statusText = `${gameState.currentPlayer === 'white' ? '흰색' : '검은색'} 차례`;
    }
    
    statusElement.textContent = statusText;
    
    // 턴 표시 업데이트
    isMyTurn = (gameState.currentPlayer === playerColor);
    
    if (playerColor !== 'spectator') {
        if (isMyTurn) {
            myStatusElement.textContent = '내 턴';
            myStatusElement.classList.add('my-turn');
            myStatusElement.classList.remove('ready');
        } else {
            myStatusElement.textContent = '상대 턴';
            myStatusElement.classList.remove('my-turn', 'ready');
        }
    } else {
        myStatusElement.textContent = '관전 중';
        myStatusElement.classList.remove('my-turn', 'ready');
    }
    
    // 체크, 체크메이트, 무승부 상태에 따른 클래스 추가
    statusElement.classList.remove('check', 'checkmate', 'draw');
    
    if (gameState.gameOver) {
        if (gameState.checkmate) {
            statusElement.classList.add('checkmate');
        } else {
            statusElement.classList.add('draw');
        }
    } else if (gameState.check) {
        statusElement.classList.add('check');
    }
}

// 클릭 핸들러
function handleSquareClick(row, col) {
    console.log(`클릭: row=${row}, col=${col}, 내 턴=${isMyTurn}, 내 색상=${playerColor}, 현재 플레이어=${gameState.currentPlayer}`);
    
    // 예상대로 턴이 설정되어 있는지 확인 (디버깅용)
    const shouldBeMyTurn = (gameState.currentPlayer === playerColor);
    if (isMyTurn !== shouldBeMyTurn) {
        console.error(`턴 값 불일치: isMyTurn=${isMyTurn}, 하지만 실제로는 ${shouldBeMyTurn}이어야 함`);
        // 올바른 값으로 수정
        isMyTurn = shouldBeMyTurn;
    }
    
    // 게임이 끝났거나 내 턴이 아니면 아무것도 할 수 없음
    if (gameState.gameOver || !isMyTurn || playerColor === 'spectator') {
        console.log('턴이 아니거나 게임이 끝남:', { 게임종료: gameState.gameOver, 내턴: isMyTurn, 색상: playerColor });
        return;
    }

    // 기물이 선택되어 있지 않은 경우
    if (!gameState.selectedPiece) {
        // 클릭한 위치에 기물이 있는지 확인
        const piece = gameState.board[row][col];
        
        // 기물이 없거나 상대편 기물인 경우 무시
        if (!piece || piece.color !== playerColor) {
            console.log('선택 불가능한 기물:', piece);
            return;
        }
        
        // 기물 선택
        gameState.selectedPiece = { row, col, piece };
        
        // 선택한 기물의 가능한 움직임 계산
        gameState.possibleMoves = calculatePossibleMoves(row, col, piece, gameState.board);
        
        // 화면 업데이트
        renderBoard();
        return;
    }
    
    // 이미 기물이 선택된 경우, 가능한 움직임 중 하나인지 확인
    const isMoveAllowed = gameState.possibleMoves.some(move => move.row === row && move.col === col);
    
    // 같은 위치를 다시 클릭하면 선택 취소
    if (gameState.selectedPiece.row === row && gameState.selectedPiece.col === col) {
        gameState.selectedPiece = null;
        gameState.possibleMoves = [];
        renderBoard();
        return;
    }
    
    // 허용되지 않은 움직임인 경우
    if (!isMoveAllowed) {
        // 다른 내 기물을 클릭한 경우 그 기물을 선택
        const piece = gameState.board[row][col];
        if (piece && piece.color === playerColor) {
            gameState.selectedPiece = { row, col, piece };
            gameState.possibleMoves = calculatePossibleMoves(row, col, piece, gameState.board);
            renderBoard();
        }
        return;
    }
    
    // 기물 이동 처리
    const fromRow = gameState.selectedPiece.row;
    const fromCol = gameState.selectedPiece.col;
    const piece = gameState.selectedPiece.piece;
    
    // 이동 전 보드 상태 저장 (취소용)
    const oldBoard = JSON.parse(JSON.stringify(gameState.board));
    
    // 이동할 위치에 기물이 있으면 잡음 처리
    if (gameState.board[row][col]) {
        // 상대방 기물 잡기 처리
    }
    
    // 기물 이동
    gameState.board[row][col] = piece;
    gameState.board[fromRow][fromCol] = null;
    
    // 킹이 체크 상태인지 확인
    const isCheck = isKingInCheck(gameState.board, piece.color === 'white' ? 'black' : 'white');
    gameState.check = isCheck;
    
    // 체크메이트인지 확인
    const isCheckmate = isCheck && !hasLegalMoves(gameState.board, piece.color === 'white' ? 'black' : 'white');
    gameState.checkmate = isCheckmate;
    
    if (isCheckmate) {
        gameState.gameOver = true;
        gameState.winner = piece.color;
    }
    
    // 스테일메이트인지 확인 (킹이 체크 상태가 아니지만 움직일 수 있는 합법적인 수가 없는 경우)
    const isStalemate = !isCheck && !hasLegalMoves(gameState.board, piece.color === 'white' ? 'black' : 'white');
    gameState.stalemate = isStalemate;
    
    if (isStalemate) {
        gameState.gameOver = true;
        gameState.winner = 'draw';
    }
    
    // 선택 초기화
    gameState.selectedPiece = null;
    gameState.possibleMoves = [];
    
    // 현재 플레이어 변경
    gameState.currentPlayer = piece.color === 'white' ? 'black' : 'white';
    isMyTurn = (gameState.currentPlayer === playerColor); // 턴 변경 후 내 턴인지 다시 확인
    
    console.log(`이동 후 현재 플레이어: ${gameState.currentPlayer}, 내 색상: ${playerColor}, 내 턴: ${isMyTurn}`);
    
    // 화면 업데이트
    renderBoard();
    renderGameStatus();
    
    // 이동 정보를 서버에 전송
    socket.emit('movePiece', {
        roomId: currentRoomId,
        from: { row: fromRow, col: fromCol },
        to: { row, col },
        gameState: gameState
    });
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
    container.style.borderRadius = 'var(--border-radius)';
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
        option.style.border = '2px solid #eee';
        option.style.borderRadius = '4px';
        
        option.innerHTML = getPieceSymbol(piece);
        
        // 자신의 턴일 때만 클릭 이벤트 추가
        if (playerColor === color) {
            option.addEventListener('click', () => handlePromotion(pieceType));
        }
        
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
    
    // 서버에 이동 정보 전달
    socket.emit('movePiece', {
        promotion: { row, col, pieceType },
        gameState: gameState
    });
}

// 플레이어 상태 업데이트
function updatePlayerStatus(color, status) {
    const statusElement = color === 'white' ? whiteStatusElement : blackStatusElement;
    statusElement.textContent = status;
    statusElement.classList.remove('ready', 'waiting');
    
    if (status === '준비 완료') {
        statusElement.classList.add('ready');
    } else {
        statusElement.classList.add('waiting');
    }
    
    // 내 상태이면 my-status도 업데이트
    if (color === playerColor) {
        myStatusElement.textContent = status === '준비 완료' ? '준비 완료' : '대기 중';
        myStatusElement.classList.toggle('ready', status === '준비 완료');
    }
    
    // 상태 변경 로그 출력 (디버깅용)
    console.log(`${color} 플레이어 상태 변경: ${status}`);
}

// 플레이어 색상 가져오기
function getPlayerColorById(playerId) {
    if (!currentRoomId) return null;
    
    // 소켓 ID를 기반으로 플레이어 색상 반환
    return playerId === socket.id ? playerColor : (playerColor === 'white' ? 'black' : 'white');
}

// 채팅 관련 함수
function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    socket.emit('sendMessage', message);
    chatInput.value = '';
}

function addChatMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    
    // 시스템 메시지
    if (message.sender === 'system') {
        messageElement.className = 'message-system';
        messageElement.textContent = message.text;
    } else {
        // 일반 메시지
        const isSelf = message.sender === socket.id;
        
        if (isSelf) {
            messageElement.classList.add('message-self');
        }
        
        const senderColor = getPlayerColorById(message.sender);
        const senderName = senderColor === 'spectator' ? '관전자' : `${senderColor === 'white' ? '흰색' : '검은색'} 플레이어`;
        
        const senderElement = document.createElement('div');
        senderElement.className = 'message-sender';
        senderElement.textContent = isSelf ? '나' : senderName;
        
        const textElement = document.createElement('div');
        textElement.className = 'message-text';
        textElement.textContent = message.text;
        
        messageElement.appendChild(senderElement);
        messageElement.appendChild(textElement);
    }
    
    chatMessagesElement.appendChild(messageElement);
    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
}

function addSystemMessage(text) {
    addChatMessage({
        sender: 'system',
        text: text,
        timestamp: new Date().toISOString()
    });
}

// 알림 표시
function showNotification(message, type = 'info') {
    notificationElement.textContent = message;
    notificationElement.className = `notification ${type}`;
    notificationElement.classList.remove('hidden');
    
    // 3초 후 알림 숨기기
    setTimeout(() => {
        notificationElement.classList.add('hidden');
    }, 3000);
}

// 체스 게임 로직 함수들
// 체스 말의 가능한 이동 계산 함수
function calculatePossibleMoves(row, col, piece, board) {
    const moves = [];
    
    switch (piece.type) {
        case 'pawn':
            calculatePawnMoves(row, col, piece.color, moves, board);
            break;
        case 'rook':
            calculateRookMoves(row, col, piece.color, moves, board);
            break;
        case 'knight':
            calculateKnightMoves(row, col, piece.color, moves, board);
            break;
        case 'bishop':
            calculateBishopMoves(row, col, piece.color, moves, board);
            break;
        case 'queen':
            calculateQueenMoves(row, col, piece.color, moves, board);
            break;
        case 'king':
            calculateKingMoves(row, col, piece.color, moves, board);
            break;
    }
    
    return moves;
}

// 폰 이동 계산
function calculatePawnMoves(row, col, color, moves, board) {
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    
    // 전진
    if (row + direction >= 0 && row + direction < 8) {
        // 한 칸 전진
        if (!board[row + direction][col]) {
            moves.push({ row: row + direction, col: col });
            
            // 두 칸 전진 (첫 이동에만 가능)
            if (row === startRow && !board[row + 2 * direction][col]) {
                moves.push({ row: row + 2 * direction, col: col });
            }
        }
        
        // 대각선 캡처 (좌측)
        if (col > 0) {
            const targetPiece = board[row + direction][col - 1];
            if (targetPiece && targetPiece.color !== color) {
                moves.push({ row: row + direction, col: col - 1 });
            }
            
            // 앙파상 (좌측)
            const lastMove = gameState.lastPawnDoubleMove;
            if (lastMove && 
                lastMove.color !== color && 
                lastMove.row === row && 
                lastMove.col === col - 1) {
                moves.push({ row: row + direction, col: col - 1 });
            }
        }
        
        // 대각선 캡처 (우측)
        if (col < 7) {
            const targetPiece = board[row + direction][col + 1];
            if (targetPiece && targetPiece.color !== color) {
                moves.push({ row: row + direction, col: col + 1 });
            }
            
            // 앙파상 (우측)
            const lastMove = gameState.lastPawnDoubleMove;
            if (lastMove && 
                lastMove.color !== color && 
                lastMove.row === row && 
                lastMove.col === col + 1) {
                moves.push({ row: row + direction, col: col + 1 });
            }
        }
    }
}

// 룩 이동 계산
function calculateRookMoves(row, col, color, moves, board) {
    // 상하좌우 방향
    const directions = [
        { rowChange: 1, colChange: 0 },  // 아래
        { rowChange: -1, colChange: 0 }, // 위
        { rowChange: 0, colChange: 1 },  // 오른쪽
        { rowChange: 0, colChange: -1 }  // 왼쪽
    ];
    
    for (const direction of directions) {
        for (let i = 1; i < 8; i++) {
            const newRow = row + i * direction.rowChange;
            const newCol = col + i * direction.colChange;
            
            // 보드 범위 확인
            if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
            
            const targetPiece = board[newRow][newCol];
            
            if (!targetPiece) {
                // 빈 칸으로 이동
                moves.push({ row: newRow, col: newCol });
            } else if (targetPiece.color !== color) {
                // 상대 말 캡처
                moves.push({ row: newRow, col: newCol });
                break;
            } else {
                // 자신의 말이 있으면 막힘
                break;
            }
        }
    }
}

// 나이트 이동 계산
function calculateKnightMoves(row, col, color, moves, board) {
    const knightMoves = [
        { rowChange: 2, colChange: 1 },
        { rowChange: 2, colChange: -1 },
        { rowChange: -2, colChange: 1 },
        { rowChange: -2, colChange: -1 },
        { rowChange: 1, colChange: 2 },
        { rowChange: 1, colChange: -2 },
        { rowChange: -1, colChange: 2 },
        { rowChange: -1, colChange: -2 }
    ];
    
    for (const move of knightMoves) {
        const newRow = row + move.rowChange;
        const newCol = col + move.colChange;
        
        // 보드 범위 확인
        if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) continue;
        
        const targetPiece = board[newRow][newCol];
        
        if (!targetPiece || targetPiece.color !== color) {
            // 빈 칸이거나 상대 말이면 이동 가능
            moves.push({ row: newRow, col: newCol });
        }
    }
}

// 비숍 이동 계산
function calculateBishopMoves(row, col, color, moves, board) {
    // 대각선 방향
    const directions = [
        { rowChange: 1, colChange: 1 },   // 오른쪽 아래
        { rowChange: 1, colChange: -1 },  // 왼쪽 아래
        { rowChange: -1, colChange: 1 },  // 오른쪽 위
        { rowChange: -1, colChange: -1 }  // 왼쪽 위
    ];
    
    for (const direction of directions) {
        for (let i = 1; i < 8; i++) {
            const newRow = row + i * direction.rowChange;
            const newCol = col + i * direction.colChange;
            
            // 보드 범위 확인
            if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
            
            const targetPiece = board[newRow][newCol];
            
            if (!targetPiece) {
                // 빈 칸으로 이동
                moves.push({ row: newRow, col: newCol });
            } else if (targetPiece.color !== color) {
                // 상대 말 캡처
                moves.push({ row: newRow, col: newCol });
                break;
            } else {
                // 자신의 말이 있으면 막힘
                break;
            }
        }
    }
}

// 퀸 이동 계산
function calculateQueenMoves(row, col, color, moves, board) {
    // 룩과 비숍의 이동을 합침
    calculateRookMoves(row, col, color, moves, board);
    calculateBishopMoves(row, col, color, moves, board);
}

// 킹 이동 계산
function calculateKingMoves(row, col, color, moves, board) {
    // 8방향
    const directions = [
        { rowChange: 1, colChange: 0 },   // 아래
        { rowChange: -1, colChange: 0 },  // 위
        { rowChange: 0, colChange: 1 },   // 오른쪽
        { rowChange: 0, colChange: -1 },  // 왼쪽
        { rowChange: 1, colChange: 1 },   // 오른쪽 아래
        { rowChange: 1, colChange: -1 },  // 왼쪽 아래
        { rowChange: -1, colChange: 1 },  // 오른쪽 위
        { rowChange: -1, colChange: -1 }  // 왼쪽 위
    ];
    
    for (const direction of directions) {
        const newRow = row + direction.rowChange;
        const newCol = col + direction.colChange;
        
        // 보드 범위 확인
        if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) continue;
        
        const targetPiece = board[newRow][newCol];
        
        if (!targetPiece || targetPiece.color !== color) {
            // 이동 위치가 안전한지 확인 (체크가 되지 않는지)
            const testBoard = JSON.parse(JSON.stringify(board));
            testBoard[row][col] = null;
            testBoard[newRow][newCol] = { type: 'king', color };
            
            if (!isPositionUnderAttack(newRow, newCol, color, testBoard)) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }
    
    // 캐슬링 검사
    if (!gameState.check) {
        checkCastling(row, col, color, moves, board);
    }
}

// 캐슬링 가능 여부 확인
function checkCastling(row, col, color, moves, board) {
    // 킹이 이동했는지 확인
    const kingMoved = color === 'white' ? 
        gameState.piecesMoved.whiteKing : 
        gameState.piecesMoved.blackKing;
    
    if (kingMoved) return;
    
    const kingRow = color === 'white' ? 7 : 0;
    
    // 킹사이드 캐슬링
    const kingsideRookMoved = color === 'white' ? 
        gameState.piecesMoved.whiteRookRight : 
        gameState.piecesMoved.blackRookRight;
    
    if (!kingsideRookMoved) {
        // 킹과 룩 사이에 다른 말이 없는지 확인
        if (!board[kingRow][5] && !board[kingRow][6]) {
            // 킹이 지나가는 칸이 공격받고 있는지 확인
            const kingPassesSafely = !isPositionUnderAttack(kingRow, 5, color, board);
            
            if (kingPassesSafely) {
                moves.push({ row: kingRow, col: 6 });
            }
        }
    }
    
    // 퀸사이드 캐슬링
    const queensideRookMoved = color === 'white' ? 
        gameState.piecesMoved.whiteRookLeft : 
        gameState.piecesMoved.blackRookLeft;
    
    if (!queensideRookMoved) {
        // 킹과 룩 사이에 다른 말이 없는지 확인
        if (!board[kingRow][1] && !board[kingRow][2] && !board[kingRow][3]) {
            // 킹이 지나가는 칸이 공격받고 있는지 확인
            const kingPassesSafely = !isPositionUnderAttack(kingRow, 3, color, board);
            
            if (kingPassesSafely) {
                moves.push({ row: kingRow, col: 2 });
            }
        }
    }
}

// 특정 위치가 공격받고 있는지 확인
function isPositionUnderAttack(row, col, color, board) {
    const oppositeColor = color === 'white' ? 'black' : 'white';
    
    // 상대방의 모든 말 조사
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            
            if (piece && piece.color === oppositeColor) {
                // 각 상대 말마다 가능한 이동 계산
                const possibleMoves = [];
                
                switch (piece.type) {
                    case 'pawn':
                        // 폰은 특수 케이스: 공격 방향만 확인
                        const direction = oppositeColor === 'white' ? -1 : 1;
                        
                        if (r + direction === row) {
                            if (c - 1 === col || c + 1 === col) {
                                return true;
                            }
                        }
                        break;
                    case 'knight':
                        calculateKnightMoves(r, c, oppositeColor, possibleMoves, board);
                        break;
                    case 'bishop':
                        calculateBishopMoves(r, c, oppositeColor, possibleMoves, board);
                        break;
                    case 'rook':
                        calculateRookMoves(r, c, oppositeColor, possibleMoves, board);
                        break;
                    case 'queen':
                        calculateQueenMoves(r, c, oppositeColor, possibleMoves, board);
                        break;
                    case 'king':
                        // 킹은 직접 계산 (재귀 방지)
                        const kingDirections = [
                            { rowChange: 1, colChange: 0 },
                            { rowChange: -1, colChange: 0 },
                            { rowChange: 0, colChange: 1 },
                            { rowChange: 0, colChange: -1 },
                            { rowChange: 1, colChange: 1 },
                            { rowChange: 1, colChange: -1 },
                            { rowChange: -1, colChange: 1 },
                            { rowChange: -1, colChange: -1 }
                        ];
                        
                        for (const dir of kingDirections) {
                            if (r + dir.rowChange === row && c + dir.colChange === col) {
                                return true;
                            }
                        }
                        break;
                }
                
                // 계산된 이동에 목표 위치가 포함되어 있는지 확인
                if (possibleMoves.some(move => move.row === row && move.col === col)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// 킹이 체크 상태인지 확인
function isKingInCheck(board, color) {
    let kingRow = -1;
    let kingCol = -1;
    
    // 킹의 위치 찾기
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.type === 'king' && piece.color === color) {
                kingRow = r;
                kingCol = c;
                break;
            }
        }
        if (kingRow !== -1) break;
    }
    
    // 킹의 위치가 공격받고 있는지 확인
    return isPositionUnderAttack(kingRow, kingCol, color, board);
}

// 게임 종료 조건 확인
function checkGameEndConditions() {
    const currentColor = gameState.currentPlayer;
    
    // 가능한 모든 이동을 찾아서 체크메이트나 스테일메이트 판정
    let hasLegalMoves = false;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = gameState.board[r][c];
            
            if (piece && piece.color === currentColor) {
                const possibleMoves = calculatePossibleMoves(r, c, piece, gameState.board);
                
                // 체크 상태에서는 체크를 피하는 움직임만 고려
                const legalMoves = gameState.check ? 
                    possibleMoves.filter(move => {
                        const testBoard = JSON.parse(JSON.stringify(gameState.board));
                        
                        // 테스트 이동 실행
                        testBoard[r][c] = null;
                        testBoard[move.row][move.col] = { ...piece };
                        
                        // 이동 후 여전히 체크 상태인지 확인
                        return !isKingInCheck(testBoard, currentColor);
                    }) : 
                    possibleMoves;
                
                if (legalMoves.length > 0) {
                    hasLegalMoves = true;
                    break;
                }
            }
        }
        if (hasLegalMoves) break;
    }
    
    // 50수 규칙 체크
    if (gameState.halfMoveCount >= 100) {
        gameState.gameOver = true;
        gameState.draw = true;
        return;
    }
    
    // 3회 반복 체크
    checkThreefoldRepetition();
    
    if (!hasLegalMoves) {
        if (gameState.check) {
            // 체크메이트
            gameState.checkmate = true;
            gameState.gameOver = true;
            gameState.winner = currentColor === 'white' ? 'black' : 'white';
        } else {
            // 스테일메이트
            gameState.stalemate = true;
            gameState.gameOver = true;
            gameState.draw = true;
        }
    }
}

// 3회 반복 규칙 확인
function checkThreefoldRepetition() {
    const positionCounts = {};
    
    for (const position of gameState.moveHistory) {
        positionCounts[position] = (positionCounts[position] || 0) + 1;
        
        if (positionCounts[position] >= 3) {
            gameState.gameOver = true;
            gameState.draw = true;
            return true;
        }
    }
    
    return false;
}

// 특정 색상의 말이 합법적인 이동을 할 수 있는지 확인
function hasLegalMoves(board, color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            
            if (piece && piece.color === color) {
                const possibleMoves = calculatePossibleMoves(r, c, piece, board);
                
                // 체크를 피할 수 있는 이동이 하나라도 있는지 확인
                for (const move of possibleMoves) {
                    const testBoard = JSON.parse(JSON.stringify(board));
                    
                    // 테스트 이동 실행
                    testBoard[r][c] = null;
                    testBoard[move.row][move.col] = { ...piece };
                    
                    // 이동 후 체크 상태가 아니면 합법적인 이동이 있음
                    if (!isKingInCheck(testBoard, color)) {
                        return true;
                    }
                }
            }
        }
    }
    
    // 합법적인 이동이 없음
    return false;
}

// 상태 메시지 업데이트 함수
function updateStatusMessage(message) {
    statusElement.textContent = message;
}

// 게임 종료 오버레이 렌더링
function renderGameOverOverlay() {
    // 이미 오버레이가 있는지 확인
    const existingOverlay = document.querySelector('.game-over-overlay');
    if (existingOverlay) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    
    const messageContainer = document.createElement('div');
    messageContainer.className = 'game-over-message';
    
    const title = document.createElement('h2');
    
    let message = '';
    
    if (gameState.checkmate) {
        title.textContent = '체크메이트!';
        const winner = gameState.winner === 'white' ? '흰색' : '검은색';
        message = `${winner} 플레이어의 승리입니다!`;
    } else if (gameState.stalemate) {
        title.textContent = '스테일메이트!';
        message = '더 이상 움직일 수 없는 상태입니다. 무승부입니다!';
    } else if (gameState.draw) {
        title.textContent = '무승부!';
        if (gameState.fiftyMoveRule) {
            message = '50수 규칙에 의한 무승부입니다.';
        } else if (gameState.repetitionDraw) {
            message = '동일 국면 3회 반복에 의한 무승부입니다.';
        } else {
            message = '합의에 의한 무승부입니다.';
        }
    } else if (gameState.playerLeft) {
        title.textContent = '상대방 게임 이탈!';
        message = `상대 플레이어가 게임을 나갔습니다. ${gameState.winner === 'white' ? '흰색' : '검은색'} 플레이어의 승리입니다!`;
    } else if (gameState.resigned) {
        title.textContent = '기권!';
        message = `상대 플레이어가 기권했습니다. ${gameState.winner === 'white' ? '흰색' : '검은색'} 플레이어의 승리입니다!`;
    } else {
        title.textContent = '게임 종료!';
        message = '게임이 종료되었습니다.';
    }
    
    messageContainer.appendChild(title);
    
    const winnerText = document.createElement('p');
    winnerText.className = 'winner';
    winnerText.textContent = message;
    messageContainer.appendChild(winnerText);
    
    const newGameBtn = document.createElement('button');
    newGameBtn.textContent = '새 게임';
    newGameBtn.addEventListener('click', () => {
        // 게임 리셋
        socket.emit('resetGame', { roomId: currentRoomId });
        
        // 오버레이 제거
        overlay.remove();
    });
    
    const lobbyBtn = document.createElement('button');
    lobbyBtn.textContent = '로비로 돌아가기';
    lobbyBtn.addEventListener('click', () => {
        // 로비로 돌아가기
        leaveRoom();
        
        // 오버레이 제거
        overlay.remove();
    });
    
    messageContainer.appendChild(newGameBtn);
    messageContainer.appendChild(document.createElement('br'));
    messageContainer.appendChild(lobbyBtn);
    
    overlay.appendChild(messageContainer);
    boardElement.appendChild(overlay);
} 