# PDCA Design: 네온 점프 (Neon Jump)

## 1. 아키텍처 및 라이브러리 (Architecture)
- **Engine**: Pure HTML5 Canvas API (2D)
- **Rendering**: RequestAnimationFrame 기반 게임 루프.
- **Audio**: Web Audio API 기반 오디오 신디사이징 (외부 에셋 없음).
- **Communication**: PostMessage API (`SUBMIT_SCORE`, `GAME_READY`, `GAME_OVER`).

## 2. 게임 메카니즘 설계 (Game Mechanics)

### 2.1. 플레이어 (Neon Square)
- **Physics**: 
  - 중력(Gravity): 0.6
  - 점프력(Lift): -8
  - 속도(Velocity) 제한: -15 to 15
- **Visual**: `shadowBlur`와 `strokeStyle`을 이용한 빛나는 정사각형.

### 2.2. 장애물 (Neon Pipes)
- **Structure**: 상단 기둥과 하단 기둥 사이의 틈새(Gap).
- **Generation**: 화면 오른쪽 끝에서 일정 간격으로 생성.
- **Movement**: 매 프레임마다 왼쪽으로 고정된 속도로 이동.
- **Scoring**: 장애물을 완전히 통과하면 `score++`.

### 2.3. 충돌 처리 (Collision)
- **Box-to-Box**: 플레이어 박스와 장애물 박스 간의 AABB 충돌 검사.
- **Screen Boundary**: 캔버스 상단/하단 경계를 벗어날 시 게임 오버.

## 3. 시각 효과 및 오디오 (Visuals & Audio)

### 3.1. 네온 효과
- 캔버스 `context.shadowBlur = 15` 적용.
- 매초 미세하게 색상이 변하는 사이버펑크 핑크/블루 테마.

### 3.2. 오디오 (Web Audio API)
- **Jump**: 고음의 Sine 파형 (짧게).
- **Score**: 맑은 Square 파형 (한 옥타브 도약).
- **Collision**: 저음의 Noise/Sawtooth 파형.

## 4. 파일 구조 (File Structure)
- `public/games/neon/index.html`: 게임 루직 및 렌더링 코드 전체 포함.
