import { Renderer } from './renderer.js';
import { VictoryFountain } from './effects.js';
import { Assets } from './assets.js';
import { Input } from './input.js';
import { CardManager } from './cardManager.js';
import { AISolver } from './ai.js';
import { Utils } from './utils.js';

/**
 * 프레임 렌더링, 시간 측정 등 심장 박동수를 조절하는 코어 엔진입니다.
 */
export const Engine = {
    canvas: null,
    ctx: null,
    timer: 0, // 실제 플레이 시간 카운터 집계소 (초)
    isStarted: false,
    isGameOver: false,

    /**
     * 심박 시작 및 DOM 바인딩 선행 처리
     */
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 렌더러 초기화 전 캔버스 크기를 먼저 확정하여 좌표 계산 오류 방지
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        Renderer.init(this.ctx);
        VictoryFountain.initPool(); 

        window.addEventListener('resize', () => {
            if (this.canvas) {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
                Renderer.calculateLayout();
            }
        });

        Assets.load(() => {
            Renderer.calculateLayout(); 
            Input.init(); 
        });
    },

    requestID: null,
    gameOverTimeout: null,

    /**
     * 메인 화면의 스타팅 게이트 개방 및 첫 라운드 진행 승인
     */
    startGame() {
        document.getElementById('start-screen').classList.remove('wcg-visible');
        
        // 이전 게임의 지연된 팝업 타이머 제거 (1초 대기 중 재시작 고려)
        if (this.gameOverTimeout) {
            clearTimeout(this.gameOverTimeout);
            this.gameOverTimeout = null;
        }

        // 새 게임 시작 시 이전 승리 연출 강제 종료 및 상태 초기화
        VictoryFountain.isActive = false; 
        CardManager.isWinPending = false;
        
        this.isStarted = true;
        this.isGameOver = false;
        this.timer = 0;
        CardManager.init();
        this.startLoop();
    },

    /**
     * requestAnimationFrame 무한루프 구동열쇠
     */
    startLoop() {
        // 이미 루프가 실행 중이라면 중복 실행 방지
        if (this.requestID) return;

        const loop = () => {
            try {
                if (window.WCGames) window.WCGames.updateDelta(); 
                
                // 게임 오버 상태이더라도 승리 폰수 연출 등은 계속 그려야 하므로 
                // 무조건 update와 draw를 호출하되 내부에서 상태별로 분기 처리합니다.
                this.update();
                Renderer.draw(); 
                
                this.requestID = requestAnimationFrame(loop);
            } catch (e) {
                console.error("Game Loop Error:", e);
                this.requestID = null; // 에러 발생 시 루프 재시작이 가능하도록 초기화
            }
        };
        this.requestID = requestAnimationFrame(loop);
    },

    /**
     * 프레임별 경과 시간 수집 및 AI 액터 가이드
     */
    update() {
        if (!this.isStarted) return;

        const dt = window.WCGames ? window.WCGames.dt : 0.016;
        
        // 실제 게임 플레이 중인 경우에만 타이머 및 카드 로직 업데이트
        if (!this.isGameOver) {
            this.timer += dt;
            document.getElementById('timer').innerText = Utils.formatTime(this.timer);

            CardManager.update();
            AISolver.tick(dt); 
        }

        // 승리 연출은 게임 오버 상태에서도 독립적으로 돌아가야 함
        VictoryFountain.update();
    },

    /**
     * 클리어 판정 시 최종 리포트를 브라우징 플랫폼으로 상납합니다.
     * @param {boolean} won 
     */
    gameOver(won) {
        if (this.isGameOver) return;
        this.isGameOver = true; // 상태는 즉시 변경하여 타이머 중단

        const scoreTime = Math.floor(this.timer);
        document.getElementById('final-time').textContent = scoreTime;

        // 1초 뒤에 팝업을 띄워 유저가 마지막 연출을 감상할 여유를 줌
        this.gameOverTimeout = setTimeout(() => {
            document.getElementById('game-over').classList.add('wcg-visible');
            this.gameOverTimeout = null;

            if (window.WCGames) {
                window.WCGames.Audio.play([400, 500, 600, 800], 'triangle', 0.2, 0.5);
                window.WCGames.gameOver(scoreTime); // SDK 스코어 플랫폼 등록 (시간 = 최종지표)
            }
        }, 1000);
    },

    /**
     * SDK 또는 내부 버튼에 의한 게임 재시작 통합 처리
     */
    restart() {
        if (this.gameOverTimeout) {
            clearTimeout(this.gameOverTimeout);
            this.gameOverTimeout = null;
        }
        document.getElementById('game-over').classList.remove('wcg-visible');
        
        if (window.WCGames) {
            window.WCGames.restart(); // SDK 통계 리셋 
        } else {
            this.startGame();
        }
    }
};
