/**
 * Voxel Tank 게임 설정 파일
 * 밸런스, 스타일, 맵 레이아웃 등의 설정을 관리합니다.
 */
import * as THREE from 'three';

// ============================================================================
// 게임 설정
// ============================================================================
const CONFIG = {
    // ------------------------------------------------------------------------
    // 탱크 설정
    // ------------------------------------------------------------------------
    TANK: {
        FORWARD_SPEED: 5,           // 전진 속도
        BACKWARD_SPEED: 3,           // 후진 속도
        ROTATE_SPEED: 4,             // 회전 속도
        TURRET_ROTATE_SPEED: 4,      // 포탑 회전 속도
        FIRE_COOLDOWN: 1000,         // 발사 쿨타임 (ms)
        MAX_HP: 100,                 // 최대 체력
        TRACK_DISTANCE: 40,          // 다른 탱크 발자국 표시 거리
        DETECTION_RANGE: 30,         // 플레이어용 적 탐지 범위
        ATTACK_RANGE: 20             // 플레이어용 자동 사격 사거리
    },

    // ------------------------------------------------------------------------
    // 총알 설정
    // ------------------------------------------------------------------------
    BULLET: {
        SPEED: 30,                   // 총알 속도
        LIFE_TIME: 1500,             // 총알 수명 (ms)
        DAMAGE: 10                   // 기본 데미지
    },

    // ------------------------------------------------------------------------
    // 월드 설정
    // ------------------------------------------------------------------------
    WORLD: {
        SIZE: 150,                  // 맵 크기
        GRID_SIZE: 1                // 그리드 크기
    },

    // ------------------------------------------------------------------------
    // 보간 속도
    // ------------------------------------------------------------------------
    LERP_SPEED: {
        TURRET: 4.0                 // 포탑 회전 부드러움 정도
    },

    // ------------------------------------------------------------------------
    // 색상 설정
    // ------------------------------------------------------------------------
    COLORS: {
        SELF: 0x4d79ff,            // 아군 색상 (파랑)
        OTHER: 0xff4d4d,            // 적 색상 (빨강)
        FLOOR: 0x3a3530,           // 지면 색상
        BULLET: 0xffff00,           // 총알 색상
        WALL: 0x252018,             // 벽 색상
        BOT: 0x9933ff               // 봇 색상 (보라)
    },

    // ------------------------------------------------------------------------
    // 맵 레이아웃
    // ------------------------------------------------------------------------
    MAP: {
        // 철조망/벽 위치
        LAYOUT: [
            // 모서리 L자형 장벽
            { x: -30, z: -30, w: 10, d: 2 }, { x: -34, z: -26, w: 2, d: 10 },
            { x: 30, z: -30, w: 10, d: 2 }, { x: 34, z: -26, w: 2, d: 10 },
            { x: -30, z: 30, w: 10, d: 2 }, { x: -34, z: 26, w: 2, d: 10 },
            { x: 30, z: 30, w: 10, d: 2 }, { x: 34, z: 26, w: 2, d: 10 },
            // 중앙 십자 장벽
            { x: 0, z: 28, w: 20, d: 2 }, { x: 0, z: -28, w: 20, d: 2 },
            { x: 28, z: 0, w: 2, d: 20 }, { x: -28, z: 0, w: 2, d: 20 },
            // 외부 덮개
            { x: -40, z: 0, w: 4, d: 4 }, { x: 40, z: 0, w: 4, d: 4 },
            { x: 0, z: -40, w: 4, d: 4 }, { x: 0, z: 40, w: 4, d: 4 },
            // 작은 장벽
            { x: -22, z: 0, w: 8, d: 2 }, { x: 22, z: 0, w: 8, d: 2 },
            { x: 0, z: -22, w: 2, d: 8 }, { x: 0, z: 22, w: 2, d: 8 }
        ],

        // 부서진 철조망
        DAMAGED_FENCE: [
            { x: -35, z: 20, w: 12, d: 2 },
            { x: 35, z: -20, w: 12, d: 2 },
            { x: -20, z: -35, w: 2, d: 12 },
            { x: 20, z: 35, w: 2, d: 12 }
        ],

        // 파괴된 탱크 위치 (맵 중앙에서부터 맵 밖까지 분산)
        WRECKS: [
            // 맵 중앙 근처
            { x: -8, z: -10 }, { x: 10, z: 8 },
            { x: -15, z: 12 }, { x: 12, z: -15 },
            // 맵 가장자리
            { x: -25, z: -20 }, { x: 25, z: 20 },
            { x: -30, z: 15 }, { x: 30, z: -25 },
            // 맵 밖 (전투 흔적)
            { x: -40, z: -35 }, { x: 40, z: 35 },
            { x: -45, z: 25 }, { x: 45, z: -40 },
            { x: -35, z: -45 }, { x: 35, z: 45 },
            { x: -50, z: 0 }, { x: 50, z: 0 },
            { x: 0, z: -50 }, { x: 0, z: 50 },
            // 더 멀리
            { x: -60, z: -30 }, { x: 60, z: 30 },
            { x: -55, z: 40 }, { x: 55, z: -55 }
        ],

        // 오브젝트 배치
        PROPS: [
            // 오두막
            { type: 'shack', x: -35, z: -30 }, { type: 'shack', x: 35, z: 30 },
            { type: 'shack', x: -30, z: 35 }, { type: 'shack', x: 30, z: -35 },
            // 감시탑
            { type: 'watchtower', x: -45, z: 30 }, { type: 'watchtower', x: 45, z: -30 },
            { type: 'watchtower', x: 30, z: 45 }, { type: 'watchtower', x: -30, z: -45 },
            // 상자
            { type: 'crate', x: -28, z: -18 }, { type: 'crate', x: 18, z: 28 },
            { type: 'crate', x: 25, z: -25 }, { type: 'crate', x: -18, z: 25 },
            // 드럼통
            { type: 'barrel', x: 22, z: -28 }, { type: 'barrel', x: -25, z: 22 },
            { type: 'barrel', x: 28, z: 18 }, { type: 'barrel', x: -22, z: -28 },
            // 모래주머니 방호 뚝
            { type: 'sandbags', x: -20, z: 20 }, { type: 'sandbags', x: 20, z: -20 },
            { type: 'sandbags', x: -35, z: 0 }, { type: 'sandbags', x: 35, z: 0 },
            { type: 'sandbags', x: 0, z: -35 }, { type: 'sandbags', x: 0, z: 35 },
            { type: 'sandbags', x: -45, z: -25 }, { type: 'sandbags', x: 45, z: 25 },
            { type: 'sandbags', x: -25, z: 45 }, { type: 'sandbags', x: 25, z: -45 }
        ]
    },

    // ------------------------------------------------------------------------
    // 봇 설정
    // ------------------------------------------------------------------------
    BOT: {
        COUNT: 15,                  // 봇 수
        // [MIN, MAX] 범위 설정 (개별 지능 부여용 - 상한선 20% 하향됨)
        FORWARD_SPEED_RANGE: [3.5, 5.2],     // 전진 속도 (최대 6.5 -> 5.2)
        BACKWARD_SPEED_RANGE: [2.0, 3.2],    // 후진 속도 (최대 4.0 -> 3.2)
        ROTATE_SPEED_RANGE: [2.5, 4.4],      // 회전 속도 (최대 5.5 -> 4.4)
        FIRE_COOLDOWN_RANGE: [1200, 3000],   // 발사 쿨타임 (최소 1000 -> 1200)
        DETECTION_RANGE_RANGE: [20, 32],     // 적 탐지 범위 (최대 40 -> 32)
        ATTACK_RANGE_RANGE: [15, 20],        // 공격 범위 (최대 25 -> 20)
        AIM_JITTER_RANGE: [0.06, 0.45],      // 조준 오차 범위 (최소 0.05 -> 0.06)
        FIRING_THRESHOLD_RANGE: [0.96, 0.985], // 사격 정렬 임계값 (최대 0.995 -> 0.985)
        JITTER_UPDATE_INTERVAL_RANGE: [0.6, 2.0], // 조준 오차 갱신 간격 (최소 0.5 -> 0.6)

        NAME_PREFIX: "Guest",        // 이름 접두사
        COLORS: [0x9933ff, 0xff9900, 0x00ffcc, 0xff0066, 0x33cc33, 0xffdd00] // 봇 색상
    },

    // ------------------------------------------------------------------------
    // 파워업 설정
    // ------------------------------------------------------------------------
    POWERUP: {
        HEAL_AMOUNT: 30,            // 회복량
        SPAWN_INTERVAL: 60,         // 스폰 간격 (초)
        MAX_COUNT: 10                // 최대 수
    },

    // ------------------------------------------------------------------------
    // 업그레이드 설정
    // ------------------------------------------------------------------------
    UPGRADE: {
        TYPES: ['CANNON', 'SPEED', 'ARMOR'], // 업그레이드 유형
        CANNON: { DAMAGE_INC: 2, SCALE_INC: 0.15 },    // 포 upgraded 데미지 증가
        SPEED: { MOVE_INC: 0.4, ROT_INC: 0.15 },        // 속도 증가
        ARMOR: { HP_INC: 30 }                            // 방어력 증가
    },

    // ------------------------------------------------------------------------
    // 공습 설정
    // ------------------------------------------------------------------------
    AIRSTRIKE: {
        INTERVAL_MIN: 60,           // 최소 간격 (초)
        INTERVAL_MAX: 120,           // 최대 간격 (초)
        PLANE_SPEED: 25,            // 전투기 속도
        PLANE_HEIGHT: 10,            // 전투기 높이
        BOMB_COUNT: 15,              // 폭탄 수
        BOMB_INTERVAL: 0.15,         // 폭탄 투하 간격 (초)
        BOMB_DAMAGE: 45,             // 폭탄 데미지
        BOMB_RADIUS: 8,              // 폭탄 반경
        WARNING_DURATION: 0,         // 공습 전 경보 시간 (초)
        SIREN_DURATION: 5,           // 사이렌 유지 시간 (초)
        SIREN_FADE_OUT: 5,            // 사이렌 페이드아웃 시간 (초)
        PLAYER_TARGET_CHANCE: 0.3,   // 플레이어가 공습 타겟이 될 확률 (0.0 ~ 1.0)
        TARGETING_RADIUS: 30,       // 목표 탐지 반경
        FALL_SPEED: 18               // 폭탄투하 속도
    },

    // ------------------------------------------------------------------------
    // 정비소 설정
    // ------------------------------------------------------------------------
    REPAIR_STATION: {
        RADIUS: 1.5,               // 수리 반경
        HEAL_RATE: 8.0,             // 초당 회복량
        COLOR_PAD: 0x2d3436,        // 패드 색상
        COLOR_GLOW: 0x00b894         // 회복 중 발광 색상
    },

    // ------------------------------------------------------------------------
    // 부스터 설정 (사용자 요청에 따라 변수로 분리)
    // ------------------------------------------------------------------------
    BOOSTER: {
        MAX_GAUGE: 100,             // 최대 게이지
        CONSUME_RATE: 35,           // 초당 소모량
        REFILL_RATE: 12,            // 초당 충전량
        SPEED_MULTIPLIER: 1.8       // 부스터 활성 시 이동 속도 배율
    },

    // ------------------------------------------------------------------------
    // 카메라 설정
    // ------------------------------------------------------------------------
    CAMERA: {
        HEIGHT: 20,                 // 카메라 높이
        SIREN_HEIGHT: 40,           // 공습 시 카메라 높이
        SIREN_ZOOM_DELAY: 3,        // 사이렌 시작 후 줌 아웃 대기 시간 (초)
        OFFSET_Z: 7,                // Z축 오프셋
        PC_FOV: 80,                 // PC 시야각
        MOBILE_FOV: 60              // 모바일 시야각
    },

    // ------------------------------------------------------------------------
    // 네트워크 설정
    // ------------------------------------------------------------------------
    NETWORK: {
        SYNC_INTERVAL: 25           // 동기화 간격 (ms)
    }
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 결정론적 랜덤 함수 (월드 동기화용)
 * 같은 시드값에 대해 항상 같은 결과를 반환합니다.
 * @param {number} seed - 시드 값
 * @returns {number} 0~1 사이의 랜덤 값
 */
function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

/**
 * 각도 선형 보간
 * @param {number} a - 시작 각도 (라디안)
 * @param {number} b - 끝 각도 (라디안)
 * @param {number} t - 보간 비율 (0~1)
 * @returns {number} 보간된 각도
 */
function lerpAngle(a, b, t) {
    let d = b - a;
    while (d < -Math.PI) d += Math.PI * 2;
    while (d > Math.PI) d -= Math.PI * 2;
    return a + d * t;
}

/**
 * 각도 정규화 (-PI ~ PI 범위로 변환)
 * @param {number} angle - 각도 (라디안)
 * @returns {number} 정규화된 각도
 */
function normalizeAngle(angle) {
    while (angle <= -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
}

/**
 * 지형 높이 반환 (현재는 평지)
 * @param {number} x - X 좌표
 * @param {number} z - Z 좌표
 * @returns {number} 높이 (항상 0)
 */
function getTerrainHeight(x, z) {
    return 0;
}

/**
 * 16진수 인코딩 (패킷 최적화용)
 * @param {number} val - 인코딩할 값
 * @param {number} offset - 오프셋
 * @param {number} scale - 스케일
 * @param {number} length - 자릿수
 * @returns {string} 16진수 문자열
 */
function encodeHex(val, offset, scale, length) {
    const intVal = Math.floor((val + offset) * scale);
    const maxVal = Math.pow(16, length) - 1;
    const clampedVal = Math.max(0, Math.min(maxVal, intVal));
    return clampedVal.toString(16).padStart(length, '0');
}

/**
 * 16진수 디코딩 (패킷 최적화용)
 * @param {string} hex - 16진수 문자열
 * @param {number} offset - 오프셋
 * @param {number} scale - 스케일
 * @returns {number} 디코딩된 값
 */
function decodeHex(hex, offset, scale) {
    const intVal = parseInt(hex, 16);
    return (intVal / scale) - offset;
}

/**
 * 탱크 데이터를 패킹 (네트워크 전송용)
 * @param {Object} tank - 탱크 객체
 * @returns {string} 패킹된 16진수 문자열
 */
function packTankData(tank) {
    // X, Z: 4자리 (오프셋 200, 스케일 100 -> -200~455 범위)
    const x = encodeHex(tank.group.position.x, 200, 100, 4);
    const z = encodeHex(tank.group.position.z, 200, 100, 4);

    // 각도 정규화
    const r = encodeHex(normalizeAngle(tank.group.rotation.y), 10, 100, 4);
    const tr = encodeHex(normalizeAngle(tank.turretGroup.rotation.y), 10, 100, 4);

    // HP, 킬 수: 4자리 (0-65535)
    const h = encodeHex(tank.hp, 0, 1, 4);
    const k = encodeHex(tank.kills, 0, 1, 4);

    // 레벨: 1자리씩 (0-F)
    const l1 = encodeHex(tank.levelCannon, 0, 1, 1);
    const l2 = encodeHex(tank.levelSpeed, 0, 1, 1);
    const l3 = encodeHex(tank.levelArmor, 0, 1, 1);

    return x + z + r + tr + h + k + l1 + l2 + l3;
}

/**
 * 탱크 데이터 언패킹 (네트워크 수신용)
 * @param {string} hex - 패킹된 문자열
 * @param {Object} tank - 탱크 객체
 * @returns {Object|null} 언패킹된 데이터 또는 null
 */
function unpackTankData(hex, tank) {
    // V2.2 규격: 27자 고정
    if (!hex || hex.length < 27) return null;

    const x = decodeHex(hex.substring(0, 4), 200, 100);
    const z = decodeHex(hex.substring(4, 8), 200, 100);
    const r = decodeHex(hex.substring(8, 12), 10, 100);
    const tr = decodeHex(hex.substring(12, 16), 10, 100);
    const h = decodeHex(hex.substring(16, 20), 0, 1);
    const k = decodeHex(hex.substring(20, 24), 0, 1);
    const l1 = decodeHex(hex.substring(24, 25), 0, 1);
    const l2 = decodeHex(hex.substring(25, 26), 0, 1);
    const l3 = decodeHex(hex.substring(26, 27), 0, 1);

    return { x, z, r, tr, h, k, l1, l2, l3 };
}

/**
 * 지형 법선 반환 (현재는 위쪽)
 * @param {number} x - X 좌표
 * @param {number} z - Z 좌표
 * @returns {THREE.Vector3} 법선 벡터
 */
function getTerrainNormal(x, z) {
    return new THREE.Vector3(0, 1, 0);
}

// ============================================================================
// ES 모듈 내보내기
// ============================================================================
export { CONFIG, seededRandom, lerpAngle, normalizeAngle, getTerrainHeight, encodeHex, decodeHex, packTankData, unpackTankData, getTerrainNormal };
