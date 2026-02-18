# PDCA Design: 게임 오디오 시스템 (Game Audio System)

## 1. 오디오 아키텍처 (Audio Architecture)
Web Audio API의 노드 그래프 시스템을 활용하여 실시간으로 사운드를 합성합니다.

- **AudioContext**: 오디오 시스템의 허브 (사용자 첫 클릭 시 활성화).
- **OscillatorNode**: 소리의 파형(Waveform) 생성 (sine, triangle, square).
- **GainNode**: 볼륨 조절 및 ADSR(Envelope) 적용.

## 2. 효과음 설계 (Sound Effects Design)

### 2.1. 블록 배치 (Place Block)
- **주파수**: `220Hz + (score * 20Hz)` (층수가 올라갈수록 고음).
- **파형**: `triangle` (부드러운 타격감).
- **지속시간**: 0.1초.
- **Envelope**: 빠른 Attack과 빠른 Decay.

### 2.2. 퍼펙트 매치 (Perfect Match)
- **주파수**: 배치 주파수의 2배 (한 옥타브 위).
- **파형**: `sine` (맑은 종소리 느낌).

### 2.3. 게임 오버 (Game Over)
- **주파수**: `440Hz -> 110Hz` (0.5초 동안 빠르게 하강).
- **파형**: `sawtooth` (거칠고 불길한 느낌).

## 3. 인터페이스 (Interface Definition)
```javascript
class AudioManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // 범용 사운드 재생 함수
  playNote(freq, type, duration, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
```

## 4. 통합 계획 (Integration Plan)
- `stack/index.html` 내에 오디오 로직 삽입.
- `gameState === 'PLAYING'` 전환 시 AudioContext 재개 (브라우저 정책 대응).
- `handleAction` 함수 내 성공/실패 시점 및 `gameOver` 시점에 오디오 메서드 호출.
