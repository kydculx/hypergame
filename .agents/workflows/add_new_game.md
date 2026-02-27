---
description: 플랫폼에 새로운 HTML5 웹게임을 추가하고 연동하는 가이드라인 (상세판)
---

이 워크플로우는 WCGames 플랫폼에 새로운 HTML5 아케이드 게임을 추가할 때 지켜야 하는 필수 기술 지침이며, 반드시 **계획 -> 개발 -> 검증** 프로세스를 따릅니다.

## 0. 작업 프로세스 체크리스트
- [ ] **계획**: 게임 컨셉, 필요한 에셋, SDK 연동 포인트 정의
- [ ] **개발**: 폴더 생성, `index.html` 구현, 스타일 및 SDK 적용
- [ ] **검증**: 로컬 실행, 점수 전송 테스트, 브라우저 호환성 확인

## 1. 프로젝트 구조 및 파일 위치
모든 게임은 `public/games/{game_id}/` 내에 위치해야 합니다.
- `index.html`: 메인 실행 파일
- `thumb.svg`: 300x300 썸네일 (SVG 권장)
- `locales/`: 다국어 번역 (ko, en)

## 2. 필수 SDK 및 스타일 포함
`index.html`의 `<head>`에 다음을 반드시 포함하세요.
```html
<link rel="stylesheet" href="/shared/wcgames-style.css">
<script src="/shared/wcgames-core.js"></script>
<script src="/shared/i18n.js"></script>
```

## 3. UI/UX 스타일 (Neon & Glassmorphism)
- 배경은 어두운 색상 유지
- 모달/팝업은 `backdrop-blur` 적용 (`.wcg-popup` 클래스 활용)
- 표준 ID 사용: `#start-screen`, `#game-over`, `#final-score`
- **모바일 롱프레스 복사/붙여넣기 방지**: `body`에 다음 CSS를 반드시 적용
```css
body {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
}
```

## 4. SDK 연동 (JavaScript)
게임 초기화 시 `WCGames.init()`를 호출하고, 종료 시 `WCGames.gameOver(score)`를 호출합니다.
**PLAY 버튼(onStart)에서 반드시 AudioContext를 초기화**해야 합니다. 모바일 브라우저는 사용자 제스처 없이 오디오 재생이 불가합니다.

```javascript
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

WCGames.init({
    id: 'game-id',
    onStart: () => {
        initAudio(); // 사운드 초기화 필수!
        /* 게임 시작 루틴 */
    },
    onRestart: () => { /* 재시작 루틴 */ }
});
```

## 5. 다국어 지원 (i18n)
`data-i18n` 속성을 요소에 추가하고 `locales/` 내 JSON 파일에 번역을 작성합니다.

## 6. 플랫폼 등록
`src/hooks/useGameStore.ts`의 `games` 배열에 해당 게임의 정보를 추가하여 목록에 표시되게 합니다.

## 7. 로컬 테스트
// turbo
npm run dev
`localhost:5173`에서 게임 실행, 점수 전송, 다국어 전환을 최종 확인합니다.
