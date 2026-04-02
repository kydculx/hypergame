import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { CONFIG, seededRandom, lerpAngle, normalizeAngle, getTerrainHeight, getTerrainNormal } from './config.js';
import { createVoxelBox, createVoxelCylinder, createVoxelCone, createItemLabel, TrackMarkManager, BulletManager } from './utils.js';


/**
 * Voxel Tank - 3D 탱크 전투 게임 (한국어 주석 추가版)
 * 섹션: 설정 → 상태/변수 → 유틸리티 → 파워업 → 입력 → 로직 → 렌더링 → SDK
 */

/* 2. 상태 및 변수 (런타임) */

/**
 * 플레이어 신원 정보 가져오기
 * URL 파라미터에서 이름, UID, 세션 키를 추출하여 고유 ID 생성
 * - n: 플레이어 이름
 * - uid: 고유 사용자 ID
 * - sk: 세션 키 (같은 사용자가 여러 탭에서 플레이할 때 구별용)
 */
function getPlayerIdentity() {
    try {
        const u = window.location.search;
        const nMatch = u.match(/[?&]n=([^&]+)/);
        const uidMatch = u.match(/[?&]uid=([^&]+)/);
        const skMatch = u.match(/[?&]sk=([^&]+)/);
        let name = nMatch ? decodeURIComponent(nMatch[1]).trim() : '';
        let idBase = uidMatch ? decodeURIComponent(uidMatch[1]).trim() : '';
        let sk = skMatch ? decodeURIComponent(skMatch[1]).trim() : '';

        if (!idBase) idBase = Math.random().toString(36).substring(2, 9);

        // 동일 사용자(같은 UID)가 여러 탭에서 접속할 때 고유성 확보를 위해 sk 추가
        let id = idBase;
        if (sk) {
            id = `${idBase}_${sk.substring(0, 4)}`;
        }

        if (!name) {
            const guestNum = Math.floor(10000 + Math.random() * 89999);
            name = `Guest${guestNum}`;
        }

        // 보안: ID는 영숫자 및 언더바만 허용, 이름은 한글/영문/숫자/공백 허용
        id = id.replace(/[^a-zA-Z0-9]/g, '_');
        name = name.replace(/[^a-zA-Z0-9가-힣\s]/g, '');
        return { id, name };
    } catch (e) {
        const guestNum = Math.floor(10000 + Math.random() * 89999);
        const fallbackId = Math.random().toString(36).substring(2, 9);
        return { id: fallbackId, name: `Guest${guestNum}` };
    }
}
const identity = getPlayerIdentity();
let myId = identity.id; // 내 플레이어 ID
let myName = identity.name; // 내 플레이어 이름
let scene, camera, renderer, clock; // Three.js 핵심 객체
let myTank; // 내 탱크 인스턴스
const walls = []; // 벽/장애물 메쉬 배열
const trees = []; // 나무 애니메이션용 그룹 배열
const wrecks = []; // 파괴된 탱크 유적 (연기 VFX용)
const bots = []; // 봇 탱크 인스턴스 배열
const powerups = []; // 활성화된 체력 포션 배열
// wallBoxes 전역 배열 제거. 충돌 박스는 이제 wall.userData.box에 저장됨
const airstrikePlanes = []; // 활성화된 전투기 배열
const airstrikeBombs = []; // 활성화된 폭격탄 배열
let repairStation; // 단일 수리 정비소 인스턴스
let trackMarkManager; // 발자국 관리자
let bulletManager; // 총알 관리자
let airstrikeWarningActive = false;
let nextAirstrikeTime = 0; // 다음 공습 이벤트 타이머
// 2. 상태 및 변수 (런타임)

let gameStartTime = Date.now(); // 접속 시점 기록 (오팩 방지용)

let lastFireTime = 0; // 마지막 발사 시간
let lastPowerupSpawnTime = 0; // 마지막 파워업 스폰 시간
let animationId = null; // 애니메이션 프레임 ID
let minimapCanvas, minimapCtx; // 미니맵 캔버스
let cameraShakeTime = 0; // 카메라 흔들림 시간
let currentCameraHeight = (CONFIG && CONFIG.CAMERA && CONFIG.CAMERA.HEIGHT) || 20; // 현재 카메라 높이 (보간용)
let wreckSmokeTimer = 0; // 유적 연기 타이머
let directionalLight; // 그림자-follow용 글로벌 조명
// 모바일 감지: 초당 60번 정규식 실행을 막기 위해 전역에서 1회만 실행
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// --- 수학 연산용 전역 임시 변수 (최적화) ---
const _tempQuat = new THREE.Quaternion();
const _parentInvQuat = new THREE.Quaternion();
const _v3_temp = new THREE.Vector3();
const _v3_temp2 = new THREE.Vector3();
const _v3_temp3 = new THREE.Vector3();
const _v3_temp4 = new THREE.Vector3(); // 추가
const _q_temp = new THREE.Quaternion();

/* 파티클 시스템 (VFX 효과) - 총알 발사, 폭발, 연기 등 시각 효과 관리 */
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.MAX_PARTICLES = (CONFIG.VFX && CONFIG.VFX.MAX_PARTICLES) || 500;
        this.group = new THREE.Group();
        scene.add(this.group);

        // 재사용 가능한 지오메트리 (메모리 최적화)
        this.sharedGeo = new THREE.BoxGeometry(1, 1, 1);
        this.muzzleGeo = new THREE.BoxGeometry(1, 1, 1);
        this.flashGeo = new THREE.BoxGeometry(1, 1, 1);
        this.trailGeo = new THREE.SphereGeometry(1, 4, 4);
        this.materials = new Map();
        // 공통 재질 캐싱 (색상별 재질 관리)
        this.getMat = (color, opacity = 1) => {
            const key = `${color}_${opacity}`;
            if (!this.materials.has(key)) {
                this.materials.set(key, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }));
            }
            return this.materials.get(key);
        };
    }

    /**
     * 기본 파티클 스폰
     * @param {THREE.Vector3} pos - 스폰 위치
     * @param {number} color - 파티클 색상
     * @param {number} count - 파티클 개수
     * @param {number} speed - 속도
     * @param {number} size - 크기
     * @param {number} life - 수명 (ms)
     */
    spawn(pos, color, count = 10, speed = 2, size = 0.1, life = 1000) {
        if (this.particles.length >= this.MAX_PARTICLES) return;
        const mat = this.getMat(color);
        for (let i = 0; i < count; i++) {
            const p = new THREE.Mesh(this.sharedGeo, mat);
            p.scale.setScalar(size);
            p.position.copy(pos);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                (Math.random()) * speed,
                (Math.random() - 0.5) * speed
            );

            this.particles.push({
                mesh: p,
                vel: vel,
                life: life,
                maxLife: life,
                gravity: (CONFIG.VFX && CONFIG.VFX.GRAVITY) || 9.8
            });
            this.group.add(p);
        }
    }

    // 용접 스파크 효과 (3색 조합 + 고중력)
    spawnWeldingSparks(pos) {
        if (this.particles.length >= this.MAX_PARTICLES) return;
        const count = 4 + Math.floor(Math.random() * 6);
        for (let i = 0; i < count; i++) {
            // 팔레트: 코어 화이트, 일렉트릭 시안, 루미너스 오렌지
            const rand = Math.random();
            const color = rand < 0.4 ? 0xffffff : (rand < 0.7 ? 0x34e7e4 : 0xffaa00);
            const mat = this.getMat(color);
            const p = new THREE.Mesh(this.sharedGeo, mat);
            const size = 0.03 + Math.random() * 0.05;
            p.scale.setScalar(size);
            p.position.copy(pos);

            const speed = 4 + Math.random() * 4;
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                (Math.random() * 0.5 + 0.5) * speed * 0.6,
                (Math.random() - 0.5) * speed
            );

            this.particles.push({
                mesh: p,
                vel: vel,
                life: 150 + Math.random() * 300,
                maxLife: 450,
                gravity: 25.0, // 낙하 효과를 위한 강한 중력
                friction: 0.98,
                initialSize: size,
                noShrink: true // 크기를 줄이지 않고 작고 강렬하게 유지
            });
            this.group.add(p);
        }
    }

    // 총구 섬광 효과 (발사 시)
    spawnMuzzleFlash(pos, dir, color = 0xffaa00) {
        const mat = this.getMat(color);
        for (let i = 0; i < 20; i++) {
            const size = 0.08 + Math.random() * 0.18;
            const p = new THREE.Mesh(this.muzzleGeo, mat);
            p.scale.setScalar(size);
            p.position.copy(pos);

            const spread = 0.6;
            const vel = dir.clone().multiplyScalar(8 + Math.random() * 8);
            vel.x += (Math.random() - 0.5) * spread * 12;
            vel.y += (Math.random() - 0.5) * spread * 12;
            vel.z += (Math.random() - 0.5) * spread * 12;

            this.particles.push({
                mesh: p,
                vel: vel,
                life: 180 + Math.random() * 180,
                maxLife: 350,
                gravity: 0,
                friction: 0.88
            });
            this.group.add(p);
        }

        const flashMat = this.getMat(0xffffff);
        for (let i = 0; i < 6; i++) {
            const size = 0.25 + Math.random() * 0.25;
            const p = new THREE.Mesh(this.flashGeo, flashMat);
            p.scale.setScalar(size);
            p.position.copy(pos);
            const vel = dir.clone().multiplyScalar(3 + Math.random() * 4);
            this.particles.push({ mesh: p, vel: vel, life: 50 + Math.random() * 50, maxLife: 100, gravity: 0 });
            this.group.add(p);
        }
    }

    // 특수 치료 버스트 효과 (정제된 힐 이펙트)
    spawnHeal(pos) {
        const colors = [0x00ffcc, 0x00ff88, 0x88ffcc, 0xffffff];
        for (let i = 0; i < 15; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const mat = this.getMat(color, 0.8);
            const p = new THREE.Mesh(this.sharedGeo, mat);
            const size = 0.06 + Math.random() * 0.08;
            p.scale.setScalar(size);

            const angle = Math.random() * Math.PI * 2;
            const radius = 0.3 + Math.random() * 0.5;
            p.position.set(
                pos.x + Math.cos(angle) * radius,
                pos.y + 0.3 + Math.random() * 0.3,
                pos.z + Math.sin(angle) * radius
            );

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                1.5 + Math.random() * 2.0,
                (Math.random() - 0.5) * 0.4
            );

            this.particles.push({
                mesh: p,
                vel: vel,
                life: 400 + Math.random() * 300,
                maxLife: 700,
                gravity: -1.0,
                friction: 0.94
            });
            this.group.add(p);
        }

        for (let i = 0; i < 8; i++) {
            const p = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.1, 0.1),
                new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.9 })
            );
            const t = i / 8 * Math.PI * 2;
            const spiralR = 0.5 + i * 0.05;
            p.position.set(
                pos.x + Math.cos(t) * spiralR,
                pos.y + 0.2,
                pos.z + Math.sin(t) * spiralR
            );

            this.particles.push({
                mesh: p,
                vel: new THREE.Vector3(Math.cos(t) * 0.3, 2.5, Math.sin(t) * 0.3),
                life: 500,
                maxLife: 500,
                gravity: -1.5,
                friction: 0.9
            });
            this.group.add(p);
        }

        for (let i = 0; i < 5; i++) {
            const spark = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.04, 0.04),
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 })
            );
            spark.position.set(
                pos.x + (Math.random() - 0.5) * 1.2,
                pos.y + 0.5 + Math.random() * 0.8,
                pos.z + (Math.random() - 0.5) * 1.2
            );

            this.particles.push({
                mesh: spark,
                vel: new THREE.Vector3(0, 3 + Math.random() * 2, 0),
                life: 200 + Math.random() * 200,
                maxLife: 400,
                gravity: 0,
                friction: 0.95
            });
            this.group.add(spark);
        }
    }

    // 특수 연기 효과 (시간이 지남에 따라 크기가 줄어듬)
    spawnSmoke(pos, color, count = 1, speed = 0.5, size = 0.2, life = 2000) {
        if (this.particles.length >= this.MAX_PARTICLES) return;
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
            const p = new THREE.Mesh(this.sharedGeo, mat);
            p.scale.setScalar(size);
            const offset = (Math.random() - 0.5) * 0.2;
            p.position.set(pos.x + offset, pos.y, pos.z + offset);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * speed * 0.3,
                (Math.random() + 0.5) * speed,
                (Math.random() - 0.5) * speed * 0.3
            );

            this.particles.push({
                mesh: p,
                vel: vel,
                life: life * (0.8 + Math.random() * 0.4),
                maxLife: life,
                initialSize: size,
                grow: false, // 기본적으로 작아지는 동작
                gravity: -1.5,
                friction: 0.98
            });
            this.group.add(p);
        }
    }

    // 특수 배기 효과 (시간이 지남에 따라 크기가 커짐)
    spawnExhaust(pos, color, count = 1, speed = 0.5, size = 0.2, life = 2000) {
        if (this.particles.length >= this.MAX_PARTICLES) return;
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
            const p = new THREE.Mesh(this.sharedGeo, mat);
            p.scale.setScalar(size);
            const offset = (Math.random() - 0.5) * 0.05;
            p.position.set(pos.x + offset, pos.y, pos.z + offset);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * speed * 0.2,
                (Math.random() + 0.2) * speed * 0.5,
                (Math.random() - 0.5) * speed * 0.2
            );

            this.particles.push({
                mesh: p,
                vel: vel,
                life: life * (0.8 + Math.random() * 0.4),
                maxLife: life,
                initialSize: size,
                grow: true, // 커지는 동작
                gravity: -0.5,
                friction: 0.98
            });
            this.group.add(p);
        }
    }

    // 특수 화염 효과
    spawnFire(pos, count = 1, speed = 1.0, size = 0.2, life = 800) {
        if (this.particles.length >= this.MAX_PARTICLES) return;
        for (let i = 0; i < count; i++) {
            const color = [0xffaa00, 0xff4400, 0xff0000][Math.floor(Math.random() * 3)];
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
            const p = new THREE.Mesh(this.sharedGeo, mat);
            p.scale.setScalar(size);
            const offset = (Math.random() - 0.5) * 0.1;
            p.position.set(pos.x + offset, pos.y, pos.z + offset);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * speed * 0.2,
                (Math.random() + 0.5) * speed,
                (Math.random() - 0.5) * speed * 0.2
            );

            this.particles.push({
                mesh: p,
                vel: vel,
                life: life * (0.6 + Math.random() * 0.4),
                maxLife: life,
                gravity: -2.0, // 연기보다 빠르게 상승
                friction: 0.96
            });
            this.group.add(p);
        }
    }

    // Specialized impact effect (착탄 효과)
    spawnImpact(pos, normal, color = 0xffaa00) {
        // 1. Flash (짧고 강한 섬광)
        const flashSize = 0.5;
        const flashGeo = new THREE.SphereGeometry(flashSize, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(pos);
        this.group.add(flash);
        this.particles.push({ mesh: flash, vel: new THREE.Vector3(), life: 100, maxLife: 100, gravity: 0 });

        // 2. 파편 (튀는 파편들)
        for (let i = 0; i < 10; i++) {
            const size = 0.05 + Math.random() * 0.1;
            const p = createVoxelBox(size, size, size, color);
            p.position.copy(pos);
            const vel = normal.clone().multiplyScalar(2 + Math.random() * 3);
            vel.x += (Math.random() - 0.5) * 2;
            vel.y += (Math.random() - 0.5) * 2;
            vel.z += (Math.random() - 0.5) * 2;
            this.particles.push({
                mesh: p,
                vel: vel,
                life: 300 + Math.random() * 300,
                maxLife: 600,
                gravity: 9.8,
                friction: 0.95
            });
            this.group.add(p);
        }
    }

    // Specialized explosion (대폭발 효과)
    spawnExplosion(pos) {
        // 1. Fireball (거대한 화염)
        for (let i = 0; i < 25; i++) {
            const size = 0.5 + Math.random() * 0.8;
            const color = [0xffaa00, 0xff4400, 0xffff00][Math.floor(Math.random() * 3)];
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
            const p = new THREE.Mesh(geometry, material);
            p.position.set(pos.x + (Math.random() - 0.5) * 1.5, pos.y + (Math.random() - 0.5) * 1.5, pos.z + (Math.random() - 0.5) * 1.5);
            const vel = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random()) * 8, (Math.random() - 0.5) * 10);
            this.particles.push({ mesh: p, vel: vel, life: 600 + Math.random() * 400, maxLife: 1000, gravity: 2, friction: 0.92 });
            this.group.add(p);
        }
        // 2. Smoke Pillar (웅장한 연기)
        for (let i = 0; i < 15; i++) {
            const size = 0.8 + Math.random() * 1.5;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.8 });
            const p = new THREE.Mesh(geometry, material);
            p.position.set(pos.x + (Math.random() - 0.5) * 2, pos.y + 0.5, pos.z + (Math.random() - 0.5) * 2);
            const vel = new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() + 1) * 4, (Math.random() - 0.5) * 3);
            this.particles.push({ mesh: p, vel: vel, life: 3000 + Math.random() * 1500, maxLife: 4500, gravity: -1.2, friction: 0.97 });
            this.group.add(p);
        }
        // 3. Heavy Debris (무거운 파편)
        for (let i = 0; i < 15; i++) {
            const size = 0.2 + Math.random() * 0.3;
            const p = createVoxelBox(size, size, size, 0x111111);
            p.position.copy(pos);
            const vel = new THREE.Vector3((Math.random() - 0.5) * 15, (Math.random() + 0.5) * 12, (Math.random() - 0.5) * 15);
            this.particles.push({ mesh: p, vel: vel, life: 1500 + Math.random() * 1000, maxLife: 2500, gravity: 15, friction: 0.99 });
            this.group.add(p);
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt * 1000;

            if (p.life <= 0) {
                this.group.remove(p.mesh);

                // 공유 지오메트리(박스, 구 등)가 아닌 경우에만 폐기하여 메모리 관리
                const isSharedGeo = (p.mesh.geometry === this.sharedGeo || p.mesh.geometry === this.muzzleGeo || p.mesh.geometry === this.flashGeo || p.mesh.geometry === this.trailGeo);
                if (!isSharedGeo) p.mesh.geometry.dispose();

                // 고유 재질(연기/화염/폭발)만 폐기, 공유된 것은 this.materials 맵에 있음
                const isSharedMat = Array.from(this.materials.values()).includes(p.mesh.material);
                if (!isSharedMat) p.mesh.material.dispose();

                this.particles.splice(i, 1);
                continue;
            }

            if (p.gravity) p.vel.y -= p.gravity * dt;
            if (p.friction) p.vel.multiplyScalar(p.friction);

            // .clone()을 피하기 위해 위치 직접 수정
            p.mesh.position.x += p.vel.x * dt;
            p.mesh.position.y += p.vel.y * dt;
            p.mesh.position.z += p.vel.z * dt;

            p.mesh.material.opacity = p.life / p.maxLife;
            if (p.grow) {
                // 배기 가스용 성장
                const growth = 1.0 + (1.0 - p.life / p.maxLife) * 1.5;
                p.mesh.scale.setScalar(growth * (p.initialSize || 1));
            } else if (!p.noShrink) {
                // 연기/화염용 축소 (noShrink가 false인 경우만)
                p.mesh.scale.setScalar((p.life / p.maxLife) * (p.initialSize || 1));
            }
        }
    }
}

let vfx;

/* 오디오 시스템 (Web Audio API) - 효과음 및 배경음 관리 */
const AudioSFX = {
    ctx: null,
    master: null,
    buffers: {}, // 캐시된 사운드 버퍼

    init() {
        if (this.ctx) return this.ctx;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            const vol = (CONFIG.AUDIO && CONFIG.AUDIO.MASTER_VOLUME) || 0.5;
            this.master.gain.setValueAtTime(vol, this.ctx.currentTime);

            this.limiter = this.ctx.createDynamicsCompressor();
            this.master.connect(this.limiter);
            this.limiter.connect(this.ctx.destination);

            // 사운드 리소스 프리로드 (백그라운드 비동기)
            this.load('cannon_shot.mp3', 'cannon');
            this.load('tank_move.mp3', 'engine');
            this.load('explosion.mp3', 'explosion');
            this.load('air_raid_siren.mp3', 'siren'); // 공습경보 사이렌
        } catch (e) {
            console.warn("Audio init failed", e);
        }
        return this.ctx;
    },
    async load(url, name) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers[name] = audioBuffer;
        } catch (e) {
            console.error(`Failed to load sound: ${url}`, e);
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    playFire() {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;

        if (this.buffers['cannon']) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers['cannon'];
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(1.0, now);
            source.connect(gain);
            gain.connect(this.master);
            source.start(now);
        } else {
            // 파일을 불러오지 못한 경우를 대비한 대체 합성음 (Sine + Noise)
            const lowOsc = this.ctx.createOscillator();
            const lowGain = this.ctx.createGain();
            lowOsc.type = 'sine';
            lowOsc.frequency.setValueAtTime(120, now);
            lowOsc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
            lowGain.gain.setValueAtTime(0.8, now);
            lowGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            lowOsc.connect(lowGain);
            lowGain.connect(this.master);
            lowOsc.start();
            lowOsc.stop(now + 0.15);
            this.playNoise(0.3, 0.6, 800, 0.4);
        }
    },

    playImpact() {
        if (!this.ctx) return;
        this.playNoise(0.2, 0.3, 600);
    },

    playExplosion() {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;

        if (this.buffers['explosion']) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers['explosion'];
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(1.0, now);
            source.connect(gain);
            gain.connect(this.master);
            source.start(now);
        } else {
            // 고품질 대체 폭발 합성음 (Triangle + Noise)
            this.playNoise(0.6, 1.5, 300);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 1);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
            osc.connect(gain);
            gain.connect(this.master);
            osc.start();
            osc.stop(now + 1);
        }
    },

    playNoise(vol, dur, filterFreq = 1000, decay = 0.3) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * dur;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + decay);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        source.start();
        source.stop(this.ctx.currentTime + dur);
    },

    playHeal() {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        osc.stop(now + 0.3);
    },

    playAirRaidSiren() {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;

        // CONFIG에서 설정값 가져오기 (기본값 설정 포함)
        const duration = (CONFIG.AIRSTRIKE && CONFIG.AIRSTRIKE.SIREN_DURATION) || 7.0;
        const fadeOut = (CONFIG.AIRSTRIKE && CONFIG.AIRSTRIKE.SIREN_FADE_OUT) || 4.0;
        const totalTime = duration + fadeOut;

        if (this.buffers['siren']) {
            if (this._sirenSource) {
                try { this._sirenSource.stop(); } catch (e) { }
            }
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers['siren'];
            const gain = this.ctx.createGain();

            // 볼륨 설정: duration 유지 후 fadeOut간 페이드 아웃
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.setValueAtTime(0.8, now + duration);
            gain.gain.exponentialRampToValueAtTime(0.001, now + totalTime);

            source.connect(gain);
            gain.connect(this.master);
            source.start(now);
            source.stop(now + totalTime);
            this._sirenSource = source;
        } else {
            // 합성 사이렌 폴백 - 설정된 총 시간에 맞춰 반복 횟수 및 볼륨 감쇄 자동 계산
            const cycles = Math.ceil(totalTime / 0.8);
            for (let i = 0; i < cycles; i++) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const t = now + i * 0.8;
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, t);
                osc.frequency.linearRampToValueAtTime(900, t + 0.4);
                osc.frequency.linearRampToValueAtTime(600, t + 0.8);

                // 전체 회차에 비례하여 볼륨 감소
                const vol = 0.3 * (1 - (i / (cycles + 1)));
                gain.gain.setValueAtTime(vol, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

                osc.connect(gain);
                gain.connect(this.master);
                osc.start(t);
                osc.stop(t + 0.8);
            }
        }
    }
};
window.AudioSFX = AudioSFX; // Expose globally

