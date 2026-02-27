# 🎮 WCGames 에이전트 개발 규칙 (Senior Level)

모든 대화와 코드는 **한국어**로 진행하며, 다음 기술 지침을 엄격히 준수합니다.

## 1. 표준 작업 프로세스 (PDCA)
1. **[계획]**: `implementation_plan.md` 작성 및 승인.
2. **[개발]**: 확정된 계획에 따라 고품질 코드 구현.
3. **[검증]**: `walkthrough.md`로 테스트 결과 보고.

## 2. 핵심 기술 지침

### 🚀 성능 및 Game Loop
- **deltaTime 기반 업데이트**: 모든 움직임은 `WCGames.updateDelta()`를 통해 계산된 `dt`를 사용해야 합니다.
- **Fixed Timestep**: 프레임 스파이크 방지를 위해 `dt`는 최대 0.033s(30fps)로 캡핑됩니다.
- **Visibility Handling**: SDK가 자동으로 일시정지/재개를 처리합니다. 게임은 `onPause`, `onResume` 콜백을 통해 사운드나 타이머를 제어합니다.

### 🧠 메모리 및 리소스 관리
- **GC 최적화**: 게임 루프(`update`, `draw`) 내에서 `new`로 객체를 생성하지 않습니다.
- **오브젝트 풀링**: 탄환, 파티클 등 반복 생성 객체는 반드시 풀링(Pooling) 방식으로 관리합니다.
- **리소스 정리**: `Restart` 호출 시 이전 세션의 GPU 메모리(Three.js geometry, material 등)를 반드시 `dispose()` 합니다.

### 📱 모바일 최적화 (Mobile First)
- **터치 대응**: 클릭 이벤트 대신 `pointerdown` 또는 `touchstart`를 우선 고려합니다. (300ms 지연 방지)
- **해상도**: `window.devicePixelRatio`를 반영하여 캔버스를 렌더링합니다.
- **입력 방지**: 롱프레스 복사, 컨텍스트 메뉴 등을 방지하는 CSS와 SDK 기능을 활용합니다.

### 🎧 오디오 관리
- **SDK AudioManager**: 게임마다 개별 클래스를 만들지 말고 `WCGames.Audio`를 사용합니다.
- **사용자 제스처**: 반드시 `onStart` (Play 버튼 클릭) 시점에 `WCGames.Audio.init()`를 호출해야 합니다.

## 3. SDK 연동 가이드
- **상태 보호**: `gameOver()`는 `PLAYING` 상태에서만 동작하도록 가드되어 있습니다.
- **에러 핸들링**: 모든 게임 콜백은 SDK 내부에서 `try-catch`로 보호됩니다.
- **디버그 모드**: URL에 `?debug`를 추가하여 SDK 로그를 확인할 수 있습니다.

## 4. UI/UX 디자인
- **모달 팝업 필수**: 모든 게임 내 팝업(시작 화면, 게임 오버 등)은 사용자 경험의 일관성을 위해 반드시 **모달(Modal)** 형태로 작성해야 합니다.
- **Visual Excellence**: 네온(Neon) 및 글래스모피즘(Glassmorphism) 스타일을 기본 테마로 사용합니다.
- **공용 스타일**: `wcgames-style.css`의 `.wcg-overlay`, `.wcg-popup` 클래스를 활용하여 배경 흐림(Blur) 및 중앙 정렬 모달을 구현합니다.

---
**주의**: 모든 게임 수정 시 `.agents/workflows/add_new_game.md`를 반드시 참조하십시오.
