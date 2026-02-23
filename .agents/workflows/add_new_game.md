---
description: 플랫폼에 새로운 HTML5 웹게임을 추가하고 연동하는 가이드라인
---

이 워크플로우는 WCGames 플랫폼에 새로운 HTML5 아케이드 게임을 추가할 때 지켜야 하는 필수 절차입니다.

## 1. 정적 파일 복사
새로운 게임의 소스코드(HTML, JS, CSS, Asset 등)는 반드시 다음 경로에 위치해야 합니다.
- `public/games/{게임영문이름}/index.html`

## 2. 썸네일 추가
해당 게임의 썸네일 이미지는 반드시 동일한 폴더 내에 SVG 또는 PNG 포맷으로 추가해야 합니다.
- `public/games/{게임영문이름}/thumb.svg` 또는 `thumb.png`

## 3. Zustand 스토어 업데이트
`src/hooks/useGameStore.ts` 파일을 열어 `games` 배열에 새로운 게임 객체를 추가합니다.
객체는 다음 구조를 따라야 합니다:

```typescript
{
  id: '{게임영문이름}',
  title: '{게임 표시 이름}',
  description: '{게임에 대한 짧은 설명}',
  thumbnailUrl: 'games/{게임영문이름}/thumb.svg',
  gameUrl: 'games/{게임영문이름}/index.html',
  category: 'action' | 'puzzle' | 'casual',
}
```

## 4. 사운드 이펙트 추가 (선택)
HTML5 아케이드 게임의 타격감과 리듬감을 살리기 위해 버튼 터치, 득점(아이템 획득), 게임 오버 등에 즉각적인 피드백을 주는 사운드를 추가하는 것을 권장합니다.
- 무거운 외부 오디오 파일(`.mp3`, `.wav`) 로드로 인한 딜레이를 방지하기 위해 가급적 **Web Audio API (`AudioContext`) 기반의 자체 합성음(Synthesizer)** 코드를 `index.html` 내에 명시하여 사용하세요. (예시: `OscillatorNode`를 활용한 8-bit/레트로풍 효과음 생성)
- 사운드는 반드시 유저의 첫 번째 상호작용(클릭/터치) 시점에 초기화(`audioCtx.resume()`)되어야 모바일 브라우저의 오디오 정책 차단을 피할 수 있습니다.

## 5. 로컬 테스트 실행
// turbo
npm run dev
브라우저에서 `localhost:5173` 으로 접속한 뒤, 메인 화면 썸네일과 실제 게임 실행, 사운드 출력, 그리고 리더보드 연동이 정상적으로 구성되었는지 확인합니다.
