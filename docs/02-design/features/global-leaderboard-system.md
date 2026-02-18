# PDCA Design: 전역 랭킹 시스템 (Global Leaderboard System)

## 1. 데이터 스키마 (Data Schema)
랭킹 정보를 저장하기 위한 중앙 데이터 구조를 정의합니다.

### 1.1. Leaderboard State
```typescript
interface ScoreEntry {
  userId: string; // 현재는 'Guest'로 고정
  score: number;
  date: number; // 타임스탬프
}

interface Leaderboard {
  [gameId: string]: ScoreEntry[]; // 게임별 상위 점수 배열
}
```

### 1.2. 전역 상태 확장 (`useGameStore`)
- **State**: `leaderboard: Leaderboard`
- **Actions**:
  - `addScore(gameId: string, score: number)`: 새로운 점수를 추가하고 정렬 후 상위 N개만 유지.
  - `getBestScore(gameId: string)`: 특정 게임의 역대 최고 기록 반환.

## 2. 지속성 설계 (Persistence)
- **Middleware**: Zustand의 `persist` 미들웨어를 사용하여 `leaderboard` 데이터를 LocalStorage에 자동 저장 및 로드.
- **Storage Key**: `hyper-game-leaderboard`

## 3. UI/UX 설계 (UI/UX Design)

### 3.1. 로비 랭킹 섹션 (Lobby Leaderboard)
- 로비 하단 또는 우측에 'Top Players' 섹션 배치.
- 게임별로 탭을 구분하여 1~5위 기록 표시.
- 1위는 금색 트로피 아이콘, 2위 은색, 3위 동색 아이콘 적용.

### 3.2. 플레이어 점수 표시 (Player Best Score)
- 게임 실행 중 상단 바에 '현재 점수'와 함께 '나의 최고 기록(Personal Best)'을 함께 표시하여 동기 부여.

## 4. 로직 흐름 (Logic Flow)
1. **점수 수신**: `Player.tsx`에서 `iframe`으로부터 `SUBMIT_SCORE` 또는 `GAME_OVER` 메시지 수신.
2. **상태 업데이트**: `useGameStore.addScore(currentGameId, score)` 호출.
3. **자동 정렬**: 새 점수가 상위 기록에 포함되는지 확인 후 배열 업데이트.
4. **UI 반영**: 로비 페이지 및 상단 바 UI가 즉시 갱신됨.

## 5. 상세 구현 계획
- `src/hooks/useGameStore.ts` 수정: `persist` 미들웨어 적용 및 랭킹 로직 추가.
- `src/pages/Lobby.tsx` 수정: 리더보드 컴포넌트 추가 및 그리드 레이아웃 조정.
- `src/pages/Player.tsx` 수정: 상단바에 최고 기록 표시 로직 추가.
