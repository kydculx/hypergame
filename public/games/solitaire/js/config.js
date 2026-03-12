/**
 * 게임 환경 설정 모듈 (Configuration)
 * 카드의 크기, 레이아웃 규격, 색상, 이벤트 지연시간 등 전역 설정값을 관리합니다.
 */
export const CONFIG = {
    card: {
        baseWidth: 70,    // 카드의 기본 폭 (픽셀)
        baseHeight: 100,  // 카드의 기본 높이 (픽셀)
        radius: 0,        // 카드의 모서리 곡률 (0으로 설정하여 직각 유지)
        ratio: 100 / 70   // 높이/폭 비율
    },
    layout: {
        paddingY: 80,         // 화면 상단에서 플레이 영역까지의 여백
        gapX: 10,             // 가로로 나열될 때의 카드 간 간격
        gapY: 20,             // 보이지 않는 카드가 겹칠 때 기본 수직 간격
        foundationGapX: 10,   // 파운데이션(완성 슬롯) 간 가로 간격
        maxScale: 1.5,        // 카드의 최대 스케일 한계점
        stackGapY: 10,        // 타블로(바닥 슬롯)에서 뒷면 카드가 겹칠 때의 고정 수직 간격
        maxFaceGapY: 30,      // 타블로에서 앞면 카드가 겹칠 때 허용하는 최대 수직 간격
        faceGapRatio: 0.3     // 카드 높이 대비 앞면이 겹쳐 보이는 정도의 비율
    },
    colors: {
        bg: '#145A25',        // 기본 배경색
        red: '#EF4444',       // 붉은색 문양 (하트, 다이아몬드) 컬러
        black: '#1F2937',     // 검은색 문양 (스페이드, 클럽) 컬러
        cardFace: '#FFFFFF',  // 카드 앞면 배경색
        cardBack: '#1E3A8A',  // 카드 뒷면 기본 배경색
        highlight: 'rgba(255, 235, 59, 0.4)' // 카드 선택 시 하이라이트 색상 (현재 CSS 및 드래그 하이라이트로 직접 적용)
    },
    suits: ['hearts', 'diamonds', 'clubs', 'spades'], // 카드의 4가지 문양 정의 배열
    ranks: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], // 카드의 13가지 숫자/문자 배열
    input: {
        doubleClickMs: 300,   // 자동 이동(더블 클릭)으로 인식할 최대 지연 시간 (밀리초)
        dragThreshold: 5      // 드래그로 판정할 최소 이동 픽셀 기준
    },
    effects: {
        sparkleCount: 12      // 카드가 파운데이션에 안착 시 나타나는 파티클 개수
    },
    ai: {
        actionInterval: 0.1   // 오토 플레이어가 동작(액션)을 수행하는 간격 (초 단위)
    }
};
