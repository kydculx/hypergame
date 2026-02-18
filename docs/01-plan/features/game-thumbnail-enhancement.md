# PDCA Plan: 게임 썸네일 강화 (Game Thumbnail Enhancement)

## 1. 개요 (Overview)
현재 플랫폼 로비에서 사용 중인 단순한 placeholder 이미지를 각 게임의 특성을 살린 매력적인 썸네일로 교체하여 사용자 경험과 플랫폼의 완성도를 높입니다.

## 2. 목표 (Goals)
- **시각적 정체성 부여**: 각 게임(Clicker, Stack, Neon Jump)의 분위기에 맞는 썸네일 제작 및 적용.
- **로비 UI 개선**: 썸네일이 돋보일 수 있도록 카드 레이아웃 및 호버 효과 강화.
- **경량화**: 외부 이미지 의존도를 낮추기 위해 SVG 또는 CSS 기반의 아트워크 활용 고려.

## 3. 핵심 기능 (Key Features)
- **맞춤형 썸네일 자산**:
  - **Sample Clicker**: 마우스 클릭 아이콘과 밝은 톤의 배경.
  - **Stack Tower**: 3D 블록이 쌓여있는 형태의 아이코닉한 디자인.
  - **Neon Jump**: 네온 핑크/블루 대비가 강조된 사이버펑크 스타일 디자인.
- **이미지 최적화**: 로딩 속도를 고려한 최적의 이미지 포맷 적용.
- **UI 애니메이션**: 썸네일에 마우스를 올렸을 때 확대되거나 빛나는 효과 추가.

## 4. 기술 스택 (Technical Stack)
- **Assets**: CSS Drawing, SVG, 또는 고품질 무료 에셋.
- **Framework**: React, Tailwind CSS.

## 5. 로드맵 (Roadmap)
1. **Phase 1: 썸네일 에셋 준비** - 각 게임별 개성 있는 이미지/SVG 소스 확보.
2. **Phase 2: 로직 수정** - `useGameStore`의 `thumbnailUrl` 업데이트.
3. **Phase 3: UI 스타일링** - Lobby 페이지의 카드 컴포넌트 고도화 (그라데이션, 그림자 등).
4. **Phase 4: 검증** - 다양한 해상도에서 썸네일이 선명하게 보이는지 확인.

## 6. 성공 지표 (Success Metrics)
- 로비 진입 시 첫인상이 훨씬 전문적이고 매력적으로 느껴짐.
- 썸네일 로딩 지연 없음.
