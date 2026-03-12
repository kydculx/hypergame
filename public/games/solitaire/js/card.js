import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { Assets } from './assets.js';

/**
 * 개별 카드 객체 정보와 상태, 3D 애니메이션을 제어하는 클래스입니다.
 */
export class Card {
    /**
     * 카드를 새로 생성합니다.
     * @param {string} suit - 카드의 문양 (hearts, diamonds, clubs, spades)
     * @param {string} rank - 카드의 심볼 ('A', '2'~'10', 'J', 'Q', 'K')
     * @param {number} value - 승패 판정과 순서 배열에 계산되는 실제 숫자 값 (1~13)
     */
    constructor(suit, rank, value) {
        this.suit = suit;
        this.rank = rank;
        this.value = value;
        this.isFaceUp = false; // 앞면을 보이고 있는지 여부

        // 렌더링 물리 좌표 (현재 화면상 위치와 이동해야 할 목표 위치)
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;

        // 사용자에 의해 현재 타겟으로 드래그되고 있는지
        this.isDragging = false;
        
        // 문양에 따른 카드 색상 (디버깅 참조 등)
        this.color = Utils.isRed(suit) ? CONFIG.colors.red : CONFIG.colors.black;

        // 3D 회전(뒤집힘) 애니메이션 상태 관리
        this.flipProgress = 0; // 0.0 에서 1.0 (최대 회전)까지의 진행률
        this.isFlipping = false;   // 회전 애니메이션 구동 여부
        this.flipFromFaceUp = false; // 뒤집기 시작할 당시 앞면이었는지 여부
    }

    /**
     * 메인 루프로부터 매 프레임 호출되어 카드의 위치(Lerp 보간) 및 회전 프레임을 업데이트 합니다.
     */
    update() {
        // 위치 이동의 선형 보간 계수 (수치가 작을수록 천천히, 부드럽게 이동)
        const lerp = 0.12;
        
        if (!this.isDragging) {
            // 부드러운 목적지 안착 X축 계산
            const dx = this.targetX - this.x;
            if (Math.abs(dx) > 0.5) {
                this.x += dx * lerp;
            } else {
                this.x = this.targetX;
            }

            // 부드러운 목적지 안착 Y축 계산
            const dy = this.targetY - this.y;
            if (Math.abs(dy) > 0.5) {
                this.y += dy * lerp;
            } else {
                this.y = this.targetY;
            }
        }

        // 카드의 3D 회전 플립(Flip) 애니메이션 처리
        if (this.isFlipping) {
            this.flipProgress += 0.15; // 뒤집히는 속도 가중치
            if (this.flipProgress >= 1) {
                this.flipProgress = 0;
                this.isFlipping = false;
                this.isFaceUp = !this.flipFromFaceUp;
            }
        }
    }

    /**
     * 현재 이 카드가 공간 이동 중이거나 뒤집히는 중인지 판별합니다. (애니메이션 상태)
     * @returns {boolean} 카드가 시각적으로 움직이고 있으면 true
     */
    get isAnimating() {
        return this.isFlipping || (!this.isDragging && (Math.abs(this.x - this.targetX) > 1 || Math.abs(this.y - this.targetY) > 1));
    }

    /**
     * 카드를 지정된 면적(앞면 또는 뒷면)으로 뒤집는 모션 지시를 내립니다.
     * @param {boolean} toFaceUp - true 이면 앞면으로 까주고, false 면 뒷면으로 은닉합니다
     */
    flip(toFaceUp) {
        if (this.isFaceUp === toFaceUp) return; // 이미 목표한 면모라면 무시
        this.isFlipping = true;
        this.flipFromFaceUp = this.isFaceUp;
        this.flipProgress = 0;
        Assets.sounds.flip(); // 카드 뒤집는 입체 오디오 재생
    }
}
