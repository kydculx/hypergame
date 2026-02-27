---
description: 플랫폼에 새로운 HTML5 웹게임을 추가하고 연동하는 가이드라인 (시니어 상세판)
---

이 워크플로우는 WCGames 플랫폼에 새로운 HTML5 아케이드 게임을 추가할 때 지켜야 하는 **필수 기술 표준**입니다. 20년차 시니어 개발자 관점의 체계적인 설계를 지향합니다.

## 0. 작업 프로세스 체크리스트
- [ ] **계획**: `implementation_plan.md` 작성. 게임 루프, 에셋 구성, deltaTime 처리 방식 정의.
- [ ] **개발**: `index.html` 구현, SDK 및 스타일 적용, 오브젝트 풀링 설계.
- [ ] **검증**: `walkthrough.md` 작성. 리트라이 버그 여부, 모바일 입력, 성능(60fps) 확인.

## 1. 프로젝트 구조
모든 게임은 `public/games/{game_id}/` 내에 위치합니다.
- `index.html`: 메인 실행 파일 (단일 파일 구조 권장)
- `thumb.svg`: 300x300 썸네일
- `locales/`: ko, en 번역 파일

## 2. 모달 팝업 표준 (Modal UI)
모든 팝업은 플랫폼의 일관성을 위해 반드시 모달 형태로 구현합니다.
- **오버레이**: `.wcg-overlay` 클래스를 사용하여 배경을 흐리게(Blur) 처리합니다.
- **팝업 박스**: `.wcg-popup` 클래스를 사용하여 중앙에 부유하는 모달 창을 생성합니다.
- **구조**: 반드시 오버레이 내부에 팝업 박스가 위치하는 계층 구조를 가집니다.

## 3. 코드 구조 표준 (Sectioning)
`<script>` 내 코드는 다음 섹션 순서를 지켜 가독성을 확보합니다.

```javascript
/* 1. Constant Configuration (Balance, Styles) */
/* 2. State & Variables (Runtime variables) */
/* 3. Utilities (Helper functions) */
/* 4. Object Classes & Pooling (Entities, Particles) */
/* 5. Input Handling (Pointer, Keyboard) */
/* 6. Game Logic (Update, Collision) */
/* 7. Rendering (Draw commands) */
/* 8. SDK Initialization & Callbacks */
```

## 3. 핵심 기술 지침

### 🚀 Game Loop & deltaTime
- **반드시** `WCGames.updateDelta()`를 사용하여 움직임을 계산합니다.
- 프레임 제한에 관계없이 일관된 속도로 작동해야 합니다 (예: `pos += speed * WCGames.dt`).

### 📱 모바일 최적화
- `viewport` 설정 필수: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`
- 캔버스 해상도 대응: `devicePixelRatio`를 반영하여 캔버스 크기 조절.
- CSS 터치 방지:
```css
body {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
}
```

### 🎧 오디오 매니저
- 게임 내부 클래스 대신 **`WCGames.Audio`**를 사용합니다.
- `onStart` 콜백에서 반드시 **`WCGames.Audio.init()`**를 호출하여 모바일 사운드 잠금을 해제합니다.

---

## 4. SDK 연동 (Essential)
```javascript
WCGames.init({
    id: 'game-id',
    onStart: () => {
        WCGames.Audio.init();
        // 게임 시작 루틴
    },
    onPause: () => { /* 사운드 일시정지, 타이머 멈춤 */ },
    onResume: () => { /* 사운드 재개, 타이머 재시작 */ },
    onRestart: () => { /* 모든 상태(변수, 클래스, UI) 완전 초기화 */ }
});
```

## 5. QA 체크리스트 (출시 전 필수)
- [ ] **Retry 정합성**: 다시 시작했을 때 이전 게임의 잔상이 남지 않는가? 오버레이가 사라지는가?
- [ ] **점수 전송**: 1회만 전송되는가? 양의 정수인가?
- [ ] **다국어**: 모든 텍스트가 `data-i18n`을 통해 번역되는가? (`title`, `instruction`, `play`, `game_over`, `final_score`, `play_again`)
- [ ] **성능**: 저사양 기기에서 60fps가 유지되는가? (오브젝트 풀링 여부)
- [ ] **모바일까지 입력을 처리하는가?**: `pointerdown` 또는 `touchmove` 등이 정상인가?

## 6. 개발 템플릿 (Skeleton)
// turbo
개발 시 필요하다면 위 구조를 따르는 보일러플레이트 파일을 즉석에서 생성하여 요청하세요.
