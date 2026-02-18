# PDCA Design: 하이퍼 게임 플랫폼 (Hyper Game Platform)

## 1. 시스템 아키텍처 (System Architecture)
플랫폼은 React 기반의 SPA로 작동하며, 각 게임은 격리된 iframe 환경에서 플랫폼과 통신합니다.

- **State Management**: Zustand (`useGameStore`)
- **Routing**: React Router (`/`, `/play/:gameId`)
- **Communication Layer**: Window PostMessage API
- **Styling**: Tailwind CSS v4 (Modern/Dark UI)

## 2. 컴포넌트 구조 (Component Structure)
- **Lobby**: 게임 목록 그리드 및 필터링
- **Player**: 
  - `TopBar`: 뒤로가기, 타이틀, 실시간 점수 표시
  - `GameContainer`: `<iframe>`을 통한 게임 렌더링
- **Shared**: Lucide React 아이콘 및 Tailwind 유틸리티 클래스

## 3. 데이터 및 인터페이스 (Data & Interface)
### 3.1. Game 모델
```typescript
interface Game {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  gameUrl: string;
  category: string;
}
```

### 3.2. 메시지 규격 (PostMessage)
- **Game → Platform**:
  - `GAME_READY`: 로딩 완료
  - `SUBMIT_SCORE`: 점수 갱신 (`payload.score`)
- **Platform → Game**:
  - `START_GAME`, `PAUSE_GAME` (향후 확장 예정)

## 4. 구현 상세 (Implementation Details)
- **Vite**: 고속 번들링 및 HMR 제공
- **Tailwind v4**: `@import "tailwindcss"`를 통한 최신 CSS 엔진 활용
- **TypeScript**: `verbatimModuleSyntax` 설정을 준수하는 모듈 시스템
