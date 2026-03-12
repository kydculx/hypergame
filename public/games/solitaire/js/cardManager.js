import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { Card } from './card.js';
import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { Assets } from './assets.js';
import { VictoryFountain } from './effects.js';

/**
 * 게임 메카닉스 및 핵심 데이터 배열들을 권할하는 책임자 포지션을 맡습니다.
 */
export const CardManager = {
    deck: [],          // 통상 52장의 모든 카드 참조 모음
    stock: [],         // 남아서 뒤집어진 덱
    waste: [],         // 스톡에서 하나씩 까서 나열한 영역
    foundations: [[], [], [], []], // 완성되어 차별된 수용슬롯 4칸
    tableaus: [[], [], [], [], [], [], []], // 메인 보드 상의 7분할 세로줄 구역

    history: [],       // 무르기 기능을 위한 상태 스냅샷 콜렉션
    undoCount: 3,      // 기본 뒤로가기 가능 횟수 한도 제한
    isWinPending: false, // 모든 패가 파운데이션에 모였으나 아직 이동 애니메이션 중인 상태

    /**
     * 게임 한판의 판을 세팅하여 새 카드를 분배하고 리셋합니다.
     */
    init() {
        this.history = [];
        this.undoCount = 3;

        const btnUndo = document.getElementById('btn-undo');
        if (btnUndo) {
            btnUndo.disabled = false;
            const countSpan = document.getElementById('undo-count');
            if (countSpan) countSpan.innerText = this.undoCount;
        }

        this.buildDeck();
        this.shuffleDeck();
        this.dealCards();
        this.isWinPending = false;
    },

    /**
     * 실행 취소(Undo) 대비책을 얕은 복사본(Shallow Deep-Copy Map)화 시켜 확보합니다.
     * @returns {Object} 저장 지점 뭉치 
     */
    createSnapshot() {
        return {
            stock: [...this.stock],
            waste: [...this.waste],
            foundations: this.foundations.map(f => [...f]),
            tableaus: this.tableaus.map(t => [...t]),
            faceUps: this.deck.map(c => c.isFaceUp)
        };
    },

    /**
     * 어떤 모션이나 자동액션이 일어날 때 그 직전의 모습을 캡처 기록합니다.
     * @param {Object} [snapshot=null] 외부에서 만들어낸 스냅샷 주입 허용
     */
    saveState(snapshot = null) {
        if (!snapshot) snapshot = this.createSnapshot();
        this.history.push(snapshot);
        if (this.history.length > 20) this.history.shift(); // 과부하 방지
    },

    /**
     * 실수로 옮긴 카드를 직전 위치로 강제 복구해주는 무르기 스킬입니다.
     */
    undo() {
        if (this.undoCount <= 0 || this.history.length === 0) return;

        this.undoCount--;
        const state = this.history.pop();

        // 포인터 참조 주소들을 구 상태 데이터로 재장착
        this.stock = [...state.stock];
        this.waste = [...state.waste];
        this.foundations = state.foundations.map(f => [...f]);
        this.tableaus = state.tableaus.map(t => [...t]);

        this.deck.forEach((c, i) => {
            c.isFaceUp = state.faceUps[i];
        });

        const btnUndo = document.getElementById('btn-undo');
        if (btnUndo) {
            const countSpan = document.getElementById('undo-count');
            if (countSpan) countSpan.innerText = this.undoCount;

            if (this.undoCount === 0) {
                btnUndo.disabled = true;
            }
        }

        Renderer.calculateLayout();
        if (window.WCGames) window.WCGames.Audio.play([300, 200], 'square', 0.05, 0.05);
    },

    /**
     * 52여벌의 스탠다드 트럼프 큐브들을 인스턴스화 등록합니다.
     */
    buildDeck() {
        this.deck = [];
        for (const suit of CONFIG.suits) {
            for (let i = 0; i < CONFIG.ranks.length; i++) {
                this.deck.push(new Card(suit, CONFIG.ranks[i], i + 1));
            }
        }
    },

    /**
     * Fisher-Yates 방식을 경유하여 통을 거칠게 섞습니다.
     */
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    },

    /**
     * 솔리테어 클론다이크 룰에 입각한 피라미드 구조식 하부 딜링을 담당합니다.
     */
    dealCards() {
        this.stock = [];
        this.waste = [];
        this.foundations = [[], [], [], []];
        this.tableaus = [[], [], [], [], [], [], []];

        let deckIndex = 0;
        // 좌측 바깥에서 나폴나폴 날아오는 배분 연출을 위한 생성 위치
        const startX = window.innerWidth;
        const startY = window.innerHeight;

        for (let col = 0; col < 7; col++) {
            for (let row = 0; row <= col; row++) {
                const card = this.deck[deckIndex++];
                // 화면 밖에서 날아들어오는 효과를 위해 초기 위치를 하단으로 설정
                card.x = window.innerWidth / 2;
                card.y = window.innerHeight + 100;
                card.isFaceUp = (row === col);
                this.tableaus[col].push(card);
                
                // 순차적 등장을 위한 약간의 딜레이 부여 (update 루틴에서 target으로 순차 이동)
                card.spawnDelay = deckIndex * 1; 
            }
        }

        while (deckIndex < this.deck.length) {
            const card = this.deck[deckIndex++];
            card.x = window.innerWidth / 2;
            card.y = window.innerHeight + 100;
            card.isFaceUp = false;
            this.stock.push(card);
            card.spawnDelay = deckIndex * 1;
        }

        Renderer.calculateLayout();

        // 초기 카드의 강제 이동을 위해 target 값을 일단 현재 위치로 고정했다가 
        // update 루틴에서 순차적으로 targetX/Y를 복구하도록 처리합니다.
        this.deck.forEach(card => {
            card._finalTargetX = card.targetX;
            card._finalTargetY = card.targetY;
            // 애니메이션 시작 전까지는 현재 위치에 머물게 함
            card.targetX = card.x;
            card.targetY = card.y;
        });
    },

    /**
     * 묶여 있는 휴면 카드 더미에서 한 장을 뽑습니다. 비워졌다면 수거해 재조립합니다.
     */
    drawFromStock() {
        this.saveState(); 
        if (this.stock.length > 0) {
            const card = this.stock.pop();
            card.isFaceUp = true;
            this.waste.push(card);
            if (window.WCGames) window.WCGames.Audio.play([400, 600], 'sine', 0.05, 0.05);
        } else if (this.waste.length > 0) {
            while (this.waste.length > 0) {
                const card = this.waste.pop();
                card.isFaceUp = false;
                this.stock.push(card);
            }
            if (window.WCGames) window.WCGames.Audio.play([200, 300], 'sine', 0.05, 0.05);
        }
        Renderer.calculateLayout();
    },

    /**
     * 타겟 위에 배치 신청된 카드가 규칙상 합당한지 검열 통과 여부를 반환합니다 (바닥 타블로용).
     * @param {Card} cardToPlace 
     * @param {Card|null} targetCard 
     * @returns {boolean} 승인 결과
     */
    canPlaceOnTableau(cardToPlace, targetCard) {
        if (!targetCard) return cardToPlace.value === 13; // K 만 진입 가능
        return targetCard.isFaceUp &&
            targetCard.value === cardToPlace.value + 1 &&
            Utils.isRed(targetCard.suit) !== Utils.isRed(cardToPlace.suit);
    },

    /**
     * 구원 슬롯인 파운데이션 부착 요건을 충족하는지 검열합니다.
     * @param {Card} cardToPlace 
     * @param {number} foundationIndex 
     * @returns {boolean} 승인 결과
     */
    canPlaceOnFoundation(cardToPlace, foundationIndex) {
        const pile = this.foundations[foundationIndex];
        if (pile.length === 0) return cardToPlace.value === 1; // A 만 진입 혀용
        const topCard = pile[pile.length - 1];
        return topCard.suit === cardToPlace.suit && topCard.value === cardToPlace.value - 1;
    },

    /**
     * 클리어 조건을 점수 검사하고, 만약 승리했다면 대대적인 환영 폭죽을 지령합니다.
     */
    checkWinCondition() {
        const isWon = this.foundations.every(f => f.length === 13);
        if (isWon && !Engine.isGameOver) {
            // 즉시 종료하지 않고, 모든 카드가 제자리에 안착할 때까지 대기 모드 진입
            this.isWinPending = true;
        }
    },

    /**
     * 엔진 측에서 파이프라인으로 연결한 단위 카드별 위치 업데이팅 라우트 브릿지입니다.
     */
    update() {
        this.deck.forEach(c => {
            // 순차적 배분(Deal) 애니메이션을 위한 딜레이 로직
            if (c.spawnDelay > 0) {
                c.spawnDelay--;
                if (c.spawnDelay <= 0) {
                    // 딜레이가 끝나면 실제 목적지를 타겟으로 설정하여 이동 시작
                    if (c._finalTargetX !== undefined) {
                        c.targetX = c._finalTargetX;
                        c.targetY = c._finalTargetY;
                        delete c._finalTargetX;
                        delete c._finalTargetY;
                        // 카드가 날아올 때 소리 효과 추가
                        if (window.WCGames && Math.random() > 0.8) Assets.sounds.flip();
                    }
                }
            }
            c.update();
        });

        // 승리 조건 충족 후 모든 카드가 이동을 마쳤는지 감시
        if (this.isWinPending) {
            const anyAnimating = this.deck.some(c => c.isAnimating);
            if (!anyAnimating) {
                this.isWinPending = false;
                VictoryFountain.start();
                Engine.gameOver(true);
            }
        }
    },

    /**
     * 유저의 조작으로 인해 해당 라인의 맨 끝머리가 빈칸은 아니나 은닉 면이 되어 버렸을 때 수동으로 까줍니다.
     * @param {number} tableauIndex 해당 타블로 줄 넘버
     */
    flipTopCardIfFaceDown(tableauIndex) {
        const pile = this.tableaus[tableauIndex];
        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            if (!topCard.isFaceUp) {
                topCard.flip(true);
                if (window.WCGames) window.WCGames.Audio.play([300, 400], 'triangle', 0.05, 0.05);
            }
        }
    }
};
