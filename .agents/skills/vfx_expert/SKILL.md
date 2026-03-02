---
name: VFX-Expert
description: HTML5 (Three.js/Canvas) 게임의 시각적 타격감, 파티클 시스템, 후처리(Post-processing) 효과를 전문적으로 설계하고 구현하는 스킬입니다.
---

# Web Game Visual Effects (VFX) Skill

이 스킬은 게임이 "밋밋하거나", "타격감이 부족할 때" 에이전트(AI)가 마치 전문 테크니컬 아티스트(TA) 및 이펙트 디자이너처럼 행동하도록 안내합니다.

## 🛠 주요 VFX 설계 절차 (에이전트 행동 지침)

### 1. 파티클 시스템(Particle System) 구축 및 튜닝
- 폭발(Explosion), 불꽃(Sparks), 부스터 궤적(Trails) 등 순간적인 시각 피드백이 필요한 곳을 분석합니다.
- `THREE.Points` 기반의 가벼운 커스텀 파티클 시스템을 작성하거나 기존 파티클 생성 로직을 고도화합니다.
- 파티클의 수명(Lifetime), 색상 전환(Gradient), 감속/가속 물리(Friction/Gravity)를 수학적으로 튜닝하여 쫀득한 타격감을 만듭니다.

### 2. 후처리(Post-Processing) 및 카메라 워크
- 게임의 아트 스타일에 맞게 `EffectComposer`를 활용한 렌더 패스(Render Pass)를 구성합니다.
- 어두운 배경(사이버펑크 등)에서는 `UnrealBloomPass`의 임계값(Threshold)과 강도(Strength)를 미세 조정하여 네온 불빛의 번짐 효과를 극대화합니다.
- 플레이어가 액션을 취하거나 충돌했을 때, 몰입감을 주기 위한 `Camera Shake`(화면 흔들림) 로직이나 동적 `FOV` 변경 기법을 코드에 주입합니다.

### 3. 모션 텐션(Juiciness) 강화
- 오브젝트가 나타나고 사라질 때 단순한 투명도 조절이 아닌, 커스텀 이징 함수(Elastic, Bounce)를 사용하여 튀어오르는 듯한(Juicy) 피드백을 추가합니다.
- 아이템 획득 시 UI 요소에도 동일하게 스케일/글리치(Glitch) 이징 애니메이션이 작동하도록 CSS와 연동합니다.

## ✨ 튜닝 완료 기준
- 장애물과 충돌 시 시야가 흔들리며 화면에 명확한 파편(Particles) 피드백이 전달되는가?
- 가속/아이템 획득 시 카메라 연출과 빛 번짐(Bloom) 이펙트가 게임의 긴장감을 더해주는가?
- 이러한 효과들이 모바일 기기에서도 프레임(60FPS) 드랍 없이 구동되도록 최적화된 파티클 카운트를 유지하는가?