/** 탱크 엔진 사운드 효과 - 이동 속도에 따라 피치와 볼륨 동적 변경 */
class TankEngineAudio {
    constructor() {
        this.ctx = AudioSFX.init();
        if (!AudioSFX.ctx) return;
        this.source = null;
        this.gain = this.ctx.createGain();
        this.gain.connect(AudioSFX.master);
        this.started = false;
    }

    start() {
        if (!this.ctx || this.started || !AudioSFX.buffers['engine']) return;
        AudioSFX.resume();

        this.source = this.ctx.createBufferSource();
        this.source.buffer = AudioSFX.buffers['engine'];
        this.source.loop = true;
        this.source.connect(this.gain);
        this.source.start(0);
        this.started = true;
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); } catch (e) { }
            try { this.source.disconnect(); } catch (e) { }
            this.source = null;
        }
        this.started = false;
    }

    update(speedRatio) {
        if (!this.ctx) return;
        if (!this.started && AudioSFX.buffers['engine']) this.start();

        const now = this.ctx.currentTime;
        const smooth = 0.05;

        // 속도 비율에 따른 피치와 볼륨 범위 (필터 미사용)
        const pRange = (CONFIG.AUDIO && CONFIG.AUDIO.ENGINE && CONFIG.AUDIO.ENGINE.PITCH_RANGE) || [0.5, 2.0];
        const vRange = (CONFIG.AUDIO && CONFIG.AUDIO.ENGINE && CONFIG.AUDIO.ENGINE.VOLUME_RANGE) || [0.3, 1.0];

        const pitch = pRange[0] + speedRatio * (pRange[1] - pRange[0]);
        const volume = vRange[0] + Math.pow(speedRatio, 0.8) * (vRange[1] - vRange[0]);

        if (this.source) {
            this.source.playbackRate.setTargetAtTime(pitch, now, smooth);
        }
        this.gain.gain.setTargetAtTime(volume, now, smooth);
    }
}

/* 4. 파워업 및 아이템 클래스 */
class HealthPotion {
    constructor(id, position) {
        this.id = id;
        this.group = new THREE.Group();
        this.healAmount = CONFIG.POWERUP.HEAL_AMOUNT;

        // --- 프리미엄 하이테크 구급 상자 모델링 ---
        const silver = 0xbdc3c7;
        const white = 0xffffff;
        const red = 0xff1744;

        // 1. Main Case (Advanced shape)
        const body = createVoxelBox(0.8, 0.6, 0.5, white, 0.1, 0.9);
        body.position.y = 0.3;
        this.group.add(body);

        // 2. 측면 래치 (디테일 부품)
        for (let x of [-0.41, 0.41]) {
            const latch = createVoxelBox(0.05, 0.2, 0.2, silver, 0.8, 0.2);
            latch.position.set(x, 0.3, 0);
            this.group.add(latch);
        }

        // 3. 인체공학적 손잡이
        const handleL = createVoxelBox(0.05, 0.15, 0.1, silver);
        handleL.position.set(-0.15, 0.65, 0);
        this.group.add(handleL);
        const handleR = createVoxelBox(0.05, 0.15, 0.1, silver);
        handleR.position.set(0.15, 0.65, 0);
        this.group.add(handleR);
        const handleBar = createVoxelBox(0.35, 0.05, 0.1, silver);
        handleBar.position.set(0, 0.73, 0);
        this.group.add(handleBar);

        // 4. 발광 적십자 코어 (메인 상징)
        const crossH = createVoxelBox(0.4, 0.12, 0.52, red);
        crossH.position.y = 0.3;
        this.group.add(crossH);
        const crossV = createVoxelBox(0.12, 0.4, 0.52, red);
        crossV.position.y = 0.3;
        this.group.add(crossV);

        this.group.position.copy(position);
        this.group.position.y = 0.8;
        scene.add(this.group);
    }

    update(dt, time) {
        this.group.rotation.y += dt * 1.5;
        this.group.position.y = 0.8 + Math.sin(time * 2.5) * 0.12;
    }

    destroy() {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
class UpgradeItem {
    constructor(id, type, position) {
        this.id = id;
        this.type = type;
        this.group = new THREE.Group();
        this.subParts = [];

        if (type === 'CANNON') {
            // --- 총알과 1:1 시각적 매칭 (아이템 형태) ---
            const s = 1.8;
            const gold = 0xffcc00;
            const copper = 0x8d6e63;
            const yellowTip = 0xffd54f;

            // 총알과 동일한 재질 파라미터 사용 (기본 무광)
            const body = createVoxelCylinder(0.12 * s, 0.12 * s, 0.4 * s, gold, 0.2, 0.8);
            body.rotation.x = Math.PI / 2;
            this.group.add(body);

            const tip = createVoxelCone(0.12 * s, 0.25 * s, yellowTip, 0.2, 0.8);
            tip.position.z = -0.32 * s;
            tip.rotation.x = Math.PI / 2;
            this.group.add(tip);

            const base = createVoxelCylinder(0.13 * s, 0.13 * s, 0.05 * s, copper, 0.2, 0.8);
            base.position.z = 0.22 * s;
            base.rotation.x = Math.PI / 2;
            this.group.add(base);
        } else if (type === 'SPEED') {
            // --- 전술 오프로드 휠 ---
            const dark = 0x2c3e50;
            const silver = 0xbdc3c7;
            const cyan = 0x00e5ff;

            // 1. 타이어 트레드
            const tire = createVoxelCylinder(0.4, 0.4, 0.25, dark, 0.1, 0.7);
            tire.rotation.x = Math.PI / 2;
            this.group.add(tire);

            // 2. 세련된 림 (X자 스포크)
            const rim = new THREE.Group();
            for (let i = 0; i < 2; i++) {
                const spoke = createVoxelBox(0.65, 0.08, 0.08, silver, 0.8, 0.2);
                spoke.rotation.z = (Math.PI / 2) * i + Math.PI / 4;
                rim.add(spoke);
            }
            rim.position.z = 0.05; // 앞면
            this.group.add(rim);

            const rimBack = rim.clone();
            rimBack.position.z = -0.05; // 뒷면
            this.group.add(rimBack);

            // 3. 발광 허브
            const hub = createVoxelBox(0.15, 0.15, 0.3, cyan);
            this.group.add(hub);

            this.wheelParts = [tire, rim, rimBack, hub];
        } else if (type === 'ARMOR') {
            // --- 중공업용 강철 패널 ---
            const steel = 0x7f8c8d;
            const darkSteel = 0x34495e;
            const screwColor = 0xbdc3c7;

            this.plates = new THREE.Group();

            // 1. 메인 두꺼운 패널
            const mainBody = createVoxelBox(0.8, 0.8, 0.2, steel, 0.9, 0.1);
            this.plates.add(mainBody);

            // 2. 표면 보강 리브 (산업용 디자인)
            const ribH = createVoxelBox(0.84, 0.1, 0.22, darkSteel);
            this.plates.add(ribH);
            const ribV = createVoxelBox(0.1, 0.84, 0.22, darkSteel);
            this.plates.add(ribV);

            // 3. 모서리 리벳/스크류
            const positions = [
                { x: 0.3, y: 0.3 }, { x: -0.3, y: 0.3 },
                { x: 0.3, y: -0.3 }, { x: -0.3, y: -0.3 }
            ];
            positions.forEach(pos => {
                const screw = createVoxelBox(0.1, 0.1, 0.25, screwColor, 1.0, 0.1);
                screw.position.set(pos.x, pos.y, 0);
                this.plates.add(screw);
            });

            this.group.add(this.plates);
            this.subParts.push(this.plates);

            // 4. 에너지 발광 코어 (은은함)
            const core = createVoxelBox(0.2, 0.2, 0.1, 0x27ae60);
            core.position.z = 0.05;
            this.group.add(core);
        }

        this.group.position.copy(position);
        this.group.position.y = 0.8;
        scene.add(this.group);
    }

    update(dt, time) {
        this.group.rotation.y += dt * 1.2;
        this.group.position.y = 0.9 + Math.sin(time * 3.5) * 0.15;

        if (this.type === 'SPEED') {
            // 그룹 전체를 메인 축을 중심으로 회전 (Y축은 이미 그룹을 회전시킴)
            // 하지만 휠 효과를 위해 로컬 축 방향으로 회전하는 것이 더 보기 좋음
            this.group.rotation.z += dt * 8.0;
        }
        if (this.type === 'ARMOR' && this.plates) {
            const scale = 1.0 + Math.sin(time * 4) * 0.1;
            this.plates.scale.set(scale, scale, scale);
        }
    }

    destroy() {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}


/** 총알 클래스 (레거시 코드, 현재 BulletManager가 주력으로 사용) */
class Bullet {
    constructor(position, direction, ownerId) {
        this.group = new THREE.Group();

        const bodyMat = new THREE.MeshBasicMaterial({ color: 0xd4a017 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 12), bodyMat);
        body.rotation.x = Math.PI / 2;
        this.group.add(body);

        const tipMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 12), tipMat);
        tip.position.z = -0.26;
        tip.rotation.x = Math.PI / 2;
        this.group.add(tip);

        const baseMat = new THREE.MeshBasicMaterial({ color: 0x8d6e63 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12), baseMat);
        base.position.z = 0.18;
        base.rotation.x = Math.PI / 2;
        this.group.add(base);

        const casingMat = new THREE.MeshBasicMaterial({ color: 0x654321 });
        const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), casingMat);
        casing.position.z = 0.22;
        casing.rotation.x = Math.PI / 2;
        this.group.add(casing);

        this.group.position.copy(position);
        this.group.lookAt(position.clone().add(direction));

        this.mesh = this.group;
        this.direction = direction.clone();
        this.ownerId = ownerId;
        this.startTime = Date.now();
        this.trailTimer = 0;
        scene.add(this.group);
    }

    update(dt) {
        this.group.position.add(this.direction.clone().multiplyScalar(CONFIG.BULLET.SPEED * dt));

        this.trailTimer += dt;

        return Date.now() - this.startTime < CONFIG.BULLET.LIFE_TIME;
    }

    destroy() {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}

class AirstrikeBomb {
    constructor(position) {
        this.group = new THREE.Group();
        this.position = position.clone();
        this.group.position.copy(this.position);

        // --- 고정밀 복셀 폭탄 모델링 ---
        const colors = CONFIG.COLORS.AIRSTRIKE;

        // 1. 폭탄 본체 (끝이 좁아지는 원통형)
        const body = createVoxelCylinder(0.25, 0.25, 0.8, colors.BODY, 0.3, 0.7);
        body.rotation.x = Math.PI / 2;
        this.group.add(body);

        // 2. 탄두부 (Nose Cone)
        const nose = createVoxelCone(0.25, 0.3, colors.STRIP);
        nose.position.z = -0.5;
        nose.rotation.x = Math.PI / 2;
        this.group.add(nose);

        // 3. 꼬리 날개 (안정적인 낙하용)
        for (let i = 0; i < 4; i++) {
            const fin = createVoxelBox(0.05, 0.3, 0.3, colors.FIN);
            fin.position.z = 0.4;
            fin.rotation.z = (Math.PI / 2) * i;
            this.group.add(fin);
        }

        // 지면을 향하도록 정렬
        this.group.lookAt(this.position.clone().add(new THREE.Vector3(0, -1, 0)));
        scene.add(this.group);
    }

    update(dt) {
        // 중력에 따른 낙하 처리
        this.position.y -= CONFIG.AIRSTRIKE.FALL_SPEED * dt;
        this.group.position.copy(this.position);

        // 지면 충돌 시 폭발 실행
        if (this.position.y <= 0) {
            this.explode();
            return false; // 객체 제거
        }
        return true;
    }

    explode() {
        // 폭발 시각 효과 및 사운드 실행
        if (vfx) vfx.spawnExplosion(this.position);
        if (window.AudioSFX) window.AudioSFX.playExplosion();

        // 폭발 반경 내 탱크들에게 데미지 적용
        const radius = CONFIG.AIRSTRIKE.BOMB_RADIUS;
        const damage = CONFIG.AIRSTRIKE.BOMB_DAMAGE;

        const checkDamage = (tank) => {
            if (!tank || tank.hp <= 0) return;
            const dist = tank.group.position.distanceTo(this.position);
            if (dist <= radius) {
                // 중심부에 가까울수록 큰 데미지 (선형 감쇄)
                const damageFactor = Math.max(0, 1.0 - (dist / radius) * 0.5);
                const finalDamage = Number(damage) * damageFactor;
                if (!isNaN(finalDamage)) {
                    tank.handleHit(finalDamage, "airstrike");
                }
            }
        };

        if (myTank) checkDamage(myTank);
        bots.forEach(bot => checkDamage(bot));

        // 플레이어 근처 폭발 시 화면 흔들림 연출
        if (myTank) {
            const distToPlayer = myTank.group.position.distanceTo(this.position);
            if (distToPlayer < 20) {
                cameraShakeTime = 0.4 * (1.0 - distToPlayer / 20);
            }
        }

        this.destroy();
    }

    destroy() {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}

class FighterPlane {
    constructor(startPoint, endPoint, targetPosition) {
        this.group = new THREE.Group();
        this.startPoint = startPoint.clone();
        this.endPoint = endPoint.clone();
        this.dir = endPoint.clone().sub(startPoint).normalize();
        this.distance = startPoint.distanceTo(endPoint);
        this.traveled = 0;
        this.bombTimer = 0;
        this.bombCount = 0;
        this.time = 0;
        this.targetPosition = targetPosition ? targetPosition.clone() : null;
        this.bombingStarted = false;

        // --- 스텔스 전투기 (F-22 랩터 스타일) ---
        const colors = CONFIG.COLORS.FIGHTER;

        // 1. 메인 동체 (Main Fuselage)
        const fuselage = createVoxelBox(0.7, 0.5, 4.0, colors.BODY);
        fuselage.position.set(0, 0, 0);
        this.group.add(fuselage);

        // 2. 기수 (Sharp Nose)
        const noseMain = createVoxelBox(0.5, 0.35, 0.8, colors.BODY);
        noseMain.position.set(0, -0.05, -2.4);
        this.group.add(noseMain);
        const noseTip = createVoxelBox(0.25, 0.2, 0.4, colors.ACCENT);
        noseTip.position.set(0, -0.08, -2.8);
        this.group.add(noseTip);

        // 3. 사이드 섀시 (엔진 베이 도어)
        for (let side of [-1, 1]) {
            const bayDoor = createVoxelBox(0.15, 0.45, 2.2, colors.ACCENT);
            bayDoor.position.set(side * 0.43, -0.05, 0.8);
            this.group.add(bayDoor);
        }

        // 4. 조종석 캐노피 (Cockpit Canopy)
        const canopyBase = createVoxelBox(0.4, 0.15, 0.8, colors.METAL);
        canopyBase.position.set(0, 0.32, -1.2);
        this.group.add(canopyBase);
        const canopyGlass = createVoxelBox(0.35, 0.25, 0.7, colors.COCKPIT, 0.1, 0.1);
        canopyGlass.position.set(0, 0.42, -1.2);
        this.group.add(canopyGlass);

        // 5. 메인 날개 (Main Delta Wings)
        for (let side of [-1, 1]) {
            const wingBase = createVoxelBox(2.2, 0.06, 1.8, colors.WING);
            wingBase.position.set(side * 1.4, -0.1, 0.3);
            wingBase.rotation.z = side * 0.08;
            this.group.add(wingBase);

            const wingTip = createVoxelBox(0.8, 0.05, 0.4, colors.WING);
            wingTip.position.set(side * 2.6, -0.12, 0.7);
            wingTip.rotation.z = side * 0.15;
            this.group.add(wingTip);

            const wingRear = createVoxelBox(1.8, 0.05, 0.6, colors.WING);
            wingRear.position.set(side * 1.2, -0.1, 1.1);
            this.group.add(wingRear);
        }

        // 6. V자형 수직 미익 (Twin Vertical Tails)
        for (let side of [-1, 1]) {
            const vTailMain = createVoxelBox(0.06, 0.9, 0.7, colors.TAIL);
            vTailMain.position.set(side * 0.5, 0.5, 1.5);
            vTailMain.rotation.z = side * 0.3;
            this.group.add(vTailMain);

            const vTailRudder = createVoxelBox(0.05, 0.5, 0.4, colors.ACCENT);
            vTailRudder.position.set(side * 0.65, 0.6, 1.7);
            vTailRudder.rotation.z = side * 0.35;
            this.group.add(vTailRudder);
        }

        // 7. 수평 미익 (Horizontal Stabilizers)
        const hStab = createVoxelBox(1.6, 0.05, 0.6, colors.WING);
        hStab.position.set(0, 0, 1.8);
        this.group.add(hStab);

        // 8. 트윈 엔진 노즐 (Twin Engine Nozzles)
        for (let side of [-1, 1]) {
            const nozzleOuter = createVoxelCylinder(0.22, 0.25, 0.5, colors.METAL, 0.8, 0.2);
            nozzleOuter.position.set(side * 0.28, -0.08, 2.2);
            nozzleOuter.rotation.x = Math.PI / 2;
            this.group.add(nozzleOuter);

            const nozzleInner = createVoxelCylinder(0.15, 0.18, 0.3, colors.ENGINE, 0.1, 0.9);
            nozzleInner.position.set(side * 0.28, -0.08, 2.35);
            nozzleInner.rotation.x = Math.PI / 2;
            if (nozzleInner.material) {
                nozzleInner.material.emissive = new THREE.Color(colors.ENGINE);
                nozzleInner.material.emissiveIntensity = 1.5;
            }
            this.group.add(nozzleInner);

            const nozzleRing = createVoxelCylinder(0.26, 0.26, 0.08, colors.ACCENT, 0.9, 0.1);
            nozzleRing.position.set(side * 0.28, -0.08, 2.45);
            nozzleRing.rotation.x = Math.PI / 2;
            this.group.add(nozzleRing);
        }

        // 9. 공기 흡입구 (Side Air Intakes)
        for (let side of [-1, 1]) {
            const intake = createVoxelBox(0.2, 0.2, 1.2, colors.ACCENT);
            intake.position.set(side * 0.5, -0.2, 0.5);
            this.group.add(intake);

            const intakeRamp = createVoxelBox(0.15, 0.1, 0.4, colors.METAL);
            intakeRamp.position.set(side * 0.55, -0.1, 0.1);
            intakeRamp.rotation.z = side * 0.2;
            this.group.add(intakeRamp);
        }

        // 10. 미사일 베이 (Missile Bays)
        const missileBay = createVoxelBox(0.3, 0.15, 0.8, colors.ACCENT);
        missileBay.position.set(0, -0.22, -0.8);
        this.group.add(missileBay);

        // 11. 데이터 링크 / 안테나 (Data Link Antenna)
        const antenna = createVoxelBox(0.02, 0.3, 0.02, colors.METAL);
        antenna.position.set(0, 0.55, 0.5);
        this.group.add(antenna);
        const antennaDish = createVoxelBox(0.15, 0.08, 0.15, colors.METAL);
        antennaDish.position.set(0, 0.7, 0.5);
        this.group.add(antennaDish);

        // 12. 랜딩 기어 도어 (착륙 장치 도어 - 닫힘)
        for (let side of [-1, 1]) {
            const gearDoor = createVoxelBox(0.15, 0.05, 0.25, colors.ACCENT);
            gearDoor.position.set(side * 0.25, -0.28, -0.3);
            this.group.add(gearDoor);
        }

        // 13. 대열등 / 표시등 (Formation Lights)
        const lightL = createVoxelBox(0.08, 0.05, 0.08, 0x00ff00);
        lightL.position.set(-2.5, -0.1, 0.5);
        if (lightL.material) {
            lightL.material.emissive = new THREE.Color(0x00ff00);
            lightL.material.emissiveIntensity = 1.0;
        }
        this.group.add(lightL);

        const lightR = createVoxelBox(0.08, 0.05, 0.08, 0xff0000);
        lightR.position.set(2.5, -0.1, 0.5);
        if (lightR.material) {
            lightR.material.emissive = new THREE.Color(0xff0000);
            lightR.material.emissiveIntensity = 1.0;
        }
        this.group.add(lightR);

        this.group.position.copy(this.startPoint);
        this.group.lookAt(this.endPoint);
        scene.add(this.group);
    }

