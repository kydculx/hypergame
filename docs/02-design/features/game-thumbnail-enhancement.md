# PDCA Design: 게임 썸네일 강화 (Game Thumbnail Enhancement)

## 1. 비주얼 컨셉 (Visual Concept)
각 게임의 장르와 분위기를 즉각적으로 전달할 수 있는 고해상도 이미지와 컬러 테마를 조합합니다.

### 1.1. 게임별 테마
- **Sample Clicker**: 
  - **이미지**: 깨끗하고 밝은 미니멀리즘 스타일.
  - **테마 컬러**: Indigo (#6366f1).
  - **대표 이미지**: 고품질 마우스/클릭 관련 추상 이미지.
- **Stack Tower**:
  - **이미지**: 기하학적이고 구조적인 3D 오브젝트 스타일.
  - **테마 컬러**: Rose/Red (#f43f5e).
  - **대표 이미지**: 쌓여있는 블록 또는 건축적 구조물 이미지.
- **Neon Jump**:
  - **이미지**: 어두운 배경에 강렬한 대비가 있는 사이버펑크 스타일.
  - **테마 컬러**: Cyan (#06b6d4).
  - **대표 이미지**: 네온 사인 또는 빛의 궤적 이미지.

## 2. 데이터 업데이트 (Data Model)
`useGameStore.ts`의 `thumbnailUrl`을 placeholder에서 엄선된 Unsplash 고화질 이미지 URL로 교체합니다.

| Game ID | New Thumbnail URL Source | Theme Color |
| :--- | :--- | :--- |
| `sample-clicker` | `https://images.unsplash.com/photo-1586717791821-3f44a563dc4c?auto=format&fit=crop&q=80&w=600&h=400` | Indigo |
| `stack-tower` | `https://images.unsplash.com/photo-1513584684374-8bdb7483efbd?auto=format&fit=crop&q=80&w=600&h=400` | Rose |
| `neon-jump` | `https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=600&h=400` | Cyan |

## 3. UI/UX 개선 상세 (Lobby UI)

### 3.1. 카드 레이아웃 고도화
- **Image Container**: `aspect-video` 비율 유지 및 `overflow-hidden`.
- **Overlay**: 하단에 은은한 그라데이션 오버레이를 추가하여 타이틀 가독성 확보.
- **Hover Effect**: 
  - 이미지 `scale-110` 확대.
  - 카드의 그림자(`drop-shadow`) 강화.
  - 게임 카테고리 태그의 발광(Glow) 효과 추가.

### 3.2. 일관된 스타일링
- 모든 썸네일에 미세한 `brightness-90` 및 `contrast-110` 필터를 적용하여 플랫폼 전체의 톤앤매너 유지.

## 4. 구현 계획 (Implementation)
- `useGameStore.ts`: 상수 데이터 업데이트.
- `Lobby.tsx`: Tailwind CSS 클래스를 수정하여 카드 UI 강화 및 애니메이션 추가.
