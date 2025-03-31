const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// 정적 파일 제공
app.use(express.static(path.join(__dirname, './')));

// 게임 방 관리
const rooms = new Map();

// 소켓 연결 처리
io.on('connection', (socket) => {
    console.log('사용자 연결됨:', socket.id);
    
    // 사용자 연결 해제 시
    socket.on('disconnect', () => {
        console.log('사용자 연결 해제:', socket.id);
        
        // 사용자가 속한 방에서 사용자 제거
        for (const roomId of rooms.keys()) {
            const room = rooms.get(roomId);
            
            if (room.white === socket.id) {
                // 백 플레이어가 나간 경우
                io.to(roomId).emit('playerLeft', { color: 'white' });
                room.white = null;
            } else if (room.black === socket.id) {
                // 흑 플레이어가 나간 경우
                io.to(roomId).emit('playerLeft', { color: 'black' });
                room.black = null;
            } else if (room.spectators && room.spectators.includes(socket.id)) {
                // 관전자가 나간 경우
                room.spectators = room.spectators.filter(id => id !== socket.id);
            }
            
            // 방에 남은 플레이어가 없으면 방 삭제
            if (!room.white && !room.black && (!room.spectators || room.spectators.length === 0)) {
                rooms.delete(roomId);
                console.log('방 삭제됨:', roomId);
            }
        }
        
        // 업데이트된 방 목록 전송
        io.emit('roomList', Array.from(rooms.values()).map(room => ({ 
            id: room.id, 
            name: room.name,
            white: !!room.white, 
            black: !!room.black
        })));
    });
    
    // 방 목록 요청
    socket.on('getRooms', () => {
        socket.emit('roomList', Array.from(rooms.values()).map(room => ({ 
            id: room.id, 
            name: room.name,
            white: !!room.white, 
            black: !!room.black
        })));
    });
    
    // 방 생성
    socket.on('createRoom', (data) => {
        const roomId = generateRoomId();
        const room = {
            id: roomId,
            name: data.name,
            white: socket.id,
            black: null,
            spectators: [],
            gameState: {
                board: initializeBoard(),
                currentPlayer: 'white',
                selectedPiece: null,
                possibleMoves: [],
                check: false,
                checkmate: false,
                stalemate: false,
                gameOver: false
            },
            whiteReady: false,
            blackReady: false
        };
        
        rooms.set(roomId, room);
        
        // 방 생성자의 색상은 항상 흰색
        const playerData = {
            roomId,
            color: 'white'
        };
        
        console.log(`[방 생성] 방 ID: ${roomId}, 방장: ${socket.id}, 색상: white`);
        
        // 소켓을 방에 조인
        socket.join(roomId);
        
        // 방 생성 결과 전송
        socket.emit('roomCreated', playerData);
        
        // 방 목록 업데이트
        updateRoomList();
    });
    
    // 방 참가
    socket.on('joinRoom', (data) => {
        const { roomId } = data;
        
        if (!rooms.has(roomId)) {
            return socket.emit('error', '존재하지 않는 방입니다.');
        }
        
        const room = rooms.get(roomId);
        let color = null;
        
        // 이미 가득 찬 방인지 확인
        if (room.white && room.black) {
            // 관전자로 참가
            room.spectators.push(socket.id);
            socket.join(roomId);
            
            const playerData = {
                roomId,
                color: 'spectator',
                gameState: room.gameState
            };
            
            socket.emit('joinedAsSpectator', playerData);
            io.to(roomId).emit('spectatorJoined', { playerId: socket.id });
            
            console.log(`[관전자 참가] 방 ID: ${roomId}, 관전자: ${socket.id}`);
            return;
        }
        
        // 빈 자리 찾기
        if (!room.white) {
            room.white = socket.id;
            color = 'white';
        } else if (!room.black) {
            room.black = socket.id;
            color = 'black';
        }
        
        console.log(`[방 참가] 방 ID: ${roomId}, 플레이어: ${socket.id}, 색상: ${color}`);
        
        // 소켓을 방에 조인
        socket.join(roomId);
        
        // 방 참가 결과 전송
        socket.emit('joinedRoom', {
            roomId,
            color,
            gameState: room.gameState
        });
        
        // 다른 플레이어에게 알림
        socket.to(roomId).emit('opponentJoined', {
            playerId: socket.id,
            color
        });
        
        // 두 플레이어가 모두 참가했는지 확인
        if (room.white && room.black) {
            io.to(roomId).emit('gameReady');
        }
        
        // 방 목록 업데이트
        updateRoomList();
    });
    
    // 방 떠나기
    socket.on('leaveRoom', ({ roomId }) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            return socket.emit('error', '존재하지 않는 방입니다.');
        }
        
        // 사용자가 어떤 역할인지 확인
        let color = null;
        
        if (room.white === socket.id) {
            color = 'white';
            room.white = null;
            room.whiteReady = false;
        } else if (room.black === socket.id) {
            color = 'black';
            room.black = null;
            room.blackReady = false;
        } else if (room.spectators && room.spectators.includes(socket.id)) {
            color = 'spectator';
            room.spectators = room.spectators.filter(id => id !== socket.id);
        }
        
        // 방 떠나기
        socket.leave(roomId);
        
        // 플레이어가 나간 경우 게임 상태 업데이트
        if (color === 'white' || color === 'black') {
            io.to(roomId).emit('playerLeft', { color });
            
            // 게임이 진행 중이었으면 게임 종료
            if (room.gameState && room.gameState.gameStarted) {
                room.gameState.gameOver = true;
                room.gameState.winner = color === 'white' ? 'black' : 'white';
                
                io.to(roomId).emit('gameOver', { 
                    reason: 'player_left',
                    winner: room.gameState.winner
                });
            }
        }
        
        // 방에 남은 플레이어가 없으면 방 삭제
        if (!room.white && !room.black && (!room.spectators || room.spectators.length === 0)) {
            rooms.delete(roomId);
            console.log('방 삭제됨:', roomId);
        }
        
        // 방 목록 업데이트
        updateRoomList();
        
        socket.emit('leftRoom');
    });
    
    // 게임 준비
    socket.on('ready', ({ roomId }) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            return socket.emit('error', '존재하지 않는 방입니다.');
        }
        
        // 플레이어 색상 확인
        let color = null;
        
        if (room.white === socket.id) {
            color = 'white';
            room.whiteReady = !room.whiteReady; // 토글 상태
        } else if (room.black === socket.id) {
            color = 'black';
            room.blackReady = !room.blackReady; // 토글 상태
        } else {
            return socket.emit('error', '플레이어만 준비 상태를 변경할 수 있습니다.');
        }
        
        // 준비 상태 여부
        const ready = color === 'white' ? room.whiteReady : room.blackReady;
        
        // 준비 상태 변경 알림
        io.to(roomId).emit('playerReady', { 
            playerId: socket.id,
            color: color,
            ready: ready
        });
        
        console.log(`방 ${roomId}: ${color} 플레이어 준비 상태 = ${ready}`);
        
        // 양쪽 모두 준비 완료된 경우 게임 시작
        if (room.white && room.black && room.whiteReady && room.blackReady) {
            io.to(roomId).emit('gameReady');
            
            // 3초 후 게임 시작
            setTimeout(() => {
                // 방이 아직 존재하는지 확인
                if (rooms.has(roomId)) {
                    // 기본 게임 상태 초기화
                    room.gameState = createInitialGameState();
                    
                    // 게임 시작 알림
                    io.to(roomId).emit('gameStart', { gameState: room.gameState });
                    
                    console.log(`방 ${roomId}: 게임 시작!`);
                }
            }, 3000);
        }
    });
    
    // 기물 이동 처리
    socket.on('movePiece', (moveData) => {
        const { roomId, from, to, gameState } = moveData;
        const room = rooms.get(roomId);
        
        if (!room) return;
        
        console.log(`[Room ${roomId}] 말 이동: ${from.row},${from.col} -> ${to.row},${to.col}`);
        console.log(`[Room ${roomId}] 현재 플레이어: ${gameState.currentPlayer}`);
        
        // 게임 상태 업데이트
        room.gameState = gameState;
        
        // 체크메이트 또는 스테일메이트 상태인지 확인
        if (gameState.checkmate) {
            console.log(`[Room ${roomId}] 체크메이트! ${gameState.winner} 승리`);
            // 모든 플레이어에게 게임 종료 알림
            io.to(roomId).emit('gameOver', {
                reason: 'checkmate',
                winner: gameState.winner
            });
        } else if (gameState.stalemate) {
            console.log(`[Room ${roomId}] 스테일메이트! 무승부`);
            // 모든 플레이어에게 무승부 알림
            io.to(roomId).emit('gameOver', {
                reason: 'stalemate',
                draw: true
            });
        } else if (gameState.fiftyMoveRule) {
            console.log(`[Room ${roomId}] 50수 규칙 적용! 무승부`);
            // 모든 플레이어에게 무승부 알림
            io.to(roomId).emit('gameOver', {
                reason: 'fifty_move_rule',
                draw: true
            });
        } else if (gameState.repetitionDraw) {
            console.log(`[Room ${roomId}] 3회 반복! 무승부`);
            // 모든 플레이어에게 무승부 알림
            io.to(roomId).emit('gameOver', {
                reason: 'threefold_repetition',
                draw: true
            });
        }
        
        // 다른 플레이어에게 이동 브로드캐스트
        socket.to(roomId).emit('pieceMoved', moveData);
    });
    
    // 채팅 메시지
    socket.on('sendMessage', (message) => {
        // 사용자가 속한 방 찾기
        let roomId = null;
        
        for (const id of rooms.keys()) {
            const room = rooms.get(id);
            if (room.white === socket.id || room.black === socket.id || 
                (room.spectators && room.spectators.includes(socket.id))) {
                roomId = id;
                break;
            }
        }
        
        if (!roomId) {
            return socket.emit('error', '참가한 방이 없습니다.');
        }
        
        const chatMessage = {
            sender: socket.id,
            text: message,
            timestamp: new Date().toISOString()
        };
        
        // 채팅 메시지 저장
        const room = rooms.get(roomId);
        room.chat.push(chatMessage);
        
        // 방의 모든 사용자에게 메시지 전파
        io.to(roomId).emit('chatMessage', chatMessage);
    });
    
    // 패배 선언
    socket.on('resign', () => {
        // 사용자가 속한 방 찾기
        let roomId = null;
        let color = null;
        
        for (const id of rooms.keys()) {
            const room = rooms.get(id);
            if (room.white === socket.id) {
                roomId = id;
                color = 'white';
                break;
            } else if (room.black === socket.id) {
                roomId = id;
                color = 'black';
                break;
            }
        }
        
        if (!roomId || !color) {
            return socket.emit('error', '게임 중인 방이 없습니다.');
        }
        
        const room = rooms.get(roomId);
        
        if (!room.gameState || !room.gameState.gameStarted) {
            return socket.emit('error', '게임이 시작되지 않았습니다.');
        }
        
        // 게임 종료 처리
        room.gameState.gameOver = true;
        room.gameState.winner = color === 'white' ? 'black' : 'white';
        
        // 모든 플레이어에게 게임 종료 알림
        io.to(roomId).emit('gameOver', { 
            reason: 'resign',
            winner: room.gameState.winner
        });
    });
    
    // 무승부 제안
    socket.on('offerDraw', () => {
        // 사용자가 속한 방 찾기
        let roomId = null;
        let color = null;
        
        for (const id of rooms.keys()) {
            const room = rooms.get(id);
            if (room.white === socket.id) {
                roomId = id;
                color = 'white';
                break;
            } else if (room.black === socket.id) {
                roomId = id;
                color = 'black';
                break;
            }
        }
        
        if (!roomId || !color) {
            return socket.emit('error', '게임 중인 방이 없습니다.');
        }
        
        const room = rooms.get(roomId);
        
        if (!room.gameState || !room.gameState.gameStarted) {
            return socket.emit('error', '게임이 시작되지 않았습니다.');
        }
        
        // 무승부 제안을 상대방에게 전송
        const opponentId = color === 'white' ? room.black : room.white;
        
        if (opponentId) {
            io.to(opponentId).emit('drawOffer', { from: color });
        }
    });
    
    // 무승부 수락
    socket.on('acceptDraw', () => {
        // 사용자가 속한 방 찾기
        let roomId = null;
        
        for (const id of rooms.keys()) {
            const room = rooms.get(id);
            if (room.white === socket.id || room.black === socket.id) {
                roomId = id;
                break;
            }
        }
        
        if (!roomId) {
            return socket.emit('error', '게임 중인 방이 없습니다.');
        }
        
        const room = rooms.get(roomId);
        
        if (!room.gameState || !room.gameState.gameStarted) {
            return socket.emit('error', '게임이 시작되지 않았습니다.');
        }
        
        // 게임 종료 처리
        room.gameState.gameOver = true;
        room.gameState.draw = true;
        
        // 모든 플레이어에게 무승부 알림
        io.to(roomId).emit('gameOver', { 
            reason: 'draw_agreement',
            draw: true
        });
    });
    
    // 게임 리셋
    socket.on('resetGame', ({ roomId }) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            return socket.emit('error', '존재하지 않는 방입니다.');
        }
        
        // 게임 상태 초기화
        room.gameState = null;
        room.whiteReady = false;
        room.blackReady = false;
        
        console.log(`[Room ${roomId}] 게임 리셋`);
        
        // 모든 플레이어에게 게임 리셋 알림
        io.to(roomId).emit('resetGame');
    });
});