    update(dt) {
        this.time += dt;
        const step = CONFIG.AIRSTRIKE.PLANE_SPEED * dt;
        this.traveled += step;

        // --- 퀄리티 애니메이션: 미세한 기우뚱함 및 고도 보정 ---
        const bank = Math.sin(this.time * 2) * 0.05;
        const bob = Math.sin(this.time * 3) * 0.15;

        this.group.position.add(this.dir.clone().multiplyScalar(step));
        this.group.position.y = CONFIG.AIRSTRIKE.PLANE_HEIGHT + bob;
        this.group.rotation.z = bank;

        // --- 비행운 (Contrails - Wingtips) ---
        if (vfx && Math.floor(this.time * 40) % 2 === 0) { // 매 프레임 파티클 생성 방지
            const leftTip = new THREE.Vector3(-2.5, 0, 0.6).applyQuaternion(this.group.quaternion).add(this.group.position);
            const rightTip = new THREE.Vector3(2.5, 0, 0.6).applyQuaternion(this.group.quaternion).add(this.group.position);
            vfx.spawnSmoke(leftTip, 0xecf0f1, 0.15, 0.8, 0.2, 1500);
            vfx.spawnSmoke(rightTip, 0xecf0f1, 0.15, 0.8, 0.2, 1500);
        }

        // --- 폭격 로직 ---
        if (!this.bombingStarted && this.targetPosition) {
            const distToTarget = this.group.position.distanceTo(this.targetPosition);
            if (distToTarget < CONFIG.AIRSTRIKE.TARGETING_RADIUS) {
                this.bombingStarted = true;
            }
        }

        if (this.bombingStarted && this.bombCount < CONFIG.AIRSTRIKE.BOMB_COUNT) {
            this.bombTimer += dt;
            if (this.bombTimer >= CONFIG.AIRSTRIKE.BOMB_INTERVAL) {
                this.bombTimer = 0;
                this.dropBomb();
                this.bombCount++;
            }
        }

        if (this.traveled >= this.distance) {
            this.destroy();
            return false;
        }
        return true;
    }

    dropBomb() {
        const bombPos = this.group.position.clone();
        bombPos.y -= 1.0;
        airstrikeBombs.push(new AirstrikeBomb(bombPos));
    }

    destroy() {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}

class RepairStation {
    constructor(x = 0, z = 0) {
        this.group = new THREE.Group();
        this.position = new THREE.Vector3(x, 0, z);
        this.group.position.copy(this.position);

        const baseSize = CONFIG.REPAIR_STATION.RADIUS * 4.5;
        const colors = CONFIG.COLORS.REPAIR_STATION;

        // 6각형 메인 베이스 (Y=0.05)
        const radius = baseSize / 1.7;
        const base = createVoxelCylinder(radius, radius, 0.1, colors.BASE, 0.2, 0.8, 6);
        base.position.y = 0.05;
        base.rotation.y = Math.PI / 6;
        base.receiveShadow = true;
        this.group.add(base);

        // 6각형 테두리 장식 (Y=0.15로 높임 - 울렁거림 방지)
        const edgeTrim = createVoxelCylinder(radius + 0.1, radius + 0.1, 0.05, colors.METAL_ACCENT, 0.4, 0.6, 6);
        edgeTrim.position.y = 0.15;
        edgeTrim.rotation.y = Math.PI / 6;
        this.group.add(edgeTrim);

        // 6각형 내부 그리드 플레이트 (Y=0.20으로 높임)
        const innerPlate = createVoxelCylinder(radius - 0.3, radius - 0.3, 0.02, 0x1a1a1a, 0.1, 1.0, 6);
        innerPlate.position.y = 0.20;
        innerPlate.rotation.y = Math.PI / 6;
        this.group.add(innerPlate);

        // 6각형 구석 소품들 (높이 간격 최적화)
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
            const dist = radius - 0.5;

            const bolt = createVoxelBox(0.2, 0.2, 0.2, colors.BOLT);
            bolt.position.set(Math.cos(angle) * dist, 0.25, Math.sin(angle) * dist);
            this.group.add(bolt);

            if (i % 2 === 0) {
                const marker = createVoxelBox(0.4, 0.02, 0.4, colors.WARNING);
                marker.position.set(Math.cos(angle) * (dist - 0.6), 0.22, Math.sin(angle) * (dist - 0.6));
                marker.rotation.y = angle;
                this.group.add(marker);
            }
        }

        this.arms = [];
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? -1 : 1;
            const armGroup = new THREE.Group();
            // 로봇 팔을 베이스의 바깥쪽 끝으로 이동 (개방적인 수리 구역 확보)
            armGroup.position.set(side * (baseSize / 2.0), 0.5, 0);

            const baseMount = createVoxelBox(1.2, 0.5, 1.2, colors.METAL_DARK, 0.8, 0.2);
            baseMount.position.y = 0.25;
            armGroup.add(baseMount);

            const pivot = createVoxelCylinder(0.3, 0.3, 0.4, colors.METAL_ACCENT, 0.9, 0.1);
            pivot.position.y = 0.5;
            pivot.rotation.x = Math.PI / 2;
            armGroup.add(pivot);

            const s1 = createVoxelBox(0.6, 2.5, 0.6, colors.HAZARD, 0.4, 0.6);
            s1.position.y = 1.6;
            s1.rotation.z = side * 0.35;
            armGroup.add(s1);

            const s2Group = new THREE.Group();
            s2Group.position.set(side * -0.8, 3.2, 0);
            s2Group.rotation.z = side * 1.0;
            armGroup.add(s2Group);

            const s2Body = createVoxelBox(0.5, 2.2, 0.5, colors.HAZARD, 0.4, 0.6);
            s2Body.position.y = 1.1;
            s2Group.add(s2Body);

            const hydraulic = createVoxelCylinder(0.08, 0.08, 1.5, colors.BOLT, 0.95, 0.05);
            hydraulic.position.set(side * 0.3, 1.5, 0.2);
            hydraulic.rotation.z = side * 0.3;
            s2Group.add(hydraulic);

            const headBase = createVoxelBox(0.5, 0.4, 0.5, colors.METAL_DARK);
            headBase.position.y = 2.35;
            s2Group.add(headBase);

            const weldingTorch = createVoxelBox(0.15, 0.15, 0.15, 0x1a1a1a);
            weldingTorch.position.set(0, 2.6, 0);
            s2Group.add(weldingTorch);

            const torchTip = createVoxelBox(0.08, 0.5, 0.08, colors.HAZARD);
            torchTip.position.set(0, 2.9, 0);
            if (torchTip.material) {
                torchTip.material.emissive = new THREE.Color(colors.HAZARD);
                torchTip.material.emissiveIntensity = 0.8;
            }
            s2Group.add(torchTip);

            this.group.add(armGroup);
            this.arms.push({ group: armGroup, s1: s1, s2: s2Group, tip: torchTip, side: side });
        }

        this.addProps(baseSize);

        scene.add(this.group);
        this.animTime = 0;
    }

    addProps(baseSize, pHeight) {
        const radius = baseSize / 1.7; // radius 정의 추가 (ReferenceError 해결)
        const colors = CONFIG.COLORS.REPAIR_STATION;

        // 6각형 모서리 전구등 (5~6개)
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
            const dist = radius;

            // 조명 지지대
            const lightBase = createVoxelBox(0.4, 0.4, 0.4, colors.METAL_DARK);
            lightBase.position.set(Math.cos(angle) * dist, 0.15, Math.sin(angle) * dist);
            lightBase.rotation.y = angle;
            this.group.add(lightBase);

            // 실제 빛나는 전구 부분
            const bulb = createVoxelCylinder(0.12, 0.12, 0.5, colors.LIGHT);
            bulb.position.set(Math.cos(angle) * dist, 0.5, Math.sin(angle) * dist);
            if (bulb.material) {
                bulb.material.emissive = new THREE.Color(colors.LIGHT);
                bulb.material.emissiveIntensity = 1.0;
            }
            this.group.add(bulb);
        }
    }

    update(dt) {
        this.animTime += dt;
        const isRepairing = myTank && myTank.hp > 0 &&
            myTank.group.position.distanceTo(this.position) < (CONFIG.REPAIR_STATION.RADIUS + 2.0) &&
            myTank.hp < myTank.maxHp;

        this.arms.forEach((arm, i) => {
            if (isRepairing) {
                const move = Math.sin(this.animTime * 5 + i) * 0.18;
                arm.s2.rotation.z = arm.side * (1.2 + move);

                if (Math.random() < CONFIG.REPAIR_STATION.SPARK_CHANCE) { // 스파크 발생
                    const hPos = new THREE.Vector3();
                    // [FIX] 니들 팁 끝점에서 파티클 발생
                    arm.tip.getWorldPosition(hPos);
                    const tipOffset = new THREE.Vector3(0, 0.4, 0).applyQuaternion(arm.tip.quaternion);
                    hPos.add(tipOffset);

                    vfx.spawnWeldingSparks(hPos);
                    if (Math.random() < CONFIG.REPAIR_STATION.SMOKE_CHANCE) {
                        vfx.spawnSmoke(hPos, 0xaaaaaa, 1, 0.4, 0.2, 500);
                    }
                }
            } else {
                arm.s2.rotation.z = THREE.MathUtils.lerp(arm.s2.rotation.z, arm.side * 0.6, dt * 2);
            }
        });

        if (isRepairing) {
            this.healTank(myTank, dt);
            if (Math.random() < 0.25) vfx.spawnHeal(myTank.group.position);
        }

        // 수리 완료 시 강제 배출 로직 (밸런스 조정)
        const currentDist = myTank.group.position.distanceTo(this.position);
        const repairThreshold = CONFIG.REPAIR_STATION.RADIUS + 3.0; // 배출 거리 최적화

        if (myTank.hp >= myTank.maxHp && currentDist < repairThreshold) {
            // 탱크의 정면 방향 계산 (전진 벡터)
            const forwardDir = new THREE.Vector3(-Math.sin(myTank.group.rotation.y), 0, -Math.cos(myTank.group.rotation.y));
            const pushSpeed = 5.0; // 배출 속도 최종 하향 (5.0)
            myTank.group.position.add(forwardDir.multiplyScalar(pushSpeed * dt));
        }
    }

    healTank(tank, dt) {
        const newHp = Math.min(tank.maxHp, tank.hp + CONFIG.REPAIR_STATION.HEAL_RATE * dt);
        tank.updateHP(newHp);
        if (Math.random() < 0.04) AudioSFX.playHeal();
    }
}

/**
 * 탱크 차체(Hull) 모델링 생성
 * @param {THREE.Group} group - 차체 파츠가 추가될 그룹
 * @param {number} color - 주 색상
 * @param {boolean} isWreck - 잔함(Wreckage) 여부
 * @returns {object} - 생성된 주요 파츠 { body, treads, wheels }
 */
function buildTankHull(group, color, isWreck = false) {
    const detailColors = CONFIG.COLORS.TANK_DETAILS;
    const metal = isWreck ? 0.2 : 0.4;
    const rough = isWreck ? 0.9 : 0.6;

    // 메인 바디
    const body = createVoxelBox(1.35, 0.32, 2.3, color, metal, rough);
    body.position.y = 0.3;
    group.add(body);

    // 사이드 스커트 (궤도 가드)
    const skirtL = createVoxelBox(0.08, 0.28, 2.25, color, metal, rough);
    skirtL.position.set(-0.65, 0.35, 0);
    group.add(skirtL);

    const skirtR = createVoxelBox(0.08, 0.28, 2.25, color, metal, rough);
    skirtR.position.set(0.65, 0.35, 0);
    group.add(skirtR);

    // 사이드 리벳 (볼트)
    for (let side of [-0.68, 0.68]) {
        for (let z = -0.8; z <= 0.9; z += 0.4) {
            const rivet = createVoxelBox(0.04, 0.04, 0.04, detailColors.BASE);
            rivet.position.set(side, 0.4, z);
            group.add(rivet);
        }
    }

    const guardL = createVoxelBox(0.4, 0.05, 0.4, detailColors.BASE);
    guardL.position.set(-0.48, 0.45, -0.85);
    group.add(guardL);

    const guardR = createVoxelBox(0.4, 0.05, 0.4, detailColors.BASE);
    guardR.position.set(0.48, 0.45, -0.85);
    group.add(guardR);

    // 보조 연료통
    const fuelColor = isWreck ? 0x1a1510 : 0x2d3436;
    [-0.4, 0.4].forEach(x => {
        const barrel = createVoxelCylinder(0.18, 0.18, 0.3, fuelColor, 0.5, 0.5);
        barrel.position.set(x, 0.4, 1.15);
        barrel.rotation.x = Math.PI / 2;
        if (isWreck && seededRandom(x * 123) < 0.3) {
            barrel.rotation.z = seededRandom(x * 456) * 0.5;
            barrel.position.y -= 0.1;
        }
        group.add(barrel);
    });

    // 후면 배기구
    for (let side of [-0.48, 0.48]) {
        const exhaust = createVoxelCylinder(0.08, 0.08, 0.15, detailColors.MUZZLE);
        exhaust.position.set(side, 0.32, 1.18);
        exhaust.rotation.x = Math.PI / 2;
        group.add(exhaust);
    }

    // 전면 디테일 (해치, 잠망경, 헤드라이트, ERA)
    const dHatch = createVoxelBox(0.35, 0.06, 0.35, detailColors.BASE);
    dHatch.position.set(0, 0.46, -0.75);
    group.add(dHatch);

    for (let ang of [-0.6, 0, 0.6]) {
        const peri = createVoxelBox(0.08, 0.08, 0.06, detailColors.MUZZLE);
        peri.position.set(Math.sin(ang) * 0.15, 0.5, -0.85 + Math.abs(ang) * 0.05);
        peri.rotation.y = -ang;
        group.add(peri);
        const lens = createVoxelBox(0.06, 0.04, 0.01, isWreck ? 0x050505 : 0x3498db);
        lens.position.set(peri.position.x, 0.51, peri.position.z - 0.035);
        lens.rotation.y = -ang;
        group.add(lens);
    }

    for (let side of [-0.55, 0.55]) {
        const lightBox = createVoxelBox(0.12, 0.08, 0.08, detailColors.WHEEL);
        lightBox.position.set(side, 0.4, -1.05);
        group.add(lightBox);
        if (!isWreck) {
            const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffcc }));
            led.position.set(side, 0.4, -1.1);
            group.add(led);
        }
    }

    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
            if (isWreck && seededRandom(row * 7 + col) < 0.4) continue;
            const era = createVoxelBox(0.25, 0.06, 0.25, color, 0.5, 0.5);
            era.position.set((col - 1) * 0.35, 0.46, -1.0 + row * 0.3);
            era.rotation.x = -0.1;
            group.add(era);
        }
    }

    for (let side of [-0.72, 0.72]) {
        const cable = createVoxelBox(0.04, 0.04, 1.4, 0x555555, 0.8, 0.2);
        cable.position.set(side, 0.45, 0);
        group.add(cable);
    }

    const treads = [
        createVoxelBox(0.4, 0.3, 2.3, detailColors.TREAD, 0.1, 0.9),
        createVoxelBox(0.4, 0.3, 2.3, detailColors.TREAD, 0.1, 0.9)
    ];
    treads[0].position.set(-0.48, 0.15, 0);
    treads[1].position.set(0.48, 0.15, 0);
    group.add(treads[0], treads[1]);

    const wheels = [];
    for (let side of [-0.48, 0.48]) {
        for (let i = 0; i < 7; i++) {
            const wheel = createVoxelCylinder(0.15, 0.15, 0.4, detailColors.WHEEL);
            wheel.position.set(side, 0.15, -1.05 + i * 0.35);
            wheel.rotation.z = Math.PI / 2;
            group.add(wheel);
            wheels.push(wheel);
        }
    }

    return { body, treads, wheels };
}

/**
 * 탱크 포탑(Turret) 모델링 생성
 * @param {THREE.Group} group - 포탑 파츠가 추가될 그룹
 * @param {THREE.Group} barrelGroup - 포신 그룹
 * @param {number} color - 주 색상
 * @param {boolean} isWreck - 잔해 여부
 * @returns {object} - 생성된 주요 파츠 { turretMain, barrel }
 */
function buildTankTurret(group, barrelGroup, color, isWreck = false) {
    const detailColors = CONFIG.COLORS.TANK_DETAILS;
    const metal = isWreck ? 0.2 : 0.4;
    const rough = isWreck ? 0.9 : 0.6;

    const turretMain = createVoxelBox(1.0, 0.35, 1.2, color, metal, rough);
    turretMain.position.set(0, 0.1, 0.15);
    turretMain.castShadow = true;
    group.add(turretMain);

    for (let side of [-1, 1]) {
        const cheek = createVoxelBox(0.12, 0.4, 1.0, color, metal, rough);
        cheek.position.set(0.42 * side, 0.1, -0.2);
        cheek.rotation.y = side > 0 ? 0.35 : -0.35;
        group.add(cheek);
    }

    const hatch = createVoxelBox(0.4, 0.1, 0.4, detailColors.BASE);
    hatch.position.set(0.18, 0.4, 0.05);
    group.add(hatch);

    // MG
    if (!isWreck || seededRandom(color * 11) > 0.5) {
        const mgGroup = new THREE.Group();
        mgGroup.position.set(-0.2, 0.4, 0.1);
        group.add(mgGroup);
        const mgBody = createVoxelBox(0.1, 0.12, 0.25, detailColors.MUZZLE, 0.8, 0.2);
        mgGroup.add(mgBody);
        const aaMgBarrel = createVoxelBox(0.04, 0.04, 0.4, detailColors.BARREL, 0.8, 0.2);
        aaMgBarrel.position.set(0, 0, -0.25);
        mgGroup.add(aaMgBarrel);
    }

    const antenna = createVoxelBox(0.015, 0.9, 0.015, 0x000000);
    antenna.position.set(-0.35, 0.7, 0.3);
    if (!isWreck) group.add(antenna);

    const optic = createVoxelBox(0.15, 0.15, 0.12, detailColors.WHEEL);
    optic.position.set(-0.25, 0.45, -0.3);
    group.add(optic);
    const opticLens = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: isWreck ? 0x0a0a0a : 0x3498db }));
    opticLens.position.set(-0.25, 0.48, -0.36);
    group.add(opticLens);

    for (let side of [-0.5, 0.5]) {
        for (let i = 0; i < 3; i++) {
            const launcher = createVoxelCylinder(0.05, 0.05, 0.2, detailColors.BASE);
            launcher.position.set(side, 0.25 + i * 0.05, -0.2 + i * 0.1);
            launcher.rotation.set(0.3, side > 0 ? 0.4 : -0.4, 0);
            group.add(launcher);
        }
    }

    const bin = createVoxelBox(0.7, 0.3, 0.3, color, metal, rough);
    bin.position.set(0, 0.15, 0.6);
    group.add(bin);

    // 포신 (Barrel)
    const barrel = new THREE.Group();
    barrel.position.set(0, 0, -0.65);
    barrel.rotation.x = -Math.PI / 2;
    barrelGroup.add(barrel);

    const tube = createVoxelCylinder(0.08, 0.1, 1.5, detailColors.BARREL, 0.6, 0.4);
    barrel.add(tube);
    const evac = createVoxelCylinder(0.14, 0.14, 0.25, detailColors.BARREL);
    evac.position.set(0, 0.1, 0);
    barrel.add(evac);
    const brakeMain = createVoxelCylinder(0.12, 0.12, 0.15, detailColors.MUZZLE);
    brakeMain.position.y = 0.75;
    barrel.add(brakeMain);
    const brakeRing = createVoxelCylinder(0.16, 0.16, 0.05, detailColors.WHEEL);
    brakeRing.position.y = 0.72;
    barrel.add(brakeRing);

    return { turretMain, barrel };
}

/**
 * 전차 잔해(Wreckage) 생성
 */
function createWreckage(x, z) {
    const color = 0x221a15; // 불탄 색상
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = seededRandom(x + z) * Math.PI * 2;
    group.rotation.x = (seededRandom(x * 2) - 0.5) * 0.15;
    group.rotation.z = (seededRandom(z * 3) - 0.5) * 0.15;
    scene.add(group);

    const hullGroup = new THREE.Group();
    group.add(hullGroup);
    buildTankHull(hullGroup, color, true);

    const turretGroup = new THREE.Group();
    turretGroup.position.y = 0.45;
    turretGroup.rotation.y = (seededRandom(x * 5) - 0.5) * 2;
    group.add(turretGroup);

    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(0, 0.15, -0.4);
    turretGroup.add(barrelGroup);
    buildTankTurret(turretGroup, barrelGroup, color, true);

    wrecks.push(group);

    // 충돌체 추가
    const col = createVoxelBox(1.6, 1.1, 2.6, 0x000000);
    col.position.set(x, 0.55, z);
    col.visible = false;
    col.userData = { type: 'wreckage' };
    scene.add(col);
    walls.push(col);
}

