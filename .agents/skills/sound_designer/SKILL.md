---
name: Sound-Designer
description: Web Audio API를 활용하여 HTML5 게임의 절차적(Procedural) 효과음과 BGM을 합성하고, 오디오 피드백을 입히는 사운드 엔지니어 스킬입니다.
---

# Web Audio Sound Design Skill

이 스킬은 무거운 `.mp3` 파일에 의존하지 않고, 코드만으로 게임에 필요한 8비트/사이버펑크/어케이드 효과음을 합성(Synthesis)하고 설계할 때 에이전트(AI)가 전문 사운드 디자이너처럼 행동하도록 안내합니다.

## 🛠 주요 사운드 설계 절차 (에이전트 행동 지침)

### 1. Procedural Audio(신디사이저) 합성
- 외부 오디오 파일 없이 `AudioContext`의 `OscillatorNode`를 활용하여 소리를 동적으로 생성하는 글로벌 오디오 클래스(Audio Manager)의 확장을 주도합니다.
- 상황별로 적절한 파형(Waveform)을 선택합니다:
  - **점프/부스트:** 빠르게 피치(Pitch)가 올라가는 `sine` 또는 `triangle` 파형.
  - **충돌/폭발:** 노이즈(White Noise) 버퍼 생성 및 `lowpass` 필터를 씌운 무거운 스웹(Sweep) 사운드.
  - **획득/스코어:** 맑고 경쾌한 `square` 파형의 아르페지오(Arpeggio).

### 2. 동적 봉투(ADSR Envelope) 튜닝
- 소리의 시작(Attack), 유지(Decay, Sustain), 끝(Release)을 세밀하게 제어하여 "띡" 거리는 단순한 소리가 아닌 악기 같은 풍부한 타격감을 만듭니다.
- `gainNode.gain.exponentialRampToValueAtTime` 등을 활용하여 소리의 여운과 펀치감을 미세 튜닝합니다.

### 3. 오디오 믹싱 및 공간감(Spatial) 부여
- 여러 효과음이 동시에 겹칠 때 소리가 깨지는(Clipping) 현상을 방지하기 위해 `DynamicsCompressorNode`를 마스터 단에 연결합니다.
- 게임 내 객체의 위치에 따라 좌우 패닝(Stereo Panning) 등을 적용해 3D 공간감이 느껴지도록 오디오 노드(`StereoPannerNode`)를 결합합니다.

## ✨ 사운드 설계 완료 기준
- 아이템 획득, 장애물 충돌 등 주요 이벤트마다 명확히 구별되는 오디오 피드백이 존재하는가?
- 스피커나 이어폰으로 들었을 때 거슬리지 않도록 주파수(Filter)와 볼륨(Gain)이 적절하게 믹싱되었는가?
- 오디오 파일 다운로드 없이 코드로 구동되어 즉각적으로 반응(Zero Latency)하는가?
