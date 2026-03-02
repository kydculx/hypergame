---
name: QA-Performance-Expert
description: HTML5 및 WebGL(Three.js) 게임의 프레임 저하(FPS Drop), 메모리 누수(Memory Leak) 및 런타임 에러를 진단하고 해결하는 전문가 스킬입니다.
---

# WebGL QA & Performance Tuning Skill

이 스킬은 게임의 렌더링 성능이 저하되거나 장시간 플레이 시 메모리 누수가 발생할 때, 에이전트(AI)가 마치 전문 최적화 엔지니어처럼 행동하도록 안내합니다.

## 🛠 주요 점검 절차 (에이전트 행동 지침)

### 1. Three.js 리소스 해제(Dispose) 추적
- `grep_search` 도구를 사용하여 프로젝트 내에서 `new THREE.Geometry`, `new THREE.Material`, `new THREE.Texture`가 생성되는 곳을 모두 찾습니다.
- 객체가 화면에서 사라지거나 삭제될 때 `scene.remove(object)` 뿐만 아니라 `geometry.dispose()`, `material.dispose()`, `texture.dispose()`가 명시적으로 호출되고 있는지 코드 컨텍스트를 분석합니다.
- 해제되지 않는 리소스가 발견되면, 사용량을 줄일 수 있는 풀링(Object Pooling) 기법이나 적절한 Dispose 로직을 사용자에게 제안하고 코드를 수정합니다.

### 2. 렌더 루프(Render Loop) 최적화 검토
- `requestAnimationFrame` 내부(메인 게임 루프 등)에서 매 프레임마다 불필요하게 객체를 생성(`new THREE.Vector3()`, `new THREE.Color()` 등)하는 안티 패턴이 있는지 `grep_search`로 분석합니다.
- 임시 객체 생성을 막기 위해 재사용 가능한 전역/클래스 변수로 분리(Hoisting)하는 리팩토링을 수행합니다.

### 3. 브라우저 콘솔 및 성능 로그 분석
- 사용자에게 브라우저의 Console 에러 로그나 Performance 탭의 경고(Warning)를 텍스트로 전달해 달라고 요청합니다. (또는 필요시 Node.js 환경에서 헤드리스 브라우저 스크립트를 작성하여 테스트를 시뮬레이션 합니다.)
- 발견된 병목 지점(Bottleneck)의 원인을 파악하고 즉각적인 코드 패치 방안(`implementation_plan.md`)을 제시합니다.

## ✨ 최적화 완료 기준
- 매 프레임마다의 Garbage Collection 발생이 최소화되었는가?
- 화면 밖으로 나간 객체(Obstacles, Items)가 정확히 파괴되거나 풀(Pool)로 반환되었는가?
- Draw Call 횟수를 줄이기 위해 메시 병합(InstancedMesh 등)이 적절히 고려되었는가?