/* 탱크 클래스 - 플레이어 및 봇의 탱크 시각 표현과 로직 관리 */
class Tank {
    /**
     * 탱크 생성자
     * @param {string} id - 고유 ID
     * @param {string} name - 표시 이름
     * @param {boolean} isPlayer - 플레이어 탱크 여부
     */
    constructor(id, name, isPlayer = false) {

        this.id = id;
        this.name = name || id;
        this.isPlayer = isPlayer;
        this.kills = 0; // 킬 수
        this.lastSeen = Date.now();
        this.isDead = false;
        this.group = new THREE.Group();

        // 업그레이드 레벨 (0~9)
        this.levelCannon = 0;
        this.levelSpeed = 0;
        this.levelArmor = 0;

        // --- HUD 체력바 시스템 (HTML 오버레이) ---
        this.hpBarElement = document.createElement('div');
        this.hpBarElement.className = 'hp-hud';

        // 이름 레이블 제거 (사용자 요청)
        this.hpBarFill = document.createElement('div');
        this.hpBarFill.className = 'hp-hud-fill';
        this.hpBarElement.appendChild(this.hpBarFill);

        // 부스터 바 (머리 위) - 플레이어 캐릭터 전용
        if (this.isPlayer) {
            this.boosterBarElement = document.createElement('div');
            this.boosterBarElement.className = 'booster-hud';
            this.boosterBarFill = document.createElement('div');
            this.boosterBarFill.className = 'booster-hud-fill';
            this.boosterBarElement.appendChild(this.boosterBarFill);
            this.hpBarElement.appendChild(this.boosterBarElement);
        }

        const container = document.getElementById('hp-bars-container');
        if (container) container.appendChild(this.hpBarElement);

        this.hp = CONFIG.TANK.MAX_HP;
        this.maxHp = CONFIG.TANK.MAX_HP;

        // 부스터 상태 (사용자 요청에 따라 변수로 관리)
        this.boosterGauge = CONFIG.BOOSTER.MAX_GAUGE;
        this.isBoosting = false;

        const mainColor = isPlayer ? CONFIG.COLORS.SELF : CONFIG.COLORS.OTHER;

        // 1. 헐 그룹 (Lower & Upper)
        this.hullGroup = new THREE.Group();
        this.group.add(this.hullGroup);

        const hullParts = buildTankHull(this.hullGroup, mainColor, false);
        this.body = hullParts.body;
        this.treads = hullParts.treads;
        this.wheels = hullParts.wheels;

        // 3. 포탑 그룹 (Turret Group)
        this.turretGroup = new THREE.Group();
        this.turretGroup.position.y = 0.45;
        this.group.add(this.turretGroup);

        // 4. 포신 그룹 (Barrel Group)
        this.barrelGroup = new THREE.Group();
        this.barrelGroup.position.set(0, 0.15, -0.4);
        this.turretGroup.add(this.barrelGroup);

        this.muzzlePoint = new THREE.Object3D();
        const turretParts = buildTankTurret(this.turretGroup, this.barrelGroup, mainColor, false);
        this.turretMain = turretParts.turretMain;
        this.barrel = turretParts.barrel;

        // VFX용 포구 끝점 좌표 보정
        this.muzzlePoint.position.set(0, 0.7, 0);
        this.barrel.add(this.muzzlePoint);


        // 5. UI 및 표시기 (UI & Indicators)
        if (!isPlayer) {
            this.createOverlayUI();
        } else {
            // 플레이어 탱크 위치 표시용 화살표
            this.indicator = new THREE.Mesh(
                new THREE.ConeGeometry(0.15, 0.3, 3),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.6 })
            );
            this.indicator.rotation.x = -Math.PI / 2;
            this.indicator.position.set(0, 1.5, -1.5);
            this.group.add(this.indicator);
        }

        scene.add(this.group);

        // 엔진 오디오 초기화 (로컬 플레이어 전용)
        if (isPlayer) {
            this.engineAudio = new TankEngineAudio();
            this.engineAudio.start();
        }

        // --- 애니메이션 및 물리 상태 변수 ---
        this.recoil = 0;              // 포신 반동
        this.shake = 0;               // 피격 시 흔들림
        this.dustTimer = 0;           // 이동 시 먼지 효과 타이머
        this.damageSmokeTimer = 0;    // 데미지 연기 타이머
        this.exhaustTimer = 0;        // 배기 가스 타이머
        this.targetWorldAngle = this.group.rotation.y;
        this.lastFireTime = 0;        // 마지막 발사 시간
        this.trackTimer = 0;          // 무한궤도 자국 타이머
        this.lastTrackPos = null;     // 마지막 자국 위치

        // LOD (거리 기반 상세도 조절)
        this._lodDistance = 60;
        this._lastLodState = true;

        // 성능 최적화용 재사용 벡터 (GC 방지)
        this._tempPos = new THREE.Vector3();
        this._tempPivotPos = new THREE.Vector3();
        this._tempRight = new THREE.Vector3();
        this._tempDir = new THREE.Vector3();
        this._tempDirL = new THREE.Vector3();
        this._tempDirR = new THREE.Vector3();

        // 장갑 시각화용 그룹
        this.hullArmorGroup = new THREE.Group();
        this.group.add(this.hullArmorGroup);

        this.turretArmorGroup = new THREE.Group();
        this.turretGroup.add(this.turretArmorGroup);

        this.lastSeen = Date.now();
        this.isMoving = false;

        // 초기 체력바 업데이트
        this.updateHP(this.hp);
    }



    /**
     * 탱크 업그레이드 적용
     * @param {string} type - 업그레이드 타입 ('CANNON', 'SPEED', 'ARMOR')
     */
    applyUpgrade(type) {
        if (type === 'CANNON') this.levelCannon = Math.min(9, this.levelCannon + 1);
        if (type === 'SPEED') this.levelSpeed = Math.min(9, this.levelSpeed + 1);
        if (type === 'ARMOR') {
            this.levelArmor = Math.min(9, this.levelArmor + 1);
            // 최대 체력 증가 및 보너스 회복
            const prevMax = this.maxHp;
            this.maxHp = CONFIG.TANK.MAX_HP + (this.levelArmor * CONFIG.UPGRADE.ARMOR.HP_INC);
            this.heal(this.maxHp - prevMax); // 증가한 최대치만큼 현재 체력도 추가
        }

        this.updateStats();
        this.updateArmorVisual();
        this.updateUpgradeUI();
    }

    /**
     * 업그레이드 UI 갱신 (플레이어 전용)
     */
    updateUpgradeUI() {
        if (!this.isPlayer) return;

        const updateItem = (id, level) => {
            const el = document.getElementById(id);
            if (!el) return;

            const prevLevel = parseInt(el.dataset.level || "0");
            el.dataset.level = level;

            const levelText = el.querySelector('.level-text');
            if (levelText) levelText.innerText = level;

            // 게이지 표시 (dots) 업데이트
            const dots = el.querySelectorAll('.gauge-dot');
            dots.forEach((dot, index) => {
                if (index < level) dot.classList.add('active');
                else dot.classList.remove('active');
            });

            // 레벨업 애니메이션 효과
            if (level > prevLevel) {
                el.classList.remove('level-up');
                el.offsetWidth; // 리플로우 강제 수행
                el.classList.add('level-up');
                setTimeout(() => el.classList.remove('level-up'), 600);
            }
        };

        updateItem('up-cannon', this.levelCannon);
        updateItem('up-speed', this.levelSpeed);
        updateItem('up-armor', this.levelArmor);

        // 최대 체력이 변경되었을 수 있으므로 HP 바 갱신
        this.updateHP(this.hp);
    }

    /**
     * 업그레이드 레벨에 따른 스탯 계산
     */
    updateStats() {
        // 이동/회전 속도 보너스 적용
        this.moveSpeedBonus = this.levelSpeed * CONFIG.UPGRADE.SPEED.MOVE_INC;
        this.rotSpeedBonus = this.levelSpeed * CONFIG.UPGRADE.SPEED.ROT_INC;
    }

    /**
     * 업그레이드 레벨에 따른 시각적 모델링 갱신 (장갑판, 포신 등)
     */
    updateArmorVisual() {
        // --- 1. 주포(Cannon) 업그레이드 시각화 ---
        if (this.barrel) {
            const upCfg = CONFIG.UPGRADE.CANNON;
            const targetXY = 1.0 + (this.levelCannon * upCfg.SCALE_XY_INC);
            const targetZ = 1.0 + (this.levelCannon * upCfg.SCALE_Z_INC);

            // 포신 크기 조절
            this.barrel.scale.set(targetXY, targetZ, targetXY);

            // 포구 화염(Muzzle Flash) 배율 조정
            if (this.muzzlePoint) {
                const muzzleScale = 1.0 + (this.levelCannon * upCfg.MUZZLE_VFX_SCALE);
                this.muzzlePoint.scale.set(muzzleScale, muzzleScale, muzzleScale);
            }
        }

        // --- 2. 추가 장갑 패널 및 사이드 스커트 ---
        const clearGroup = (group) => {
            while (group && group.children.length > 0) {
                const child = group.children[0];
                group.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        };
        clearGroup(this.hullArmorGroup);
        clearGroup(this.turretArmorGroup);

        const armorColor = CONFIG.COLORS.ARMOR.PLATE;
        const metal = 0.7;
        const rough = 0.3;
        const upArmor = CONFIG.UPGRADE.ARMOR;

        // 레벨 기반 추가 장갑 단계별 렌더링
        // 1단계: 기본 사이드 스커트
        if (this.levelArmor >= upArmor.VISUAL_LEVELS[0]) {
            for (let side of [-0.72, 0.72]) {
                for (let z = -0.7; z <= 0.7; z += 0.35) {
                    const skirt = createVoxelBox(0.15, 0.5, 0.32, armorColor, metal, rough);
                    skirt.position.set(side, 0.3, z);
                    this.hullArmorGroup.add(skirt);
                }
                const frontGuard = createVoxelBox(0.4, 0.1, 0.3, armorColor, metal, rough);
                frontGuard.position.set(side * 0.4, 0.4, -0.9);
                this.hullArmorGroup.add(frontGuard);
            }
        }

        // 2단계: 수납함 추가
        if (this.levelArmor >= upArmor.VISUAL_LEVELS[1]) {
            for (let side of [-0.8, 0.8]) {
                const box = createVoxelBox(0.2, 0.25, 0.4, armorColor, metal, rough);
                box.position.set(side, 0.45, 0.1);
                this.hullArmorGroup.add(box);
            }
        }

        // 3단계: 반응장갑(ERA) 모듈
        if (this.levelArmor >= upArmor.VISUAL_LEVELS[2]) {
            for (let x of [-0.3, 0.3]) {
                const eraTurret = createVoxelBox(0.25, 0.25, 0.15, armorColor, metal, rough);
                eraTurret.position.set(x, 0.15, -0.4);
                this.turretArmorGroup.add(eraTurret);
            }
        }

        // 4단계: 돌출형 공간 장갑 및 슬랫 아머(Cage)
        if (this.levelArmor >= upArmor.VISUAL_LEVELS[3]) {
            for (let side of [-0.7, 0.7]) {
                const shield = createVoxelBox(0.12, 0.55, 1.0, armorColor, metal, rough);
                shield.position.set(side, 0.1, -0.1);
                shield.rotation.y = side > 0 ? -0.2 : 0.2;
                this.turretArmorGroup.add(shield);
            }
            // 슬랫 아머 바
            const barColor = CONFIG.COLORS.ARMOR.METAL_BAR;
            for (let x = -0.65; x <= 0.65; x += 0.1) {
                const bar = createVoxelBox(0.04, 0.45, 0.04, barColor);
                bar.position.set(x, 0.45, 1.0);
                this.hullArmorGroup.add(bar);
            }
        }

        // 5단계: 상부 보호 강화판
        if (this.levelArmor >= upArmor.VISUAL_LEVELS[4]) {
            const roof = createVoxelBox(0.8, 0.05, 0.8, armorColor, metal, rough);
            roof.position.set(0, 0.45, 0);
            this.turretArmorGroup.add(roof);
        }
    }

    /**
     * 탄포 사격 로직
     * @param {number} jitter - 추가 조준 오차 (봇용)
     * @returns {boolean} 사격 여부
     */
    shoot(jitter = 0) {
        // 정비소 반경 내에서는 사격 금지
        if (repairStation) {
            const dist = this.group.position.distanceTo(repairStation.group.position);
            if (dist < CONFIG.REPAIR_STATION.RADIUS + 2.0) return false;
        }

        const now = Date.now();
        const cooldown = (this.isBot ? (this.stats ? this.stats.fireCooldown : CONFIG.BOT.FIRE_COOLDOWN_RANGE[0]) : CONFIG.TANK.FIRE_COOLDOWN) + jitter;

        if (now - this.lastFireTime < cooldown) return false;
        this.lastFireTime = now;

        // 월드 좌표 기반 발사체 위치/방향 계산
        this.muzzlePoint.getWorldPosition(this._tempPos);
        this.barrelGroup.getWorldPosition(this._tempPivotPos);
        const dir = this._tempPos.clone().sub(this._tempPivotPos).normalize();

        // 업그레이드 레벨에 따른 데미지 및 크기 보너스
        const bulletScale = 1.0 + (Math.min(3, this.levelCannon) * CONFIG.UPGRADE.CANNON.SCALE_INC);
        const bulletDamage = CONFIG.TANK.DAMAGE + (this.levelCannon * CONFIG.UPGRADE.CANNON.DAMAGE_INC);

        const spawnBullet = (startPos, direction) => {
            bulletManager.add(startPos, direction, this.id, bulletDamage, bulletScale);
        };

        // 주포 업그레이드 단계별 사격 방식 분기
        if (this.levelCannon < 4) {
            // 단일 사격 (Single Shot)
            spawnBullet(this._tempPos, dir);
        } else if (this.levelCannon < 7) {
            // 더블 배럴 사격 (Double Shot)
            const quat = this.turretGroup.getWorldQuaternion(new THREE.Quaternion());
            this._tempRight.set(1, 0, 0).applyQuaternion(quat);
            const posL = this._tempPos.clone().add(this._tempRight.clone().multiplyScalar(-0.2));
            const posR = this._tempPos.clone().add(this._tempRight.clone().multiplyScalar(0.2));
            spawnBullet(posL, dir);
            spawnBullet(posR, dir);
        } else {
            // 산탄 사격 (Spread Shot - 3발)
            const quat = this.turretGroup.getWorldQuaternion(new THREE.Quaternion());
            this._tempRight.set(1, 0, 0).applyQuaternion(quat);
            spawnBullet(this._tempPos, dir);

            this._tempDirL.copy(dir).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.15);
            this._tempDirR.copy(dir).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.15);
            spawnBullet(this._tempPos, this._tempDirL);
            spawnBullet(this._tempPos, this._tempDirR);
        }

        // 사격 시각/청각 효과
        this.playShootEffect();
        if (window.AudioSFX) AudioSFX.playFire();

        // 반동 애니메이션 트리거
        this.recoil = 1.0;

        return true;
    }

    /**
     * 탱크 애니메이션 및 상태 기반 시각 효과 업데이트
     * @param {number} dt - 델타 타임
     * @param {boolean} isMoving - 이동 중인지 여부
     */
    updateAnims(dt, isMoving) {
        // LOD(Level of Detail) 처리: 카메라 거리에 따라 가시성 조절
        if (this.isPlayer) {
            this.group.visible = true;
        } else if (camera) {
            const dist = this.group.position.distanceTo(camera.position);
            const lodState = dist < this._lodDistance;
            if (lodState !== this._lastLodState) {
                this.group.visible = lodState;
                this._lastLodState = lodState;
            }
        }

        // 트랙마크(궤도 자국) 생성
        if (isMoving && trackMarkManager) {
            this.trackTimer += dt;
            if (this.trackTimer > 0.15) {
                this.trackTimer = 0;
                const pos = this.group.position;
                if (!this.lastTrackPos || pos.distanceTo(this.lastTrackPos) > 0.3) {
                    this.lastTrackPos = pos.clone();
                    trackMarkManager.add(pos.x, pos.z, this.group.rotation.y);
                }
            }
        }

        // 1. 사격 반동 복구 애니메이션
        if (this.recoil > 0) {
            this.recoil = Math.max(0, this.recoil - dt * 4.5);
            // 비선형 곡선을 적용하여 찰진 반동 체감 부여
            const curve = Math.pow(this.recoil, 1.5);
            this.barrelGroup.position.z = -0.4 + curve * 0.55; // 포신 후퇴
            this.hullGroup.position.z = curve * 0.15;          // 차체 밀림
            this.hullGroup.rotation.x = -curve * 0.08;         // 전면 들림
        } else {
            // 위치 복구 (Lerp)
            this.barrelGroup.position.z = THREE.MathUtils.lerp(this.barrelGroup.position.z, -0.4, 0.1);
            this.hullGroup.position.z = THREE.MathUtils.lerp(this.hullGroup.position.z, 0, 0.2);
            this.hullGroup.rotation.x = THREE.MathUtils.lerp(this.hullGroup.rotation.x, 0, 0.2);
        }

        // 2. 엔진 진동 효과 (Idling Wobble)
        if (!isMoving) {
            const wobble = Math.sin(Date.now() * 0.01) * 0.002;
            this.hullGroup.position.y += wobble;
        }

        // 바퀴 회전 애니메이션
        if (isMoving && this.wheels) {
            this.wheels.forEach(w => w.rotation.x += dt * 10);
        }

        // 이동 중 위아래 흔들림 (묵직한 무게감)
        this.shake += dt * (isMoving ? 20 : 10);
        const shakeAmp = isMoving ? 0.015 : 0.005;
        this.hullGroup.position.y = Math.sin(this.shake) * shakeAmp;

        // 3. 이동 중 배기 연기 (Exhaust Smoke)
        if (isMoving && vfx) {
            this.exhaustTimer += dt;
            if (this.exhaustTimer > 0.08) {
                this.exhaustTimer = 0;

                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
                const exhaustColors = CONFIG.COLORS.VFX;

                for (let xOff of [-0.48, 0.48]) {
                    const exhaustPos = new THREE.Vector3(xOff, 0.65, 1.23).applyMatrix4(this.group.matrixWorld);
                    // 기본 배기 연기 (길이 단축: 1500 -> 800)
                    vfx.spawnExhaust(exhaustPos, exhaustColors.EXHAUST, 1, 0.3, 0.3, 800);

                    // 랜덤하게 발생하는 짙은 그을음 (길이 단축: 800 -> 400)
                    if (Math.random() < 0.4) {
                        vfx.spawnExhaust(exhaustPos, exhaustColors.EXHAUST_DARK, 1, 0.4, 0.25, 400);
                    }
                }
            }
        }

        // 4. 데미지 상태에 따른 연기 및 화염 효과
        const hpPercent = this.hp / this.maxHp;
        if (hpPercent <= 0.5 && vfx) {
            if (!this.damageSmokeTimer) this.damageSmokeTimer = 0;

            let interval = 0.3;
            let smokeCount = 1;
            let smokeSize = 0.35;
            let smokeLife = 2000;
            let fireCount = 0;

            // 체력 구간별 효과 강도 조절
            if (hpPercent <= 0.15) {
                interval = 0.02; smokeCount = 5; smokeSize = 0.8; smokeLife = 4000; fireCount = 6;
            } else if (hpPercent <= 0.25) {
                interval = 0.06; smokeCount = 3; smokeSize = 0.6; smokeLife = 3000; fireCount = 4;
            } else if (hpPercent <= 0.35) {
                interval = 0.12; smokeCount = 2; smokeSize = 0.5; smokeLife = 2500; fireCount = 3;
            } else if (hpPercent <= 0.45) {
                interval = 0.2; smokeCount = 1; smokeSize = 0.4; smokeLife = 2000; fireCount = 2;
            }

            this.damageSmokeTimer += dt;
            if (this.damageSmokeTimer > interval) {
                this.damageSmokeTimer = 0;
                const vfxColors = CONFIG.COLORS.VFX;

                for (let i = 0; i < smokeCount; i++) {
                    const smokePos = new THREE.Vector3(
                        (Math.random() - 0.5) * 1.2,
                        0.5 + Math.random() * 0.6,
                        (Math.random() - 0.5) * 1.2
                    );
                    smokePos.applyMatrix4(this.group.matrixWorld);

                    // 검은 연기 스폰
                    vfx.spawnSmoke(smokePos, vfxColors.SMOKE, 1, 0.2, smokeSize, smokeLife);

                    if (hpPercent <= 0.25) {
                        vfx.spawnSmoke(smokePos, vfxColors.SMOKE_DARK, 1, 0.25, smokeSize * 0.8, smokeLife * 0.8);
                    }
                }

                // 화염 효과 (체력이 매우 낮을 때)
                if (fireCount > 0) {
                    for (let i = 0; i < fireCount; i++) {
                        const firePos = new THREE.Vector3(
                            (Math.random() - 0.5) * 1.0,
                            0.3 + Math.random() * 0.5,
                            (Math.random() - 0.5) * 1.0
                        );
                        firePos.applyMatrix4(this.group.matrixWorld);
                        vfx.spawnFire(firePos, 3, 2.0, 0.25, 600);
                    }
                }
            }
        }
    }

    /**
     * 사격 시각 효과 실행
     */
    playShootEffect() {
        this.recoil = 1.0;
        const vfxColors = CONFIG.COLORS.VFX;

        if (this.isPlayer) {
            cameraShakeTime = 0.5;
            if (window.AudioSFX) AudioSFX.playFire();
        }

        if (vfx) {
            const worldPos = new THREE.Vector3();
            this.muzzlePoint.getWorldPosition(worldPos);
            const pivotPos = new THREE.Vector3();
            this.barrelGroup.getWorldPosition(pivotPos);
            const worldDir = worldPos.clone().sub(pivotPos).normalize();

            // 포구 화염 및 스파크
            vfx.spawnMuzzleFlash(worldPos, worldDir, vfxColors.MUZZLE_FLASH);
            vfx.spawn(worldPos, vfxColors.FIRE, 8, 3, 0.15, 400);
            vfx.spawn(worldPos, vfxColors.SMOKE_DARK, 6, 1.5, 0.12, 600);

            // 탄피 배출 효과
            const casingPos = new THREE.Vector3();
            this.group.getWorldPosition(casingPos);
            casingPos.x += 0.3;
            casingPos.y += 0.4;
            vfx.spawnExhaust(casingPos, vfxColors.CASING, 1, 1.5, 0.05, 300);
        }

        if (this.isPlayer && camera) {
            cameraShakeTime = 0.3;
        }
    }

    createOverlayUI() {
        // HUD overlay handling
    }

    /**
     * 체력 갱신 및 UI 연동
     * @param {number} hp - 설정할 체력 값
     */
    updateHP(hp) {
        // 유효성 체크
        const validHp = typeof hp === 'number' && !isNaN(hp) ? hp : (this.hp || 0);
        this.hp = Math.max(0, Math.min(this.maxHp, validHp));

        const hpCfg = CONFIG.UI.HP_BAR;
        const pct = Math.max(0, (this.hp / this.maxHp) * 100);

        // --- HUD HP 바 업데이트 (HTML 오버레이) ---
        if (this.hpBarFill) {
            this.hpBarFill.style.width = `${pct}%`;

            // 체력 비율에 따른 색상 및 발광 효과 변경
            if (pct < 30) {
                this.hpBarFill.style.background = `linear-gradient(90deg, ${hpCfg.COLORS.CRITICAL}, #b30000)`;
                this.hpBarFill.style.boxShadow = `0 0 6px ${hpCfg.COLORS.CRITICAL}99`;
            } else if (pct < 60) {
                this.hpBarFill.style.background = `linear-gradient(90deg, ${hpCfg.COLORS.WARNING}, #d4ac0d)`;
                this.hpBarFill.style.boxShadow = `0 0 6px ${hpCfg.COLORS.WARNING}66`;
            } else {
                this.hpBarFill.style.background = `linear-gradient(90deg, ${hpCfg.COLORS.HEALTHY}, #27ae60)`;
                this.hpBarFill.style.boxShadow = `0 0 6px ${hpCfg.COLORS.HEALTHY}66`;
            }
        }

        // 플레이어 상태창 UI 업데이트 (상단 HUD 제거로 인한 비활성화)
    }

    /**
     * 체력 회복
     * @param {number} amount - 회복량
     */
    heal(amount) {
        if (this.hp <= 0) return;
        this.updateHP(this.hp + amount);

        // 회복 시각/청각 효과
        if (vfx) vfx.spawnHeal(this.group.position);
        if (window.AudioSFX) AudioSFX.playHeal();

        // 부유 텍스트 피드백
        spawnFloatingText(this.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), `+${Math.round(amount)}`);
    }

    /**
     * 데미지 처리 및 처치 로직
     * @param {number} damage - 입은 데미지
     * @param {string} shooterId - 쏜 개체의 ID
     */
    handleHit(damage, shooterId) {
        if (this.hp <= 0) return; // 이미 사망 상태면 무시

        this.updateHP(this.hp - damage);

        // 플레이어 사망 시 처리
        if (this.isPlayer && this.hp <= 0) {
            // 사망 연출을 위해 잠시 대기 후 게임 오버 표시
            setTimeout(() => {
                if (window.WCGames) WCGames.gameOver(this.kills);
            }, 3000);
        }

        // 탱크 파괴 처리
        if (this.hp <= 0) {
            this.isDead = true;
            if (window.AudioSFX) window.AudioSFX.playExplosion();
            if (vfx) vfx.spawnExplosion(this.group.position);

            // 처치자 정보 업데이트 및 보상 지급
            const allTanks = [myTank, ...bots];
            const killer = allTanks.find(t => t && t.id === shooterId);
            if (killer) {
                killer.kills++;
                updateScoreboard();

                // 처치 보상 지급 (Kill Reward)
                grantKillReward(killer);

                if (killer.isPlayer && window.WCGames && window.WCGames.submitScore) {
                    window.WCGames.submitScore(killer.kills);
                }
            }
        }
    }

    /**
     * 탱크 객체 제거 및 리소스 정리
     */
    destroy() {
        // HUD 엘리먼트 제거
        if (this.hpBarElement && this.hpBarElement.parentNode) {
            this.hpBarElement.parentNode.removeChild(this.hpBarElement);
        }

        // Scene에서 그룹 제거
        if (this.group.parent) {
            this.group.parent.remove(this.group);
        }
    }

    /**
     * HUD 체력바 위치 갱신 (3D -> 2D 투영)
     * @param {THREE.Camera} camera - 렌더링 카메라
     */
    updateHUD(camera) {
        if (!this.hpBarElement || !this.group) return;

        // 3D 위치를 NDC(Normalized Device Coordinates)로 투영
        // [수정] 포탑(Turret)이 아닌 탱크 본체(Group) 위치를 기준으로 하여 시각적 안정성 확보 (포탑 회전 영향 제거)
        const refObject = this.group;
        // 1. 탱크 본체의 월드 위치 및 회전 가져오기
        refObject.getWorldPosition(_v3_temp); // Pivot 위치 (월드)
        refObject.getWorldQuaternion(_q_temp); // 전체 회전 (월드)

        // [사용자 요청] 카메라 각도에 따른 실시간 위치 계산 (카메라 기준 상대 좌표 적용)
        const offset3D = (CONFIG.UI.HP_BAR && CONFIG.UI.HP_BAR.OFFSET_3D) || { X: 0, Y: 1.8, Z: 0 };
        // 카메라의 월드 행렬에서 우측(Right), 상단(Up), 후방(Back) 벡터를 가져옵니다.
        const cMat = camera.matrixWorld.elements;
        _v3_temp2.set(cMat[0], cMat[1], cMat[2]); // Camera Right
        _v3_temp3.set(cMat[4], cMat[5], cMat[6]); // Camera Up
        _v3_temp4.set(cMat[8], cMat[9], cMat[10]); // Camera Back (Forward의 반대)

        // 오프셋 적용: X(화면 좌우), Y(화면 상하), Z(화면 앞뒤)
        _v3_temp.addScaledVector(_v3_temp2, (offset3D.X || 0));
        _v3_temp.addScaledVector(_v3_temp3, (offset3D.Y || 0));
        _v3_temp.addScaledVector(_v3_temp4, -(offset3D.Z || 0)); // 음수가 카메라 앞쪽(화면 안쪽)

        // 4. 화면 투영
        _v3_temp.project(camera);

        // 화면 밖이거나 카메라 뒤에 있는지 체크
        const isVisible = _v3_temp.z <= 1 && Math.abs(_v3_temp.x) < 1.1 && Math.abs(_v3_temp.y) < 1.1;

        if (!isVisible || this.hp <= 0 || this.isDead) {
            this.hpBarElement.style.display = 'none';
        } else {
            this.hpBarElement.style.display = 'block';

            // 화면 픽셀 좌표로 변환
            const x = (_v3_temp.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-_v3_temp.y * 0.5 + 0.5) * window.innerHeight;

            // [수정] 거리에 따른 스케일링 기능 제거 요청 반영
            // 중앙 정렬(-50%)만 유지하여 탱크 머리 위에 정확히 위치시킴
            const offsetPixels = (CONFIG.UI.HP_BAR && CONFIG.UI.HP_BAR.OFFSET_Y_PX) || 0;
            this.hpBarElement.style.transform = `translate(-50%, -50%)`;
            this.hpBarElement.style.left = `${x}px`;
            this.hpBarElement.style.top = `${y - offsetPixels}px`;
            this.hpBarElement.style.opacity = 1;

            // 기력(Booster) 바 업데이트
            if (this.boosterBarFill && CONFIG.BOOSTER) {
                const boosterRatio = (this.boosterGauge || 0) / CONFIG.BOOSTER.MAX_GAUGE;
                this.boosterBarFill.style.width = `${boosterRatio * 100}%`;

                // 기력 부족 시 색상 강조
                const boosterCfg = CONFIG.UI.BOOSTER;
                if ((this.boosterGauge || 0) < 20) {
                    this.boosterBarFill.style.background = boosterCfg.LOW;
                } else {
                    this.boosterBarFill.style.background = boosterCfg.NORMAL;
                }
            }
        }
    }
}

