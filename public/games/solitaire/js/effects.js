import { CONFIG } from './config.js';
import { CardManager } from './cardManager.js';
import { Renderer } from './renderer.js';

/**
 * 윈도우 기반 솔리테어의 상징적 연출인, 게임 클리어 시 화면 전체에 카드가 흩뿌려지는 폭포수 효과 시스템입니다.
 */
export const VictoryFountain = {
    isActive: false, // 이펙트가 기동 중인지 여부
    pool: [],
    particles: [],
    cardIndex: 0, // 몇 번째 카드를 뿌렸는지 카운터
    timer: 0,

    /**
     * 사전에 52장의 카드를 할당 및 대기시켜 둡니다.
     */
    initPool() {
        for (let i = 0; i < 52; i++) {
            this.pool.push({
                active: false, card: null, x: 0, y: 0, vx: 0, vy: 0, rotation: 0, vRotation: 0
            });
        }
    },

    /**
     * 승리 확정 시 효과를 트리거합니다.
     */
    start() {
        this.isActive = true;
        this.particles.forEach(p => p.active = false);
        this.particles = [];
        this.cardIndex = 0;
        this.timer = 0;
    },

    /**
     * 폭포수들의 물리 효과 (반동, 가속, 회전) 정보를 매 엔진 사이클 단위로 갱신합니다.
     */
    update() {
        if (!this.isActive) return;

        this.timer += window.WCGames ? window.WCGames.dt : 0.016; 
        // 시한폭탄 형태로 정해진 간격에 맞춰 카드들을 순차적으로 투사
        if (this.timer > 0.1 && this.cardIndex < 52) {
            this.timer = 0;
            const card = CardManager.deck[this.cardIndex % 52];
            
            const p = this.pool[this.cardIndex];
            if (p) {
                p.active = true;
                p.card = card;
                p.x = card.x;
                p.y = card.y;
                p.vx = (Math.random() - 0.5) * 15; // 횡 측면 산포 강도
                p.vy = -Math.random() * 20 - 5; // 위쪽으로 솟구쳐 오르는 발사력
                p.rotation = 0;
                p.vRotation = (Math.random() - 0.5) * 0.2; // 뱅글뱅글 자전하는 스핀 속도
                
                this.particles.push(p);
            }
            this.cardIndex++;
            if (window.WCGames) {
                // 발사될 때마다 음정이 미묘하게 상향되는 사운드 플레이
                window.WCGames.Audio.play([200 * (1 + this.cardIndex / 50)], 'sine', 0.02, 0.05);
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.vy += 0.8; // 하늘 높은 줄 모르고 올라가던 카드들을 지면으로 잡아끄는 강한 중력
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.vRotation;

            // 시야상에서 아득히 밑으로 사라진 카드들은 추적 연산(배열)에서 제외
            if (p.y > Renderer.ch + Renderer.cardH * 2) {
                p.active = false;
                this.particles.splice(i, 1);
            }
        }
    },

    /**
     * 현재 스크린상에 표출되고 있는 튀어오르는 카드들을 실제로 그려냅니다.
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        if (!this.isActive) return;
        this.particles.forEach(p => {
            ctx.save();
            // 해당 파티클 카드 크기를 고려해 정중앙 코어를 축으로 회전시킴
            ctx.translate(p.x + Renderer.cardW / 2, p.y + Renderer.cardH / 2);
            ctx.rotate(p.rotation);
            ctx.translate(-Renderer.cardW / 2, -Renderer.cardH / 2);
            Renderer.drawCard(p.card, 0, 0); // 각도 조절 완료 후 본체 카드 출력
            ctx.restore();
        });
    }
};
