# PDCA Design: 네온 브레이크 (Neon Breakout)

## 1. 아키텍처 및 라이브러리 (Architecture)
- **Engine**: HTML5 Canvas 2D Context.
- **Physics Engine**: 커스텀 경계 충돌 및 입사각/반사각 물리 로직.
- **Rendering**: `requestAnimationFrame` 기반의 60FPS 렌더링.
- **State Management**: 게임 내 로컬 상태 (Score, Lives, Bricks array).

## 2. 게임 오브젝트 설계 (Object Design)

### 2.1. 패들 (Paddle)
- **Position**: 화면 하단 고정. 마우스/터치 X 좌표 추적.
- **Size**: 너비 100px, 높이 15px.
- **Visual**: Cyan 네온 글로우 효과.

### 2.2. 볼 (Ball)
- **Physics**: 
  - 기본 속도(Speed) 유지. 
  - 패들 충돌 위치에 따른 반사각 변화 (가운데는 수직, 끝부분은 수평에 가깝게).
- **Visual**: White/Pink 네온 원형.

### 2.3. 벽돌 (Bricks)
- **Layout**: 5행 8열 그리드 배치.
- **Type**: 
  - 일반 벽돌 (1회 타격 시 파괴).
  - 강화 벽돌 (2회 타격 시 파괴, 색상 변화).
- **Visual**: 행별로 다른 네온 컬러 (Purple, Blue, Green, Yellow, Orange).

## 3. 시각 및 청각 효과 (Visuals & Audio)

### 3.1. 파티클 시스템 (Particles)
- 벽돌 파괴 시 해당 벽돌의 색상을 가진 작은 사각형 파편 5~10개가 무작위 방향으로 비산하며 서서히 사라짐.

### 3.2. 오디오 (Web Audio API)
- **Hit Wall**: 짧은 틱 소리.
- **Hit Brick**: 경쾌한 타격음 (벽돌 종류에 따라 피치 다름).
- **Hit Paddle**: 낮은 톤의 둔탁한 소리.
- **Game Over**: 하강하는 전자음.

## 4. 플랫폼 인터페이스 (Interface)
- `GAME_READY`: 초기화 완료 시.
- `SUBMIT_SCORE`: 벽돌 파괴 시마다 누적 점수 전송.
- `GAME_OVER`: 공을 놓쳐 목숨이 0이 되었을 때.

## 5. 파일 구조 (File Structure)
- `public/games/breakout/index.html`: 게임 전체 로직 포함.
- `public/images/neon-breakout-thumb.svg`: 로컬 썸네일 파일.