/* 봇 클래스 - AI 제어 탱크 (Tank 클래스 상속) */
class Bot extends Tank {
    /**
     * 봇 생성자
     * @param {string} id - 봇 고유 ID
     * @param {string} name - 봇 이름
     * @param {number} color - 탱크 색상 (지정하지 않으면 CONFIG에서 랜덤 선택)
     */
    constructor(id, name, color = null) {
        super(id, name, false);
        this.isBot = true;
        this.isMoving = false; // 시각 효과(애니메이션) 구동을 위한 이동 상태 추적

        // 개별 지능 및 성능(Stats) 할당 (CONFIG 범위 내에서 랜덤화)
        const getRand = (range) => range[0] + Math.random() * (range[1] - range[0]);
        this.stats = {
            forwardSpeed: getRand(CONFIG.BOT.FORWARD_SPEED_RANGE),
            backwardSpeed: getRand(CONFIG.BOT.BACKWARD_SPEED_RANGE),
            rotateSpeed: getRand(CONFIG.BOT.ROTATE_SPEED_RANGE),
            fireCooldown: getRand(CONFIG.BOT.FIRE_COOLDOWN_RANGE),
            detectionRange: getRand(CONFIG.BOT.DETECTION_RANGE_RANGE),
            attackRange: getRand(CONFIG.BOT.ATTACK_RANGE_RANGE),
            aimJitterMax: getRand(CONFIG.BOT.AIM_JITTER_RANGE),
            firingThreshold: getRand(CONFIG.BOT.FIRING_THRESHOLD_RANGE),
            jitterUpdateInterval: getRand(CONFIG.BOT.JITTER_UPDATE_INTERVAL_RANGE)
        };

        this.lastFireTime = 0;
        this.target = null;
        this.state = 'WANDER'; // 기본 상태: 배회
        this.stateTimer = 0;
        this.strafeTimer = 0;
        this.aimJitter = (Math.random() - 0.5) * this.stats.aimJitterMax;
        this.aimJitterTimer = 0;
        this.blockedTimer = 0;
        this.strafeDir = Math.random() < 0.5 ? 1 : -1;

        // 봇 색상 결정 (CONFIG.BOT.COLORS 참조)
        this.color = color || (CONFIG.BOT && CONFIG.BOT.COLORS ? CONFIG.BOT.COLORS[Math.floor(Math.random() * CONFIG.BOT.COLORS.length)] : CONFIG.COLORS.BOT);

        // AI 연산을 위한 재사용 벡터 객체들 (Garbage Collection 방지)
        this._aiTargetVec = new THREE.Vector3();
        this._aiForward = new THREE.Vector3();
        this._aiDir = new THREE.Vector3();
        this._aiFirePos = new THREE.Vector3();
        this._aiWanderTarget = new THREE.Vector3();
        this._aiWanderForward = new THREE.Vector3();

        // 모델 색상 적용
        if (this.body && this.body.material) {
            this.body.material.color.set(this.color);
        }
        if (this.turret && this.turret.material) {
            this.turret.material.color.set(this.color);
        }
    }

    /**
     * AI 행동 업데이트
     * @param {number} dt - 델타 타임
     */
    updateAI(dt) {
        this.isMoving = false; // 기본 이동 상태 초기화
        if (this.hp <= 0) return;

        // 1. 타겟 탐색 (탐지 범위 내 가장 가까운 플레이어 또는 다른 봇)
        let nearestDist = this.stats.detectionRange;
        let potentialTarget = null;

        const possibleTargets = [];
        if (myTank && myTank.hp > 0) possibleTargets.push(myTank);
        // 중복 제거 및 유효 봇 확인
        bots.forEach(b => {
            if (b !== this && b.hp > 0) possibleTargets.push(b);
        });

        // 가장 가까운 적 탐색
        for (const target of possibleTargets) {
            const d = this.group.position.distanceTo(target.group.position);
            if (d < nearestDist) {
                nearestDist = d;
                potentialTarget = target;
            }
        }

        this.target = potentialTarget;

        // 상태 결정
        if (this.target) {
            this.state = 'ATTACK';
        } else {
            this.state = 'WANDER';
        }

        // 2. 상태 실행
        if (this.state === 'ATTACK') {
            const targetPos = this.target.group.position;
            const dx = targetPos.x - this.group.position.x;
            const dz = targetPos.z - this.group.position.z;
            const dist = this.group.position.distanceTo(targetPos);

            // 1. 차체 타겟 각도 계산 (스트레이핑 및 거리 제어)
            this.strafeTimer -= dt;
            if (this.strafeTimer <= 0) {
                this.strafeTimer = 1 + Math.random() * 2;
                this.strafeDir = Math.random() < 0.5 ? 1 : -1;
            }

            // 거리 제어: 거리에 따라 타겟 쪽으로 조향하거나 멀어짐
            let offset = (Math.PI / 2) * this.strafeDir;
            let moveDir = 1; // 기본값은 전진

            if (dist > 30) {
                offset *= 0.3; // 타겟을 더 많이 향하도록 설정
            } else if (dist < 15) {
                // 너무 가까우면 스트레이핑하며 거리 유지 시도
                offset *= 1.2;
                if (dist < 10) moveDir = -0.5; // 아주 가까우면 천천히 후진
            }

            const angleToTarget = Math.atan2(-dx, -dz);
            const hullTargetAngle = angleToTarget + offset;

            // 차체 회전 (개별 속도 사용)
            let hullRotDiff = hullTargetAngle - this.group.rotation.y;
            while (hullRotDiff < -Math.PI) hullRotDiff += Math.PI * 2;
            while (hullRotDiff > Math.PI) hullRotDiff -= Math.PI * 2;
            const hullStep = this.stats.rotateSpeed * dt;
            this.group.rotation.y += Math.max(-hullStep, Math.min(hullStep, hullRotDiff));

            // 2. 포탑 독립 회전 (타겟 조준)
            this.aimJitterTimer += dt;
            if (this.aimJitterTimer > this.stats.jitterUpdateInterval) {
                this.aimJitterTimer = 0;
                this.aimJitter = (Math.random() - 0.5) * this.stats.aimJitterMax;
            }
            const turretDesiredGlobalAngle = angleToTarget + this.aimJitter;
            const turretLocalTargetAngle = turretDesiredGlobalAngle - this.group.rotation.y;
            let turretRotDiff = turretLocalTargetAngle - this.turretGroup.rotation.y;
            while (turretRotDiff < -Math.PI) turretRotDiff += Math.PI * 2;
            while (turretRotDiff > Math.PI) turretRotDiff -= Math.PI * 2;
            const turretStep = CONFIG.TANK.TURRET_ROTATE_SPEED * dt;
            this.turretGroup.rotation.y += Math.max(-turretStep, Math.min(turretStep, turretRotDiff));

            // 3. 개선된 벽 처리 이동 (봇을 위한 곡선 조향)
            const botAlignment = Math.max(0, Math.cos(hullRotDiff));
            const botSpeedScale = Math.pow(botAlignment, 0.4);

            if (botSpeedScale > 0.05 || moveDir < 0) {
                this._aiTargetVec.set(-Math.sin(hullTargetAngle), 0, -Math.cos(hullTargetAngle));
                this._aiForward.set(-Math.sin(this.group.rotation.y), 0, -Math.cos(this.group.rotation.y));
                const blendedDir = this._aiForward.clone().multiplyScalar(0.8).add(this._aiTargetVec.multiplyScalar(0.2)).normalize();

                const effectiveDir = moveDir > 0 ? moveDir * botSpeedScale : moveDir;
                if (!this.move(effectiveDir, dt, blendedDir)) {
                    this.group.rotation.y += (this.strafeDir * 2.0) * dt;
                    this.move(-0.5, dt);
                    this.isMoving = true; // 여전히 이동 중 (후진)
                } else {
                    this.isMoving = true;
                }
            }

            // 4. 공격 확인
            const currentWorldAngle = this.turretGroup.rotation.y + this.group.rotation.y;
            const angleDiff = Math.abs(normalizeAngle(currentWorldAngle - angleToTarget));

            if (dist < this.stats.attackRange && angleDiff < this.stats.firingThreshold) {
                // shoot()은 내부적으로 쿨타임을 처리함 (ms 단위)
                this.shoot();
            }
        } else {
            // 배회(WANDER) 상태
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.stateTimer = 2 + Math.random() * 3;
                this._aiWanderTarget.set((Math.random() - 0.5) * 160, 0, (Math.random() - 0.5) * 160);
            }

            const dx = this._aiWanderTarget.x - this.group.position.x;
            const dz = this._aiWanderTarget.z - this.group.position.z;
            const angleToTarget = Math.atan2(-dx, -dz);

            let rotDiff = angleToTarget - this.group.rotation.y;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            const step = this.stats.rotateSpeed * 0.5 * dt;
            this.group.rotation.y += Math.max(-step, Math.min(step, rotDiff));

            this.turretGroup.rotation.y *= 0.95; // 포탑을 정면으로 초기화

            const alignment = Math.max(0, Math.cos(rotDiff));
            if (alignment > 0.8) {
                this._aiWanderForward.set(-Math.sin(this.group.rotation.y), 0, -Math.cos(this.group.rotation.y));
                if (!this.move(0.6, dt, this._aiWanderForward)) {
                    this.stateTimer = 0; // 막히면 새로운 타겟 선택
                } else {
                    this.isMoving = true;
                }
            }
        }

        // 봇이 맵 경계 내에 머무르도록 보장
        const halfSize = (CONFIG.WORLD.SIZE / 2) - 5;
        this.group.position.x = Math.max(-halfSize, Math.min(halfSize, this.group.position.x));
        this.group.position.z = Math.max(-halfSize, Math.min(halfSize, this.group.position.z));

        // 선제적 벽 충돌 방지 (전방 확인)
        this._aiForward.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y);
        const probeDist = 3.5;
        const probePos = this.group.position.clone().add(this._aiForward.clone().multiplyScalar(probeDist));

        if (!isPositionSafe(probePos.x, probePos.z)) {
            this.blockedTimer += dt;
            this.group.rotation.y += this.strafeDir * dt * (3.0 + (this.rotSpeedBonus || 0));

            if (this.blockedTimer > 0.5) {
                this.move(-0.6, dt);
                this.isMoving = true;
            }
        } else {
            this.blockedTimer = Math.max(0, this.blockedTimer - dt);
        }
    }

    /**
     * 봇 이동 처리 (충돌 검사 포함)
     * @param {number} dir - 이동 방향 (1: 전진, -1: 후진)
     * @param {number} dt - 델타 타임
     * @param {THREE.Vector3} [customDir] - 커스텀 이동 방향 벡터
     * @returns {boolean} 이동 성공 여부
     */
    move(dir, dt, customDir = null) {
        // 부스터 장착 여부 및 게이지 확인
        const boosterMult = (this.isBoosting && this.boosterGauge > 0) ? CONFIG.BOOSTER.SPEED_MULTIPLIER : 1.0;

        // 보너스 포함 최종 속성 계산
        const moveSpeed = ((dir >= 0 ? this.stats.forwardSpeed : this.stats.backwardSpeed) + (this.moveSpeedBonus || 0)) * boosterMult;
        const speed = moveSpeed * dir;
        const moveVec = customDir ? customDir.clone() : new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y);
        const nextPos = this.group.position.clone().add(moveVec.multiplyScalar(speed * dt));

        // 지형 안전성(벽 충돌) 확인
        if (isPositionSafe(nextPos.x, nextPos.z)) {
            this.group.position.copy(nextPos);
            return true;
        }
        return false;
    }

    /**
     * 봇 피격 처리
     * @param {number} damage - 입은 데미지
     * @param {string} shooterId - 공격자 ID
     */
    handleHit(damage, shooterId) {
        if (this.hp <= 0) return;
        super.updateHP(this.hp - damage);

        // 피격 시 반응 (스트레이핑 방향 전환 및 조준 흔들림 유도)
        if (this.hp > 0) {
            this.strafeDir *= -1;
            this.strafeTimer = 1 + Math.random();
            if (this.isPlayer && camera) cameraShakeTime = 0.2; // 플레이어를 쐈을 때의 진동
        }

        // 사망 처리
        if (this.hp <= 0) {
            this.isDead = true;
            if (vfx) vfx.spawnExplosion(this.group.position);

            // 처치 보너스 및 점수 갱신
            const allTanks = [myTank, ...bots];
            const killer = allTanks.find(t => t && t.id === shooterId);
            if (killer) {
                killer.kills++;
                updateScoreboard();

                // 킬 보상 (아이템 드랍 등 가능성)
                grantKillReward(killer);

                if (killer.isPlayer && window.WCGames && window.WCGames.submitScore) {
                    window.WCGames.submitScore(killer.kills);
                }
            }
            if (window.AudioSFX) AudioSFX.playExplosion();

            // 리소스 정리
            this.destroy();

            // 매니저 배열에서 제거
            const idx = bots.indexOf(this);
            if (idx !== -1) bots.splice(idx, 1);

            // 지정된 시간 후 봇 리스폰 (CONFIG 설정에 따름)
            if (CONFIG.BOT.COUNT > 0) {
                setTimeout(() => {
                    // 게임이 아직 실행 중일 때만 리스폰
                    if (typeof spawnBots === 'function') spawnBots(1);
                }, 5000);
            }
        }
    }
}

/* 5. 입력 처리 (키보드, 마우스, 모바일 조이스틱) */

// 키보드 입력 상태 트래킹
const keys = {};
const keyDownHandler = e => {
    keys[e.code] = true;
    keys[e.key.toLowerCase()] = true;
};
const keyUpHandler = e => {
    keys[e.code] = false;
    keys[e.key.toLowerCase()] = false;
};
window.addEventListener('keydown', keyDownHandler);
window.addEventListener('keyup', keyUpHandler);

// 마우스 버튼 상태 트래킹
const mouseButtons = { left: false, right: false };
const mouseDownHandler = e => {
    if (e.button === 0) mouseButtons.left = true;
    if (e.button === 2) mouseButtons.right = true;
};
const mouseUpHandler = e => {
    if (e.button === 0) mouseButtons.left = false;
    if (e.button === 2) mouseButtons.right = false;
};
window.addEventListener('mousedown', mouseDownHandler);
window.addEventListener('mouseup', mouseUpHandler);

// 모바일 조이스틱 입력 상태 (-1 ~ 1 범위)
const joystickLeft = { x: 0, y: 0 }; // 좌측: 이동/회전 용
const joystickRight = { x: 0, y: 0 }; // 우측: 포탑 조준/사격 용

// 모바일 부스터 입력 상태 (멀티터치 지원)
window.isMobileBoosting = false;

// 마우스 위치 트래킹 (WCGames 코어 입력 데이터 연동)
const mouseMoveHandler = e => {
    if (window.WCGames.input && window.WCGames.input.mouse) {
        window.WCGames.input.mouse.x = e.clientX;
        window.WCGames.input.mouse.y = e.clientY;
    }
};

if (!window.WCGames.input) {
    window.WCGames.input = { mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 } };
    window.addEventListener('mousemove', mouseMoveHandler);
}

/**
 * 게임 종료/재시작 시 입력 리스너 정리
 */
function cleanupInputListeners() {
    window.removeEventListener('keydown', keyDownHandler);
    window.removeEventListener('keyup', keyUpHandler);
    window.removeEventListener('mousedown', mouseDownHandler);
    window.removeEventListener('mouseup', mouseUpHandler);
    window.removeEventListener('mousemove', mouseMoveHandler);
}

/**
 * 모바일 조이스틱 UI 설정
 */
