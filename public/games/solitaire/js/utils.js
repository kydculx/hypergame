/**
 * 공통 유틸리티 모듈 (Utility Functions)
 * 게임 전역에서 공통으로 사용되는 헬퍼 함수들을 제공합니다.
 */
export const Utils = {
    /**
     * 카드의 문양이 붉은색(하트, 다이아몬드)인지 판별합니다.
     * @param {string} suit - 카드의 문양 문자열
     * @returns {boolean} 붉은색 계열이면 true 반환
     */
    isRed(suit) {
        return suit === 'hearts' || suit === 'diamonds';
    },

    /**
     * 초 단위의 시간을 읽기 쉬운 'MM:SS' 형태의 문자열로 변환(포맷팅)합니다.
     * @param {number} seconds - 경과 시간 (초)
     * @returns {string} 포맷팅된 시간 문자열
     */
    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    /**
     * 주어진 특정 점(좌표)이 사각형 영역 안에 포함되어 있는지 검사합니다.
     * 카드 클릭이나 드래그 앤 드롭 판정에 주로 사용됩니다.
     * @param {number} px - 대상 점의 X 좌표
     * @param {number} py - 대상 점의 Y 좌표
     * @param {number} rx - 사각형의 좌상단 X 좌표
     * @param {number} ry - 사각형의 좌상단 Y 좌표
     * @param {number} rw - 사각형의 폭
     * @param {number} rh - 사각형의 높이
     * @returns {boolean} 사각형 내에 점이 존재하면 true 반환
     */
    pointInRect(px, py, rx, ry, rw, rh) {
        return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
    }
};
