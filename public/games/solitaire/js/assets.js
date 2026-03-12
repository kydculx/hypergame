import { CONFIG } from './config.js';

/**
 * 에셋 및 그래픽 리소스 관리 모듈
 * 카드 이미지, 오프스크린 캔버스 캐싱, 사운드 효과를 통합 관리합니다.
 */
export const Assets = {
    cardImage: new Image(),
    isLoaded: false,
    faceCanvases: {},
    cardBackCanvas: null,

    // 프리미엄 절차적(Procedural) 오디오 효과음
    sounds: {
        /** 카드를 뒤집을 때 재생되는 사운드 */
        flip: () => { if (window.WCGames) window.WCGames.Audio.play([400, 600], 'sine', 0.05, 0.03); },
        /** 카드를 슬라이드(드래그)할 때 재생되는 사운드 */
        slide: () => { if (window.WCGames) window.WCGames.Audio.play([150, 100], 'triangle', 0.05, 0.08); },
        /** 카드를 바닥(타블로)에 내려놓을 때 재생되는 사운드 */
        place: () => { if (window.WCGames) window.WCGames.Audio.play([400, 300], 'square', 0.05, 0.04); },
        /** 카드를 완성 슬롯(파운데이션)에 성공적으로 안착 시켰을 때의 알림음 */
        foundation: () => { if (window.WCGames) window.WCGames.Audio.play([600, 800], 'sine', 0.1, 0.08); },
        /** 새 게임 시작 혹은 카드를 섞을 때 재생되는 쾌활한 사운드 */
        shuffle: () => { if (window.WCGames) window.WCGames.Audio.play([200, 150, 250], 'triangle', 0.1, 0.15); }
    },

    // 스프라이트 시트 제원 (13열: A~K, 4행: 클로버, 스페이드, 하트, 다이아몬드)
    spriteDocs: {
        cols: 13,
        rows: 4,
        width: 950,
        height: 392,
        cardW: 73, // 950 / 13 은 소수점이 발생해 캔버스 렌더링 시 인접 스프라이트가 번지는(bleeding) 현상이 발생합니다. 따라서 정확한 정수 73을 사용합니다.
        cardH: 98,  // 392 / 4 = 98
    },

    /**
     * 메인 카드 스프라이트 이미지를 로드합니다.
     * @param {function} callback - 이미지 로드 완료 후 실행할 콜백 함수
     */
    load(callback) {
        this.cardImage.onload = () => {
            this.isLoaded = true;
            if (callback) callback();
        };
        this.cardImage.src = 'card.png';
    },

    /**
     * 각 카드(52장)의 앞면을 캔버스(가상 메모리)에 미리 그려 성능을 최적화(캐싱)합니다.
     * @param {number} w - 렌더링할 카드의 폭
     * @param {number} h - 렌더링할 카드의 높이
     * @param {number} r - 카드 테두리의 둥글기 반경 (border-radius)
     */
    createCardFaces(w, h, r) {
        if (!this.isLoaded) return;

        // 크기가 달라지지 않았다면 기존 캐시 재사용 (메모리 절약)
        if (this.faceCanvases && this.lastFaceW === w && this.lastFaceH === h) return;
        this.lastFaceW = w;
        this.lastFaceH = h;

        this.faceCanvases = {};
        for (const suit of CONFIG.suits) {
            for (const rank of CONFIG.ranks) {
                const cvs = document.createElement('canvas');
                cvs.width = w;
                cvs.height = h;
                const ctx = cvs.getContext('2d');

                ctx.beginPath();
                ctx.roundRect(0, 0, w, h, r);
                ctx.clip(); // 테두리를 둥글게 자르기

                ctx.fillStyle = CONFIG.colors.cardFace;
                ctx.fill();

                const sCol = this.getSpriteCol(rank);
                const sRow = this.getSpriteRow(suit);
                const sW = this.spriteDocs.cardW;
                const sH = this.spriteDocs.cardH;

                ctx.drawImage(
                    this.cardImage,
                    sCol * sW, sRow * sH, sW, sH, // 소스 이미지 추출 위치/크기
                    -1, -1, w + 2, h + 2          // 대상 캔버스에 그릴 위치/크기 (클리핑 여백 방어용 확충)
                );

                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1;
                ctx.stroke();

                this.faceCanvases[`${rank}_${suit}`] = cvs;
            }
        }
    },

    /**
     * 카드의 뒷면 디자인(프리미엄 네이비 럭셔리 스타일)을 캔버스에 그려 캐싱합니다.
     * @param {number} w - 카드의 폭
     * @param {number} h - 카드의 높이
     * @param {number} r - 카드의 테두리 반경
     */
    createCardBack(w, h, r) {
        if (this.cardBackCanvas && this.cardBackCanvas.width === w && this.cardBackCanvas.height === h) return;
        if (!this.cardBackCanvas) this.cardBackCanvas = document.createElement('canvas');

        const cvs = this.cardBackCanvas;
        cvs.width = w;
        cvs.height = h;
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        // 뒷면 배경 그라데이션 (네이비 톤)
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, r);
        const backGradient = ctx.createLinearGradient(0, 0, w, h);
        backGradient.addColorStop(0, '#2b4162'); 
        backGradient.addColorStop(1, '#1a2a44');
        ctx.fillStyle = backGradient;
        ctx.fill();

        // 내부 서브 테두리 선 긋기
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(3, 3, w - 6, h - 6, Math.max(0, r - 1));
        ctx.stroke();

        // 내부 다이아몬드(마름모) 메쉬 패턴 영역 클리핑 처리
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(6, 6, w - 12, h - 12, Math.max(0, r - 2));
        ctx.clip();

        // 대각선 교차 그물망 패턴 그리기
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        const step = 8;
        for (let i = -h; i < w + h; i += step) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + h, h);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(i + w, 0);
            ctx.lineTo(i + w - h, h);
            ctx.stroke();
        }

        // 중앙 장식 아이콘 (작은 마름모) 그리기
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2 - 12);
        ctx.lineTo(w / 2 + 8, h / 2);
        ctx.lineTo(w / 2, h / 2 + 12);
        ctx.lineTo(w / 2 - 8, h / 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore(); // 클리핑 복구

        // 상단에서 아래로 부드럽게 퍼지는 빛 반사 (하이라이트) 효과 부여
        const shine = ctx.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.3, h * 0.3, w * 1.2);
        shine.addColorStop(0, 'rgba(255,255,255,0.05)');
        shine.addColorStop(1, 'transparent');
        ctx.fillStyle = shine;
        ctx.fill();
    },

    /**
     * 지정된 문양(Suit)이 스프라이트 시트에서 어느 행(Y열)에 위치하는지 반환합니다.
     * @param {string} suit - 카드의 문양 이름
     * @returns {number} 행의 인덱스 (0~3)
     */
    getSpriteRow(suit) {
        switch (suit) {
            case 'clubs': return 0;
            case 'spades': return 1;
            case 'hearts': return 2;
            case 'diamonds': return 3;
            default: return 0;
        }
    },

    /**
     * 지정된 숫자 혹은 영문자(Rank)가 스프라이트 시트에서 어느 열(X열)에 위치하는지 반환합니다.
     * @param {string} rank - 카드의 단위 문자 ('A', '2', ... 'K')
     * @returns {number} 열의 인덱스 (0~12)
     */
    getSpriteCol(rank) {
        if (rank === 'A') return 0;
        if (rank === 'J') return 10;
        if (rank === 'Q') return 11;
        if (rank === 'K') return 12;
        return parseInt(rank) - 1; // '2' -> 1번 인덱스, '10' -> 9번 인덱스
    }
};
