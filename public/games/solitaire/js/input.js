import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { Engine } from './engine.js';
import { CardManager } from './cardManager.js';
import { Renderer } from './renderer.js';
import { Assets } from './assets.js';
import { VictoryFountain } from './effects.js';

/**
 * 터치 및 마우스 이벤트에 의한 조작기반 드래그 앤 드롭 행위를 포획하여 분석합니다.
 */
export const Input = {
    dragPile: [],     // 사용자의 커서 끝단에 쥐어진 통나무 배열 (한장 이상일 수 있음)
    sourceType: null, // 이 카드의 고향 파트 ('tableau', 'waste', 'foundation')
    sourceIndex: -1,  // 고향 파트의 고유 X축 슬롯 번호
    dragOffsetX: 0,   // 마리우스 클릭 포인트 ~ 카드의 기준점(0,0)간 오차 보정치
    dragOffsetY: 0,

    lastClickTime: 0, // 더블 클릭 간파용 타임스탬프 기록
    lastClickedCard: null,
    hasMoved: false,
    startX: 0,
    startY: 0,

    /**
     * 메인 캔버스 돔 객체에 청취자 역할을 주입합니다.
     */
    init() {
        const cvs = Engine.canvas;
        cvs.addEventListener('pointerdown', e => this.onDown(e));
        cvs.addEventListener('pointermove', e => this.onMove(e));
        cvs.addEventListener('pointerup', e => this.onUp(e));
        window.addEventListener('contextmenu', e => e.preventDefault()); // 딴지 걸기 방지 (맥락메뉴 차단)
    },

    /**
     * 화면 상의 임의의 공간을 건드렸을 때 (MouseDown/TouchStart) 판정 제어부
     * @param {PointerEvent} e 
     */
    onDown(e) {
        if (!Engine.isStarted || Engine.isGameOver) return;

        const rect = Engine.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // 1. 스톡 더미 (맨 좌측 상단 은폐 구역) 강제 조우 감지
        if (CardManager.stock.length > 0) {
            const topStock = CardManager.stock[CardManager.stock.length - 1];
            if (Utils.pointInRect(mx, my, topStock.targetX, topStock.targetY, Renderer.cardW, Renderer.cardH)) {
                CardManager.drawFromStock();
                return;
            }
        } else if (CardManager.waste.length > 0) {
            // 모두 소진된 스톡 빈자리 (리로드 버튼 구역) 접촉 시
            const startX = (Renderer.cw - (7 * Renderer.cardW + 6 * CONFIG.layout.gapX)) / 2;
            if (Utils.pointInRect(mx, my, startX, Renderer.topY, Renderer.cardW, Renderer.cardH)) {
                CardManager.drawFromStock(); 
                return;
            }
        }

        // 2. 웨이스트 영역 (드롭되는 카드들) 조회 
        if (CardManager.waste.length > 0) {
            const topWaste = CardManager.waste[CardManager.waste.length - 1];
            if (Utils.pointInRect(mx, my, topWaste.targetX, topWaste.targetY, Renderer.cardW, Renderer.cardH)) {
                const now = Date.now();
                // 패스트 포워딩 (더블 클릭 인식 시 파운데이션 등 목표지로 즉시 다이렉트 이송)
                if (now - this.lastClickTime < CONFIG.input.doubleClickMs && this.lastClickedCard === topWaste) {
                    if (this.tryAutoMove([topWaste], 'waste', -1)) return;
                }
                this.lastClickTime = now;
                this.lastClickedCard = topWaste;

                this.startDrag([topWaste], 'waste', -1, mx, my);
                return;
            }
        }

        // 3. 타블로 보드 영역 역순 (가장 위에 쌓인 친구)으로 훑기
        for (let c = 0; c < 7; c++) {
            const pile = CardManager.tableaus[c];
            for (let r = pile.length - 1; r >= 0; r--) {
                const card = pile[r];

                let hitHeight = Renderer.cardH;
                if (r < pile.length - 1) {
                    hitHeight = pile[r + 1].targetY - card.targetY;
                }

                if (Utils.pointInRect(mx, my, card.targetX, card.targetY, Renderer.cardW, hitHeight)) {
                    if (!card.isFaceUp) {
                        // 뒤집힌 카드 클릭 시 뒤집는 거동 유도
                        if (r === pile.length - 1) {
                            CardManager.saveState();
                            card.flip(true);
                            Renderer.calculateLayout();
                            if (window.WCGames) window.WCGames.Audio.play([400, 600], 'sine', 0.05, 0.05);
                        }
                        return; 
                    }

                    const subPile = pile.slice(r);

                    const now = Date.now();
                    if (now - this.lastClickTime < CONFIG.input.doubleClickMs && this.lastClickedCard === card) {
                        if (this.tryAutoMove(subPile, 'tableau', c)) return;
                    }
                    this.lastClickTime = now;
                    this.lastClickedCard = card;

                    this.startDrag(subPile, 'tableau', c, mx, my);
                    return; 
                }
            }
        }

        // 4. 파운데이션 우상단 영역 조회
        for (let f = 0; f < 4; f++) {
            const pile = CardManager.foundations[f];
            if (pile.length > 0) {
                const topFoundation = pile[pile.length - 1];
                if (Utils.pointInRect(mx, my, topFoundation.targetX, topFoundation.targetY, Renderer.cardW, Renderer.cardH)) {
                    this.startDrag([topFoundation], 'foundation', f, mx, my);
                    return;
                }
            }
        }
    },

    /**
     * 더블클릭 당한 카드를 적당한 곳에 지능적으로 떨꿔줍니다.
     * @param {Array} cards 
     * @param {string} type 
     * @param {number} index 
     * @returns {boolean}
     */
    tryAutoMove(cards, type, index) {
        const topCard = cards[0];

        // 파운데이션 직행 버스 가능성 검토
        if (cards.length === 1) {
            for (let f = 0; f < 4; f++) {
                if (CardManager.canPlaceOnFoundation(topCard, f)) {
                    CardManager.saveState(); 
                    if (type === 'waste') CardManager.waste.pop();
                    else if (type === 'tableau') {
                        CardManager.tableaus[index].pop();
                        CardManager.flipTopCardIfFaceDown(index); 
                    }
                    CardManager.foundations[f].push(topCard);
                    if (window.WCGames) window.WCGames.Audio.play([600, 800], 'sine', 0.1, 0.1);
                    Renderer.calculateLayout();
                    CardManager.checkWinCondition();
                    return true;
                }
            }
        }

        // 타블로 점프 가능성 검토
        for (let c = 0; c < 7; c++) {
            if (type === 'tableau' && index === c) continue; 

            const pile = CardManager.tableaus[c];
            const targetCard = pile.length > 0 ? pile[pile.length - 1] : null;

            if (CardManager.canPlaceOnTableau(topCard, targetCard)) {
                CardManager.saveState(); 
                if (type === 'waste') CardManager.waste.pop();
                else if (type === 'tableau') {
                    CardManager.tableaus[index] = CardManager.tableaus[index].slice(0, CardManager.tableaus[index].length - cards.length);
                    CardManager.flipTopCardIfFaceDown(index); 
                }
                CardManager.tableaus[c] = CardManager.tableaus[c].concat(cards);
                Assets.sounds.place();
                Renderer.calculateLayout();
                return true;
            }
        }

        return false;
    },

    /**
     * 마우스 포인터 위로 종이판을 띄워 들개끔 모드를 변경합니다.
     */
    startDrag(cards, type, index, mx, my) {
        // 물리법칙 이탈 전 미리 스냅샷 발사!
        this.pendingSnapshot = CardManager.createSnapshot();

        this.dragPile = cards;
        this.sourceType = type;
        this.sourceIndex = index;
        this.startX = mx;
        this.startY = my;
        this.hasMoved = false;

        const topCard = cards[0];
        this.dragOffsetX = mx - topCard.x;
        this.dragOffsetY = my - topCard.y;

        if (type === 'waste') CardManager.waste.pop();
        else if (type === 'foundation') CardManager.foundations[index].pop();
        else if (type === 'tableau') {
            CardManager.tableaus[index] = CardManager.tableaus[index].slice(0, CardManager.tableaus[index].length - cards.length);
        }

        cards.forEach(c => {
            c.isDragging = true;
        });
    },

    /**
     * 끌고 있을 때 (MouseMove) 처리 구문
     */
    onMove(e) {
        if (this.dragPile.length === 0) return;

        const rect = Engine.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const newX = mx - this.dragOffsetX;
        const newY = my - this.dragOffsetY;

        if (Math.abs(mx - this.startX) > CONFIG.input.dragThreshold || Math.abs(my - this.startY) > CONFIG.input.dragThreshold) {
            this.hasMoved = true;
        }

        this.dragPile.forEach((card, i) => {
            card.x = newX;
            card.y = newY + (i * Math.min(CONFIG.layout.maxFaceGapY, Renderer.cardH * CONFIG.layout.faceGapRatio));
        });
    },

    /**
     * 마우스 누른 것을 풀었을 때 (MouseUp/Drop) 안착 시도
     */
    onUp(e) {
        if (this.dragPile.length === 0) return;

        const rect = Engine.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        let placed = false;
        const topCard = this.dragPile[0]; 

        const startX = (Renderer.cw - (7 * Renderer.cardW + 6 * CONFIG.layout.gapX)) / 2;
        const topY = Renderer.topY;
        const tableauY = Renderer.tableauY;

        // 1. 파운데이션에 드랍 했닝?
        if (this.dragPile.length === 1) {
            for (let f = 0; f < 4; f++) {
                const fX = startX + (f + 3) * (Renderer.cardW + CONFIG.layout.gapX);
                if (Utils.pointInRect(mx, my, fX, topY, Renderer.cardW, Renderer.cardH)) {
                    if (CardManager.canPlaceOnFoundation(topCard, f)) {
                        CardManager.foundations[f].push(topCard);
                        placed = true;
                        CardManager.saveState(this.pendingSnapshot);
                        if (window.WCGames) window.WCGames.Audio.play([600, 800], 'sine', 0.1, 0.1);
                        break;
                    }
                }
            }
        }

        // 2. 타블로 슬롯에 드랍 했닝?
        if (!placed) {
            for (let c = 0; c < 7; c++) {
                const pile = CardManager.tableaus[c];
                const tX = startX + c * (Renderer.cardW + CONFIG.layout.gapX);

                const targetCard = pile.length > 0 ? pile[pile.length - 1] : null;
                const validHitArea = targetCard ?
                    Utils.pointInRect(mx, my, tX, targetCard.targetY, Renderer.cardW, Renderer.cardH * 1.5) : 
                    Utils.pointInRect(mx, my, tX, tableauY, Renderer.cardW, Renderer.cardH);

                let directHit = false;
                if (targetCard && Utils.pointInRect(mx, my, targetCard.x, targetCard.y, Renderer.cardW, Renderer.cardH)) {
                    directHit = true;
                }

                if (validHitArea || directHit) {
                    if (CardManager.canPlaceOnTableau(topCard, targetCard)) {
                        CardManager.tableaus[c] = CardManager.tableaus[c].concat(this.dragPile);
                        placed = true;
                        Assets.sounds.place();
                        break;
                    }
                }
            }
        }

        // 실패로 돌아가는 자들의 말발굽
        if (!placed) {
            if (this.sourceType === 'waste') CardManager.waste = CardManager.waste.concat(this.dragPile);
            else if (this.sourceType === 'foundation') CardManager.foundations[this.sourceIndex] = CardManager.foundations[this.sourceIndex].concat(this.dragPile);
            else if (this.sourceType === 'tableau') CardManager.tableaus[this.sourceIndex] = CardManager.tableaus[this.sourceIndex].concat(this.dragPile);
        } else {
            if (this.sourceType === 'tableau') {
                CardManager.flipTopCardIfFaceDown(this.sourceIndex); 
            }
            CardManager.checkWinCondition(); 
        }

        this.dragPile.forEach(c => c.isDragging = false);
        this.dragPile = [];
        this.sourceType = null;

        Renderer.calculateLayout();
    }
};
