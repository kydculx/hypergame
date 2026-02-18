# PDCA Design: 사용자 프로필 시스템 (User Profile System)

## 1. 데이터 모델 (Data Model)

### 1.1. Profile State
```typescript
interface UserProfile {
  nickname: string;
  avatarColor: string; // 랜덤 컬러 또는 선택된 컬러
  joinedAt: number;
}
```

### 1.2. 전역 상태 확장 (`useGameStore`)
- **State**: `userProfile: UserProfile`
- **Initial State**: 
  - `nickname`: "Guest_" + 랜덤 숫자
  - `avatarColor`: 랜덤 hex 컬러
- **Actions**:
  - `setNickname(name: string)`: 닉네임 유효성 검사 후 업데이트.
  - `addScore`: 기존 로직을 수정하여 `get().userProfile.nickname`을 사용하도록 연동.

## 2. UI/UX 설계 (UI/UX Design)

### 2.1. 프로필 관리 컴포넌트 (`UserProfile.tsx`)
- 로비 상단 우측(또는 헤더)에 위치.
- 현재 닉네임과 아바타 아이콘 표시.
- 클릭 시 인라인 편집 모드 또는 작은 팝오버 창 활성화.
- **입력 제한**: 최소 2자, 최대 12자. 영문/한글/숫자 허용.

### 2.2. 로비 헤더 연동
- "Welcome back, [Nickname]!" 형태의 개인화된 환영 메시지 출력.

## 3. 지속성 보완 (Persistence)
- `hyper-game-storage`의 `partialize` 옵션에 `userProfile` 필드 추가하여 자동 저장되도록 설정.

## 4. 로직 흐름 (Logic Flow)
1. 사용자가 로비에서 닉네임 옆의 '수정' 아이콘 클릭.
2. 텍스트 입력 후 '저장' 또는 엔터 키 입력.
3. `useGameStore.setNickname` 호출 및 LocalStorage 저장.
4. 이후 모든 게임 종료 시 제출되는 점수 데이터에 변경된 닉네임이 기록됨.

## 5. 상세 구현 계획
- `src/hooks/useGameStore.ts`: `UserProfile` 인터페이스 추가 및 초기화 로직 구현.
- `src/components/UserProfile.tsx` 신규 생성: 프로필 표시 및 편집 UI.
- `src/pages/Lobby.tsx`: 헤더에 `UserProfile` 컴포넌트 통합 및 환영 문구 수정.
