# 멀티플레이어 체스 게임

실시간으로 다른 사용자와 체스를 즐길 수 있는 웹 기반 멀티플레이어 체스 게임입니다.

## 기능

- 실시간 멀티플레이어 체스
- 방 생성 및 참가 시스템
- 게임 내 채팅
- 관전자 모드
- 모든 공식 체스 규칙 지원:
  - 캐슬링
  - 앙파상
  - 폰 승급
  - 체크와 체크메이트
  - 스테일메이트
  - 50수 규칙
  - 3회 반복 규칙

## 설치 및 실행

### 요구 사항

- Node.js (14.x 이상)
- npm 또는 yarn

### 설치

```bash
# 저장소 클론
git clone https://github.com/username/multiplayer-chess-game.git
cd multiplayer-chess-game

# 의존성 설치
npm install
# 또는
yarn install
```

### 실행

```bash
# 개발 모드로 서버 실행
npm run dev
# 또는
yarn dev

# 프로덕션 모드로 서버 실행
npm start
# 또는
yarn start
```

서버가 실행되면 브라우저에서 `http://localhost:3000`으로 접속하여 게임을 플레이할 수 있습니다.

## 게임 플레이 방법

1. **방 생성하기**
   - 닉네임과 원하는 색상(흰색/검은색)을 선택하고 "방 생성" 버튼을 클릭합니다.

2. **방 참가하기**
   - 방 목록에서 참가하고 싶은 방을 선택하고 색상을 선택하여 참가합니다.
   - 이미 다른 플레이어가 선택한 색상은 선택할 수 없습니다.
   - 관전자로 참가할 수도 있습니다.

3. **게임 준비**
   - 두 플레이어가 모두 방에 입장하면 "준비" 버튼을 클릭하여 게임 준비 상태로 변경합니다.
   - 양쪽 플레이어가 모두 준비되면 3초 후 게임이 시작됩니다.

4. **체스 말 이동**
   - 자신의 턴일 때 이동할 말을 클릭한 후, 이동하고자 하는 위치를 클릭합니다.
   - 가능한 이동 위치는 하이라이트로 표시됩니다.

5. **채팅 사용하기**
   - 오른쪽 채팅창에 메시지를 입력하여 상대방과 대화할 수 있습니다.

## 기술 스택

- **프론트엔드**: HTML, CSS, JavaScript
- **백엔드**: Node.js, Express
- **실시간 통신**: Socket.IO

## 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요. 