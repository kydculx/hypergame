---
description: WCGames 프로젝트의 네온(Neon) & 글래스모피즘(Glassmorphism) UI 스타일링 가이드라인
---

이 워크플로우는 프로젝트에 새로운 UI 컴포넌트(모달, 카드, 버튼 등)를 추가하거나 수정할 때 반드시 지켜야 하는 고유의 스타일 지침입니다.

## 핵심 컨셉
1. **다크 모드 베이스**: 배경은 매우 어두운 남색/검정(`bg-[#0f1123]` 또는 `bg-[#1A1B2E]`)을 사용합니다.
2. **글래스모피즘 (유리 효과)**: 창이 뜨는 모달이나 오버레이는 반투명한 블러 효과를 가집니다 (`backdrop-blur-md`, `backdrop-blur-xl`, `bg-black/60`).
3. **은은한 테두리 (Border)**: 컴포넌트 간의 구분 선은 하얗고 굵은 실선 대신, 투명도 높은 1px 선을 사용해 자연스럽게 반사되는듯한 시각효과를 줍니다.
   - 예시: `border border-white/10` 또는 `border border-cyan-500/30`
4. **네온 글로우 (Neon Glow)**: `hover` 액션 시에는 단색 배경이 바뀌는 대신, 형광(시안/앰버/핑크) 계열의 그림자(`shadow`)나 링(`ring`)이 은은하게 퍼지도록 처리합니다.
   - 예시: `hover:shadow-[0_8px_30px_rgba(14,165,233,0.5)]`

## 컴포넌트 제작 시 필수 수칙
- **절대 투박한 Solid Border 사용 금지**: `border-white` 등 투명도가 없는 선은 피하세요.
- 컴포넌트를 중앙 정렬할 때, 브라우저 크기 변화에 대응하기 위해 `fixed inset-0 flex items-center justify-center p-4` 구조를 고려하세요.
- 상태값(Rank, 1st/2nd/3rd)별 렌더링 시 하드코딩된 색상 말고 `amber-400`, `slate-300`, `amber-700` 등 일관된 Tailwind 프리셋을 사용하세요.
