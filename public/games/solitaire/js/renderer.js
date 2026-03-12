import { CONFIG } from './config.js';
import { Assets } from './assets.js';
import { CardManager } from './cardManager.js';
import { VictoryFountain } from './effects.js';
import { Input } from './input.js';

/**
 * 게임 메인 렌더러 (Graphics Engine)
 * 전체 화면 비율 및 크기 변경에 유동적으로 반응(Responsive)하고 시뮬레이션된 프레임을 묘사합니다.
 */
export const Renderer = {
    ctx: null, // HTML Canvas 2D 그리기용 객체
    cw: 0,     // 캔버스의 현재 전체 가로 폭
    ch: 0,     // 캔버스의 현재 전체 세로 폭

    cardW: 0,  // 재배치 후 연산된 기준 카드 너비
    cardH: 0,  // 재배치 후 연산된 기준 카드 높이
    scale: 1,  // 확대 및 축소 전반적 스케일 비율
    topY: 80,  // 화면 상부 영역(스톡, 완성덱 등) Y 좌표 시작점
    tableauY: 200, // 화면 하부 영역(바닥 섞을패) Y 좌표 시작점

    /**
     * 그래픽 컨텍스트를 바인딩하며 렌더러의 수명을 시작합니다.
     * @param {CanvasRenderingContext2D} ctx 
     */
    init(ctx) {
        this.ctx = ctx;
    },

    /**
     * 윈도우 리사이즈 등에 대응하기 위해 화면 구역 밸런스 및 카드의 위치 목표를 모두 재산출합니다.
     */
    calculateLayout() {
        this.cw = window.innerWidth;
        this.ch = window.innerHeight;

        // 양옆 여백 및 기둥의 여백을 뺀 알짜 너비를 역산출
        const totalGaps = 8;
        const maxW = (this.cw - (CONFIG.layout.gapX * totalGaps)) / 7;

        this.cardW = Math.min(maxW, CONFIG.card.baseWidth * CONFIG.layout.maxScale);
        this.cardH = this.cardW * CONFIG.card.ratio;

        const startX = (this.cw - (7 * this.cardW + 6 * CONFIG.layout.gapX)) / 2;

        // 높이를 파악하여 어느 정도 겹침 상태에서도 예쁘게 비례 배분할 수 있도록 설계
        const estimatedTableauHeight = this.cardH + (15 * Math.min(CONFIG.layout.maxFaceGapY, this.cardH * CONFIG.layout.faceGapRatio));
        const totalEstimatedHeight = this.cardH + 20 + estimatedTableauHeight;

        this.topY = Math.max(CONFIG.layout.paddingY, (this.ch - totalEstimatedHeight) / 2);
        this.tableauY = this.topY + this.cardH + 20;

        // 1. 스톡 데크 (좌측 가장 맨 끝 예비역 묶음) 좌표 설정
        CardManager.stock.forEach((c, i) => {
            c.targetX = startX;
            c.targetY = this.topY;
            c.zIndex = i;
        });

        // 2. 웨이스트 (오픈되어 사용 가능한 묶음) 부분 오프셋 이격 처리 등
        const wasteLen = CardManager.waste.length;
        CardManager.waste.forEach((c, i) => {
            let offset = 0;
            if (wasteLen <= 3) {
                offset = i;
            } else {
                // 부채꼴로 펼쳐 보여줘 카드의 직관적 피드백 제공
                if (i === wasteLen - 1) offset = 2;
                else if (i === wasteLen - 2) offset = 1;
                else offset = 0;
            }
            const wasteX = startX + this.cardW + CONFIG.layout.gapX;
            c.targetX = wasteX + (offset * Math.min(CONFIG.layout.maxFaceGapY, this.cardW * 0.25));
            c.targetY = this.topY;
            c.zIndex = i;
        });

        // 3. 파운데이션 (우측 상부 결승 거점 타워 영역) 타겟 위치 대입
        CardManager.foundations.forEach((pile, pIndex) => {
            pile.forEach((c, i) => {
                c.targetX = startX + (pIndex + 3) * (this.cardW + CONFIG.layout.gapX);
                c.targetY = this.topY;
                c.zIndex = i;
            });
        });

        // 4. 타블로 바닥 카드 배열 (7열 계단 구조) 뷰 재계산
        CardManager.tableaus.forEach((pile, pIndex) => {
            pile.forEach((c, i) => {
                c.targetX = startX + pIndex * (this.cardW + CONFIG.layout.gapX);
                // 겹침 여부에 따라 등간격을 축소/증폭함
                const prevFaceDowns = pile.slice(0, i).filter(pc => !pc.isFaceUp).length;
                const prevFaceUps = i - prevFaceDowns;

                c.targetY = this.tableauY + (prevFaceDowns * CONFIG.layout.stackGapY) + (prevFaceUps * Math.min(CONFIG.layout.maxFaceGapY, this.cardH * CONFIG.layout.faceGapRatio));
                c.zIndex = i;
            });
        });

        // 변경된 크기 및 종횡비에 의거해 최적화 기법에 쓰일 더미 메모리용 그래픽 소스 재생산
        Assets.createCardBack(this.cardW, this.cardH, CONFIG.card.radius);
        Assets.createCardFaces(this.cardW, this.cardH, CONFIG.card.radius);
    },

    /**
     * 메인 렌더 사이클 (Main Display Frame Loop)을 주관합니다.
     */
    draw() {
        this.ctx.clearRect(0, 0, this.cw, this.ch);

        this.drawSlots(); // 바닥의 빈 윤곽선 슬롯

        // 드래깅되거나 애니메이션에 속하지 않은 기본 카드 선발
        let toRender = [...CardManager.deck].filter(c => !c.isDragging && !c.isAnimating);

        // 아래 카드가 위 카드에 덮히게끔 Z-Index 및 좌표에 의한 소트
        toRender.sort((a, b) => {
            if (a.targetY !== b.targetY) return a.targetY - b.targetY;
            return a.zIndex - b.zIndex;
        });

        const animatingCards = [...CardManager.deck].filter(c => !c.isDragging && c.isAnimating);
        animatingCards.sort((a, b) => a.zIndex - b.zIndex);

        const draggingCards = Input.dragPile;

        toRender = toRender.concat(animatingCards).concat(draggingCards || []);

        toRender.forEach(c => {
            if (c) this.drawCard(c);
        });

        // 게임용 분수 연출 같은 특수 이펙트 가미
        VictoryFountain.draw(this.ctx);
    },

    /**
     * 어떤 기능 슬롯인지 유저에게 알리기 위해 바닥면 테두리를 그립니다.
     */
    drawSlots() {
        this.ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.lineWidth = 2;

        const startX = (this.cw - (7 * this.cardW + 6 * CONFIG.layout.gapX)) / 2;
        const topY = this.topY;

        const drawRect = (x, y) => {
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, this.cardW, this.cardH, CONFIG.card.radius);
            this.ctx.fill();
            this.ctx.stroke();
        };

        // 스톡 더미 외형 (원형 화살표 포함)
        drawRect(startX, topY);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        this.ctx.beginPath();
        this.ctx.arc(startX + this.cardW / 2, topY + this.cardH / 2, 16, 0, Math.PI * 1.5);
        this.ctx.moveTo(startX + this.cardW / 2, topY + this.cardH / 2 - 22);
        this.ctx.lineTo(startX + this.cardW / 2 + 6, topY + this.cardH / 2 - 16);
        this.ctx.lineTo(startX + this.cardW / 2 - 6, topY + this.cardH / 2 - 16);
        this.ctx.stroke();

        // 파운데이션 파트
        for (let i = 0; i < 4; i++) {
            const x = startX + (i + 3) * (this.cardW + CONFIG.layout.gapX);
            drawRect(x, topY);
        }

        // 바닥 플레이어블 파트
        const tableauY = this.tableauY;
        for (let i = 0; i < 7; i++) {
            drawRect(startX + i * (this.cardW + CONFIG.layout.gapX), tableauY);
        }
    },

    /**
     * 카드의 외래적 특징(마우스 오버나 플립)을 반영해 낱장 드로잉합니다.
     * @param {Object} card - 작화할 카드 객체
     * @param {number} [overrideX] - 로컬 변환계에서의 X 축 오프셋 재정의 (Victory 이펙트용 옵션)
     * @param {number} [overrideY] - 로컬 변환계에서의 Y 축 오프셋 재정의
     */
    drawCard(card, overrideX, overrideY) {
        const ctx = this.ctx;
        const x = overrideX !== undefined ? overrideX : card.x;
        const y = overrideY !== undefined ? overrideY : card.y;
        const w = this.cardW;
        const h = this.cardH;
        const r = CONFIG.card.radius;

        let drawW = w;
        let drawX = x;
        let showingFace = card.isFaceUp;

        // 카드의 3D 양면 턴오버 착시 기법
        if (card.isFlipping) {
            const p = card.flipProgress;
            if (p < 0.5) {
                drawW = w * (1 - p * 2);
                showingFace = card.flipFromFaceUp;
            } else {
                drawW = w * (p - 0.5) * 2;
                showingFace = !card.flipFromFaceUp;
            }
            drawX = x + (w - drawW) / 2;
        }

        // 마우스로 붙들거나 드롭 시 튀어오르는 음영 연출
        if (card.isDragging) {
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetY = 10;
            
            // 드래그 아웃라인용 패스 지정 (카드 이미지 위치와 정확히 일치시킴)
            ctx.beginPath();
            ctx.rect(drawX, y, drawW, h);
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.roundRect(drawX + 1, y + 2, drawW, h, r);
            ctx.fill();
        }

        // 이미 그려둔 캔버스를 이미지 삼아 붙여넣어 극강의 속도 이점 확보
        if (showingFace) {
            if (Assets.faceCanvases && Assets.faceCanvases[`${card.rank}_${card.suit}`]) {
                ctx.drawImage(Assets.faceCanvases[`${card.rank}_${card.suit}`], drawX, y, drawW, h);
            }
        } else {
            if (Assets.cardBackCanvas) {
                ctx.drawImage(Assets.cardBackCanvas, drawX, y, drawW, h);
            }
        }

        // 드래그 중인 오브젝트 하이라이팅 표시
        if (card.isDragging) {
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }
    }
};