// 랜덤 방 ID 생성
function generateRoomId() {
    return Math.random().toString(36).substring(2, 10);
}

// 초기 게임 상태 생성 함수
function createInitialGameState() {
    return {
        board: initializeBoard(),
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
        moveHistory: [],
        gameStarted: true
    };
}

// 초기 보드 상태
function initialBoard() {
    return [
        [
            { type: 'rook', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'queen', color: 'black' },
            { type: 'king', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'rook', color: 'black' }
        ],
        [
            { type: 'pawn', color: 'black' },
            { type: 'pawn', color: 'black' },
            { type: 'pawn', color: 'black' },
            { type: 'pawn', color: 'black' },
            { type: 'pawn', color: 'black' },
            { type: 'pawn', color: 'black' },
            { type: 'pawn', color: 'black' },
            { type: 'pawn', color: 'black' }
        ],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [
            { type: 'pawn', color: 'white' },
            { type: 'pawn', color: 'white' },
            { type: 'pawn', color: 'white' },
            { type: 'pawn', color: 'white' },
            { type: 'pawn', color: 'white' },
            { type: 'pawn', color: 'white' },
            { type: 'pawn', color: 'white' },
            { type: 'pawn', color: 'white' }
        ],
        [
            { type: 'rook', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'queen', color: 'white' },
            { type: 'king', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'rook', color: 'white' }
        ]
    ];
}

// 방 목록 업데이트 함수
function updateRoomList() {
    io.emit('roomList', Array.from(rooms.values()).map(room => ({ 
        id: room.id, 
        name: room.name,
        white: !!room.white, 
        black: !!room.black
    })));
}

// 초기 체스 보드 생성 함수
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

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
}); 