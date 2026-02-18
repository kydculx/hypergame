# PDCA Design: 스택 타워 게임 (Stack Tower Game)

## 1. 아키텍처 및 라이브러리 (Architecture)
- **Engine**: Three.js (WebGL)
- **Rendering**: WebGLRenderer, PerspectiveCamera, OrthographicCamera (선택적).
- **Communication**: `window.parent.postMessage`를 통한 플랫폼 연동.

## 2. 핵심 메카니즘 설계 (Core Mechanics)

### 2.1. 블록 데이터 모델
```typescript
interface Block {
  mesh: THREE.Mesh;
  width: number;
  depth: number;
  position: { x: number; y: number; z: number };
}
```

### 2.2. 블록 이동 로직
- 현재 활성화된 블록은 X축 또는 Z축으로 왕복 운동 (`Math.sin` 또는 선형 보간 활용).
- 층수가 올라갈 때마다 이동 방향(X -> Z -> X)을 변경.

### 2.3. 절단 알고리즘 (Cutting Logic)
1. 클릭 시 현재 블록의 위치와 아래 블록의 위치 비교.
2. 겹치는 영역(Overlap)의 크기와 중심 계산.
3. 겹치는 부분은 새로운 기반 블록이 되고, 겹치지 않는 부분은 물리 효과와 함께 추락 연출.
4. 만약 겹치는 영역이 0 이하라면 게임 오버.

### 2.4. 카메라 제어
- 타워가 높아질수록 카메라의 Y축 위치를 부드럽게 상승시켜 타워 꼭대기를 항상 주시 (`lerp` 사용).

## 3. UI 및 시각 효과 (Visuals)
- **배경색**: 층수가 올라감에 따라 색조(HSL)가 서서히 변하는 그라데이션 효과.
- **HUD**: 현재 층수(Score) 표시.
- **게임 오버**: "Game Over" 텍스트와 함께 '다시 시작' 버튼 표시.

## 4. 플랫폼 인터페이스 (Platform Interface)
- `GAME_READY`: 초기 로딩 완료 시 전송.
- `SUBMIT_SCORE`: 블록이 성공적으로 쌓일 때마다 현재 층수 전송.
- `GAME_OVER`: 게임 종료 시 전송.

## 5. 파일 구조 (File Structure)
- `public/games/stack/index.html`: 메인 진입점 및 Three.js 스크립트 포함.
- `public/games/stack/game.js`: 게임 엔진 로직.