function setupJoysticks() {
    const el = document.getElementById('joystick-left');
    if (!el) return;

    /**
     * 개별 조이스틱 설정 함수
     * @param {string} id - HTML 요소 ID
     * @param {Object} target - 입력 값을 저장할 객체 (x, y)
     */
    const setup = (id, target) => {
        const el = document.getElementById(id);
        if (!el) return;

        let active = false;
        let startPos = { x: 0, y: 0 };
        let touchId = null;
        const knob = el.querySelector('.joystick-knob');
        const radius = CONFIG.UI.JOYSTICK_RADIUS || 40; // 조이스틱 가동 반경

        const handleMove = (e) => {
            if (!active) return;
            let touch = null;
            if (e.touches) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === touchId) {
                        touch = e.changedTouches[i];
                        break;
                    }
                }
            } else {
                touch = e;
            }
            if (!touch) return;

            const dx = touch.clientX - startPos.x;
            const dy = touch.clientY - startPos.y;
            const dist = Math.min(radius, Math.sqrt(dx * dx + dy * dy));
            const angle = Math.atan2(dy, dx);

            const moveX = Math.cos(angle) * dist;
            const moveY = Math.sin(angle) * dist;
            knob.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;

            // -1.0 ~ 1.0 범위로 정규화하여 타겟에 저장
            target.x = moveX / radius;
            target.y = moveY / radius;

            if (e.cancelable) e.preventDefault();
        };

        const handleStart = (e) => {
            if (active) return;
            const touch = e.touches ? e.changedTouches[0] : e;

            // 화면 오른쪽 절반은 부스터/사격 영역이므로 좌측 조이스틱 시작 위치 제한
            if (id === 'joystick-left' && touch.clientX > window.innerWidth / 2) return;
            // 부스터 버튼 위에서 시작하는 경우 무시
            if (e.target.closest('#booster-btn')) return;

            if (e.touches) touchId = touch.identifier;

            active = true;
            startPos = { x: touch.clientX, y: touch.clientY };
            handleMove(e);
            if (e.cancelable) e.preventDefault();
        };

        const handleEnd = (e) => {
            if (!active) return;
            if (e.touches) {
                let found = false;
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === touchId) {
                        found = true;
                        break;
                    }
                }
                if (found) return; // 해당 터치가 아직 종료되지 않음
            }

            active = false;
            touchId = null;
            knob.style.transform = `translate(-50%, -50%)`;
            target.x = 0;
            target.y = 0;
        };

        // 이벤트 리스너 등록
        window.addEventListener('touchstart', handleStart, { passive: false });
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
        window.addEventListener('touchcancel', handleEnd);

        window.addEventListener('mousedown', handleStart);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
    };

    setup('joystick-left', joystickLeft);
    // joystick-right는 현재 자동 조준 시스템 사용으로 인해 비활성화 상태

    // --- 부스터 버튼 멀티터치 설정 ---
    const boosterBtn = document.getElementById('booster-btn');
    if (boosterBtn) {
        const handleBoosterStart = (e) => {
            window.isMobileBoosting = true;
            boosterBtn.classList.add('active');
            if (e.cancelable) e.preventDefault();
        };

        const handleBoosterEnd = (e) => {
            // 멀티터치 상황이므로 현재 터치가 부스터 버튼 영역을 벗어났는지 여부를 더 정밀하게 체크할 수도 있지만,
            // 버튼 자체에 리스너를 걸었으므로 touchend가 발생하면 해당 버튼 입력 종료로 간주
            window.isMobileBoosting = false;
            boosterBtn.classList.remove('active');
            if (e.cancelable) e.preventDefault();
        };

        // 터치 이벤트 (멀티터치 지원)
        boosterBtn.addEventListener('touchstart', handleBoosterStart, { passive: false });
        boosterBtn.addEventListener('touchend', handleBoosterEnd, { passive: false });
        boosterBtn.addEventListener('touchcancel', handleBoosterEnd, { passive: false });

        // 데스크톱 테스트용 마우스 이벤트
        boosterBtn.addEventListener('mousedown', handleBoosterStart);
        boosterBtn.addEventListener('mouseup', handleBoosterEnd);
        boosterBtn.addEventListener('mouseleave', handleBoosterEnd); // 버튼 영역 밖으로 마우스가 나갔을 때 처리
    }
}

/**
 * 봇 스폰 함수 - 설정된 개수만큼 봇 생성
 * @param {number} count - 생성할 봇 수
 */
function spawnBots(count) {
    if (bots.length >= CONFIG.BOT.COUNT) return;

    const actualToSpawn = Math.min(count, CONFIG.BOT.COUNT - bots.length);
    for (let i = 0; i < actualToSpawn; i++) {
        const spawn = getRandomSpawnPoint();
        const botId = `bot_${Math.random().toString(36).substring(2, 7)}`;
        const botNum = Math.floor(10000 + Math.random() * 89999);
        const botName = `${CONFIG.BOT.NAME_PREFIX}${botNum}`;

        // Bot 클래스 인스턴스 생성
        const bot = new Bot(botId, botName);
        bot.group.position.set(spawn.x, 0, spawn.z);
        bots.push(bot);
    }
}

/* 6. 게임 로직 (업데이트, 충돌) */
let lastScoreUpdate = 0;

/**
 * 스코어보드 업데이트 - 킬 수 표시 (DOM 업데이트 제한: 200ms)
 */
