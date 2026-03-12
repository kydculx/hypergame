import { Engine } from './engine.js';
import { CardManager } from './cardManager.js';
import { AISolver } from './ai.js';
import { Card } from './card.js';

/**
 * 프로젝트 애플리케이션의 메인 진입 통로.
 * 전역 노출이 필요한 객체들을 브라우저 window 문맥으로 승격 배포하며, SDK 결합을 완수합니다.
 */

// HTML DOM 내의 onclick 이벤트에서 직접 접근하기 위해 window 프로퍼티로 할당
window.CardManager = CardManager;
window.AISolver = AISolver;
window.Engine = Engine;

// 어드민용 원클릭 테스트 클리어 치트
window.TEST_WIN = () => {
    CardManager.foundations.forEach(f => {
        for (let i = 1; i <= 13; i++) {
            f.push(new Card('hearts', i.toString(), i));
        }
    }); // 임시 클리어 상태 강제 조성
    CardManager.checkWinCondition();
};

Engine.init(); // 핵심 엔진 첫 시운전 예약

if (window.WCGames) {
    // 플레이 생태계 생명주기와 통합 연골 매칭
    window.WCGames.init({
        id: 'solitaire',
        onStart: () => {
            window.WCGames.Audio.init();
            
            // 번역 파일 시스템이 가져다주는 다국어 문자 정보 DOM 갱신
            const t = window.WCGamesTranslation;
            if (t) {
                const queryTitle = document.querySelector('[data-i18n="title"]');
                const queryInst = document.querySelector('[data-i18n="instruction"]');
                const queryPlay = document.querySelector('[data-i18n="play"]');
                const queryGameOver = document.querySelector('[data-i18n="game_over"]');
                const queryScore = document.querySelector('[data-i18n="final_score"]');
                const queryPlayAgain = document.querySelector('[data-i18n="play_again"]');
                
                if (t.title && queryTitle) queryTitle.textContent = t.title;
                if (t.instruction && queryInst) queryInst.textContent = t.instruction;
                if (t.play && queryPlay) queryPlay.textContent = t.play;
                if (t.game_over && queryGameOver) queryGameOver.textContent = t.game_over;
                if (t.final_score && queryScore) queryScore.textContent = t.final_score;
                if (t.play_again && queryPlayAgain) queryPlayAgain.textContent = t.play_again;
            }
        },
        onPause: () => {
            // 일시 정지 지시 하달에 대한 무반응 대응 (requestAnimationFrame 스틸 펜딩)
        },
        onResume: () => {
            // 브라우저 포커스 리스토어 
        },
        onRestart: () => {
            // SDK에서 리스타트 신호가 오면 무조건 게임을 처음부터 다시 구성
            Engine.startGame();
        }
    });
}
