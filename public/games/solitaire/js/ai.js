import { CONFIG } from './config.js';
import { Engine } from './engine.js';
import { CardManager } from './cardManager.js';
import { Renderer } from './renderer.js';
import { Assets } from './assets.js';

/**
 * 인공지능 (Auto Play) 브레인 모듈
 * 상황을 모니터링하며 가장 스코어 보존이 높은 한 수를 스스로 전개해 대신 게임을 진행해 줍니다.
 */
export const AISolver = {
    isActive: false, // 뇌관 작동 중인지 여부
    timer: 0,
    interval: CONFIG.ai.actionInterval,
    lastStateSignature: '',
    movesSinceLastStockCycle: 0,
    stockCyclesWithNoMoves: 0,
    fullDeckHasBeenSeen: false,
    initialStockCount: 0,

    /**
     * 버튼에 의해 작동될 토글형 오프너입니다.
     */
    toggle() {
        this.isActive = !this.isActive;
        const btn = document.getElementById('btn-autoplay');
        const text = document.getElementById('autoplay-text');
        if (btn && text) {
            text.innerText = `Auto Play: ${this.isActive ? 'ON' : 'OFF'}`;
            btn.style.background = this.isActive ? 'rgba(231, 76, 60, 0.2)' : 'rgba(46, 204, 113, 0.2)';
            btn.style.borderColor = this.isActive ? '#e74c3c' : '#2ecc71';
        }
    },

    /**
     * 루프의 톱니바퀴 (Update 구문)
     * @param {number} dt 
     */
    tick(dt) {
        if (!this.isActive || Engine.isGameOver) return;

        // 애니메이션 도중에 섣부른 조작 시도 원천 금지 타임
        if (CardManager.deck.some(c => c.isAnimating || c.isDragging)) return;

        this.timer += dt;
        if (this.timer >= this.interval) {
            this.timer = 0;
            this.performAction();
        }
    },

    /**
     * 반복되는 데드락 스톡 순환을 검출하기 위해 시그너처로 지문을 남깁니다.
     * @returns {string} 해시오브젝트 
     */
    getStateSignature() {
        let sig = `W:${CardManager.waste.length}|F:${CardManager.foundations.map(f => f.length).join(',')}|T:`;
        CardManager.tableaus.forEach(t => {
            if (t.length > 0) {
                const top = t[t.length - 1];
                sig += `${top.suit}${top.rank}${top.isFaceUp ? 'U' : 'D'}`;
            } else {
                sig += 'E'; // 빈 상태 표기
            }
        });
        return sig;
    },

    /**
     * AI의 셜록홈즈 추리 행동 파도
     * @returns {boolean} 어떤 수라도 진행 했는가 유무
     */
    performAction() {
        // 1번부터 5번 판단 라인까지 보드 내의 영리한 가치 수를 색출
        if (this.tryMoveToFoundation() ||
            this.tryFlipFaceDown() ||
            this.tryUnblockFoundationCard() ||
            this.tryMoveTableauToTableauRevealingFaceDown() ||
            this.tryMoveWasteToTableau()) {

            this.movesSinceLastStockCycle++;
            return true;
        }

        // 보드 내에 둘 거리가 없다면 새로운 지지력을 스톡에서 조달
        if (CardManager.stock.length === 0 && CardManager.waste.length > 0) {
            if (this.movesSinceLastStockCycle === 0) {
                console.log("AI 데드락 감지: 클리어 불가능한 패입니다. 초기화(Restart) 프로세스를 인가합니다.");
                if (window.WCGames) window.WCGames.restart();
                return true;
            }
            this.movesSinceLastStockCycle = 0;
        }

        CardManager.drawFromStock();
        return true;
    },

    /**
     * 전략 1: 파운데이션 빌드 시도
     */
    tryMoveToFoundation() {
        if (CardManager.waste.length > 0) {
            const topWaste = CardManager.waste[CardManager.waste.length - 1];
            for (let f = 0; f < 4; f++) {
                if (CardManager.canPlaceOnFoundation(topWaste, f)) {
                    CardManager.saveState();
                    CardManager.foundations[f].push(CardManager.waste.pop());
                    Renderer.calculateLayout();
                    if (window.WCGames) window.WCGames.Audio.play([600, 800], 'sine', 0.1, 0.1);
                    CardManager.checkWinCondition();
                    return true;
                }
            }
        }

        for (let c = 0; c < 7; c++) {
            const pile = CardManager.tableaus[c];
            if (pile.length > 0) {
                const topCard = pile[pile.length - 1];
                if (topCard.isFaceUp) {
                    for (let f = 0; f < 4; f++) {
                        if (CardManager.canPlaceOnFoundation(topCard, f)) {
                            CardManager.saveState();
                            CardManager.foundations[f].push(CardManager.tableaus[c].pop());
                            Renderer.calculateLayout();
                            if (window.WCGames) window.WCGames.Audio.play([600, 800], 'sine', 0.1, 0.1);
                            CardManager.checkWinCondition();
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    },

    /**
     * 전략 2: 포로 구출 작전 (타블로 하단에 감춰진 파운데이션 후보를 꺼내기 위해 상단 패 치우기)
     */
    tryUnblockFoundationCard() {
        for (let c = 0; c < 7; c++) {
            const pile = CardManager.tableaus[c];
            if (pile.length < 2) continue;

            for (let i = 0; i < pile.length - 1; i++) {
                const card = pile[i];
                if (!card.isFaceUp) continue;

                for (let f = 0; f < 4; f++) {
                    if (CardManager.canPlaceOnFoundation(card, f)) {
                        const movingCard = pile[i + 1];
                        for (let dest = 0; dest < 7; dest++) {
                            if (c === dest) continue;
                            const destPile = CardManager.tableaus[dest];
                            const destTopCard = destPile.length > 0 ? destPile[destPile.length - 1] : null;

                            if (CardManager.canPlaceOnTableau(movingCard, destTopCard)) {
                                CardManager.saveState();
                                const subPile = pile.splice(i + 1);
                                CardManager.tableaus[dest] = CardManager.tableaus[dest].concat(subPile);
                                Renderer.calculateLayout();
                                Assets.sounds.place();
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    },

    /**
     * 전략 3: 뒷면 까뒤집기
     */
    tryFlipFaceDown() {
        for (let c = 0; c < 7; c++) {
            const pile = CardManager.tableaus[c];
            if (pile.length > 0) {
                const topCard = pile[pile.length - 1];
                if (!topCard.isFaceUp) {
                    CardManager.saveState();
                    topCard.flip(true);
                    Renderer.calculateLayout();
                    if (window.WCGames) window.WCGames.Audio.play([400, 600], 'sine', 0.05, 0.05);
                    return true;
                }
            }
        }
        return false;
    },

    /**
     * 전략 4: 새로운 자원 발굴 기회 확보를 위한 다단 트랜지션 (최적화 판단식 탑재)
     */
    tryMoveTableauToTableauRevealingFaceDown() {
        let bestMove = null;
        let maxScore = -1;

        for (let src = 0; src < 7; src++) {
            const srcPile = CardManager.tableaus[src];
            if (srcPile.length === 0) continue;

            for (let i = 0; i < srcPile.length; i++) {
                if (!srcPile[i].isFaceUp) continue;

                const movingCard = srcPile[i];
                const hiddenCount = i;
                const hasHiddenCardUnderneath = i > 0 && !srcPile[i - 1].isFaceUp;
                const isKingNotAtBase = movingCard.value === 13 && i > 0;
                const isJustShiftingSameColor = i > 0 && srcPile[i - 1].isFaceUp;

                if (!hasHiddenCardUnderneath && !isKingNotAtBase) continue;
                if (isJustShiftingSameColor && !isKingNotAtBase) continue;

                for (let dest = 0; dest < 7; dest++) {
                    if (src === dest) continue;
                    const destPile = CardManager.tableaus[dest];
                    const destTopCard = destPile.length > 0 ? destPile[destPile.length - 1] : null;

                    if (CardManager.canPlaceOnTableau(movingCard, destTopCard)) {
                        let score = 0;
                        if (hasHiddenCardUnderneath || isKingNotAtBase) {
                            score = hiddenCount + 1;
                        }

                        if (score > maxScore) {
                            maxScore = score;
                            bestMove = { src, dest, index: i };
                        }
                    }
                }
            }
        }

        if (bestMove && maxScore > 0) {
            CardManager.saveState();
            const subPile = CardManager.tableaus[bestMove.src].splice(bestMove.index);
            CardManager.tableaus[bestMove.dest] = CardManager.tableaus[bestMove.dest].concat(subPile);
            Renderer.calculateLayout();
            if (window.WCGames) window.WCGames.Audio.play([400, 300], 'square', 0.05, 0.05);
            return true;
        }
        return false;
    },

    /**
     * 전략 5: 웨이스트의 잠재물을 타블로 테이블에 고정시켜 활용폭 넓히기
     */
    tryMoveWasteToTableau() {
        if (CardManager.waste.length === 0) return false;
        const topWaste = CardManager.waste[CardManager.waste.length - 1];

        for (let c = 0; c < 7; c++) {
            const destPile = CardManager.tableaus[c];
            const destTopCard = destPile.length > 0 ? destPile[destPile.length - 1] : null;

            if (CardManager.canPlaceOnTableau(topWaste, destTopCard)) {
                CardManager.saveState();
                CardManager.tableaus[c].push(CardManager.waste.pop());
                Renderer.calculateLayout();
                if (window.WCGames) window.WCGames.Audio.play([400, 300], 'square', 0.05, 0.05);
                return true;
            }
        }
        return false;
    }
};
