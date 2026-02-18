# PDCA Implementation Guide: 하이퍼 게임 플랫폼 (Hyper Game Platform)

## 1. 프로젝트 초기화 (Project Initialization)
- **명령어**: `npm create vite@latest . -- --template react-ts`
- **의존성 설치**:
  - `react-router-dom`: 페이지 라우팅
  - `zustand`: 전역 상태 관리
  - `lucide-react`: UI 아이콘
  - `tailwindcss`, `postcss`, `autoprefixer`: 스타일링 (v4 적용됨)

## 2. 주요 구현 내용 (Core Implementation)

### 2.1. 디렉토리 구조
```
src/
  ├── components/   # UI 컴포넌트
  ├── pages/        # Lobby, Player 페이지
  ├── hooks/        # useGameStore (Zustand)
  └── App.tsx       # 라우터 설정
public/
  └── games/        # 개별 게임 에셋 (iframe용)
```

### 2.2. 상태 관리 (Zustand Store)
- **파일**: `src/hooks/useGameStore.ts`
- **기능**: 게임 목록 정의 및 현재 선택된 게임 상태 관리

### 2.3. 페이지 구현
- **Lobby (`src/pages/Lobby.tsx`)**: 게임 목록 그리드 뷰, 카드 클릭 시 플레이 페이지 이동.
- **Player (`src/pages/Player.tsx`)**: 
  - `<iframe>`을 통한 게임 실행 환경 제공.
  - `window.addEventListener('message', ...)`를 통한 점수 수신 및 UI 업데이트.

### 2.4. 샘플 게임
- **위치**: `public/games/sample/index.html`
- **기능**: 버튼 클릭 시 점수 증가 및 부모 창(플랫폼)으로 `postMessage` 전송.

## 3. 설정 및 빌드 (Configuration & Build)
- **Tailwind CSS v4**: `src/index.css`에 `@import "tailwindcss";` 적용.
- **TypeScript**: `verbatimModuleSyntax` 설정에 맞춰 `import type` 사용.
- **빌드**: `npm run build` 성공 확인 (PostCSS 플러그인 이슈 해결 완료).

## 4. 실행 방법 (How to Run)
1. `npm install` (의존성 설치)
2. `npm run dev` (개발 서버 실행)
3. 브라우저에서 `http://localhost:5173` 접속
