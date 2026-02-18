# PDCA Plan: 게임 오디오 시스템 (Game Audio System)

## 1. 개요 (Overview)
현재 게임에 사운드가 없어 사용자 경험이 밋밋한 문제를 해결하기 위해, Web Audio API를 활용한 실시간 오디오 합성 시스템을 구축합니다. 외부 오디오 파일 없이 코드로 효과음을 생성하여 가볍고 빠른 로딩 속도를 유지합니다.

## 2. 목표 (Goals)
- **자립형 오디오**: 별도의 mp3/wav 파일 없이 브라우저 내장 API로 사운드 생성.
- **상황별 효과음**:
  - 블록 배치 성공 (음계 상승 효과).
  - 퍼펙트 매치 (더 맑고 청아한 소리).
  - 게임 오버 (불협화음 또는 하강하는 톤).
- **성능 최적화**: 게임 루프에 지장을 주지 않는 가벼운 오실레이터 사용.

## 3. 핵심 기능 (Key Features)
- **Synthesizer Class**: 오실레이터(Oscillator)와 게인 노드(GainNode)를 관리하는 간단한 신디사이저 클래스.
- **Dynamic Pitch**: 블록이 쌓일 때마다 피치(음높이)가 올라가 긴장감을 고조시킴.
- **Envelope Control**: 소리의 시작(Attack)과 끝(Release)을 부드럽게 처리하여 자연스러운 타격감 구현.

## 4. 기술 스택 (Technical Stack)
- **API**: Web Audio API (AudioContext, OscillatorNode, GainNode).
- **Implementation**: Vanilla JS (게임 파일 내 직접 구현).

## 5. 로드맵 (Roadmap)
1. **Phase 1: 오디오 컨텍스트 설정** - 사용자 상호작용(클릭) 시 AudioContext 초기화.
2. **Phase 2: 효과음 함수 구현** - `playSound(frequency, type)` 함수 작성.
3. **Phase 3: 게임 로직 연동** - 블록 배치 및 게임 오버 시점에 효과음 트리거.
4. **Phase 4: 음계 로직 적용** - 콤보나 층수에 따라 주파수(Hz)를 계산하여 음악적인 연출 추가.

## 6. 성공 지표 (Success Metrics)
- 모바일/데스크탑 브라우저에서 지연 없는 소리 재생.
- 게임 플레이 중 프레임 드랍 없음.