function updateScoreboard() {
    const now = Date.now();
    if (now - lastScoreUpdate < 200) return; // Performance: Throttle DOM updates
    lastScoreUpdate = now;

    const scoreboard = document.getElementById('scoreboard');
    if (!scoreboard) return;

    const allPlayers = [];
    if (myTank) allPlayers.push(myTank);
    bots.forEach(b => allPlayers.push(b));

    // 유저는 항상 보여주고, AI 봇은 킬수가 0인 경우 제외
    const displayedPlayers = allPlayers.filter(p => p.isPlayer || !p.isBot || p.kills > 0);

    displayedPlayers.sort((a, b) => b.kills - a.kills);

    scoreboard.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">
            Kills
        </div>
        ${displayedPlayers.map(p => `
            <div class="scoreboard-item" style="color: ${p.isPlayer ? '#4d79ff' : (p.isBot ? '#e0e0e0' : '#ff4d4d')}">
                <span>${p.name || p.id}${p.isPlayer ? ' (ME)' : ''}</span>
                <span style="font-size: 0.8em; opacity: 0.6; margin-left:10px;">${p.kills}</span>
            </div>
        `).join('')}
    `;
}

/**
 * 발사 함수 - 내 탱크의 총알 발사
 */
function fire() {
    if (!myTank || myTank.hp <= 0) return;
    myTank.shoot();
}

/**
 * 미니맵 렌더링 - 2D Canvas를 이용해 탱크 및 아이템 위치 표시
 */
function renderMinimap() {
    if (!minimapCanvas || !minimapCtx) return;
    const size = CONFIG.UI.MINIMAP_SIZE || 100;
    const mapScale = size / (CONFIG.WORLD.SIZE * 2);
    const mapCenter = size / 2;

    // 미니맵 배경 클리어 및 베이스 드로잉
    minimapCtx.clearRect(0, 0, size, size);
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    minimapCtx.fillRect(0, 0, size, size);

    // 1. 수리 정비소 표시 (초록색 원)
    if (repairStation) {
        const rsX = mapCenter + repairStation.group.position.x * mapScale;
        const rsZ = mapCenter + repairStation.group.position.z * mapScale;
        minimapCtx.fillStyle = '#00ff00';
        minimapCtx.beginPath();
        minimapCtx.arc(rsX, rsZ, 3, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    // 2. 적 봇 표시 (주황색 원)
    bots.forEach(bot => {
        if (bot.hp <= 0) return;
        const bx = mapCenter + bot.group.position.x * mapScale;
        const bz = mapCenter + bot.group.position.z * mapScale;
        minimapCtx.fillStyle = '#ff6600';
        minimapCtx.beginPath();
        minimapCtx.arc(bx, bz, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    // 3. 파워업/아이템 표시 (민트색 원)
    powerups.forEach(p => {
        if (!p.group) return;
        const px = mapCenter + p.group.position.x * mapScale;
        const pz = mapCenter + p.group.position.z * mapScale;
        minimapCtx.fillStyle = '#2ecc71';
        minimapCtx.beginPath();
        minimapCtx.arc(px, pz, 1.5, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    // 4. 플레이어 위치 표시 (파란색 원 + 테두리)
    if (myTank && myTank.hp > 0) {
        const px = mapCenter + myTank.group.position.x * mapScale;
        const pz = mapCenter + myTank.group.position.z * mapScale;
        minimapCtx.fillStyle = '#4488ff';
        minimapCtx.beginPath();
        minimapCtx.arc(px, pz, 3, 0, Math.PI * 2);
        minimapCtx.fill();
        minimapCtx.strokeStyle = '#ffffff';
        minimapCtx.lineWidth = 1;
        minimapCtx.stroke();
    }
}

/**
 * 메인 게임 루프 업데이트 - 매 프레임 호출
 * @param {number} dt - 델타 타임 (초)
 */
/**
 * 메인 게임 루프 업데이트 - 매 프레임 호출
 * @param {number} dt - 델타 타임 (초)
 */
function update(dt) {
    const now = Date.now();

    // 1. 핵심 시스템 업데이트
    if (repairStation) repairStation.update(dt);
    renderMinimap();
    if (trackMarkManager) trackMarkManager.update();

    // 2. 플레이어 탱크 업데이트 (플레이 중이며 살아있을 때만)
    if (WCGames.state === 'PLAYING' && myTank && myTank.hp > 0) {

        // --- 부스터 입력 및 게이지 관리 ---
        const isInputBoosting = !!(keys['Space'] || keys[' '] || window.isMobileBoosting);

        if (isInputBoosting && myTank.boosterGauge > 0) {
            myTank.isBoosting = true;
            myTank.boosterGauge = Math.max(0, myTank.boosterGauge - CONFIG.BOOSTER.CONSUME_RATE * dt);

            // 게이지 소진 시 강제로 해제
            if (myTank.boosterGauge <= 0) {
                myTank.isBoosting = false;
            }
        } else {
            myTank.isBoosting = false;
            // 미사용 시 자동 리필
            myTank.boosterGauge = Math.min(CONFIG.BOOSTER.MAX_GAUGE, myTank.boosterGauge + CONFIG.BOOSTER.REFILL_RATE * dt);
        }

        // HUD 부스터 게이지 UI 업데이트 (상단 HUD 제거로 인한 비활성화)

        // 3. 입력 감지 및 이동 소스 결정
        const isJoystickActive = Math.abs(joystickLeft.x) > 0.1 || Math.abs(joystickLeft.y) > 0.1;

        if (isJoystickActive) {
            // --- 조이스틱 제어 (모바일 기반: 절대 방향 제어) ---
            const nx = joystickLeft.x;
            const nz = joystickLeft.y;
            const moveMag = 1.0; // 조이스틱 기울기에 상관없이 최대 속도 유지
            const targetAngle = Math.atan2(-nx, -nz);

            // 탱크 몸체 회전
            const rotBoost = 1.0 + (moveMag * 0.2);
            myTank.group.rotation.y = lerpAngle(myTank.group.rotation.y, targetAngle, CONFIG.TANK.ROTATE_SPEED * rotBoost * dt);

            const currentAngle = myTank.group.rotation.y;
            const angleDiff = Math.abs(normalizeAngle(targetAngle - currentAngle));
            const alignmentFactor = Math.max(0, Math.cos(angleDiff)); // 회전 정렬 방향에 따른 보정
            const speedScale = Math.pow(alignmentFactor, 0.4);

            if (speedScale > 0.05) {
                const currentSpeed = (CONFIG.TANK.FORWARD_SPEED + (myTank.moveSpeedBonus || 0));
                const forwardX = -Math.sin(currentAngle);
                const forwardZ = -Math.cos(currentAngle);

                // 실제 이동 벡터 계산
                let moveX = (forwardX * 0.8) + (nx * 0.2);
                let moveZ = (forwardZ * 0.8) + (nz * 0.2);
                const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
                moveX /= moveLen;
                moveZ /= moveLen;

                const boosterMult = (myTank.isBoosting && myTank.boosterGauge > 0) ? CONFIG.BOOSTER.SPEED_MULTIPLIER : 1.0;
                const actualMove = moveMag * currentSpeed * dt * speedScale * boosterMult;
                myTank.group.position.x += moveX * actualMove;
                myTank.group.position.z += moveZ * actualMove;

                if (myTank.engineAudio) myTank.engineAudio.update(moveMag * speedScale);
                myTank.updateAnims(dt, true);
            } else {
                if (myTank.engineAudio) myTank.engineAudio.update(0.2);
                myTank.updateAnims(dt, false);
            }
        } else {
            // --- 키보드 제어 (PC 기반: 상대 방향 제어) ---
            let moveDir = 0;
            if (keys['w'] || keys['KeyW'] || keys['ArrowUp']) moveDir = 1.0;
            else if (keys['s'] || keys['KeyS'] || keys['ArrowDown']) moveDir = -0.7; // 후진 시 패널티

            // 수동 공습 트리거 (디버그용: 'K' 키)
            if (keys['KeyK'] && now > (myTank.lastKTrigger || 0) + 1000) {
                myTank.lastKTrigger = now;
                triggerManualAirstrike();
            }

            // 회전 처리
            const rotSpeed = CONFIG.TANK.ROTATE_SPEED * (1.1 + (Math.abs(moveDir) * 0.2));
            if (keys['a'] || keys['KeyA'] || keys['ArrowLeft']) myTank.group.rotation.y += rotSpeed * dt;
            if (keys['d'] || keys['KeyD'] || keys['ArrowRight']) myTank.group.rotation.y -= rotSpeed * dt;

            // 이동 처리
            if (moveDir !== 0) {
                const currentAngle = myTank.group.rotation.y;
                const boosterMult = (myTank.isBoosting && myTank.boosterGauge > 0) ? CONFIG.BOOSTER.SPEED_MULTIPLIER : 1.0;
                const currentSpeed = (CONFIG.TANK.FORWARD_SPEED + (myTank.moveSpeedBonus || 0));

                const dirX = -Math.sin(currentAngle) * moveDir;
                const dirZ = -Math.cos(currentAngle) * moveDir;
                const actualMove = currentSpeed * dt * boosterMult;

                myTank.group.position.x += dirX * actualMove;
                myTank.group.position.z += dirZ * actualMove;

                if (myTank.engineAudio) myTank.engineAudio.update(1.0);
                myTank.updateAnims(dt, true);
            } else {
                const isRotating = (keys['a'] || keys['KeyA'] || keys['ArrowLeft'] || keys['d'] || keys['KeyD'] || keys['ArrowRight']);
                if (myTank.engineAudio) myTank.engineAudio.update(isRotating ? 0.3 : 0.0);
                myTank.updateAnims(dt, false);
            }
        }

        // 탱크 수평 유지 (물리 엔진 미적용 시 보정)
        myTank.hullGroup.rotation.x = 0;
        myTank.hullGroup.rotation.z = 0;

        // 4. 포탑 회전 제어 (마우스 / 오른쪽 조이스틱 / 자동 조준)
        let targetTurretAngle = null;
        let isManualAim = false;

        // --- 오른쪽 조이스틱 조준 (모바일 전용) ---
        if (Math.abs(joystickRight.x) > 0.1 || Math.abs(joystickRight.y) > 0.1) {
            targetTurretAngle = Math.atan2(-joystickRight.x, -joystickRight.y);
            isManualAim = true;
            // 조이스틱을 끝까지 당기면 자동 사격
            if (Math.sqrt(joystickRight.x ** 2 + joystickRight.y ** 2) > 0.8) fire();
        }

        // --- 자동 조준 시스템 (공격 범위 내 가장 가까운 적 추적) ---
        const nearestEnemyPos = findNearestEnemy(myTank.group.position, CONFIG.TANK.DETECTION_RANGE);

        if (!isManualAim && nearestEnemyPos) {
            targetTurretAngle = Math.atan2(myTank.group.position.x - nearestEnemyPos.x, myTank.group.position.z - nearestEnemyPos.z);

            // 자동 발사 조건 확인 (각도 정렬 및 거리 체크)
            const currentWorldAngle = myTank.turretGroup.rotation.y + myTank.group.rotation.y;
            const angleDiff = Math.abs(normalizeAngle(currentWorldAngle - targetTurretAngle));
            const distToEnemy = myTank.group.position.distanceTo(nearestEnemyPos);

            if (angleDiff < (CONFIG.TANK.FIRING_THRESHOLD || 0.2) && distToEnemy < CONFIG.TANK.ATTACK_RANGE) {
                fire();
            }
        } else if (!isManualAim) {
            // 적이 없고 수동 조작도 없을 경우 포탑을 정면(차체 방향)으로 정렬
            targetTurretAngle = myTank.group.rotation.y;
        }

        // 월드 타겟 각도 갱신
        if (targetTurretAngle !== null) myTank.targetWorldAngle = targetTurretAngle;

        // 월드 각도를 로컬 각도로 변환하여 부드러운 회전 적용
        const currentWorldAngle = myTank.turretGroup.rotation.y + myTank.group.rotation.y;
        const nextWorldAngle = lerpAngle(currentWorldAngle, myTank.targetWorldAngle, CONFIG.LERP_SPEED.TURRET * dt);
        myTank.turretGroup.rotation.y = nextWorldAngle - myTank.group.rotation.y;

        // 5. 물리 및 충돌 검사
        checkCollisions();

        // 6. 동적 카메라 시스템 (공습 전 줌아웃 등 연출)
        const warningElement = document.getElementById('air-raid-warning');
        const warningActive = (warningElement && warningElement.style.display !== 'none');

        // 공습 경보 사이렌 및 줌 시점 계산
        const warningDuration = (CONFIG.AIRSTRIKE.WARNING_DURATION || 3) * 1000;
        const sirenStartTime = nextAirstrikeTime - warningDuration;
        const zoomDelay = (CONFIG.CAMERA.SIREN_ZOOM_DELAY || 3) * 1000;

        // 7. 스마트 카메라 팔로우 (탑다운 고정 오프셋 및 공습 줌 연출)
        // 사이렌 시작 후 지정된 딜레이가 지났거나, 비행기 혹은 폭탄이 존재하는 경우 줌 아웃 유지
        const isZoomActive = (warningActive && (now > sirenStartTime + zoomDelay)) || airstrikePlanes.length > 0 || airstrikeBombs.length > 0;
        const targetHeight = isZoomActive ? (CONFIG.CAMERA.SIREN_HEIGHT || 40) : CONFIG.CAMERA.HEIGHT;

        // 부드러운 높이 보간 (Lerp)
        currentCameraHeight = THREE.MathUtils.lerp(currentCameraHeight, targetHeight, dt * (CONFIG.CAMERA.LERP_SPEED || 1.5));

        let camX = myTank.group.position.x;
        let camY = currentCameraHeight;
        let camZ = myTank.group.position.z + CONFIG.CAMERA.OFFSET_Z;

        // 카메라 흔들림 (피격 또는 폭발 시)
        if (cameraShakeTime > 0) {
            cameraShakeTime -= dt;
            const shake = CONFIG.CAMERA.SHAKE_INTENSITY || 0.3;
            camX += (Math.random() - 0.5) * shake;
            camY += (Math.random() - 0.5) * shake;
            camZ += (Math.random() - 0.5) * shake;
        }

        camera.position.set(camX, camY, camZ);
        camera.lookAt(myTank.group.position);

        // 8. 동적 그림자 조명 동기화
        if (directionalLight) {
            directionalLight.position.set(camX + 30, 50, camZ + 10);
            directionalLight.target.position.set(camX, 0, camZ);
            directionalLight.target.updateMatrixWorld();
        }
    }

    // 3. 적 봇 상태 업데이트
    bots.forEach(bot => {
        bot.updateAnims(dt, bot.isMoving);
        bot.updateAI(dt);

        // 지형 보정
        bot.group.position.y = 0;
        bot.hullGroup.rotation.x = 0;
        bot.hullGroup.rotation.z = 0;
    });

    // 4. 파워업(아이템) 시스템 관리
    // 설정된 간격마다 파워업 스폰
    if (now - lastPowerupSpawnTime > CONFIG.POWERUP.SPAWN_INTERVAL * 1000 && powerups.length < CONFIG.POWERUP.MAX_COUNT) {
        lastPowerupSpawnTime = now;
        const spawn = getRandomSpawnPoint();
        const id = `p_${Math.floor(spawn.x)}_${Math.floor(spawn.z)}`;
        const p = new HealthPotion(id, new THREE.Vector3(spawn.x, 0, spawn.z));
        powerups.push(p);
    }

    // 파워업 업데이트 및 충돌 검사 (플레이어 및 봇)
    const currentTimeSec = now * 0.001;
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.update(dt, currentTimeSec);

        const candidates = [myTank, ...bots];
        for (const tank of candidates) {
            if (!tank || tank.hp <= 0) continue;

            const dist = tank.group.position.distanceTo(p.group.position);
            if (dist < (CONFIG.POWERUP.PICKUP_RADIUS || 1.5)) {
                // 회복 처리
                tank.heal(CONFIG.POWERUP.HEAL_AMOUNT);
                spawnFloatingText(tank.group.position.clone().add(new THREE.Vector3(0, 2, 0)), "HP UP", "#27ae60");

                p.destroy();
                powerups.splice(i, 1);
                break; // 해당 아이템 소멸
            }
        }
    }

    // 5. 시각 효과 및 환경 요소 업데이트
    if (vfx) vfx.update(dt);

    // 나무 흔들림 연출
    trees.forEach(tree => {
        if (tree.userData.shakeAmount > 0) {
            tree.userData.shakeAmount -= dt * 2.0;
            if (tree.userData.shakeAmount < 0) tree.userData.shakeAmount = 0;

            const shake = Math.sin(now * 0.05) * tree.userData.shakeAmount * 0.2;
            tree.rotation.x = shake;
            tree.rotation.z = shake * 0.5;
        } else {
            tree.rotation.x = 0;
            tree.rotation.z = 0;
        }
    });

    // 6. 공습(Airstrike) 시스템 관리
    if (nextAirstrikeTime === 0) {
        // 첫 공습 시간 계산
        const interval = CONFIG.AIRSTRIKE.INTERVAL_MIN + Math.random() * (CONFIG.AIRSTRIKE.INTERVAL_MAX - CONFIG.AIRSTRIKE.INTERVAL_MIN);
        nextAirstrikeTime = now + interval * 1000;
    }

    // 경보 처리
    const warningTime = (CONFIG.AIRSTRIKE.WARNING_DURATION || 3) * 1000;
    const warningElement = document.getElementById('air-raid-warning');
    if (now > nextAirstrikeTime - warningTime && now < nextAirstrikeTime) {
        if (!airstrikeWarningActive) {
            airstrikeWarningActive = true;
            showAirstrikeWarning();
        }
    }

    // 경보 UI 연출 (깜빡임)
    if (airstrikeWarningActive) {
        if (warningElement) {
            warningElement.style.display = 'block';
            warningElement.style.opacity = Math.sin(now * 0.01) * 0.5 + 0.5;
        }
    } else {
        if (warningElement) warningElement.style.display = 'none';
    }

    // 공습 실행 시점
    if (now > nextAirstrikeTime) {
        // 무작위 타겟 선정 (살아있는 탱크 중 하나)
        const allTargets = [myTank, ...bots.filter(b => b.hp > 0)];
        let targetX = (Math.random() - 0.5) * CONFIG.WORLD.SIZE * 0.5;
        let targetZ = (Math.random() - 0.5) * CONFIG.WORLD.SIZE * 0.5;

        if (allTargets.length > 0) {
            const victim = allTargets[Math.floor(Math.random() * allTargets.length)];
            targetX = victim.group.position.x;
            targetZ = victim.group.position.z;
        }

        // 공습 경로 설정 (360도 무작위 진입)
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = CONFIG.WORLD.SIZE * 1.5;
        const startX = targetX + Math.cos(angle) * spawnDist;
        const startZ = targetZ + Math.sin(angle) * spawnDist;
        const endX = targetX - Math.cos(angle) * spawnDist;
        const endZ = targetZ - Math.sin(angle) * spawnDist;

        const start = new THREE.Vector3(startX, CONFIG.AIRSTRIKE.PLANE_HEIGHT, startZ);
        const end = new THREE.Vector3(endX, CONFIG.AIRSTRIKE.PLANE_HEIGHT, endZ);
        const targetPos = new THREE.Vector3(targetX, 0, targetZ);

        airstrikePlanes.push(new FighterPlane(start, end, targetPos));

        // 다음 공습 타이머 예약
        const nextInterval = CONFIG.AIRSTRIKE.INTERVAL_MIN + Math.random() * (CONFIG.AIRSTRIKE.INTERVAL_MAX - CONFIG.AIRSTRIKE.INTERVAL_MIN);
        nextAirstrikeTime = now + nextInterval * 1000;
        airstrikeWarningActive = false;
    }

    // 비행기 및 폭탄 객체 업데이트
    for (let i = airstrikePlanes.length - 1; i >= 0; i--) {
        if (!airstrikePlanes[i].update(dt)) {
            airstrikePlanes[i].destroy();
            airstrikePlanes.splice(i, 1);
        }
    }
    for (let i = airstrikeBombs.length - 1; i >= 0; i--) {
        if (!airstrikeBombs[i].update(dt)) {
            airstrikeBombs[i].destroy();
            airstrikeBombs.splice(i, 1);
        }
    }

    // 잔해(Wrecks) 전용 특수 VFX 연출 (지속적인 연기 및 불꽃)
    wreckSmokeTimer += dt;
    if (wreckSmokeTimer > 0.25) {
        wreckSmokeTimer = 0;
        wrecks.forEach(wreck => {
            const basePos = new THREE.Vector3(0, 0.6, 0).add(wreck.position);

            // 연기 효과
            const smokePos = basePos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5));
            vfx.spawnSmoke(smokePos, CONFIG.COLORS.VFX.WRECK_SMOKE || 0x1a1a1a, 2, 0.3, 0.5, 3000);

            // 불꽃 효과
            const firePos = basePos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3));
            vfx.spawnFire(firePos, 2, 1.2, 0.2, 600);

            // 랜덤하게 불꽃 튀김 연출
            if (Math.random() < 0.4) {
                const emberPos = basePos.clone().add(new THREE.Vector3(0, Math.random() * 0.3, 0));
                vfx.spawnFire(emberPos, 3, 2.0, 0.08, 400);
            }
        });
    }

    // 7. HUD 오버레이 업데이트
    if (camera) {
        if (myTank) myTank.updateHUD(camera);
        bots.forEach(b => b.updateHUD(camera));
    }
}

/**
 * 처치 보상 부여 로직
 * @param {Tank} killer - 처치한 탱크 인스턴스
 */
function grantKillReward(killer) {
    if (!killer || killer.hp <= 0) return;

    // 업그레이드 종류 중 랜덤 선택
    const rewards = CONFIG.UPGRADE.TYPES;
    const selected = rewards[Math.floor(Math.random() * rewards.length)];

    killer.applyUpgrade(selected);

    // 시각적 피드백 (플로팅 텍스트 및 사운드)
    spawnFloatingText(killer.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)), `${selected} UP`, "#ffd700");
    if (window.AudioSFX) AudioSFX.playHeal();
    if (vfx) vfx.spawn(killer.group.position, 0xffff00, 20, 4, 0.2, 1000);
}

/**
 * 충돌 처리 - 내 탱크와 벽/타 탱크의 충돌 감지 및 해결
 */
function checkCollisions() {
    const dt = clock.getDelta();
    const originalPos = myTank.group.position.clone();

    // 맵 경계 체크
    const tileBound = (CONFIG.WORLD.SIZE / 2) - 1;
    myTank.group.position.x = Math.max(-tileBound, Math.min(tileBound, myTank.group.position.x));
    myTank.group.position.z = Math.max(-tileBound, Math.min(tileBound, myTank.group.position.z));

    // 벽(장애물) 충돌 체크
    const wallTankRadius = 0.65;
    for (const wall of walls) {
        const wallW = wall.geometry.parameters.width;
        const wallD = wall.geometry.parameters.depth;

        const wallMinX = wall.position.x - wallW / 2 - wallTankRadius;
        const wallMaxX = wall.position.x + wallW / 2 + wallTankRadius;
        const wallMinZ = wall.position.z - wallD / 2 - wallTankRadius;
        const wallMaxZ = wall.position.z + wallD / 2 + wallTankRadius;

        if (myTank.group.position.x > wallMinX && myTank.group.position.x < wallMaxX &&
            myTank.group.position.z > wallMinZ && myTank.group.position.z < wallMaxZ) {

            // 가장 가까운 면으로_push
            const dists = [
                Math.abs(myTank.group.position.x - wallMinX),
                Math.abs(myTank.group.position.x - wallMaxX),
                Math.abs(myTank.group.position.z - wallMinZ),
                Math.abs(myTank.group.position.z - wallMaxZ)
            ];
            const minIdx = dists.indexOf(Math.min(...dists));
            if (minIdx === 0) myTank.group.position.x = wallMinX;
            else if (minIdx === 1) myTank.group.position.x = wallMaxX;
            else if (minIdx === 2) myTank.group.position.z = wallMinZ;
            else if (minIdx === 3) myTank.group.position.z = wallMaxZ;
        }
    }

    // --- 새로운 기능: 탱크 간 겹침 방지 ---
    const TANK_PHYSICS_RADIUS = 0.8;
    const allTanks = [myTank, ...bots].filter(t => t && !t.isDead);

    // 1. 플레이어와 다른 탱크 간의 충돌 해결
    for (const other of allTanks) {
        if (other === myTank) continue;
        const dist = myTank.group.position.distanceTo(other.group.position);
        const minDist = TANK_PHYSICS_RADIUS * 2;
        if (dist < minDist) {
            // 충돌 벡터를 따라 서로 밀어냄
            const pushDir = myTank.group.position.clone().sub(other.group.position).normalize();
            if (dist === 0) pushDir.set(Math.random(), 0, Math.random()).normalize();
            const overlap = minDist - dist;
            myTank.group.position.add(pushDir.multiplyScalar(overlap * 0.5));
        }
    }
    // 2. 봇과 다른 탱크 간의 충돌 해결 (로컬 처리)
    for (let i = 0; i < bots.length; i++) {
        const bot = bots[i];
        if (bot.isDead) continue;
        const candidates = [myTank, ...bots];
        for (let j = 0; j < candidates.length; j++) {
            const other = candidates[j];
            if (other === bot) continue;
            const dist = bot.group.position.distanceTo(other.group.position);
            const minDist = TANK_PHYSICS_RADIUS * 2;
            if (dist < minDist) {
                const pushDir = bot.group.position.clone().sub(other.group.position).normalize();
                if (dist === 0) pushDir.set(Math.random(), 0, Math.random()).normalize();
                const overlap = minDist - dist;
                bot.group.position.add(pushDir.multiplyScalar(overlap * 0.5));
            }
        }
    }

    // 총알 및 기타 충돌
    updateBullets();
}


function updateBullets() {
    if (!bulletManager) return;

    const dt = 0.016;
    const bullets = bulletManager.getBulletArray();

    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        // 총알 위치 업데이트
        bullet.group.position.add(bullet.direction.clone().multiplyScalar(CONFIG.BULLET.SPEED * dt));

        // 총알 트레일(Trail) 효과 추가
        if (vfx) {
            bullet.trailTimer = (bullet.trailTimer || 0) + dt;
            if (bullet.trailTimer > 0.03) {
                bullet.trailTimer = 0;
                const trailPos = bullet.group.position.clone();
                // 총알 뒤쪽에 연기 생성
                trailPos.sub(bullet.direction.clone().multiplyScalar(0.2));
                vfx.spawnSmoke(trailPos, 0xaaaaaa, 1, 0.5, 0.08, 400);
            }
        }

        // 수명 확인
        if (Date.now() - bullet.startTime > CONFIG.BULLET.LIFE_TIME) {
            bulletManager.remove(i);
            continue;
        }

        let hit = false;

        // 벽 충돌
        for (const wall of walls) {
            const wallW = wall.geometry.parameters.width;
            const wallD = wall.geometry.parameters.depth;
            const wallH = wall.geometry.parameters.height || 1;

            if (Math.abs(bullet.group.position.x - wall.position.x) < wallW / 2 + 0.2 &&
                Math.abs(bullet.group.position.z - wall.position.z) < wallD / 2 + 0.2 &&
                Math.abs(bullet.group.position.y - wall.position.y) < wallH / 2 + 0.5) {

                if (vfx) {
                    const normal = bullet.group.position.clone().sub(wall.position).normalize();
                    vfx.spawnImpact(bullet.group.position, normal, 0xaaaaaa);

                    // 나무에 맞으면 흔들리기 시작
                    if (wall.userData && wall.userData.type === 'tree' && wall.userData.parentTree) {
                        wall.userData.parentTree.userData.shakeAmount = 1.0;
                    }

                    // 파괴 가능한 프롭 로직
                    if (wall.userData && wall.userData.isBreakable) {
                        // 프롭을 위한 큰 폭발
                        for (let j = 0; j < 3; j++) {
                            vfx.spawnImpact(wall.position, new THREE.Vector3(0, 1, 0), wall.userData.type === 'barrel' ? 0xc62828 : 0x5d4037);
                        }
                        AudioSFX.playImpact();

                        // 씬과 벽 배열에서 제거
                        scene.remove(wall);
                        wall.traverse(child => {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) child.material.dispose();
                        });
                        const wallIdx = walls.indexOf(wall);
                        if (wallIdx !== -1) walls.splice(wallIdx, 1);
                    }
                }
                if (bullet.ownerId === myId) AudioSFX.playImpact();
                hit = true;
                break;
            }
        }
        if (hit) {
            bulletManager.remove(i);
            continue;
        }

        // 플레이어 충돌
        if (bullet.ownerId !== myTank.id && bullet.group.position.distanceTo(myTank.group.position) < 1.2) {
            AudioSFX.playImpact();
            if (vfx) vfx.spawnImpact(bullet.group.position, new THREE.Vector3(0, 1, 0), 0xffaa00);
            myTank.handleHit(bullet.damage || CONFIG.BULLET.DAMAGE, bullet.ownerId);
            hit = true;
        }

        if (hit) {
            bulletManager.remove(i);
            continue;
        }

        // 봇 충돌
        for (const bot of bots) {
            if (bullet.ownerId !== bot.id && bullet.group.position.distanceTo(bot.group.position) < 1.2) {
                AudioSFX.playImpact();
                if (vfx) vfx.spawnImpact(bullet.group.position, new THREE.Vector3(0, 1, 0), 0xffaa00);
                bot.handleHit(bullet.damage || CONFIG.BULLET.DAMAGE, bullet.ownerId);
                hit = true;
                break;
            }
        }

        if (hit) {
            bulletManager.remove(i);
            continue;
        }
    }
}



/* 7. 렌더링 - 메인 애니메이션 루프 */
function animate() {
    animationId = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    update(dt);
    renderer.render(scene, camera);
}

/* 7. 충돌 및 스폰 유틸 - 위치 안전성 체크 및 랜덤 스폰 포인트 생성 */

/**
 * 위치 안전성 체크 - 탱크가 해당 위치에 스폰/이동 가능한지 확인
 * @param {number} x - X 좌표
 * @param {number} z - Z 좌표
 * @returns {boolean} 안전한지 여부
 */
function isPositionSafe(x, z) {
    const tankRadius = 1.8;
    const halfSize = (CONFIG.WORLD.SIZE / 2) - 5;
    if (Math.abs(x) > halfSize || Math.abs(z) > halfSize) return false;

    const tankBox = new THREE.Box3(
        new THREE.Vector3(x - tankRadius, 0, z - tankRadius),
        new THREE.Vector3(x + tankRadius, 2, z + tankRadius)
    );

    for (const wall of walls) {
        const box = wall.userData.box;
        if (box && tankBox.intersectsBox(box)) {
            return false;
        }
    }
    return true;
}

/**
 * 새로운 기능: 두 지점 간의 가시선(LoS) 체크.
 * 경로에 벽이 없으면 true를 반환함.
 */
function checkLineOfSight(from, to) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const distance = direction.length();
    direction.normalize();

    const ray = new THREE.Ray(from, direction);
    const intersection = new THREE.Vector3();

    for (const wall of walls) {
        const box = wall.userData.box;
        if (box && ray.intersectBox(box, intersection)) {
            const hitDist = from.distanceTo(intersection);
            if (hitDist < distance) return false; // 경로가 벽에 의해 막힘
        }
    }
    return true;
}

function getRandomSpawnPoint() {
    const range = (CONFIG.WORLD.SIZE / 2) - 10;
    for (let i = 0; i < 100; i++) {
        const x = (Math.random() - 0.5) * range * 2;
        const z = (Math.random() - 0.5) * range * 2;
        if (isPositionSafe(x, z)) {
            return { x, z };
        }
    }
    return { x: 0, z: 0 };
}

/**
 * 자동 조준을 위한 가장 가까운 적 찾기
 */
function findNearestEnemy(pos, maxDist = 50) {
    let nearest = null;
    let minDist = maxDist;

    // 봇 검색
    bots.forEach(bot => {
        if (bot && !bot.isDead && bot.group) {
            const d = pos.distanceTo(bot.group.position);
            if (d < minDist) {
                minDist = d;
                nearest = bot.group.position;
            }
        }
    });

    // 싱글 플레이어용으로 다른 플레이어 탱크 검색 제거됨

    return nearest;
}

/**
 * 플로팅 텍스트 효과 유틸리티
 */
function spawnFloatingText(pos, text, color = '#4caf50') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 50px Arial';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(pos);
    sprite.scale.set(6, 3, 1);
    scene.add(sprite);


    let life = 0;
    const maxLife = 60;
    function updateText() {
        life++;
        sprite.position.y += 0.06;

        sprite.material.opacity = 1 - (life / maxLife);
        if (life < maxLife) {
            requestAnimationFrame(updateText);
        } else {
            scene.remove(sprite);
            texture.dispose();
            material.dispose();
        }
    }
    updateText();
}

/**
 * 나무(Tree) 생성
 */
function createTree(x, z) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, 0, z);
    treeGroup.userData = { type: 'tree', shakeAmount: 0, initialRotation: 0 };
    scene.add(treeGroup);
    trees.push(treeGroup);

    const trunk = createVoxelCylinder(0.2, 0.2, 1.0, 0x5d4037, 0, 0.8);
    trunk.position.y = 0.5;
    treeGroup.add(trunk);

    const foliage = createVoxelCone(1.0, 2.0, 0x2e7d32, 0, 0.9);
    foliage.position.y = 1.8;
    treeGroup.add(foliage);

    const cap = createVoxelCone(0.7, 1.5, 0x388e3c);
    cap.position.y = 2.8;
    treeGroup.add(cap);

    const col = createVoxelBox(0.8, 3.5, 0.8, 0x000000);
    col.position.set(x, 1.75, z);
    col.visible = false;
    col.userData = { type: 'tree', parentTree: treeGroup };
    scene.add(col);
    walls.push(col);
}

/**
 * 불탄 나무(Burned Tree) 생성
 */
function createBurnedTree(x, z) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, 0, z);
    treeGroup.userData = { type: 'tree', shakeAmount: 0, initialRotation: 0 };
    scene.add(treeGroup);
    trees.push(treeGroup);

    const charredTrunk = createVoxelCylinder(0.22, 0.28, 1.2, 0x0d0a08, 0, 0.8);
    charredTrunk.position.y = 0.6;
    charredTrunk.rotation.z = seededRandom(x * 7 + z * 3) * 0.15 - 0.075;
    treeGroup.add(charredTrunk);

    const deadBranches = createVoxelCone(0.6, 1.2, 0x151210, 0, 0.6);
    deadBranches.position.y = 1.5;
    treeGroup.add(deadBranches);

    const ashFoliage = createVoxelCone(0.4, 0.8, 0x1a1815, 0, 0.5);
    ashFoliage.position.y = 2.0;
    ashFoliage.rotation.y = Math.PI / 6;
    treeGroup.add(ashFoliage);

    for (let i = 0; i < 4; i++) {
        const spot = createVoxelBox(0.12, 0.06, 0.12, 0x080504);
        spot.position.set(
            (seededRandom(x + i) - 0.5) * 0.4,
            0.2 + seededRandom(z + i) * 0.6,
            (seededRandom(i * 7) - 0.5) * 0.4
        );
        treeGroup.add(spot);
    }

    const ashPile = createVoxelBox(0.7, 0.1, 0.7, 0x1a1510, 0, 1);
    ashPile.position.y = 0.05;
    treeGroup.add(ashPile);

    const col = createVoxelBox(0.8, 3.5, 0.8, 0x000000);
    col.position.set(x, 1.75, z);
    col.visible = false;
    col.userData = { type: 'tree', parentTree: treeGroup };
    scene.add(col);
    walls.push(col);
}

/**
 * 대전차 장애물 (Czech Hedgehog) 생성
 */
function createHedgehog(x, z) {
    const group = new THREE.Group();
    const color = 0x1a1815;
    const s = 1.2;
    const b1 = createVoxelBox(s, 0.15, 0.15, color);
    const b2 = createVoxelBox(s, 0.15, 0.15, color);
    const b3 = createVoxelBox(s, 0.15, 0.15, color);
    b1.rotation.set(Math.PI / 4, 0, 0);
    b2.rotation.set(-Math.PI / 4, 0, 0);
    b3.rotation.set(0, 0, Math.PI / 2);
    group.add(b1, b2, b3);
    group.position.set(x, 0.4, z);
    scene.add(group);

    const col = createVoxelBox(0.8, 0.8, 0.8, 0x000000, 0, 1);
    col.position.set(x, 0.4, z);
    col.visible = false;
    col.userData = { type: 'hedgehog' };
    scene.add(col);
    walls.push(col);
}

/**
 * 프롭 생성 (상자 및 배럴)
 */
function createProp(type, x, z) {
    if (type === 'crate') {
        const crate = createVoxelBox(0.8, 0.8, 0.8, 0x252018);
        crate.position.set(x, 0.4, z);
        crate.userData = { isBreakable: true, type: 'crate' };
        scene.add(crate);
        walls.push(crate);

        for (let i = 0; i < 4; i++) {
            const d = createVoxelBox(0.82, 0.1, 0.1, 0x1a1510);
            d.position.set(x, 0.4 + (i % 2 ? 0.3 : -0.3), z);
            crate.add(d);
        }
    } else if (type === 'barrel') {
        const barrel = createVoxelCylinder(0.3, 0.3, 0.9, 0x3a2520);
        barrel.position.set(x, 0.45, z);
        barrel.userData = { isBreakable: true, type: 'barrel' };
        scene.add(barrel);
        walls.push(barrel);

        const r1 = createVoxelCylinder(0.32, 0.32, 0.05, 0x1a1510);
        r1.position.y = 0.2;
        barrel.add(r1);
        const r2 = createVoxelCylinder(0.32, 0.32, 0.05, 0x1a1510);
        r2.position.y = -0.2;
        barrel.add(r2);
    }
}

/**
 * 요새 벽(Fortress Wall) 생성
 */
function createFortressWall(wallDef) {
    const { x, z, w, d } = wallDef;
    const h = 2.0;
    const color = 0x1a1815;
    const wireColor = 0x151210;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);

    const isHorizontal = w > d;
    const length = isHorizontal ? w : d;
    const postSpacing = 2.5;
    const numPosts = Math.floor(length / postSpacing) + 1;

    for (let i = 0; i <= numPosts; i++) {
        const pos = -length / 2 + i * postSpacing;
        const postH = h + 0.3 + (i % 2) * 0.4;

        const post = createVoxelBox(0.15, postH, 0.15, wireColor);
        if (isHorizontal) post.position.set(pos, postH / 2, 0);
        else post.position.set(0, postH / 2, pos);
        group.add(post);

        const cap = createVoxelBox(0.25, 0.1, 0.25, wireColor);
        if (isHorizontal) cap.position.set(pos, postH + 0.05, 0);
        else cap.position.set(0, postH + 0.05, pos);
        group.add(cap);
    }

    for (let layer = 0; layer < 3; layer++) {
        const wireH = 0.3 + layer * (h / 3);
        const wire = createVoxelBox(isHorizontal ? w : 0.05, 0.05, isHorizontal ? 0.05 : d, wireColor);
        wire.position.set(0, wireH, 0);
        group.add(wire);
    }

    for (let i = 0; i < numPosts; i++) {
        const pos1 = -length / 2 + i * postSpacing;
        const pos2 = Math.min(pos1 + postSpacing, length / 2);

        for (let layer = 0; layer < 3; layer++) {
            const wireH = 0.3 + layer * (h / 3);
            const diag = createVoxelBox(0.03, 0.03, Math.sqrt(postSpacing * postSpacing + 0.09), wireColor);
            if (isHorizontal) {
                diag.position.set((pos1 + pos2) / 2, wireH, 0);
                diag.rotation.y = Math.atan2(0.3, pos2 - pos1);
            } else {
                diag.position.set(0, wireH, (pos1 + pos2) / 2);
                diag.rotation.x = Math.atan2(0.3, pos2 - pos1);
            }
            group.add(diag);
        }
    }

    const col = createVoxelBox(w + 0.2, h + 0.5, d + 0.2, 0x000000);
    col.position.set(x, h / 2 + 0.2, z);
    col.visible = false;
    col.userData = { type: 'fortress' };
    scene.add(col);
    walls.push(col);
}

/**
 * 손상된 울타리(Damaged Fence) 생성
 */
function createDamagedFence(wallDef) {
    const { x, z, w, d } = wallDef;
    const h = 1.8;
    const wireColor = 0x151210;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);

    const isHorizontal = w > d;
    const length = isHorizontal ? w : d;
    const postSpacing = 3.0;
    const numPosts = Math.floor(length / postSpacing) + 1;
    const skipPosts = [Math.floor(numPosts / 3), Math.floor(numPosts * 2 / 3)];

    for (let i = 0; i <= numPosts; i++) {
        if (skipPosts.includes(i)) continue;

        const pos = -length / 2 + i * postSpacing;
        const tilt = (Math.random() - 0.5) * 0.2;
        const postH = h - (i % 2) * 0.3;

        const post = createVoxelBox(0.12, postH, 0.12, wireColor);
        if (isHorizontal) {
            post.position.set(pos, postH / 2, 0);
            post.rotation.z = tilt;
        } else {
            post.position.set(0, postH / 2, pos);
            post.rotation.x = tilt;
        }
        group.add(post);
    }

    const wireLayers = [0.4, 0.9, 1.4];
    wireLayers.forEach((wireH, li) => {
        if (li === 1) return;
        for (let i = 0; i < numPosts; i++) {
            const startPos = -length / 2 + i * postSpacing;
            const endPos = Math.min(startPos + postSpacing, length / 2);
            if (skipPosts.includes(i)) continue;
            if (Math.random() < 0.15) continue;

            const wire = createVoxelBox(isHorizontal ? postSpacing : 0.03, 0.03, isHorizontal ? 0.03 : postSpacing, wireColor);
            if (isHorizontal) wire.position.set((startPos + endPos) / 2, wireH, 0);
            else wire.position.set(0, wireH, (startPos + endPos) / 2);
            group.add(wire);
        }
    });

    const fallenCount = Math.floor(numPosts / 4);
    for (let f = 0; f < fallenCount; f++) {
        const i = Math.floor(Math.random() * numPosts);
        const pos = -length / 2 + i * postSpacing;
        const fallen = createVoxelBox(0.1, 0.1, 1.5 + Math.random(), wireColor);
        if (isHorizontal) {
            fallen.position.set(pos, 0.15, (Math.random() - 0.5) * 0.5);
            fallen.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
        } else {
            fallen.position.set((Math.random() - 0.5) * 0.5, 0.15, pos);
            fallen.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
        }
        group.add(fallen);
    }

    const colW = isHorizontal ? w : 0.2;
    const colD = isHorizontal ? 0.2 : d;
    const col = createVoxelBox(colW, h, colD, 0x000000);
    col.position.set(x, h / 2, z);
    col.visible = false;
    col.userData = { type: 'fence' };
    scene.add(col);
    walls.push(col);
}

/**
 * 파손된 오두막(Shack) 생성
 */
function createShack(x, z, rot = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    scene.add(group);

    const wallColor = 0x252018;
    const roofColor = 0x1a1510;

    const floor = createVoxelBox(2.5, 0.15, 2.5, 0x1a1510);
    floor.position.y = 0.075;
    group.add(floor);

    const backWall = createVoxelBox(2.5, 1.8, 0.15, wallColor);
    backWall.position.set(0, 1.0, -1.175);
    group.add(backWall);

    const leftWall = createVoxelBox(0.15, 1.8, 2.5, wallColor);
    leftWall.position.set(-1.175, 1.0, 0);
    group.add(leftWall);

    const rightWall = createVoxelBox(0.15, 1.8, 2.5, wallColor);
    rightWall.position.set(1.175, 1.0, 0);
    group.add(rightWall);

    const frontWallL = createVoxelBox(0.8, 1.4, 0.15, wallColor);
    frontWallL.position.set(-0.7, 0.7, 1.175);
    frontWallL.rotation.z = 0.1;
    group.add(frontWallL);

    const frontWallR = createVoxelBox(0.8, 1.0, 0.15, wallColor);
    frontWallR.position.set(0.8, 0.5, 1.175);
    frontWallR.rotation.z = -0.15;
    group.add(frontWallR);

    const roof = createVoxelBox(2.8, 0.15, 2.8, roofColor);
    roof.position.set(0.3, 1.95, 0.2);
    roof.rotation.x = 0.15;
    roof.rotation.z = 0.1;
    group.add(roof);

    const debris1 = createVoxelBox(0.4, 0.3, 0.5, 0x1a1510);
    debris1.position.set(0.8, 2.1, -0.5);
    group.add(debris1);

    const col = createVoxelBox(2.5, 1.8, 2.5, 0x000000);
    col.position.set(x, 0.9, z);
    col.visible = false;
    col.userData = { type: 'shack' };
    scene.add(col);
    walls.push(col);
}

/**
 * 감시탑(Watchtower) 생성
 */
function createWatchtower(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);

    const towerColor = 0x1a1510;
    const metalColor = 0x252018;

    const base = createVoxelBox(1.8, 0.3, 1.8, 0x151210);
    base.position.y = 0.15;
    group.add(base);

    const legPositions = [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]];
    legPositions.forEach(([lx, lz]) => {
        const leg = createVoxelBox(0.2, 3.0, 0.2, metalColor);
        leg.position.set(lx, 1.5, lz);
        group.add(leg);
    });

    const platform = createVoxelBox(2.2, 0.15, 2.2, towerColor);
    platform.position.set(0.1, 3.0, 0.1);
    platform.rotation.x = 0.1;
    platform.rotation.z = -0.1;
    group.add(platform);

    const rail1 = createVoxelBox(2.0, 0.1, 0.1, metalColor);
    rail1.position.set(0, 3.3, -1.0);
    rail1.rotation.z = 0.2;
    group.add(rail1);

    const rail2 = createVoxelBox(0.1, 0.1, 1.8, metalColor);
    rail2.position.set(-1.0, 3.2, 0);
    group.add(rail2);

    const shelter = createVoxelBox(1.5, 0.8, 1.5, towerColor);
    shelter.position.set(-0.2, 3.6, -0.2);
    shelter.rotation.z = 0.15;
    group.add(shelter);

    const shelterRoof = createVoxelBox(1.7, 0.1, 1.7, metalColor);
    shelterRoof.position.set(-0.2, 4.1, -0.2);
    group.add(shelterRoof);

    const col = createVoxelBox(1.8, 4.0, 1.8, 0x000000);
    col.position.set(x, 2.0, z);
    col.visible = false;
    col.userData = { type: 'watchtower' };
    scene.add(col);
    walls.push(col);
}

/**
 * 모래주머니 방호벽(Sandbag Bunker) 생성
 */
function createSandbags(x, z, rot = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    scene.add(group);

    const sandDark = 0x4A3728;
    const sandBrown = 0x5C4033;
    const sandMuddy = 0x3D2817;

    for (let i = 0; i < 6; i++) {
        const color = [sandBrown, sandDark, sandMuddy, sandBrown, sandDark, sandMuddy][i];
        const bag = createVoxelCylinder(0.28, 0.32, 0.85, color, 0.1, 0.9);
        bag.rotation.z = Math.PI / 2;
        bag.rotation.y = (Math.random() - 0.5) * 0.15;
        bag.position.set(-2.0 + i * 0.8, 0.3, (Math.random() - 0.5) * 0.1);
        group.add(bag);
    }
    for (let i = 0; i < 5; i++) {
        const color = [sandMuddy, sandBrown, sandDark, sandMuddy, sandBrown][i];
        const bag = createVoxelCylinder(0.26, 0.30, 0.85, color, 0.1, 0.9);
        bag.rotation.z = Math.PI / 2;
        bag.rotation.y = (Math.random() - 0.5) * 0.2;
        bag.position.set(-1.6 + i * 0.8, 0.7, (Math.random() - 0.5) * 0.12);
        group.add(bag);
    }
    for (let i = 0; i < 4; i++) {
        const color = [sandDark, sandMuddy, sandBrown, sandDark][i];
        const bag = createVoxelCylinder(0.25, 0.28, 0.8, color, 0.1, 0.9);
        bag.rotation.z = Math.PI / 2;
        bag.rotation.y = (Math.random() - 0.5) * 0.18;
        bag.position.set(-1.2 + i * 0.8, 1.1, (Math.random() - 0.5) * 0.1);
        group.add(bag);
    }

    const col = createVoxelBox(5.0, 2.2, 1.2, 0x000000);
    col.position.set(x, 1.1, z);
    col.rotation.y = rot;
    col.visible = false;
    col.userData = { type: 'sandbags' };
    scene.add(col);
    walls.push(col);
}


/* 8. SDK 초기화 및 콜백 - 게임 시작/초기화/재시작 처리 */
const Game = {
    /**
     * 게임 시작
     */
    start() {
        WCGames.start();
        setupJoysticks();
    },

    /**
     * 게임 초기화 - 씬, 카메라, 렌더러, 맵, 탱크 등 생성
     */
    init() {
        // 이전 상태와 씬 정리
        if (typeof myTank !== 'undefined' && myTank) {
            myTank.destroy();
            myTank = null;
        }
        // 탱크 정리 로직 제거됨
        if (bulletManager) {
            const bullets = bulletManager.getBulletArray();
            for (let i = bullets.length - 1; i >= 0; i--) {
                bulletManager.remove(i);
            }
        }
        if (typeof walls !== 'undefined') {
            walls.length = 0;
        }
        if (typeof bots !== 'undefined') {
            bots.forEach(b => b.destroy());
            bots.length = 0;
        }
        // wallBoxes 초기화 로직 제거됨

        scene = new THREE.Scene();
        trackMarkManager = new TrackMarkManager(scene);
        bulletManager = new BulletManager(scene);

        vfx = new ParticleSystem();
        cameraShakeTime = 0;
        scene.background = new THREE.Color(CONFIG.COLORS.FLOOR);
        // 사용자 요청에 따라 명확성을 위해 안개 제거됨

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        // FOV는 isMobile 전역값 기준으로 init 시 1회 설정
        camera.fov = isMobile ? CONFIG.CAMERA.MOBILE_FOV : CONFIG.CAMERA.PC_FOV;
        camera.updateProjectionMatrix();

        const container = document.getElementById('game-container');
        container.innerHTML = ''; // 이전 캔버스가 있으면 정리

        renderer = new THREE.WebGLRenderer({ antialias: true });

        const isPC = window.matchMedia('(pointer: fine)').matches;
        const targetWidth = isPC ? 1920 : window.innerWidth;
        const targetHeight = isPC ? 1080 : window.innerHeight;

        renderer.setSize(targetWidth, targetHeight);
        if (isPC) {
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.objectFit = 'contain';
            renderer.domElement.style.backgroundColor = '#' + CONFIG.COLORS.FLOOR.toString(16).padStart(6, '0');
        }

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.BasicShadowMap;
        container.appendChild(renderer.domElement);

        // 미니맵 캔버스 초기화
        minimapCanvas = document.getElementById('minimap');
        if (minimapCanvas) {
            minimapCtx = minimapCanvas.getContext('2d');
        }

        if (clock) clock.stop();
        clock = new THREE.Clock();

        // 환경 설정
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        scene.add(hemisphereLight);

        directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(30, 50, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.left = -40;
        directionalLight.shadow.camera.right = 40;
        directionalLight.shadow.camera.top = 40;
        directionalLight.shadow.camera.bottom = -40;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 150;
        directionalLight.shadow.bias = -0.0005; // 복셀의 섀도우 아크네(Shadow Acne) 현상 수정
        scene.add(directionalLight);
        scene.add(directionalLight.target); // 추적을 위해 타겟을 명시적으로 추가해야 함

        const groundGeo = new THREE.PlaneGeometry(CONFIG.WORLD.SIZE, CONFIG.WORLD.SIZE);
        const groundMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.FLOOR });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        scene.add(ground);

        for (let i = 0; i < 600; i++) {
            const x = (seededRandom(i * 1.1) - 0.5) * CONFIG.WORLD.SIZE * 0.95;
            const z = (seededRandom(i * 2.2) - 0.5) * CONFIG.WORLD.SIZE * 0.95;
            const type = seededRandom(i * 3.3);

            if (type < 0.15) {
                const r = 0.05 + seededRandom(i * 4) * 0.15;
                const h = r * 0.5;
                const pebble = createVoxelCylinder(r, r * 1.2, h, 0x151210);
                pebble.position.set(x, h / 2, z);
                pebble.rotation.set(
                    seededRandom(i * 5) * Math.PI,
                    seededRandom(i * 5.1) * Math.PI,
                    seededRandom(i * 5.2) * Math.PI
                );
                scene.add(pebble);
            } else if (type < 0.3) {
                const r1 = 0.08 + seededRandom(i * 6) * 0.2;
                const r2 = r1 * (0.7 + seededRandom(i * 7) * 0.3);
                const h = 0.1 + seededRandom(i * 8) * 0.3;
                const rock = createVoxelCylinder(r1, r2, h, 0x1a1510);
                rock.position.set(x, h / 2, z);
                rock.rotation.set(
                    seededRandom(i * 9) * 0.6,
                    seededRandom(i * 10) * Math.PI * 2,
                    seededRandom(i * 11) * 0.6
                );
                scene.add(rock);
            } else if (type < 0.45) {
                const w = 0.4 + seededRandom(i * 12) * 0.8;
                const h = 0.05 + seededRandom(i * 13) * 0.12;
                const d = 0.4 + seededRandom(i * 14) * 0.8;
                const bump = createVoxelBox(w, h, d, 0x1a1510);
                bump.position.set(x, h / 2, z);
                bump.rotation.y = seededRandom(i * 15) * Math.PI;
                scene.add(bump);
            } else if (type < 0.6) {
                const w = 1.5 + seededRandom(i * 16) * 2;
                const d = 0.08 + seededRandom(i * 17) * 0.15;
                const crack = createVoxelBox(w, 0.015, d, 0x0d0a08);
                crack.position.set(x, 0.007, z);
                crack.rotation.y = seededRandom(i * 18) * Math.PI;
                scene.add(crack);
            } else if (type < 0.7) {
                const w = 0.8 + seededRandom(i * 19) * 1.5;
                const d = 0.6 + seededRandom(i * 20) * 1.2;
                const mud = createVoxelBox(w, 0.025, d, 0x151210);
                mud.position.set(x, 0.012, z);
                scene.add(mud);
            } else if (type < 0.82) {
                const w = 0.3 + seededRandom(i * 21) * 0.6;
                const h = 0.1 + seededRandom(i * 22) * 0.2;
                const d = 0.3 + seededRandom(i * 23) * 0.5;
                const debris = createVoxelBox(w, h, d, 0x1a1510);
                debris.position.set(x, h / 2, z);
                debris.rotation.set(
                    seededRandom(i * 24) * 0.7,
                    seededRandom(i * 25) * Math.PI * 2,
                    seededRandom(i * 26) * 0.7
                );
                scene.add(debris);
            } else if (type < 0.92) {
                const r = 0.15 + seededRandom(i * 27) * 0.25;
                const h = 0.15 + seededRandom(i * 28) * 0.25;
                const rock = createVoxelCylinder(r, r, h, 0x1f1a15);
                rock.position.set(x, h / 2, z);
                rock.rotation.set(
                    seededRandom(i * 29) * 0.4,
                    seededRandom(i * 30) * Math.PI,
                    seededRandom(i * 31) * 0.4
                );
                scene.add(rock);
            } else {
                const w = 0.5 + seededRandom(i * 32) * 1;
                const r = 0.08 + seededRandom(i * 33) * 0.12;
                const log = createVoxelCylinder(r, r * 1.2, w, 0x151008);
                log.position.set(x, r * 0.5, z);
                log.rotation.x = Math.PI / 2 + seededRandom(i * 34) * 0.5;
                log.rotation.z = seededRandom(i * 35) * Math.PI;
                scene.add(log);
            }
        }

        // Invisible Raycast Plane (포신 제어용 투명 평면)
        const raycastFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(CONFIG.WORLD.SIZE, CONFIG.WORLD.SIZE),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        raycastFloor.rotation.x = -Math.PI / 2;
        raycastFloor.name = 'raycast-floor';
        scene.add(raycastFloor);

        // 맵 소품 및 잔해 생성 로직이 전역 함수로 추출됨






        // 맵 소품 및 잔해 생성 로직이 전역 함수로 추출됨







        // CONFIG에서 고정 소품 생성
        CONFIG.MAP.PROPS.forEach(prop => {
            if (prop.type === 'tree') createBurnedTree(prop.x, prop.z);
            else if (prop.type === 'hedgehog') createHedgehog(prop.x, prop.z);
            else if (prop.type === 'crate') createProp('crate', prop.x, prop.z);
            else if (prop.type === 'barrel') createProp('barrel', prop.x, prop.z);
            else if (prop.type === 'sandbags') createSandbags(prop.x, prop.z);
            else if (prop.type === 'shack') createShack(prop.x, prop.z, prop.rot || 0);
            else if (prop.type === 'watchtower') createWatchtower(prop.x, prop.z);
        });

        // 고정된 파괴 탱크(잔해) 생성
        CONFIG.MAP.WRECKS.forEach(pos => {
            createWreckage(pos.x, pos.z);
        });

        CONFIG.MAP.LAYOUT.forEach(wallDef => {
            createFortressWall(wallDef);
        });

        if (CONFIG.MAP.DAMAGED_FENCE) {
            CONFIG.MAP.DAMAGED_FENCE.forEach(fenceDef => {
                createDamagedFence(fenceDef);
            });
        }

        // 중요: 모든 안전 점검 전에 월드 행렬 업데이트 (getRandomSpawnPoint 등에서 사용)
        scene.updateMatrixWorld(true);

        // 성능 향상을 위해 모든 충돌 박스를 한 번에 생성(Bake)
        walls.forEach(wall => {
            wall.userData.box = new THREE.Box3().setFromObject(wall);
        });

        // 수리 정비소(Repair Station) 생성
        repairStation = new RepairStation(0, 0);

        // 내 탱크 생성
        const spawn = getRandomSpawnPoint();
        myTank = new Tank(myId, myName, true);
        myTank.group.position.set(spawn.x, 0, spawn.z);
        myTank.updateHP(CONFIG.TANK.MAX_HP);

        // 봇 초기화
        spawnBots(CONFIG.BOT.COUNT);

        if (animationId) cancelAnimationFrame(animationId);
        animate();

        window.addEventListener('resize', () => {
            const isPC = window.matchMedia('(pointer: fine)').matches;
            if (isPC) {
                camera.aspect = 1920 / 1080;
                camera.updateProjectionMatrix();
            } else {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
        });
    }
};

window.Game = Game;

WCGames.init({
    id: 'voxel-tank',
    onStart: () => {
        WCGames.Audio.init();
        AudioSFX.init();
        Game.init();
    },
    onPause: () => { },
    onResume: () => { },
    onGameOver: () => { },
    onRestart: () => {
        cleanupInputListeners();
        window.addEventListener('keydown', keyDownHandler);
        window.addEventListener('keyup', keyUpHandler);
        window.addEventListener('mousedown', mouseDownHandler);
        window.addEventListener('mouseup', mouseUpHandler);
        window.addEventListener('mousemove', mouseMoveHandler);
        if (bulletManager) {
            updateHUD();
            const bullets = bulletManager.getBulletArray();
            for (let i = bullets.length - 1; i >= 0; i--) {
                bulletManager.remove(i);
            }
        }
        // 재시작 시 항상 봇 재설정
        if (bots) {
            bots.forEach(b => b.destroy());
            bots.length = 0;
            spawnBots(CONFIG.BOT.COUNT);
        }
        const spawn = getRandomSpawnPoint();
        if (myTank) {
            myTank.group.position.set(spawn.x, 0, spawn.z);
            myTank.updateHP(CONFIG.TANK.MAX_HP);
            myTank.kills = 0;
        }
        updateScoreboard();
    }
});

/**
 * 수동 공습 요청 - K 키로 호출 (현재 위치上方에 전투기 출격)
 */
function triggerManualAirstrike() {
    if (!myTank || myTank.hp <= 0) return;

    showAirstrikeWarning();
    spawnFloatingText(myTank.group.position.clone().add(new THREE.Vector3(0, 3, 0)), "AIR RAID REQUESTED", "#ff3e3e");

    setTimeout(() => {
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = CONFIG.WORLD.SIZE * 1.5;
        const targetX = myTank ? myTank.group.position.x : 0;
        const targetZ = myTank ? myTank.group.position.z : 0;

        const startX = targetX + Math.cos(angle) * spawnDist;
        const startZ = targetZ + Math.sin(angle) * spawnDist;
        const endX = targetX - Math.cos(angle) * spawnDist;
        const endZ = targetZ - Math.sin(angle) * spawnDist;

        const start = new THREE.Vector3(startX, CONFIG.AIRSTRIKE.PLANE_HEIGHT, startZ);
        const end = new THREE.Vector3(endX, CONFIG.AIRSTRIKE.PLANE_HEIGHT, endZ);
        const targetPos = new THREE.Vector3(targetX, 0, targetZ);
        airstrikePlanes.push(new FighterPlane(start, end, targetPos));

        airstrikeWarningActive = false;
    }, 3000);
}

function showAirstrikeWarning() {
    let warningElement = document.getElementById('air-raid-warning');
    if (!warningElement) {
        const div = document.createElement('div');
        div.id = 'air-raid-warning';
        div.style.position = 'fixed';
        div.style.top = '40%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.color = '#ff4d4d';
        div.style.fontSize = '24px';
        div.style.fontWeight = 'bold';
        div.style.textShadow = '0 0 10px #000';
        div.style.zIndex = '1000';
        div.style.pointerEvents = 'none';
        div.style.fontFamily = 'monospace';
        div.innerText = '⚠️ AIR RAID WARNING ⚠️';
        document.body.appendChild(div);
    }
    if (window.AudioSFX) window.AudioSFX.playAirRaidSiren();
    airstrikeWarningActive = true;
}

