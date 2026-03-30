import * as THREE from 'three';
import { CONFIG, seededRandom, lerpAngle, normalizeAngle, getTerrainHeight, encodeHex, decodeHex, packTankData, unpackTankData, getTerrainNormal } from './config.js';
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

        //同一ユーザーによる複数タブでの一意性を確保
        let id = idBase;
        if (sk) {
            id = `${idBase}_${sk.substring(0, 4)}`;
        }

        if (!name) {
            const guestNum = Math.floor(10000 + Math.random() * 89999);
            name = `Guest${guestNum}`;
        }

        // Safety: id should be alphanumeric, name can have Korean
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
const tanks = new Map(); // ID -> 타 플레이어 탱크 인스턴스
const walls = []; // 벽/장애물 메쉬 배열
const trees = []; // 나무 애니메이션용 그룹 배열
const wrecks = []; // 파괴된 탱크 유적 (연기 VFX용)
const bots = []; // 봇 탱크 인스턴스 배열
const powerups = []; // 활성화된 체력 포션 배열
const wallBoxes = []; // 월드 공간 바운딩 박스 캐시
const airstrikePlanes = []; // 활성화된 전투기 배열
const airstrikeBombs = []; // 활성화된 폭격탄 배열
let repairStation; // 단일 수리 정비소 인스턴스
let trackMarkManager; // 발자국 관리자
let bulletManager; // 총알 관리자
let airstrikeWarningActive = false;
let nextAirstrikeTime = 0; // 다음 공습 이벤트 타이머
let supabaseClient; // 실시간 멀티플레이어 클라이언트
let channel; // Supabase 채널
let amIMaster = false; // 마스터 클라이언트 여부
let lastFireTime = 0; // 마지막 발사 시간
let lastSyncTime = 0; // 마지막 동기화 시간
let lastHeartbeatTime = 0; // 마지막 하트비트 시간
let lastSentPos = new THREE.Vector3(); // 마지막으로 전송한 위치
let lastSentRot = 0; // 마지막으로 전송한 회전각
let lastSentTurretRot = 0; // 마지막으로 전송한 포탑 회전각
let lastPowerupSpawnTime = 0; // 마지막 파워업 스폰 시간
let animationId = null; // 애니메이션 프레임 ID
let minimapCanvas, minimapCtx; // 미니맵 캔버스
let cameraShakeTime = 0; // 카메라 흔들림 시간
let currentCameraHeight = (CONFIG && CONFIG.CAMERA && CONFIG.CAMERA.HEIGHT) || 20; // 현재 카메라 높이 (보간용)
let wreckSmokeTimer = 0; // 유적 연기 타이머
let directionalLight; // 그림자-follow용 글로벌 조명
// 모바일 감지: 초당 60번 정규식 실행을 막기 위해 전역에서 1회만 실행
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

/* 파티클 시스템 (VFX 효과) - 총알 발사, 폭발, 연기 등 시각 효과 관리 */
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.MAX_PARTICLES = 500;
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
                gravity: 9.8
            });
            this.group.add(p);
        }
    }

    // 용접 스파크 효과 (3색 조합 + 고중력)
    spawnWeldingSparks(pos) {
        if (this.particles.length >= this.MAX_PARTICLES) return;
        const count = 4 + Math.floor(Math.random() * 6);
        for (let i = 0; i < count; i++) {
            // Palette: Core White, Electric Cyan, Luminous Orange
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
                gravity: 25.0, // Strong gravity for falling effect
                friction: 0.98,
                initialSize: size,
                noShrink: true // Don't shrink, stay small and intense
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

    // NEW: Specialized heal burst effect (정제된 힐 이펙트)
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

    // Specialized smoke effect (연기 효과 - Shrinks over time)
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
                grow: false, // Default shrinking behavior
                gravity: -1.5,
                friction: 0.98
            });
            this.group.add(p);
        }
    }

    // Specialized exhaust effect (배기 효과 - Grows over time)
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
                grow: true, // Growth behavior
                gravity: -0.5,
                friction: 0.98
            });
            this.group.add(p);
        }
    }

    // Specialized fire effect (화염 효과)
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
                gravity: -2.0, // Rises faster than smoke
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

        // 2. Debris (튀는 파편들)
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
                // Only dispose unique materials (smoke/fire), shared ones are in this.materials map
                const isShared = Array.from(this.materials.values()).includes(p.mesh.material);
                if (!isShared) p.mesh.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }

            if (p.gravity) p.vel.y -= p.gravity * dt;
            if (p.friction) p.vel.multiplyScalar(p.friction);

            // In-place addition to avoid .clone()
            p.mesh.position.x += p.vel.x * dt;
            p.mesh.position.y += p.vel.y * dt;
            p.mesh.position.z += p.vel.z * dt;

            p.mesh.material.opacity = p.life / p.maxLife;
            if (p.grow) {
                // Growth for Exhaust
                const growth = 1.0 + (1.0 - p.life / p.maxLife) * 1.5;
                p.mesh.scale.setScalar(growth * (p.initialSize || 1));
            } else if (!p.noShrink) {
                // Shrink for Smoke/Fire (only if noShrink is false)
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
            this.master.gain.setValueAtTime(0.5, this.ctx.currentTime);

            this.limiter = this.ctx.createDynamicsCompressor();
            this.master.connect(this.limiter);
            this.limiter.connect(this.ctx.destination);

            // Preload sounds (Async in background)
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
            // Fallback synthesis if not loaded yet
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
            // High-quality fallback synthesis if not loaded/found
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

        // Pure pitch and volume range (No Filter)
        const pitch = 0.5 + speedRatio * 1.5;
        const volume = 0.3 + Math.pow(speedRatio, 0.8) * 0.7; // 0.3 (30%) to 1.0

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

        // --- Premium High-Tech Medbox ---
        const silver = 0xbdc3c7;
        const white = 0xffffff;
        const red = 0xff1744;

        // 1. Main Case (Advanced shape)
        const body = createVoxelBox(0.8, 0.6, 0.5, white, 0.1, 0.9);
        body.position.y = 0.3;
        this.group.add(body);

        // 2. Side Latches (Detailed parts)
        for (let x of [-0.41, 0.41]) {
            const latch = createVoxelBox(0.05, 0.2, 0.2, silver, 0.8, 0.2);
            latch.position.set(x, 0.3, 0);
            this.group.add(latch);
        }

        // 3. Ergonomic Handle
        const handleL = createVoxelBox(0.05, 0.15, 0.1, silver);
        handleL.position.set(-0.15, 0.65, 0);
        this.group.add(handleL);
        const handleR = createVoxelBox(0.05, 0.15, 0.1, silver);
        handleR.position.set(0.15, 0.65, 0);
        this.group.add(handleR);
        const handleBar = createVoxelBox(0.35, 0.05, 0.1, silver);
        handleBar.position.set(0, 0.73, 0);
        this.group.add(handleBar);

        // 4. Glowing Red Cross Core
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
            // --- 1:1 Visual Match with Bullet (Horizontal) ---
            const s = 1.8;
            const gold = 0xffcc00;
            const copper = 0x8d6e63;
            const yellowTip = 0xffd54f;

            // Use same material params as Bullet (Default matte)
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
            // --- Tactical Off-road Wheel ---
            const dark = 0x2c3e50;
            const silver = 0xbdc3c7;
            const cyan = 0x00e5ff;

            // 1. Tire Tread
            const tire = createVoxelCylinder(0.4, 0.4, 0.25, dark, 0.1, 0.7);
            tire.rotation.x = Math.PI / 2;
            this.group.add(tire);

            // 2. Stylish Rim (X-spokes)
            const rim = new THREE.Group();
            for (let i = 0; i < 2; i++) {
                const spoke = createVoxelBox(0.65, 0.08, 0.08, silver, 0.8, 0.2);
                spoke.rotation.z = (Math.PI / 2) * i + Math.PI / 4;
                rim.add(spoke);
            }
            rim.position.z = 0.05; // Front side
            this.group.add(rim);

            const rimBack = rim.clone();
            rimBack.position.z = -0.05; // Back side
            this.group.add(rimBack);

            // 3. Glowing Hub
            const hub = createVoxelBox(0.15, 0.15, 0.3, cyan);
            this.group.add(hub);

            this.wheelParts = [tire, rim, rimBack, hub];
        } else if (type === 'ARMOR') {
            // --- Heavy Industrial Steel Panel ---
            const steel = 0x7f8c8d;
            const darkSteel = 0x34495e;
            const screwColor = 0xbdc3c7;

            this.plates = new THREE.Group();

            // 1. Main Thick Panel
            const mainBody = createVoxelBox(0.8, 0.8, 0.2, steel, 0.9, 0.1);
            this.plates.add(mainBody);

            // 2. Surface Reinforcement Ribs (Industrial look)
            const ribH = createVoxelBox(0.84, 0.1, 0.22, darkSteel);
            this.plates.add(ribH);
            const ribV = createVoxelBox(0.1, 0.84, 0.22, darkSteel);
            this.plates.add(ribV);

            // 3. Corner Rivets/Screws
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

            // 4. Energy Glow Core (Subtle)
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
            // Spin the entire group around its main axis (Y already rotates the group)
            // But for a wheel effect, spinning around its local axial axis looks better
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
        const darkBody = 0x2d3436;
        const yellowStrip = 0xfdcb6e;
        const lightGray = 0xb2bec3;

        // 1. 폭탄 본체 (끝이 좁아지는 원통형)
        const body = createVoxelCylinder(0.25, 0.25, 0.8, darkBody, 0.3, 0.7);
        body.rotation.x = Math.PI / 2;
        this.group.add(body);

        // 2. 탄두부 (Nose Cone)
        const nose = createVoxelCone(0.25, 0.3, yellowStrip);
        nose.position.z = -0.5;
        nose.rotation.x = Math.PI / 2;
        this.group.add(nose);

        // 3. 꼬리 날개 (안정적인 낙하용)
        for (let i = 0; i < 4; i++) {
            const fin = createVoxelBox(0.05, 0.3, 0.3, lightGray);
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
                const damageFactor = 1.0 - (dist / radius) * 0.5;
                tank.handleHit(damage * damageFactor, "airstrike");
            }
        };

        if (myTank) checkDamage(myTank);
        tanks.forEach(tank => checkDamage(tank));
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

        // --- 스텔스 전투기 (F-22 Raptor Style) ---
        const body = 0x1a1a1a;
        const bodyAccent = 0x2d2d2d;
        const cockpit = 0x00d4aa;
        const engineColor = 0xff6600;
        const wing = 0x252525;
        const tailFin = 0x333333;
        const metal = 0x3a3a3a;

        // 1. 메인 퍼널 (Main Fuselage)
        const fuselage = createVoxelBox(0.7, 0.5, 4.0, body);
        fuselage.position.set(0, 0, 0);
        this.group.add(fuselage);

        // 2. 코 (Sharp Nose)
        const noseMain = createVoxelBox(0.5, 0.35, 0.8, body);
        noseMain.position.set(0, -0.05, -2.4);
        this.group.add(noseMain);
        const noseTip = createVoxelBox(0.25, 0.2, 0.4, bodyAccent);
        noseTip.position.set(0, -0.08, -2.8);
        this.group.add(noseTip);

        // 3. 사이드 섀시 (Engine Bay Doors)
        for (let side of [-1, 1]) {
            const bayDoor = createVoxelBox(0.15, 0.45, 2.2, bodyAccent);
            bayDoor.position.set(side * 0.43, -0.05, 0.8);
            this.group.add(bayDoor);
        }

        // 4. 조종석 캐노피 (Cockpit Canopy)
        const canopyBase = createVoxelBox(0.4, 0.15, 0.8, metal);
        canopyBase.position.set(0, 0.32, -1.2);
        this.group.add(canopyBase);
        const canopyGlass = createVoxelBox(0.35, 0.25, 0.7, cockpit, 0.1, 0.1);
        canopyGlass.position.set(0, 0.42, -1.2);
        this.group.add(canopyGlass);

        // 5. 메인 날개 (Main Delta Wings)
        for (let side of [-1, 1]) {
            const wingBase = createVoxelBox(2.2, 0.06, 1.8, wing);
            wingBase.position.set(side * 1.4, -0.1, 0.3);
            wingBase.rotation.z = side * 0.08;
            this.group.add(wingBase);

            const wingTip = createVoxelBox(0.8, 0.05, 0.4, wing);
            wingTip.position.set(side * 2.6, -0.12, 0.7);
            wingTip.rotation.z = side * 0.15;
            this.group.add(wingTip);

            const wingRear = createVoxelBox(1.8, 0.05, 0.6, wing);
            wingRear.position.set(side * 1.2, -0.1, 1.1);
            this.group.add(wingRear);
        }

        // 6. V형 수직 미익 (Twin Vertical Tails)
        for (let side of [-1, 1]) {
            const vTailMain = createVoxelBox(0.06, 0.9, 0.7, tailFin);
            vTailMain.position.set(side * 0.5, 0.5, 1.5);
            vTailMain.rotation.z = side * 0.3;
            this.group.add(vTailMain);

            const vTailRudder = createVoxelBox(0.05, 0.5, 0.4, bodyAccent);
            vTailRudder.position.set(side * 0.65, 0.6, 1.7);
            vTailRudder.rotation.z = side * 0.35;
            this.group.add(vTailRudder);
        }

        // 7. 수평 미익 (Horizontal Stabilizers)
        const hStab = createVoxelBox(1.6, 0.05, 0.6, wing);
        hStab.position.set(0, 0, 1.8);
        this.group.add(hStab);

        // 8. 트윈 엔진 노즐 (Twin Engine Nozzles)
        for (let side of [-1, 1]) {
            const nozzleOuter = createVoxelCylinder(0.22, 0.25, 0.5, metal, 0.8, 0.2);
            nozzleOuter.position.set(side * 0.28, -0.08, 2.2);
            nozzleOuter.rotation.x = Math.PI / 2;
            this.group.add(nozzleOuter);

            const nozzleInner = createVoxelCylinder(0.15, 0.18, 0.3, engineColor, 0.1, 0.9);
            nozzleInner.position.set(side * 0.28, -0.08, 2.35);
            nozzleInner.rotation.x = Math.PI / 2;
            if (nozzleInner.material) {
                nozzleInner.material.emissive = new THREE.Color(engineColor);
                nozzleInner.material.emissiveIntensity = 1.5;
            }
            this.group.add(nozzleInner);

            const nozzleRing = createVoxelCylinder(0.26, 0.26, 0.08, bodyAccent, 0.9, 0.1);
            nozzleRing.position.set(side * 0.28, -0.08, 2.45);
            nozzleRing.rotation.x = Math.PI / 2;
            this.group.add(nozzleRing);
        }

        // 9. воздухозаборники (Side Air Intakes)
        for (let side of [-1, 1]) {
            const intake = createVoxelBox(0.2, 0.2, 1.2, bodyAccent);
            intake.position.set(side * 0.5, -0.2, 0.5);
            this.group.add(intake);

            const intakeRamp = createVoxelBox(0.15, 0.1, 0.4, metal);
            intakeRamp.position.set(side * 0.55, -0.1, 0.1);
            intakeRamp.rotation.z = side * 0.2;
            this.group.add(intakeRamp);
        }

        // 10. 미사일 베이 (Missile Bays)
        const missileBay = createVoxelBox(0.3, 0.15, 0.8, bodyAccent);
        missileBay.position.set(0, -0.22, -0.8);
        this.group.add(missileBay);

        // 11. 데이터 링크 / 안테나 (Data Link Antenna)
        const antenna = createVoxelBox(0.02, 0.3, 0.02, metal);
        antenna.position.set(0, 0.55, 0.5);
        this.group.add(antenna);
        const antennaDish = createVoxelBox(0.15, 0.08, 0.15, metal);
        antennaDish.position.set(0, 0.7, 0.5);
        this.group.add(antennaDish);

        // 12. 랜딩 기어 도어 (Landing Gear Doors - Closed)
        for (let side of [-1, 1]) {
            const gearDoor = createVoxelBox(0.15, 0.05, 0.25, bodyAccent);
            gearDoor.position.set(side * 0.25, -0.28, -0.3);
            this.group.add(gearDoor);
        }

        // 13. 디스플레이 라이트 (Formation Lights)
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
        const baseColor = 0x252220;
        const metalDark = 0x1a1815;
        const metalAccent = 0x252220;
        const hazardOrange = 0x3a2520;
        const warningStripes = 0x2a2520;
        const techCyan = 0x00d4aa;
        const boltSilver = 0x252220;

        // 6각형 메인 베이스 (Y=0.05)
        const radius = baseSize / 1.7;
        const base = createVoxelCylinder(radius, radius, 0.1, baseColor, 0.2, 0.8, 6);
        base.position.y = 0.05;
        base.rotation.y = Math.PI / 6;
        base.receiveShadow = true;
        this.group.add(base);

        // 6각형 테두리 장식 (Y=0.15로 높임 - 울렁거림 방지)
        const edgeTrim = createVoxelCylinder(radius + 0.1, radius + 0.1, 0.05, metalAccent, 0.4, 0.6, 6);
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
            
            const bolt = createVoxelBox(0.2, 0.2, 0.2, boltSilver);
            bolt.position.set(Math.cos(angle) * dist, 0.25, Math.sin(angle) * dist);
            this.group.add(bolt);

            if (i % 2 === 0) {
                const marker = createVoxelBox(0.4, 0.02, 0.4, warningStripes);
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

            const baseMount = createVoxelBox(1.2, 0.5, 1.2, metalDark, 0.8, 0.2);
            baseMount.position.y = 0.25;
            armGroup.add(baseMount);

            const pivot = createVoxelCylinder(0.3, 0.3, 0.4, metalAccent, 0.9, 0.1);
            pivot.position.y = 0.5;
            pivot.rotation.x = Math.PI / 2;
            armGroup.add(pivot);

            const s1 = createVoxelBox(0.6, 2.5, 0.6, hazardOrange, 0.4, 0.6);
            s1.position.y = 1.6;
            s1.rotation.z = side * 0.35;
            armGroup.add(s1);

            const s2Group = new THREE.Group();
            s2Group.position.set(side * -0.8, 3.2, 0);
            s2Group.rotation.z = side * 1.0;
            armGroup.add(s2Group);

            const s2Body = createVoxelBox(0.5, 2.2, 0.5, hazardOrange, 0.4, 0.6);
            s2Body.position.y = 1.1;
            s2Group.add(s2Body);

            const hydraulic = createVoxelCylinder(0.08, 0.08, 1.5, boltSilver, 0.95, 0.05);
            hydraulic.position.set(side * 0.3, 1.5, 0.2);
            hydraulic.rotation.z = side * 0.3;
            s2Group.add(hydraulic);

            const headBase = createVoxelBox(0.5, 0.4, 0.5, metalDark);
            headBase.position.y = 2.35;
            s2Group.add(headBase);

            const weldingTorch = createVoxelBox(0.15, 0.15, 0.15, 0x1a1a1a);
            weldingTorch.position.set(0, 2.6, 0);
            s2Group.add(weldingTorch);

            const torchTip = createVoxelBox(0.08, 0.5, 0.08, 0xff6b35);
            torchTip.position.set(0, 2.9, 0);
            if (torchTip.material) {
                torchTip.material.emissive = new THREE.Color(0xff6b35);
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
        const metalDark = 0x2d2d2d;
        const hazardOrange = 0xff6b35;
        const techCyan = 0x00d4aa;





        // 6각형 모서리 전구등 (5~6개)
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
            const dist = radius; 
            
            // 조명 지지대
            const lightBase = createVoxelBox(0.4, 0.4, 0.4, 0x1a1a1a);
            lightBase.position.set(Math.cos(angle) * dist, 0.15, Math.sin(angle) * dist);
            lightBase.rotation.y = angle;
            this.group.add(lightBase);

            // 실제 빛나는 전구 부분
            const bulb = createVoxelCylinder(0.12, 0.12, 0.5, 0x00ffff);
            bulb.position.set(Math.cos(angle) * dist, 0.5, Math.sin(angle) * dist);
            if (bulb.material) {
                bulb.material.emissive = new THREE.Color(0x00ffff);
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

                if (Math.random() < 0.6) { // More frequent sparks
                    const hPos = new THREE.Vector3();
                    // [FIX] 니들 팁 끝점에서 파티클 발생
                    arm.tip.getWorldPosition(hPos);
                    const tipOffset = new THREE.Vector3(0, 0.4, 0).applyQuaternion(arm.tip.quaternion);
                    hPos.add(tipOffset);

                    vfx.spawnWeldingSparks(hPos);
                    if (Math.random() < 0.3) {
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
            // 탱크의 정면 방향 계산 (Forward Vector)
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

/* 탱크 클래스 - 플레이어 및 봇의 탱크 시각表現와 로직 관리 */
class Tank {
    /**
     * 탱크 생성자
     * @param {string} id - 탱크 고유 ID
     * @param {string} name - 플레이어 이름
     * @param {boolean} isLocal - 내 탱크 여부
     */
    constructor(id, name, isLocal = false) {
        this.id = id;
        this.name = name || id;
        this.isLocal = isLocal;
        this.kills = 0; // 킬 수
        this.lastSeen = Date.now();
        this.isDead = false;
        this.group = new THREE.Group();

        // 업그레이드 레벨 (0~9)
        this.levelCannon = 0;
        this.levelSpeed = 0;
        this.levelArmor = 0;

        // 기본 스탯
        this.hp = CONFIG.TANK.MAX_HP;
        this.maxHp = CONFIG.TANK.MAX_HP;

        const mainColor = isLocal ? CONFIG.COLORS.SELF : CONFIG.COLORS.OTHER;
        const detailColor = 0x333333;

        // 1.赫尔Group (Lower & Upper) - LEOPARD STYLE (Low & Long)
        this.hullGroup = new THREE.Group();
        this.group.add(this.hullGroup);

        // 메인 바디 (낉고 길게)
        this.body = createVoxelBox(1.35, 0.32, 2.3, mainColor, 0.4, 0.6);
        this.body.position.y = 0.3;
        this.hullGroup.add(this.body);

        // Side Skirts (궤도 가드 - 더 얇고 길게)
        const skirtL = createVoxelBox(0.08, 0.28, 2.25, mainColor, 0.4, 0.6);
        skirtL.position.set(-0.65, 0.35, 0);
        this.hullGroup.add(skirtL);

        const skirtR = createVoxelBox(0.08, 0.28, 2.25, mainColor, 0.4, 0.6);
        skirtR.position.set(0.65, 0.35, 0);
        this.hullGroup.add(skirtR);

        // Side Rivets (Bolts) 디테일
        for (let side of [-0.68, 0.68]) {
            for (let z = -0.8; z <= 0.9; z += 0.4) {
                const rivet = createVoxelBox(0.04, 0.04, 0.04, detailColor);
                rivet.position.set(side, 0.4, z);
                this.hullGroup.add(rivet);
            }
        }

        const guardL = createVoxelBox(0.4, 0.05, 0.4, 0x333333);
        guardL.position.set(-0.48, 0.45, -0.85);
        this.hullGroup.add(guardL);

        const guardR = createVoxelBox(0.4, 0.05, 0.4, 0x333333);
        guardR.position.set(0.48, 0.45, -0.85);
        this.hullGroup.add(guardR);

        // --- Tank Front Details (Removed per user request to eliminate 'bulldozer'/'shield' look) ---





        // Rear Fuel Barrels (보조 연료통 - 길이 절반으로 축소)
        const barrel1 = createVoxelCylinder(0.18, 0.18, 0.3, 0x2d3436, 0.5, 0.5);
        barrel1.position.set(-0.4, 0.4, 1.15);
        barrel1.rotation.x = Math.PI / 2;
        this.hullGroup.add(barrel1);

        const barrel2 = createVoxelCylinder(0.18, 0.18, 0.3, 0x2d3436, 0.5, 0.5);
        barrel2.position.set(0.4, 0.4, 1.15);
        barrel2.rotation.x = Math.PI / 2;
        this.hullGroup.add(barrel2);

        // Rear Decor (배기구 - 차체에 매립하여 삐져나온 부분 수정)
        const exhaustL = createVoxelCylinder(0.08, 0.08, 0.15, 0x111111);
        exhaustL.position.set(-0.48, 0.32, 1.18);
        exhaustL.rotation.x = Math.PI / 2;
        this.hullGroup.add(exhaustL);

        const exhaustR = createVoxelCylinder(0.08, 0.08, 0.15, 0x111111);
        exhaustR.position.set(0.48, 0.32, 1.18);
        exhaustR.rotation.x = Math.PI / 2;
        this.hullGroup.add(exhaustR);

        // --- NEW: Premium Hull Front Details (상단 디자인 고도화) ---
        // 1. Driver's Hatch (조종수 해치)
        const dHatch = createVoxelBox(0.35, 0.06, 0.35, detailColor);
        dHatch.position.set(0, 0.46, -0.75);
        this.hullGroup.add(dHatch);

        // 3-way Periscopes (잠망경)
        for (let ang of [-0.6, 0, 0.6]) {
            const peri = createVoxelBox(0.08, 0.08, 0.06, 0x111111);
            peri.position.set(Math.sin(ang) * 0.15, 0.5, -0.85 + Math.abs(ang) * 0.05);
            peri.rotation.y = -ang;
            this.hullGroup.add(peri);
            // Lens
            const lens = createVoxelBox(0.06, 0.04, 0.01, 0x3498db);
            lens.position.set(peri.position.x, 0.51, peri.position.z - 0.035);
            lens.rotation.y = -ang;
            this.hullGroup.add(lens);
        }

        // 2. Front Headlights (현대적인 LED 헤드라이트)
        for (let side of [-0.55, 0.55]) {
            const lightBox = createVoxelBox(0.12, 0.08, 0.08, 0x222222);
            lightBox.position.set(side, 0.4, -1.05);
            this.hullGroup.add(lightBox);
            // Glowing LED
            const led = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.04, 0.02),
                new THREE.MeshBasicMaterial({ color: 0xffffcc })
            );
            led.position.set(side, 0.4, -1.1);
            this.hullGroup.add(led);
        }

        // 3. Reactive Armor (ERA Blocks - 현대적 장갑)
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 3; col++) {
                const era = createVoxelBox(0.25, 0.06, 0.25, mainColor, 0.5, 0.5);
                const xPos = (col - 1) * 0.35;
                const zPos = -1.0 + row * 0.3;
                era.position.set(xPos, 0.46, zPos);
                // 약간의 랜덤 각도로 투박한 느낌 추가
                era.rotation.x = -0.1;
                this.hullGroup.add(era);
            }
        }

        // 3. Side Tow Cables
        for (let side of [-0.72, 0.72]) {
            const cable = createVoxelBox(0.04, 0.04, 1.4, 0x555555, 0.8, 0.2);
            cable.position.set(side, 0.45, 0);
            this.hullGroup.add(cable);
        }

        // Treads
        this.treads = [
            createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a, 0.1, 0.9),
            createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a, 0.1, 0.9)
        ];
        this.treads[0].position.set(-0.48, 0.15, 0);
        this.treads[1].position.set(0.48, 0.15, 0);
        this.hullGroup.add(this.treads[0], this.treads[1]);

        // Road Wheels (촘촘하게)
        this.wheels = [];
        for (let side of [-0.48, 0.48]) {
            for (let i = 0; i < 7; i++) {
                const wheel = createVoxelCylinder(0.15, 0.15, 0.4, 0x333333);
                wheel.position.set(side, 0.15, -1.05 + i * 0.35);
                wheel.rotation.z = Math.PI / 2;
                this.hullGroup.add(wheel);
                this.wheels.push(wheel);
            }
        }

        // 2. Turret Group
        this.turretGroup = new THREE.Group();
        this.turretGroup.position.y = 0.45; // Lowered to sit on hull top (0.46)
        this.group.add(this.turretGroup);

        // Turret Base (납작한 형태)
        this.turretMain = createVoxelBox(1.0, 0.35, 1.2, mainColor, 0.4, 0.6);
        this.turretMain.position.set(0, 0.1, 0.15);
        this.turretMain.castShadow = true;
        this.turretGroup.add(this.turretMain);

        // Turret Faceted Cheeks (앞으로 갈수록 좁아지는 레오파드 포탑)
        for (let side of [-1, 1]) {
            const cheek = createVoxelBox(0.12, 0.4, 1.0, mainColor, 0.5, 0.5);
            cheek.position.set(0.42 * side, 0.1, -0.2);
            cheek.rotation.y = side > 0 ? 0.35 : -0.35; // Wedge angle
            this.turretGroup.add(cheek);
        }


        // Hatch on turret
        const hatch = createVoxelBox(0.4, 0.1, 0.4, detailColor);
        hatch.position.set(0.18, 0.4, 0.05);
        this.turretGroup.add(hatch);

        // Machine Gun (대공 기관총)
        this.mgGroup = new THREE.Group();
        this.mgGroup.position.set(-0.2, 0.4, 0.1);
        this.turretGroup.add(this.mgGroup);

        const mgBody = createVoxelBox(0.1, 0.12, 0.25, 0x111111, 0.8, 0.2);
        this.mgGroup.add(mgBody);

        const aaMgBarrel = createVoxelBox(0.04, 0.04, 0.4, 0x222222, 0.8, 0.2);
        aaMgBarrel.position.set(0, 0, -0.25);
        this.mgGroup.add(aaMgBarrel);

        // Antenna
        const antenna = createVoxelBox(0.015, 0.9, 0.015, 0x000000);
        antenna.position.set(-0.35, 0.7, 0.3);
        this.turretGroup.add(antenna);

        // --- NEW: Premium Turret Details ---
        // 1. Periscope Optics (Blue Glass)
        const optic = createVoxelBox(0.15, 0.15, 0.12, 0x222222);
        optic.position.set(-0.25, 0.45, -0.3);
        this.turretGroup.add(optic);
        const lens = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.06, 0.02),
            new THREE.MeshBasicMaterial({ color: 0x3498db })
        );
        lens.position.set(-0.25, 0.48, -0.36);
        this.turretGroup.add(lens);

        // 2. Smoke Discharger Batteries
        for (let side of [-0.5, 0.5]) {
            for (let i = 0; i < 3; i++) {
                const launcher = createVoxelCylinder(0.05, 0.05, 0.2, 0x222222);
                launcher.position.set(side, 0.25 + i * 0.05, -0.2 + i * 0.1);
                launcher.rotation.set(0.3, side > 0 ? 0.4 : -0.4, 0);
                this.turretGroup.add(launcher);
            }
        }

        // 3. Rear Stowage (Backpacks/Bins)
        const bin = createVoxelBox(0.7, 0.3, 0.3, mainColor, 0.2, 0.8);
        bin.position.set(0, 0.15, 0.6);
        this.turretGroup.add(bin);

        // 3. Barrel Group (for individual recoil)
        this.barrelGroup = new THREE.Group();
        this.barrelGroup.position.set(0, 0.15, -0.4);
        this.turretGroup.add(this.barrelGroup);

        // Main Barrel (Bore Evacuator 추가)
        this.barrel = new THREE.Group();
        this.barrel.position.set(0, 0, -0.65);
        this.barrel.rotation.x = -Math.PI / 2;
        this.barrelGroup.add(this.barrel);

        // Main Tube
        const tube = createVoxelCylinder(0.08, 0.1, 1.5, detailColor, 0.6, 0.4);
        this.barrel.add(tube);

        // Bore Evacuator (포신 중간 연기 배기장치 - 이미지의 특징)
        const evac = createVoxelCylinder(0.14, 0.14, 0.25, detailColor);
        evac.position.set(0, 0.1, 0); // Middle of tube
        this.barrel.add(evac);

        // Muzzle Brake
        const brakeMain = createVoxelCylinder(0.12, 0.12, 0.15, 0x111111);
        brakeMain.position.y = 0.75;
        this.barrel.add(brakeMain);


        const brakeRing = createVoxelCylinder(0.16, 0.16, 0.05, 0x222222);
        brakeRing.position.y = 0.72;
        this.barrel.add(brakeRing);

        // Muzzle end point for VFX
        this.muzzlePoint = new THREE.Object3D();
        this.muzzlePoint.position.set(0, 0.7, 0); // Corrected for Cylinder (radius-based top)
        this.barrel.add(this.muzzlePoint);

        // UI & Indicators
        if (!isLocal) {
            this.createOverlayUI();
        } else {
            this.indicator = new THREE.Mesh(
                new THREE.ConeGeometry(0.15, 0.3, 3),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.6 })
            );
            this.indicator.rotation.x = -Math.PI / 2;
            this.indicator.position.set(0, 1.5, -1.5);
            this.group.add(this.indicator);
        }

        scene.add(this.group);

        // Audio (Only for local player to avoid sound clutter)
        if (isLocal) {
            this.engineAudio = new TankEngineAudio();
            this.engineAudio.start();
        }

        // Animation States
        this.recoil = 0;
        this.shake = 0;
        this.dustTimer = 0;
        this.damageSmokeTimer = 0;
        this.exhaustTimer = 0;
        this.targetWorldAngle = this.group.rotation.y;
        this.lastFireTime = 0;
        this.trackTimer = 0;
        this.lastTrackPos = null;

        // LOD
        this._lodDistance = 60;
        this._lastLodState = true;

        // Reusable vectors for shoot() to reduce GC
        this._tempPos = new THREE.Vector3();
        this._tempPivotPos = new THREE.Vector3();
        this._tempRight = new THREE.Vector3();
        this._tempDir = new THREE.Vector3();
        this._tempDirL = new THREE.Vector3();
        this._tempDirR = new THREE.Vector3();

        // Armor Visual Groups
        this.hullArmorGroup = new THREE.Group();
        this.group.add(this.hullArmorGroup);

        this.turretArmorGroup = new THREE.Group();
        this.turretGroup.add(this.turretArmorGroup);
    }

    applyUpgrade(type) {
        if (type === 'CANNON') this.levelCannon = Math.min(9, this.levelCannon + 1);
        if (type === 'SPEED') this.levelSpeed = Math.min(9, this.levelSpeed + 1);
        if (type === 'ARMOR') {
            this.levelArmor = Math.min(9, this.levelArmor + 1);
            // Increase Max HP and heal
            const prevMax = this.maxHp;
            this.maxHp = CONFIG.TANK.MAX_HP + (this.levelArmor * CONFIG.UPGRADE.ARMOR.HP_INC);
            this.heal(this.maxHp - prevMax); // Increase current HP by the bonus amount
        }

        this.updateStats();
        this.updateArmorVisual();
        if (this.isLocal) this.updateUpgradeUI();
    }

    updateUpgradeUI() {
        if (!this.isLocal) return;

        const updateItem = (id, level) => {
            const el = document.getElementById(id);
            if (!el) return;

            const levelText = el.querySelector('.level-text');
            const prevLevel = parseInt(levelText?.innerText || "0");

            if (levelText) levelText.innerText = level;

            // Update gauge dots (assuming 5 max levels as shown in HTML)
            const dots = el.querySelectorAll('.gauge-dot');
            dots.forEach((dot, index) => {
                if (index < level) dot.classList.add('active');
                else dot.classList.remove('active');
            });

            // Level-up feedback animation
            if (level > prevLevel) {
                el.classList.remove('level-up');
                void el.offsetWidth; // Force reflow for CSS animation
                el.classList.add('level-up');
                setTimeout(() => el.classList.remove('level-up'), 600);
            }
        };

        updateItem('up-cannon', this.levelCannon);
        updateItem('up-speed', this.levelSpeed);
        updateItem('up-armor', this.levelArmor);

        // Update HP text as well in case maxHp changed
        this.updateHP(this.hp);
    }

    updateStats() {
        // Upgrade bonuses
        this.moveSpeedBonus = this.levelSpeed * CONFIG.UPGRADE.SPEED.MOVE_INC;
        this.rotSpeedBonus = this.levelSpeed * CONFIG.UPGRADE.SPEED.ROT_INC;
    }

    updateArmorVisual() {
        // Clear existing armor parts
        const clear = (group) => {
            while (group.children.length > 0) {
                const child = group.children[0];
                group.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        };
        clear(this.hullArmorGroup);
        clear(this.turretArmorGroup);

        const armorColor = 0x7b87a0; // Steel Gunmetal
        const rivetColor = 0x333333;
        const metal = 0.7;
        const rough = 0.3;

        // --- HULL ARMOR ---

        // Level 1-3: Chunky Side Skirts + Mudguards
        if (this.levelArmor >= 1) {
            for (let side of [-0.72, 0.72]) {
                // Skirts (Segmented & Thick)
                for (let z = -0.7; z <= 0.7; z += 0.35) {
                    const skirt = createVoxelBox(0.15, 0.5, 0.32, armorColor, metal, rough);
                    skirt.position.set(side, 0.3, z);
                    this.hullArmorGroup.add(skirt);
                }

                // Mudguards (Front & Back)
                const frontGuard = createVoxelBox(0.4, 0.1, 0.3, armorColor, metal, rough);
                frontGuard.position.set(side * 0.4, 0.4, -0.9);
                this.hullArmorGroup.add(frontGuard);
            }

            if (this.levelArmor >= 3) {
                // Storage Boxes on side skirts
                for (let side of [-0.8, 0.8]) {
                    const box = createVoxelBox(0.2, 0.25, 0.4, armorColor, metal, rough);
                    box.position.set(side, 0.45, 0.1);
                    this.hullArmorGroup.add(box);
                }
            }
        }

        // Level 4-6: ERA (Explosive Reactive Armor) - Hull & Turret
        if (this.levelArmor >= 4) {
            // Hull Front ERA removed per user request


            // Turret Front ERA (Should turn with turret)
            for (let x of [-0.3, 0.3]) {
                const eraTurret = createVoxelBox(0.25, 0.25, 0.15, armorColor, metal, rough);
                eraTurret.position.set(x, 0.15, -0.4); // Local turret coords
                this.turretArmorGroup.add(eraTurret);
            }
        }

        // Level 7-9: Super Heavy Arsenal
        if (this.levelArmor >= 7) {
            // Massive Side Shields (Spaced Armor) on Turret Cheeks
            for (let side of [-0.7, 0.7]) {
                const shield = createVoxelBox(0.12, 0.55, 1.0, armorColor, metal, rough);
                shield.position.set(side, 0.1, -0.1);
                shield.rotation.y = side > 0 ? -0.2 : 0.2;
                this.turretArmorGroup.add(shield);

                // Reinforcement Bars
                const bar = createVoxelBox(0.2, 0.05, 0.05, rivetColor);
                bar.position.set(side * 0.8, 0.1, 0);
                this.turretArmorGroup.add(bar);
            }

            // Rear Slat Armor (Cage) - Increased density
            for (let x = -0.65; x <= 0.65; x += 0.08) {
                const bar = createVoxelBox(0.04, 0.45, 0.04, rivetColor, 0.5, 0.5);
                bar.position.set(x, 0.45, 1.0);
                this.hullArmorGroup.add(bar);
            }
            for (let y = 0.35; y <= 0.65; y += 0.15) {
                const hBar = createVoxelBox(1.4, 0.04, 0.05, armorColor, metal, rough);
                hBar.position.set(0, y, 1.01);
                this.hullArmorGroup.add(hBar);
            }
        }

        // Level 9: Final Evolution - Turret Roof Plate
        if (this.levelArmor >= 9) {
            // Front Wedge Armor removed per user request

            // Extra Heavy Turret Roof Plate
            const roof = createVoxelBox(0.8, 0.05, 0.8, armorColor, metal, rough);
            roof.position.set(0, 0.45, 0);
            this.turretArmorGroup.add(roof);
        }
    }

    shoot(jitter = 0) {
        if (repairStation) {
            const dist = this.group.position.distanceTo(repairStation.group.position);
            // 수리 반경(RADIUS + 2.0) 내에서는 사격 불가
            if (dist < CONFIG.REPAIR_STATION.RADIUS + 2.0) return;
        }

        const now = Date.now();
        const cooldown = (this.isBot ? (this.stats ? this.stats.fireCooldown : CONFIG.BOT.FIRE_COOLDOWN_RANGE[0]) : CONFIG.TANK.FIRE_COOLDOWN) + jitter;
        if (now - this.lastFireTime < cooldown) return;
        this.lastFireTime = now;

        this.muzzlePoint.getWorldPosition(this._tempPos);
        this.barrelGroup.getWorldPosition(this._tempPivotPos);
        const dir = this._tempPos.clone().sub(this._tempPivotPos).normalize();

        const bulletScale = 1.0 + (Math.min(3, this.levelCannon) * CONFIG.UPGRADE.CANNON.SCALE_INC);
        const bulletDamage = CONFIG.TANK.DAMAGE + (this.levelCannon * CONFIG.UPGRADE.CANNON.DAMAGE_INC);

        const spawnBullet = (startPos, direction) => {
            bulletManager.add(startPos, direction, this.id, bulletDamage, bulletScale);
        };

        if (this.levelCannon < 4) {
            spawnBullet(this._tempPos, dir);
        } else if (this.levelCannon < 7) {
            const quat = this.turretGroup.getWorldQuaternion(new THREE.Quaternion());
            this._tempRight.set(1, 0, 0).applyQuaternion(quat);
            const posL = this._tempPos.clone().add(this._tempRight.clone().multiplyScalar(-0.2));
            const posR = this._tempPos.clone().add(this._tempRight.clone().multiplyScalar(0.2));
            spawnBullet(posL, dir);
            spawnBullet(posR, dir);
        } else {
            const quat = this.turretGroup.getWorldQuaternion(new THREE.Quaternion());
            this._tempRight.set(1, 0, 0).applyQuaternion(quat);
            spawnBullet(this._tempPos, dir);

            this._tempDirL.copy(dir).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.15);
            this._tempDirR.copy(dir).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.15);
            spawnBullet(this._tempPos, this._tempDirL);
            spawnBullet(this._tempPos, this._tempDirR);
        }

        this.playShootEffect();
        if (window.AudioSFX) AudioSFX.playFire();

        // Trigger Recoil Animation
        this.recoil = 1.0;

        // Broadcast if local
        if (this.isLocal && channel) {
            channel.send({
                type: 'broadcast',
                event: 'fire',
                payload: {
                    p: [parseFloat(this._tempPos.x.toFixed(2)), parseFloat(this._tempPos.y.toFixed(2)), parseFloat(this._tempPos.z.toFixed(2))],
                    v: [parseFloat(dir.x.toFixed(2)), parseFloat(dir.y.toFixed(2)), parseFloat(dir.z.toFixed(2))],
                    i: this.id,
                    l: this.levelCannon
                }
            });
        }
    }

    updateAnims(dt, isMoving) {
        if (this.isLocal) {
            this.group.visible = true;
        } else if (camera) {
            const dist = this.group.position.distanceTo(camera.position);
            const lodState = dist < this._lodDistance;
            if (lodState !== this._lastLodState) {
                this.group.visible = lodState;
                this._lastLodState = lodState;
            }
            if (!lodState) return;
        }

        // 트랙마크 생성 (독립적인 매니저에 위임)
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

        // 1. Handle Recoil Recovery
        if (this.recoil > 0) {
            this.recoil = Math.max(0, this.recoil - dt * 4.5);
            // Non-linear recoil for "snappier" feeling
            const curve = Math.pow(this.recoil, 1.5);
            this.barrelGroup.position.z = -0.4 + curve * 0.55; // Shoot back
            this.hullGroup.position.z = curve * 0.15;
            this.hullGroup.rotation.x = -curve * 0.08; // Front tilt up
        } else {
            this.barrelGroup.position.z = THREE.MathUtils.lerp(this.barrelGroup.position.z, -0.4, 0.1);
            this.hullGroup.position.z = THREE.MathUtils.lerp(this.hullGroup.position.z, 0, 0.2);
            this.hullGroup.rotation.x = THREE.MathUtils.lerp(this.hullGroup.rotation.x, 0, 0.2);
        }

        // 2. Idling Wobble (Subtle engine vibration)
        if (!isMoving) {
            const wobble = Math.sin(Date.now() * 0.01) * 0.002;
            this.hullGroup.position.y += wobble;
        }

        // Wheel Rotation
        if (isMoving && this.wheels) {
            this.wheels.forEach(w => w.rotation.x += dt * 10);
        }

        // 2. Idle / Moving Shake (Heavy feel)
        this.shake += dt * (isMoving ? 20 : 10);
        const shakeAmp = isMoving ? 0.015 : 0.005;
        this.hullGroup.position.y = Math.sin(this.shake) * shakeAmp;

        // 3. Premium Exhaust Smoke when moving
        if (isMoving && vfx) {
            this.exhaustTimer += dt;
            if (this.exhaustTimer > 0.08) {
                this.exhaustTimer = 0;

                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
                const exhaustVel = forward.multiplyScalar(2.0);

                for (let xOff of [-0.48, 0.48]) {
                    const exhaustPos = new THREE.Vector3(xOff, 0.65, 1.23).applyMatrix4(this.group.matrixWorld);

                    vfx.spawnExhaust(exhaustPos, 0x99aabb, 1, 0.4, 0.3, 1500);

                    if (Math.random() < 0.4) {
                        vfx.spawnExhaust(exhaustPos, 0x555555, 1, 0.6, 0.25, 800);
                    }
                }
            }
        }

        // 4. Damage Smoke & Fire (HP-based effect)
        const hpPercent = this.hp / this.maxHp;
        if (hpPercent <= 0.5 && vfx) {
            if (!this.damageSmokeTimer) this.damageSmokeTimer = 0;

            let interval = 0.3;
            let smokeCount = 2;
            let smokeSize = 0.35;
            let smokeLife = 2000;
            let fireCount = 0;

            if (hpPercent <= 0.15) {
                interval = 0.02; smokeCount = 8; smokeSize = 0.8; smokeLife = 4000; fireCount = 6;
            } else if (hpPercent <= 0.25) {
                interval = 0.06; smokeCount = 5; smokeSize = 0.6; smokeLife = 3000; fireCount = 4;
            } else if (hpPercent <= 0.35) {
                interval = 0.12; smokeCount = 3; smokeSize = 0.5; smokeLife = 2500; fireCount = 3;
            } else if (hpPercent <= 0.45) {
                interval = 0.2; smokeCount = 2; smokeSize = 0.4; smokeLife = 2000; fireCount = 2;
            }

            this.damageSmokeTimer += dt;
            if (this.damageSmokeTimer > interval) {
                this.damageSmokeTimer = 0;

                for (let i = 0; i < smokeCount; i++) {
                    const smokePos = new THREE.Vector3(
                        (Math.random() - 0.5) * 1.2,
                        0.5 + Math.random() * 0.6,
                        (Math.random() - 0.5) * 1.2
                    );
                    smokePos.applyMatrix4(this.group.matrixWorld);

                    vfx.spawnSmoke(smokePos, 0x1a1a1a, 1, 0.2, smokeSize, smokeLife);

                    if (hpPercent <= 0.25) {
                        vfx.spawnSmoke(smokePos, 0x333333, 1, 0.25, smokeSize * 0.8, smokeLife * 0.8);
                    }
                }

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

    playShootEffect() {
        this.recoil = 1.0;
        if (this.isLocal) {
            cameraShakeTime = 0.5;
            AudioSFX.playFire();
        }
        if (vfx) {
            const worldPos = new THREE.Vector3();
            this.muzzlePoint.getWorldPosition(worldPos);
            const pivotPos = new THREE.Vector3();
            this.barrelGroup.getWorldPosition(pivotPos);
            const worldDir = worldPos.clone().sub(pivotPos).normalize();

            vfx.spawnMuzzleFlash(worldPos, worldDir, 0xffcc00);
            vfx.spawn(worldPos, 0xff6600, 8, 3, 0.15, 400);
            vfx.spawn(worldPos, 0x333333, 6, 1.5, 0.12, 600);

            const casingPos = new THREE.Vector3();
            this.group.getWorldPosition(casingPos);
            casingPos.x += 0.3;
            casingPos.y += 0.4;
            vfx.spawnExhaust(casingPos, 0x8d6e63, 1, 1.5, 0.05, 300);
        }
        if (this.isLocal && camera) {
            cameraShakeTime = 0.3;
        }
    }

    createOverlayUI() {
        // Simple sprite-based health bar or handled via HTML overlay in sync
    }

    updateHP(hp) {
        this.hp = Math.max(0, Math.min(this.maxHp, hp));
        if (this.isLocal) {
            const fillEl = document.getElementById('hp-fill');
            const textEl = document.getElementById('status-text');
            if (fillEl) fillEl.style.width = `${(this.hp / this.maxHp) * 100}%`;
            if (textEl) textEl.textContent = Math.round(this.hp);
        }
    }

    heal(amount) {
        if (this.hp <= 0) return;
        this.updateHP(this.hp + amount);

        // --- Enhanced Effects ---
        if (vfx) vfx.spawnHeal(this.group.position);
        if (window.AudioSFX) AudioSFX.playHeal();

        // Visual text feedback
        spawnFloatingText(this.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), `+${Math.round(amount)}`);

        if (this.isLocal) {
            syncMultiplayer();
        }
    }

    handleHit(damage, shooterId) {
        if (this.hp <= 0) return; // Already dead

        this.updateHP(this.hp - damage);

        // If I am hit, I need to broadcast my new HP immediately
        if (this.isLocal) {
            syncMultiplayer();

            // If I died, I broadcast the death event so everyone knows who killed me
            if (this.hp <= 0) {
                if (channel) {
                    channel.send({
                        type: 'broadcast',
                        event: 'death',
                        payload: { i: myId, k: shooterId }
                    });
                }

                // Give 3 seconds to watch the explosion before showing game over screen
                setTimeout(() => {
                    WCGames.gameOver(this.kills);
                }, 3000);
            }
        }
        // Explosion sound and VFX for ANY tank dying
        if (this.hp <= 0) {
            this.isDead = true;
            if (window.AudioSFX) window.AudioSFX.playExplosion();
            if (vfx) vfx.spawnExplosion(this.group.position);

            // Find who shot this and increment their kills
            const allTanks = [myTank, ...Array.from(tanks.values()), ...bots];
            const killer = allTanks.find(t => t && t.id === shooterId);
            if (killer) {
                killer.kills++;
                updateScoreboard();

                // NEW: Grant kill reward
                grantKillReward(killer);

                if (killer.isLocal) {
                    syncMultiplayer();
                    if (window.WCGames && window.WCGames.submitScore) {
                        window.WCGames.submitScore(killer.kills);
                    }
                }
            }
        }
    }

    destroy() {
        scene.remove(this.group);
        if (this.engineAudio) this.engineAudio.stop();
    }
}

/* 봇 클래스 - AI-controlled 탱크 (Tank 클래스 상속) */
class Bot extends Tank {
    /**
     * 봇 생성자
     * @param {string} id - 봇 고유 ID
     * @param {string} name - 봇 이름
     * @param {number} syncedColor - 동기화된 색상
     */
    constructor(id, name, syncedColor = null) {
        super(id, name, false);
        this.isBot = true;

        // 개별 지능 및 성능(Stats) 할당
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
        this.state = 'WANDER';
        this.stateTimer = 0;
        this.strafeTimer = 0;
        this.aimJitter = (Math.random() - 0.5) * this.stats.aimJitterMax;
        this.aimJitterTimer = 0;
        this.blockedTimer = 0;
        this.strafeDir = Math.random() < 0.5 ? 1 : -1;

        this.color = syncedColor || (CONFIG.BOT && CONFIG.BOT.COLORS ? CONFIG.BOT.COLORS[Math.floor(Math.random() * CONFIG.BOT.COLORS.length)] : 0x9933ff);

        // Reusable vectors for AI
        this._aiTargetVec = new THREE.Vector3();
        this._aiForward = new THREE.Vector3();
        this._aiDir = new THREE.Vector3();
        this._aiFirePos = new THREE.Vector3();
        this._aiWanderTarget = new THREE.Vector3();
        this._aiWanderForward = new THREE.Vector3();

        if (this.body && this.body.material) {
            this.body.material.color.set(this.color);
        }
        if (this.turret && this.turret.material) {
            this.turret.material.color.set(this.color);
        }
    }

    updateAI(dt) {
        if (this.hp <= 0) return;

        // 1. Target Selection (Nearest player or bot)
        let nearestDist = this.stats.detectionRange;
        let potentialTarget = null;

        // Check all potential targets
        const possibleTargets = [];
        if (myTank && myTank.hp > 0) possibleTargets.push(myTank);
        tanks.forEach(t => { if (t.hp > 0) possibleTargets.push(t); });
        bots.forEach(b => {
            if (b !== this && b.hp > 0) possibleTargets.push(b);
        });

        for (const target of possibleTargets) {
            const d = this.group.position.distanceTo(target.group.position);
            if (d < nearestDist) {
                nearestDist = d;
                potentialTarget = target;
            }
        }

        this.target = potentialTarget;

        if (this.target) {
            this.state = 'ATTACK';
        } else {
            this.state = 'WANDER';
        }

        // 2. State Execution
        if (this.state === 'ATTACK') {
            const targetPos = this.target.group.position;
            const dx = targetPos.x - this.group.position.x;
            const dz = targetPos.z - this.group.position.z;
            const dist = this.group.position.distanceTo(targetPos);

            // 1. Calculate Target Angle for Hull (Strafing & Distance control)
            this.strafeTimer -= dt;
            if (this.strafeTimer <= 0) {
                this.strafeTimer = 1 + Math.random() * 2;
                this.strafeDir = Math.random() < 0.5 ? 1 : -1;
            }

            // Dist control: steer more towards or away depending on range
            let offset = (Math.PI / 2) * this.strafeDir;
            let moveDir = 1; // Default to forward

            if (dist > 30) {
                offset *= 0.3; // Point more towards target
            } else if (dist < 15) {
                // If too close, try to maintain distance while strafing
                offset *= 1.2;
                if (dist < 10) moveDir = -0.5; // Back up slowly if very close
            }

            const angleToTarget = Math.atan2(-dx, -dz);
            const hullTargetAngle = angleToTarget + offset;

            // Rotate hull (Using Individual speed)
            let hullRotDiff = hullTargetAngle - this.group.rotation.y;
            while (hullRotDiff < -Math.PI) hullRotDiff += Math.PI * 2;
            while (hullRotDiff > Math.PI) hullRotDiff -= Math.PI * 2;
            const hullStep = this.stats.rotateSpeed * dt;
            this.group.rotation.y += Math.max(-hullStep, Math.min(hullStep, hullRotDiff));

            // 2. Rotate turret independently (Aim at target)
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

            // 3. Movement with better wall handling (Curved Steering for Bots)
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
                }
            }

            const turretWorldAngle = this.group.rotation.y + this.turretGroup.rotation.y;
            this._aiDir.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), turretWorldAngle);
            const targetDirRaw = new THREE.Vector3(dx, 0, dz).normalize();
            const dot = this._aiDir.dot(targetDirRaw);

            if (dot > this.stats.firingThreshold && dist < this.stats.attackRange) {
                // Line of Sight Check before shooting
                const firePos = new THREE.Vector3();
                this.muzzlePoint.getWorldPosition(firePos);
                const targetCenterPos = targetPos.clone().add(new THREE.Vector3(0, 0.5, 0)); // Aim at body center

                if (checkLineOfSight(firePos, targetCenterPos)) {
                    this.shoot();
                }
            }
        } else {
            // WANDER
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.stateTimer = 1 + Math.random() * 2;
                this.wanderAngle = (Math.random() - 0.5) * Math.PI * 2;
            }

            let wanderRotDiff = this.wanderAngle - this.group.rotation.y;
            while (wanderRotDiff < -Math.PI) wanderRotDiff += Math.PI * 2;
            while (wanderRotDiff > Math.PI) wanderRotDiff -= Math.PI * 2;
            const wanderStep = (CONFIG.TANK.ROTATE_SPEED + (this.rotSpeedBonus || 0)) * dt;
            this.group.rotation.y += Math.max(-wanderStep, Math.min(wanderStep, wanderRotDiff));

            // Move forward with Curved Steering during wandering
            const wanderAlignment = Math.max(0, Math.cos(wanderRotDiff));
            const wanderSpeedScale = Math.pow(wanderAlignment, 0.4);

            if (wanderSpeedScale > 0.1) {
                this._aiWanderTarget.set(-Math.sin(this.wanderAngle), 0, -Math.cos(this.wanderAngle));
                this._aiWanderForward.set(-Math.sin(this.group.rotation.y), 0, -Math.cos(this.group.rotation.y));
                const blendedWanderDir = this._aiWanderForward.clone().multiplyScalar(0.8).add(this._aiWanderTarget.multiplyScalar(0.2)).normalize();

                if (!this.move(1.0 * wanderSpeedScale, dt, blendedWanderDir)) {
                    this.wanderAngle = (Math.random() - 0.5) * Math.PI * 2;
                    this.stateTimer = 0.5;
                }
            }

            // --- Auto-Center Turret during WANDER ---
            const wanderTurretStep = CONFIG.TANK.TURRET_ROTATE_SPEED * dt;
            let wanderTurretRotDiff = 0 - this.turretGroup.rotation.y; // 0 is forward relative to hull
            while (wanderTurretRotDiff < -Math.PI) wanderTurretRotDiff += Math.PI * 2;
            while (wanderTurretRotDiff > Math.PI) wanderTurretRotDiff -= Math.PI * 2;
            this.turretGroup.rotation.y += Math.max(-wanderTurretStep, Math.min(wanderTurretStep, wanderTurretRotDiff));
        }

        // Ensure bots stay in bounds
        const halfSize = (CONFIG.WORLD.SIZE / 2) - 5;
        this.group.position.x = Math.max(-halfSize, Math.min(halfSize, this.group.position.x));
        this.group.position.z = Math.max(-halfSize, Math.min(halfSize, this.group.position.z));

        // Proactive Wall Avoidance (Check ahead)
        this._aiForward.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y);
        const probeDist = 3.5;
        const probePos = this.group.position.clone().add(this._aiForward.clone().multiplyScalar(probeDist));

        if (!isPositionSafe(probePos.x, probePos.z)) {
            this.blockedTimer += dt;
            this.group.rotation.y += this.strafeDir * dt * (3.0 + (this.rotSpeedBonus || 0));

            if (this.blockedTimer > 0.5) {
                this.move(-0.6, dt);
            }
        } else {
            this.blockedTimer = Math.max(0, this.blockedTimer - dt);
        }
    }

    move(dir, dt, customDir = null) {
        const moveSpeed = (dir >= 0 ? this.stats.forwardSpeed : this.stats.backwardSpeed) + (this.moveSpeedBonus || 0);
        const speed = moveSpeed * dir;
        const moveVec = customDir ? customDir.clone() : new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y);
        const nextPos = this.group.position.clone().add(moveVec.multiplyScalar(speed * dt));

        if (isPositionSafe(nextPos.x, nextPos.z)) {
            this.group.position.copy(nextPos);
            return true;
        }
        return false;
    }

    handleHit(damage, shooterId) {
        if (this.hp <= 0) return;
        super.updateHP(this.hp - damage);

        // React to hit (Panic / Dodge)
        if (this.hp > 0) {
            this.strafeDir *= -1;
            this.strafeTimer = 1 + Math.random();
            this.wanderAngle = (Math.random() - 0.5) * Math.PI * 2;
            if (this.isLocal && camera) cameraShakeTime = 0.2;
        }

        if (this.hp <= 0) {
            this.isDead = true;
            if (vfx) vfx.spawnExplosion(this.group.position);
            // Find who shot this
            const allTanks = [myTank, ...Array.from(tanks.values()), ...bots];
            const killer = allTanks.find(t => t && t.id === shooterId);
            if (killer) {
                killer.kills++;
                updateScoreboard();

                // NEW: Grant kill reward
                grantKillReward(killer);

                if (killer.isLocal) {
                    syncMultiplayer();
                    if (window.WCGames && window.WCGames.submitScore) {
                        window.WCGames.submitScore(killer.kills);
                    }
                }
            }
            if (window.AudioSFX) AudioSFX.playExplosion();
            this.destroy();
            // Remove from bots array
            const idx = bots.indexOf(this);
            if (idx !== -1) bots.splice(idx, 1);

            // Respawn after 5 seconds
            setTimeout(() => spawnBots(1), 5000);
        }
    }
}

/* 5. 입력 처리 (포인터, 키보드, 모바일 조이스틱) */
const keys = {}; // 키보드 상태 저장
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

// 마우스 버튼 상태 관리
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

// 모바일 조이스틱 입력 (-1~1 범위)
const joystickLeft = { x: 0, y: 0 }; // 이동용
const joystickRight = { x: 0, y: 0 }; // 조준용

// Initialize Input tracking if not provided by core
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

// Cleanup function for game restart
function cleanupInputListeners() {
    window.removeEventListener('keydown', keyDownHandler);
    window.removeEventListener('keyup', keyUpHandler);
    window.removeEventListener('mousedown', mouseDownHandler);
    window.removeEventListener('mouseup', mouseUpHandler);
    window.removeEventListener('mousemove', mouseMoveHandler);
}

function setupJoysticks() {
    const el = document.getElementById('joystick-left');
    if (el) { // Check if element exists before setting up
        const setup = (id, target) => {
            const el = document.getElementById(id);
            if (!el) return; // UI 요소가 제거된 경우를 대비한 안전 코드
            let active = false;
            let startPos = { x: 0, y: 0 };
            let touchId = null;
            const knob = el.querySelector('.joystick-knob');

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
                const dist = Math.min(40, Math.sqrt(dx * dx + dy * dy));
                const angle = Math.atan2(dy, dx);

                const moveX = Math.cos(angle) * dist;
                const moveY = Math.sin(angle) * dist;
                knob.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;

                target.x = moveX / 40;
                target.y = moveY / 40;

                if (e.cancelable) e.preventDefault();
            };

            const handleStart = (e) => {
                if (active) return;
                const touch = e.touches ? e.changedTouches[0] : e;
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
                    if (found) return; // This touch is still active
                }

                active = false;
                touchId = null;
                knob.style.transform = `translate(-50%, -50%)`;
                target.x = 0;
                target.y = 0;
            };

            window.addEventListener('touchstart', handleStart, { passive: false });
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);
            window.addEventListener('touchcancel', handleEnd);

            window.addEventListener('mousedown', handleStart);
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
        };

        setup('joystick-left', joystickLeft);
        // joystick-right는 사용자의 요청에 의해 제거됨 (모바일 자동 조준 활용)
    }
}

function spawnBots(count) {
    for (let i = 0; i < count; i++) {
        const spawn = getRandomSpawnPoint();
        const botId = `bot_${Math.random().toString(36).substring(2, 7)}`;
        const botNum = Math.floor(10000 + Math.random() * 89999);
        const botName = `${CONFIG.BOT.NAME_PREFIX}${botNum}`;
        const bot = new Bot(botId, botName);
        bot.group.position.set(spawn.x, 0, spawn.z);
        bots.push(bot);
    }
}

/* 6. 게임 로직 (업데이트, 충돌, 동기화) */
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

    const allPlayers = Array.from(tanks.values());
    if (myTank) allPlayers.push(myTank);
    bots.forEach(b => allPlayers.push(b));

    // 유저는 항상 보여주고, AI 봇은 킬수가 0인 경우 제외
    const displayedPlayers = allPlayers.filter(p => p.isLocal || !p.isBot || p.kills > 0);

    displayedPlayers.sort((a, b) => b.kills - a.kills);

    scoreboard.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">
            Kills
        </div>
        ${displayedPlayers.map(p => `
            <div class="scoreboard-item" style="color: ${p.isLocal ? '#4d79ff' : (p.isBot ? '#e0e0e0' : '#ff4d4d')}">
                <span>${p.name || p.id}${p.isLocal ? ' (ME)' : ''}</span>
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

function renderMinimap() {
    if (!minimapCanvas || !minimapCtx) return;
    const size = 100;
    const mapScale = size / (CONFIG.WORLD.SIZE * 2);
    const mapCenter = size / 2;

    minimapCtx.clearRect(0, 0, size, size);
    minimapCtx.fillStyle = 'rgba(40, 40, 40, 0.2)';
    minimapCtx.fillRect(0, 0, size, size);

    if (repairStation) {
        const rsX = mapCenter + repairStation.group.position.x * mapScale;
        const rsZ = mapCenter + repairStation.group.position.z * mapScale;
        minimapCtx.fillStyle = '#00ff00';
        minimapCtx.beginPath();
        minimapCtx.arc(rsX, rsZ, 3, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    tanks.forEach(tank => {
        if (tank.hp <= 0) return;
        const tx = mapCenter + tank.group.position.x * mapScale;
        const tz = mapCenter + tank.group.position.z * mapScale;
        minimapCtx.fillStyle = '#ff4444';
        minimapCtx.beginPath();
        minimapCtx.arc(tx, tz, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    bots.forEach(bot => {
        if (bot.hp <= 0) return;
        const bx = mapCenter + bot.group.position.x * mapScale;
        const bz = mapCenter + bot.group.position.z * mapScale;
        minimapCtx.fillStyle = '#ff6600';
        minimapCtx.beginPath();
        minimapCtx.arc(bx, bz, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    });

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
function update(dt) {
    const now = Date.now();

    // 수리 정비소(Repair Station) 상태 업데이트
    if (repairStation) repairStation.update(dt);

    renderMinimap();

    // 발자국 업데이트 (독립적으로 관리)
    if (trackMarkManager) trackMarkManager.update();

    // 1. 플레이어 탱크 업데이트 (플레이 중이며 살아있을 때만)
    if (WCGames.state === 'PLAYING' && myTank && myTank.hp > 0) {
        // 1. Input Detection & Source Selection
        const isJoystickActive = Math.abs(joystickLeft.x) > 0.1 || Math.abs(joystickLeft.y) > 0.1;
        const isKeyboardMoving = keys['w'] || keys['KeyW'] || keys['ArrowUp'] || keys['s'] || keys['KeyS'] || keys['ArrowDown'];
        const isKeyboardRotating = keys['a'] || keys['KeyA'] || keys['ArrowLeft'] || keys['d'] || keys['KeyD'] || keys['ArrowRight'];

        if (isJoystickActive) {
            // --- MOBILE/JOYSTICK LOGIC (Absolute Directional Control) ---
            const nx = joystickLeft.x;
            const nz = joystickLeft.y;
            const inputMag = Math.sqrt(nx * nx + nz * nz);
            const moveMag = Math.min(1.0, inputMag);
            const targetAngle = Math.atan2(-nx, -nz);

            const rotBoost = 1.0 + (moveMag * 0.2);
            myTank.group.rotation.y = lerpAngle(myTank.group.rotation.y, targetAngle, CONFIG.TANK.ROTATE_SPEED * rotBoost * dt);

            const currentAngle = myTank.group.rotation.y;
            const angleDiff = Math.abs(normalizeAngle(targetAngle - currentAngle));
            const alignmentFactor = Math.max(0, Math.cos(angleDiff));
            const speedScale = Math.pow(alignmentFactor, 0.4);

            if (speedScale > 0.05) {
                const currentSpeed = (CONFIG.TANK.FORWARD_SPEED + (myTank.moveSpeedBonus || 0));
                const forwardX = -Math.sin(currentAngle);
                const forwardZ = -Math.cos(currentAngle);

                let moveX = (forwardX * 0.8) + (nx * 0.2);
                let moveZ = (forwardZ * 0.8) + (nz * 0.2);
                const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
                moveX /= moveLen;
                moveZ /= moveLen;

                const actualMove = moveMag * currentSpeed * dt * speedScale;
                myTank.group.position.x += moveX * actualMove;
                myTank.group.position.z += moveZ * actualMove;

                if (myTank.engineAudio) myTank.engineAudio.update(moveMag * speedScale);
                myTank.updateAnims(dt, true);
            } else {
                if (myTank.engineAudio) myTank.engineAudio.update(0.2);
                myTank.updateAnims(dt, false);
            }
        } else {
            // --- PC/KEYBOARD LOGIC (Traditional Tank Controls: W/S Move, A/D Rotate) ---
            let moveDir = 0;
            if (keys['w'] || keys['KeyW'] || keys['ArrowUp']) moveDir = 1.0;
            else if (keys['s'] || keys['KeyS'] || keys['ArrowDown']) moveDir = -0.7; // Backwards is slower

            // --- DEBUG: Manual Airstrike Trigger (Press 'K') ---
            if (keys['KeyK'] && now > (myTank.lastKTrigger || 0) + 1000) {
                myTank.lastKTrigger = now;
                triggerManualAirstrike();
            }

            // Direct rotation handle (A/D)
            const rotSpeed = CONFIG.TANK.ROTATE_SPEED * (1.1 + (Math.abs(moveDir) * 0.2));
            if (keys['a'] || keys['KeyA'] || keys['ArrowLeft']) myTank.group.rotation.y += rotSpeed * dt;
            if (keys['d'] || keys['KeyD'] || keys['ArrowRight']) myTank.group.rotation.y -= rotSpeed * dt;

            if (moveDir !== 0) {
                const currentAngle = myTank.group.rotation.y;
                const currentSpeed = (CONFIG.TANK.FORWARD_SPEED + (myTank.moveSpeedBonus || 0));

                // Move along the current heading
                const dirX = -Math.sin(currentAngle) * moveDir;
                const dirZ = -Math.cos(currentAngle) * moveDir;
                const actualMove = currentSpeed * dt;

                myTank.group.position.x += dirX * actualMove;
                myTank.group.position.z += dirZ * actualMove;

                if (myTank.engineAudio) myTank.engineAudio.update(1.0);
                myTank.updateAnims(dt, true);
            } else {
                // Not moving, check if rotating for engine sound
                const isRotating = (keys['a'] || keys['KeyA'] || keys['ArrowLeft'] || keys['d'] || keys['KeyD'] || keys['ArrowRight']);
                if (myTank.engineAudio) myTank.engineAudio.update(isRotating ? 0.3 : 0.0);
                myTank.updateAnims(dt, false);
            }
        }

        myTank.hullGroup.rotation.x = 0;
        myTank.hullGroup.rotation.z = 0;

        // Turret Rotation (Mouse / Right Joystick / Auto)
        let targetTurretAngle = null;
        let isManualAim = false;

        // 1. Right Joystick Aim
        if (Math.abs(joystickRight.x) > 0.1 || Math.abs(joystickRight.y) > 0.1) {
            targetTurretAngle = Math.atan2(-joystickRight.x, -joystickRight.y);
            isManualAim = true;
            if (Math.sqrt(joystickRight.x ** 2 + joystickRight.y ** 2) > 0.8) fire();
        }
        // 2. Mouse Aim (PC)
        else if (window.matchMedia('(pointer: fine)').matches && window.WCGames.input && window.WCGames.input.mouse) {
            const raycaster = new THREE.Raycaster();
            const mouseCoord = new THREE.Vector2(
                (WCGames.input.mouse.x / window.innerWidth) * 2 - 1,
                -(WCGames.input.mouse.y / window.innerHeight) * 2 + 1
            );
            raycaster.setFromCamera(mouseCoord, camera);
            const intersects = raycaster.intersectObject(scene.getObjectByName('raycast-floor'), true);
            if (intersects.length > 0) {
                const pt = intersects[0].point;
                // Only override if mouse button is pressed OR user is actively aiming far away
                const distToMouse = myTank.group.position.distanceTo(pt);
                if (mouseButtons.right || distToMouse > 15) {
                    targetTurretAngle = Math.atan2(myTank.group.position.x - pt.x, myTank.group.position.z - pt.z);
                    isManualAim = true;
                }
            }
        }

        // 3. Auto Aim (Priority if not actively overriding)
        const nearestEnemyPos = findNearestEnemy(myTank.group.position, CONFIG.TANK.DETECTION_RANGE);

        if (!isManualAim && nearestEnemyPos) {
            targetTurretAngle = Math.atan2(myTank.group.position.x - nearestEnemyPos.x, myTank.group.position.z - nearestEnemyPos.z);

            // Auto Fire Check
            const currentWorldAngle = myTank.turretGroup.rotation.y + myTank.group.rotation.y;
            const angleDiff = Math.abs(normalizeAngle(currentWorldAngle - targetTurretAngle));
            const distToEnemy = myTank.group.position.distanceTo(nearestEnemyPos);

            // Sync attack range with TANK config
            if (angleDiff < 0.2 && distToEnemy < CONFIG.TANK.ATTACK_RANGE) {
                fire();
            }
        } else if (!isManualAim) {
            // No enemy found and not manual aiming -> Return turret to forward direction
            targetTurretAngle = myTank.group.rotation.y;
        }


        if (targetTurretAngle !== null) myTank.targetWorldAngle = targetTurretAngle;

        // Smooth rotation
        const currentWorldAngle = myTank.turretGroup.rotation.y + myTank.group.rotation.y;
        const nextWorldAngle = lerpAngle(currentWorldAngle, myTank.targetWorldAngle, CONFIG.LERP_SPEED.TURRET * dt);
        myTank.turretGroup.rotation.y = nextWorldAngle - myTank.group.rotation.y;

        // if (mouseButtons.left) fire(); // Mouse click fire disabled as requested


        // Collisions
        checkCollisions();

        // 8. Reverted Camera Follow (Top-down Fixed Offset)

        // --- Dynamic Camera Height (Airstrike Zoom) ---
        const warningElement = document.getElementById('air-raid-warning');
        const warningActive = (warningElement && warningElement.style.display !== 'none');
        
        // 사이렌 시작 시점 계산 (공습 예정 시간 - 경보 시간)
        const warningDuration = (CONFIG.AIRSTRIKE.WARNING_DURATION || 3) * 1000;
        const sirenStartTime = nextAirstrikeTime - warningDuration;
        const zoomDelay = (CONFIG.CAMERA.SIREN_ZOOM_DELAY || 3) * 1000;
        
        // 사이렌 시작 후 지정된 딜레이가 지났거나, 비행기 혹은 폭탄이 존재하는 경우 줌 아웃 유지
        const isZoomActive = (warningActive && (now > sirenStartTime + zoomDelay)) || airstrikePlanes.length > 0 || airstrikeBombs.length > 0;
        const targetHeight = isZoomActive ? (CONFIG.CAMERA.SIREN_HEIGHT || 40) : CONFIG.CAMERA.HEIGHT;
        
        // 부드러운 높이 보간 (Lerp)
        currentCameraHeight = THREE.MathUtils.lerp(currentCameraHeight, targetHeight, dt * 1.5);

        let camX = myTank.group.position.x;
        let camY = currentCameraHeight;
        let camZ = myTank.group.position.z + CONFIG.CAMERA.OFFSET_Z;

        // Add Screen Shake
        if (cameraShakeTime > 0) {
            cameraShakeTime -= dt;
            const shake = 0.3;
            camX += (Math.random() - 0.5) * shake;
            camY += (Math.random() - 0.5) * shake;
            camZ += (Math.random() - 0.5) * shake;
        }

        camera.position.set(camX, camY, camZ);
        camera.lookAt(myTank.group.position);

        // --- Shadow Follow ---
        if (directionalLight) {
            directionalLight.position.set(camX + 30, 50, camZ + 10);
            directionalLight.target.position.set(camX, 0, camZ);
            directionalLight.target.updateMatrixWorld();
        }
    }

    // 2. Other Tanks Anim Update
    tanks.forEach(tank => {
        tank.updateAnims(dt, true);
    });

    // 2. Local Bots Update (Everyone manages their own bots independently)
    bots.forEach(bot => {
        bot.updateAnims(dt, true);
        bot.updateAI(dt);

        bot.group.position.y = 0;
        bot.hullGroup.rotation.x = 0;
        bot.hullGroup.rotation.z = 0;
    });

    // --- PowerUp Spawning (Local only) ---
    if (now - lastPowerupSpawnTime > CONFIG.POWERUP.SPAWN_INTERVAL * 1000 && powerups.length < CONFIG.POWERUP.MAX_COUNT) {
        lastPowerupSpawnTime = now;
        const spawn = getRandomSpawnPoint();
        const id = `lp_${Math.random().toString(36).substring(2, 7)}`;
        const p = new HealthPotion(id, new THREE.Vector3(spawn.x, 0, spawn.z));
        powerups.push(p);
    }

    // --- Local PowerUp Update & Collision ---
    const currentTime = Date.now() * 0.001;
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.update(dt, currentTime);

        // Check collision for both player and bots
        const candidates = [myTank, ...bots];
        for (const tank of candidates) {
            if (!tank || tank.hp <= 0) continue;

            const dist = tank.group.position.distanceTo(p.group.position);
            if (dist < 1.5) {
                tank.heal(CONFIG.POWERUP.HEAL_AMOUNT);
                spawnFloatingText(tank.group.position.clone().add(new THREE.Vector3(0, 2, 0)), "HP UP", "#27ae60");
                p.destroy();
                powerups.splice(i, 1);
                break; // Potion consumed
            }
        }
    }

    if (vfx) vfx.update(dt);

    // 3. Update Trees (Shake animation)
    trees.forEach(tree => {
        if (tree.userData.shakeAmount > 0) {
            tree.userData.shakeAmount -= dt * 2.0; // Decay
            if (tree.userData.shakeAmount < 0) tree.userData.shakeAmount = 0;

            // Apply oscillating rotation (Shake)
            const shake = Math.sin(Date.now() * 0.05) * tree.userData.shakeAmount * 0.2;
            tree.rotation.x = shake;
            tree.rotation.z = shake * 0.5;
        } else {
            tree.rotation.x = 0;
            tree.rotation.z = 0;
        }
    });

    // --- Airstrike System (Local only for flair) ---
    if (nextAirstrikeTime === 0) {
        nextAirstrikeTime = now + (CONFIG.AIRSTRIKE.INTERVAL_MIN + Math.random() * (CONFIG.AIRSTRIKE.INTERVAL_MAX - CONFIG.AIRSTRIKE.INTERVAL_MIN)) * 1000;
    }

    const warningTime = (CONFIG.AIRSTRIKE.WARNING_DURATION || 3) * 1000;
    const warningElement = document.getElementById('air-raid-warning');
    if (now > nextAirstrikeTime - warningTime && now < nextAirstrikeTime) {
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
            // 경보 표시 시 사이렌 재생
            if (window.AudioSFX) window.AudioSFX.playAirRaidSiren();
        } else {
            // 이전에 숨겨져 있다가 다시 나타나는 순간에만 사이렌 재생
            if (warningElement.style.display === 'none') {
                if (window.AudioSFX) window.AudioSFX.playAirRaidSiren();
            }
            warningElement.style.display = 'block';
            warningElement.style.opacity = Math.sin(now * 0.01) * 0.5 + 0.5; // 깜빡임 효과
        }
    } else if (warningElement) {
        warningElement.style.display = 'none';
    }

    if (now > nextAirstrikeTime) {
        // --- 스마트 타겟 선정 및 경로 설정 ---
        const allPotentialTargets = [];
        if (myTank && myTank.hp > 0) allPotentialTargets.push(myTank);
        bots.forEach(bot => { if (bot.hp > 0) allPotentialTargets.push(bot); });

        // 타겟 위치 정보 (탱크가 없을 경우 대비 기본값 포함)
        let targetX = (Math.random() - 0.5) * CONFIG.WORLD.SIZE * 0.5;
        let targetZ = (Math.random() - 0.5) * CONFIG.WORLD.SIZE * 0.5;

        if (allPotentialTargets.length > 0) {
            let victim;
            const playerChance = (CONFIG.AIRSTRIKE && CONFIG.AIRSTRIKE.PLAYER_TARGET_CHANCE) !== undefined ? CONFIG.AIRSTRIKE.PLAYER_TARGET_CHANCE : 0.3;
            
            // 플레이어가 살아있고 확률에 당첨된 경우 플레이어 조준
            if (myTank && myTank.hp > 0 && Math.random() < playerChance) {
                victim = myTank;
            } else {
                // 그 외에는 생존한 봇들 중 무작위 선택
                const liveBots = bots.filter(b => b.hp > 0);
                if (liveBots.length > 0) {
                    victim = liveBots[Math.floor(Math.random() * liveBots.length)];
                } else {
                    // 봇도 없으면 아무나 (백업)
                    victim = allPotentialTargets[Math.floor(Math.random() * allPotentialTargets.length)];
                }
            }
            
            targetX = victim.group.position.x;
            targetZ = victim.group.position.z;
        }

        // --- 360도 전방위 진입 로직 ---
        // 무작위 진입 각도 결정
        const angle = Math.random() * Math.PI * 2;
        // 맵 반경보다 충분히 먼 곳에서 스폰 (원형 경계 외곽)
        const spawnDist = CONFIG.WORLD.SIZE * 1.5;

        // 시작점과 끝점을 타겟 기준으로 대칭되게 설정 (타겟 상공 통과 보장)
        const startX = targetX + Math.cos(angle) * spawnDist;
        const startZ = targetZ + Math.sin(angle) * spawnDist;
        const endX = targetX - Math.cos(angle) * spawnDist;
        const endZ = targetZ - Math.sin(angle) * spawnDist;

        const start = new THREE.Vector3(startX, CONFIG.AIRSTRIKE.PLANE_HEIGHT, startZ);
        const end = new THREE.Vector3(endX, CONFIG.AIRSTRIKE.PLANE_HEIGHT, endZ);
        const targetPos = new THREE.Vector3(targetX, 0, targetZ);

        airstrikePlanes.push(new FighterPlane(start, end, targetPos));

        // Reset timer
        nextAirstrikeTime = now + (CONFIG.AIRSTRIKE.INTERVAL_MIN + Math.random() * (CONFIG.AIRSTRIKE.INTERVAL_MAX - CONFIG.AIRSTRIKE.INTERVAL_MIN)) * 1000;
    }

    // Update Planes
    for (let i = airstrikePlanes.length - 1; i >= 0; i--) {
        if (!airstrikePlanes[i].update(dt)) {
            airstrikePlanes.splice(i, 1);
        }
    }

    // Update Bombs
    for (let i = airstrikeBombs.length - 1; i >= 0; i--) {
        if (!airstrikeBombs[i].update(dt)) {
            airstrikeBombs.splice(i, 1);
        }
    }

    // 4. Update VFX System & Wreck Effects
    if (vfx) {
        vfx.update(dt);

        wreckSmokeTimer += dt;
        if (wreckSmokeTimer > 0.25) { // 0.08 → 0.25: 파티클 생성 빈도 감소
            wreckSmokeTimer = 0;
            wrecks.forEach(wreck => {
                const basePos = new THREE.Vector3(0, 0.6, 0).add(wreck.position);

                const smokePos1 = basePos.clone();
                smokePos1.x += (Math.random() - 0.5) * 0.5;
                smokePos1.z += (Math.random() - 0.5) * 0.5;
                vfx.spawnSmoke(smokePos1, 0x1a1a1a, 2, 0.3, 0.5, 3000);

                const firePos = basePos.clone();
                firePos.x += (Math.random() - 0.5) * 0.3;
                firePos.z += (Math.random() - 0.5) * 0.3;
                vfx.spawnFire(firePos, 2, 1.2, 0.2, 600);

                if (Math.random() < 0.4) {
                    const emberPos = basePos.clone();
                    emberPos.y += Math.random() * 0.3;
                    vfx.spawnFire(emberPos, 3, 2.0, 0.08, 400);
                }

                const steamPos = basePos.clone();
                steamPos.x += (Math.random() - 0.5) * 0.8;
                steamPos.z += (Math.random() - 0.5) * 0.8;
                vfx.spawnExhaust(steamPos, 0x555555, 1, 0.8, 0.25, 1500);
            });
        }
    }

    // 6. Sync
    syncMultiplayer();
}

function grantKillReward(killer) {
    if (!killer || killer.hp <= 0) return;

    // Use TYPES from CONFIG to determine possible rewards
    const rewards = CONFIG.UPGRADE.TYPES;
    const selected = rewards[Math.floor(Math.random() * rewards.length)];

    killer.applyUpgrade(selected);
    // Concise floating text feedback per user request
    spawnFloatingText(killer.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)), `${selected} UP`, "#ffd700");

    // FX
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

    // --- NEW: Tank vs Tank Overlap Prevention ---
    const TANK_PHYSICS_RADIUS = 0.8;
    const allTanks = [myTank, ...bots, ...Array.from(tanks.values())].filter(t => t && !t.isDead);

    // 1. Resolve Player vs Others
    for (const other of allTanks) {
        if (other === myTank) continue;
        const dist = myTank.group.position.distanceTo(other.group.position);
        const minDist = TANK_PHYSICS_RADIUS * 2;
        if (dist < minDist) {
            // Push apart along the collision vector
            const pushDir = myTank.group.position.clone().sub(other.group.position).normalize();
            if (dist === 0) pushDir.set(Math.random(), 0, Math.random()).normalize(); // Avoid zero-div
            const overlap = minDist - dist;
            myTank.group.position.add(pushDir.multiplyScalar(overlap * 0.5));
            // Note: We only push the local player here to simplify. Bots are handled below.
        }
    }

    // 2. Resolve Bots vs Others (Local resolution)
    for (let i = 0; i < bots.length; i++) {
        const bot = bots[i];
        if (bot.isDead) continue;
        const candidates = [myTank, ...Array.from(tanks.values()), ...bots];
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

    // Bullets and other collisions
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

        // 수명 확인
        if (Date.now() - bullet.startTime > CONFIG.BULLET.LIFE_TIME) {
            bulletManager.remove(i);
            continue;
        }

        let hit = false;

        // Wall collision
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

                    // If hit tree, start shaking
                    if (wall.userData && wall.userData.type === 'tree' && wall.userData.parentTree) {
                        wall.userData.parentTree.userData.shakeAmount = 1.0;
                    }

                    // Breakable props logic
                    if (wall.userData && wall.userData.isBreakable) {
                        // Big explosion for props
                        for (let j = 0; j < 3; j++) {
                            vfx.spawnImpact(wall.position, new THREE.Vector3(0, 1, 0), wall.userData.type === 'barrel' ? 0xc62828 : 0x5d4037);
                        }
                        AudioSFX.playImpact();

                        // Remove from scene and walls array
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

        // Player collisions
        const allPlayers = [myTank, ...Array.from(tanks.values())];
        for (const tank of allPlayers) {
            if (!tank || bullet.ownerId === tank.id) continue;
            if (bullet.group.position.distanceTo(tank.group.position) < 1.2) {
                // If I shot a player OR my local bot shot a player, broadcast the hit
                const isMyBotShooter = bots.some(b => b.id === bullet.ownerId);
                if (bullet.ownerId === myId || isMyBotShooter) {
                    AudioSFX.playImpact();
                    if (vfx) vfx.spawnImpact(bullet.group.position, new THREE.Vector3(0, 1, 0), 0xffaa00);
                    if (tank === myTank) tank.handleHit(bullet.damage || CONFIG.BULLET.DAMAGE, bullet.ownerId);
                    channel.send({
                        type: 'broadcast',
                        event: 'hit',
                        payload: { t: tank.id, d: bullet.damage || CONFIG.BULLET.DAMAGE, s: bullet.ownerId }
                    });
                }
                hit = true;
                break;
            }
        }
        if (hit) {
            bulletManager.remove(i);
            continue;
        }

        // Bot collisions (Local only)
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

/**
 * 멀티플레이어 동기화 - 내 상태를 다른 플레이어에게 브로드캐스트
 */
function syncMultiplayer() {
    if (!channel) return;

    const now = Date.now();
    if (now - lastSyncTime < CONFIG.NETWORK.SYNC_INTERVAL) return;
    lastSyncTime = now;

    // 1. 내 상태 브로드캐스트 (플레이 중일 때만)
    if (WCGames.state === 'PLAYING' && myId && myTank) {
        const distMoved = myTank.group.position.distanceTo(lastSentPos);
        const rotDiff = Math.abs(normalizeAngle(myTank.group.rotation.y - lastSentRot));
        const turretDiff = Math.abs(normalizeAngle(myTank.turretGroup.rotation.y - lastSentTurretRot));

        // 하트비트 체크: 정지 상태여도 2초에 한 번은 전송
        const isStationary = distMoved <= 0.05 && rotDiff <= 0.01 && turretDiff <= 0.01;
        const needsHeartbeat = now - lastHeartbeatTime > 2000;

        if (!isStationary || needsHeartbeat) {
            const dStr = packTankData(myTank);
            channel.send({
                type: 'broadcast',
                event: 'move',
                payload: {
                    i: myId,
                    n: myName,
                    d: dStr
                }
            });

            lastSentPos.copy(myTank.group.position);
            lastSentRot = myTank.group.rotation.y;
            lastSentTurretRot = myTank.turretGroup.rotation.y;
            lastHeartbeatTime = now;
        }
    }

    // 2. Broadcast ALL Bots (DELETED: BOTS ARE LOCAL)


    updateScoreboard();
}

let currentMasterId = null;

function updateMasterStatus() {
    if (!channel) return;
    const state = channel.presenceState();

    // Find all players and their states
    let players = [];
    Object.keys(state).forEach(id => {
        const presences = state[id];
        if (presences && presences.length > 0) {
            players.push({ id, state: presences[0].game_state || 'INIT' });
        }
    });

    if (players.length === 0) return;

    // Sticky Logic: If current Master is still in room and PLAYING, keep them.
    const activeCurrentMaster = players.find(p => p.id === currentMasterId && p.state === 'PLAYING');

    if (activeCurrentMaster) {
        // Stick with current
        amIMaster = (currentMasterId === myId);
    } else {
        // Pick new Master
        // Prioritize 'PLAYING' state, then Sort by ID
        players.sort((a, b) => {
            if (a.state === 'PLAYING' && b.state !== 'PLAYING') return -1;
            if (a.state !== 'PLAYING' && b.state === 'PLAYING') return 1;
            return a.id.localeCompare(b.id);
        });
        currentMasterId = players[0].id;
        amIMaster = (currentMasterId === myId);
    }

    // UI Feedback
    const statusText = document.getElementById('status-text');
    if (statusText && myTank) {
        statusText.textContent = Math.round(myTank.hp);
    }

    if (bots.length === 0) {
        spawnBots(CONFIG.BOT.COUNT);
    }
}

function updatePresenceState() {
    if (channel) {
        channel.track({
            online_at: new Date().toISOString(),
            game_state: WCGames.state,
            name: myName
        });
    }
}

/* 7. 렌더링 - 메인 애니메이션 루프 */
function animate() {
    animationId = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    update(dt);
    syncMultiplayer();
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

    for (const wallBox of wallBoxes) {
        if (tankBox.intersectsBox(wallBox)) {
            return false;
        }
    }
    return true;
}

/**
 * NEW: Line of Sight (LoS) check between two points.
 * Returns true if the path is clear of walls.
 */
function checkLineOfSight(from, to) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const distance = direction.length();
    direction.normalize();

    const ray = new THREE.Ray(from, direction);
    const intersection = new THREE.Vector3();

    for (const wallBox of wallBoxes) {
        if (ray.intersectBox(wallBox, intersection)) {
            const hitDist = from.distanceTo(intersection);
            if (hitDist < distance) return false; // Path is blocked by a wall
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
 * Find nearest enemy for auto-aim
 */
function findNearestEnemy(pos, maxDist = 50) {
    let nearest = null;
    let minDist = maxDist;

    // Search Bots
    bots.forEach(bot => {
        if (bot && !bot.isDead && bot.group) {
            const d = pos.distanceTo(bot.group.position);
            if (d < minDist) {
                minDist = d;
                nearest = bot.group.position;
            }
        }
    });

    // Search Other Player Tanks
    tanks.forEach((tank, id) => {
        if (tank && tank !== myTank && !tank.isDead && tank.group) {
            const d = pos.distanceTo(tank.group.position);
            if (d < minDist) {
                minDist = d;
                nearest = tank.group.position;
            }
        }
    });

    return nearest;
}

/**
 * Floating Text Effect utility
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
        // Clear old state and scene
        if (typeof myTank !== 'undefined' && myTank) {
            myTank.destroy();
            myTank = null;
        }
        if (typeof tanks !== 'undefined') {
            tanks.forEach(t => t.destroy());
            tanks.clear();
        }
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
        if (typeof wallBoxes !== 'undefined') {
            wallBoxes.length = 0;
        }

        scene = new THREE.Scene();
        trackMarkManager = new TrackMarkManager(scene);
        bulletManager = new BulletManager(scene);

        vfx = new ParticleSystem();
        cameraShakeTime = 0;
        scene.background = new THREE.Color(CONFIG.COLORS.FLOOR);
        // scene.fog = new THREE.FogExp2(CONFIG.COLORS.FLOOR, 0.02); // Fog removed for clarity per user request

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        // FOV는 isMobile 전역값 기준으로 init 시 1회 설정
        camera.fov = isMobile ? CONFIG.CAMERA.MOBILE_FOV : CONFIG.CAMERA.PC_FOV;
        camera.updateProjectionMatrix();

        const container = document.getElementById('game-container');
        container.innerHTML = ''; // Clear previous canvas if any

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

        // Environment
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
        directionalLight.shadow.bias = -0.0005; // Fix shadow acne on voxels
        scene.add(directionalLight);
        scene.add(directionalLight.target); // Need to add target specifically for following

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

        // Helper: Create Czech Hedgehog (대전차 장애물)
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

            // Add invisible collision box for hedgehog
            const col = createVoxelBox(0.8, 0.8, 0.8, 0x000000, 0, 1); // Matte, invisible collision box
            col.position.set(x, 0.4, z);
            col.visible = false;
            scene.add(col);
            walls.push(col);
        }

        // Helper: Create Props (Crates & Barrels)
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

        function createShack(x, z, rot = 0) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rot;
            scene.add(group);

            const wallColor = 0x252018;
            const roofColor = 0x1a1510;

            // Foundation
            const floor = createVoxelBox(2.5, 0.15, 2.5, 0x1a1510);
            floor.position.y = 0.075;
            group.add(floor);

            // Walls
            const backWall = createVoxelBox(2.5, 1.8, 0.15, wallColor);
            backWall.position.set(0, 1.0, -1.175);
            group.add(backWall);

            const leftWall = createVoxelBox(0.15, 1.8, 2.5, wallColor);
            leftWall.position.set(-1.175, 1.0, 0);
            group.add(leftWall);

            const rightWall = createVoxelBox(0.15, 1.8, 2.5, wallColor);
            rightWall.position.set(1.175, 1.0, 0);
            group.add(rightWall);

            // Collapsed front wall (一半만 있음)
            const frontWallL = createVoxelBox(0.8, 1.4, 0.15, wallColor);
            frontWallL.position.set(-0.7, 0.7, 1.175);
            frontWallL.rotation.z = 0.1;
            group.add(frontWallL);

            const frontWallR = createVoxelBox(0.8, 1.0, 0.15, wallColor);
            frontWallR.position.set(0.8, 0.5, 1.175);
            frontWallR.rotation.z = -0.15;
            group.add(frontWallR);

            // Roof (一部分塌陷)
            const roof = createVoxelBox(2.8, 0.15, 2.8, roofColor);
            roof.position.set(0.3, 1.95, 0.2);
            roof.rotation.x = 0.15;
            roof.rotation.z = 0.1;
            group.add(roof);

            // Debris on roof
            const debris1 = createVoxelBox(0.4, 0.3, 0.5, 0x1a1510);
            debris1.position.set(0.8, 2.1, -0.5);
            group.add(debris1);

            // collision
            const col = createVoxelBox(2.5, 1.8, 2.5, 0x000000);
            col.position.set(x, 0.9, z);
            col.visible = false;
            scene.add(col);
            walls.push(col);
        }

        function createWatchtower(x, z) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            scene.add(group);

            const towerColor = 0x1a1510;
            const metalColor = 0x252018;

            // Foundation
            const base = createVoxelBox(1.8, 0.3, 1.8, 0x151210);
            base.position.y = 0.15;
            group.add(base);

            // Legs
            const legPositions = [
                [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]
            ];
            legPositions.forEach(([lx, lz]) => {
                const leg = createVoxelBox(0.2, 3.0, 0.2, metalColor);
                leg.position.set(lx, 1.5, lz);
                group.add(leg);
            });

            // Platform (一部分塌陷)
            const platform = createVoxelBox(2.2, 0.15, 2.2, towerColor);
            platform.position.set(0.1, 3.0, 0.1);
            platform.rotation.x = 0.1;
            platform.rotation.z = -0.1;
            group.add(platform);

            // Damaged railing
            const rail1 = createVoxelBox(2.0, 0.1, 0.1, metalColor);
            rail1.position.set(0, 3.3, -1.0);
            rail1.rotation.z = 0.2;
            group.add(rail1);

            const rail2 = createVoxelBox(0.1, 0.1, 1.8, metalColor);
            rail2.position.set(-1.0, 3.2, 0);
            group.add(rail2);

            // Top shelter (一半塌陷)
            const shelter = createVoxelBox(1.5, 0.8, 1.5, towerColor);
            shelter.position.set(-0.2, 3.6, -0.2);
            shelter.rotation.z = 0.15;
            group.add(shelter);

            const shelterRoof = createVoxelBox(1.7, 0.1, 1.7, metalColor);
            shelterRoof.position.set(-0.2, 4.1, -0.2);
            group.add(shelterRoof);

            // collision
            const col = createVoxelBox(1.8, 4.0, 1.8, 0x000000);
            col.position.set(x, 2.0, z);
            col.visible = false;
            scene.add(col);
            walls.push(col);
        }

        // 모래주머니 방호 뚝 (Sandbag Bunker) - 포대자루처럼 가운데서 부풀어 오름
        function createSandbags(x, z, rot = 0) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rot;
            scene.add(group);

            // 더 어두운 자연스러운 색상
            const sandDark = 0x4A3728; // 어두운 갈색
            const sandBrown = 0x5C4033; // 갈색
            const sandMuddy = 0x3D2817; // 진한 mud색
            const sandDusty = 0x6B5344; //먼지 색

            // 포대자루 형태: 가운데가 더 두껍고 양쪽이 좁음
            // createVoxelCylinder(topRadius, bottomRadius, height) 사용

            // 1단 (6개)
            for (let i = 0; i < 6; i++) {
                const color = [sandBrown, sandDark, sandMuddy, sandBrown, sandDark, sandMuddy][i];
                // 가운데가 더 부풀어 오르도록: top < bottom, middle에突出
                const bag = createVoxelCylinder(0.28, 0.32, 0.85, color, 0.1, 0.9);
                bag.rotation.z = Math.PI / 2;
                bag.rotation.y = (Math.random() - 0.5) * 0.15;
                bag.position.set(-2.0 + i * 0.8, 0.3, (Math.random() - 0.5) * 0.1);
                group.add(bag);
            }

            // 2단
            for (let i = 0; i < 5; i++) {
                const color = [sandMuddy, sandBrown, sandDark, sandMuddy, sandBrown][i];
                const bag = createVoxelCylinder(0.26, 0.30, 0.85, color, 0.1, 0.9);
                bag.rotation.z = Math.PI / 2;
                bag.rotation.y = (Math.random() - 0.5) * 0.2;
                bag.position.set(-1.6 + i * 0.8, 0.7, (Math.random() - 0.5) * 0.12);
                group.add(bag);
            }

            // 3단
            for (let i = 0; i < 4; i++) {
                const color = [sandDark, sandMuddy, sandBrown, sandDark][i];
                const bag = createVoxelCylinder(0.25, 0.28, 0.8, color, 0.1, 0.9);
                bag.rotation.z = Math.PI / 2;
                bag.rotation.y = (Math.random() - 0.5) * 0.18;
                bag.position.set(-1.2 + i * 0.8, 1.1, (Math.random() - 0.5) * 0.1);
                group.add(bag);
            }

            // 4단
            for (let i = 0; i < 3; i++) {
                const color = [sandBrown, sandDark, sandMuddy][i];
                const bag = createVoxelCylinder(0.22, 0.26, 0.75, color, 0.1, 0.9);
                bag.rotation.z = Math.PI / 2;
                bag.rotation.y = (Math.random() - 0.5) * 0.15;
                bag.position.set(-0.8 + i * 0.8, 1.45, (Math.random() - 0.5) * 0.08);
                group.add(bag);
            }

            // 5단
            for (let i = 0; i < 2; i++) {
                const color = [sandMuddy, sandBrown][i];
                const bag = createVoxelCylinder(0.2, 0.24, 0.7, color, 0.1, 0.9);
                bag.rotation.z = Math.PI / 2;
                bag.rotation.y = (Math.random() - 0.5) * 0.1;
                bag.position.set(-0.4 + i * 0.8, 1.75, (Math.random() - 0.5) * 0.06);
                group.add(bag);
            }

            // 충돌 박스
            const col = createVoxelBox(5.0, 2.2, 1.2, 0x000000);
            col.position.set(x, 1.1, z);
            col.rotation.y = rot;
            col.visible = false;
            col.userData = { type: 'sandbags' };
            scene.add(col);
            walls.push(col);
        }

        // 파괴된 탱크 잔해 생성 (원형 유지 + 다양한 변형)
        function createWreck(x, z) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = seededRandom(x * 7 + z) * Math.PI * 2;
            scene.add(group);
            wrecks.push(group);

            // 랜덤 변형 파라미터
            const tiltX = (seededRandom(x * 11 + z * 13) - 0.5) * 0.7;
            const tiltZ = (seededRandom(x * 17 + z * 19) - 0.5) * 0.7;
            const colorVar = seededRandom(x * 23 + z * 29);

            // 색상: 올리브~녹슨 갈색 다양화
            const baseHue = colorVar < 0.5 ? 0.25 : 0.08; // green vs brown
            const color = colorVar < 0.5 ?
                0x2a3a2a : // 올리브
                (colorVar < 0.75 ? 0x3d4a3a : 0x4a3525); // 녹슨 올리브 : 녹슨 갈색
            const burntColor = colorVar < 0.3 ? 0x1a1a1a : color;

            // 1.赫尔 (본체)
            const hullGroup = new THREE.Group();
            hullGroup.rotation.set(tiltX, 0, tiltZ);

            // 메인 바디
            const hullMain = createVoxelBox(1.35, 0.32, 2.3, burntColor, 0.3, 0.7);
            hullMain.position.y = 0.3;
            hullGroup.add(hullMain);

            // 사이드 스커트
            const skirtL = createVoxelBox(0.08, 0.28, 2.25, burntColor, 0.3, 0.7);
            skirtL.position.set(-0.65, 0.35, 0);
            hullGroup.add(skirtL);
            const skirtR = createVoxelBox(0.08, 0.28, 2.25, burntColor, 0.3, 0.7);
            skirtR.position.set(0.65, 0.35, 0);
            hullGroup.add(skirtR);

            // 전방 펜더 가드
            const guardL = createVoxelBox(0.4, 0.05, 0.4, 0x333333);
            guardL.position.set(-0.48, 0.45, -0.85);
            hullGroup.add(guardL);
            const guardR = createVoxelBox(0.4, 0.05, 0.4, 0x333333);
            guardR.position.set(0.48, 0.45, -0.85);
            hullGroup.add(guardR);

            // 후방 연료통
            const fuelL = createVoxelCylinder(0.18, 0.18, 0.3, 0x2d3436, 0.5, 0.5);
            fuelL.position.set(-0.4, 0.4, 1.15);
            fuelL.rotation.x = Math.PI / 2;
            hullGroup.add(fuelL);
            const fuelR = createVoxelCylinder(0.18, 0.18, 0.3, 0x2d3436, 0.5, 0.5);
            fuelR.position.set(0.4, 0.4, 1.15);
            fuelR.rotation.x = Math.PI / 2;
            hullGroup.add(fuelR);

            // 트랙
            const trackL = createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a, 0.1, 0.9);
            trackL.position.set(-0.48, 0.15, 0);
            hullGroup.add(trackL);
            const trackR = createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a, 0.1, 0.9);
            trackR.position.set(0.48, 0.15, 0);
            hullGroup.add(trackR);

            // 로드휠
            for (let i = 0; i < 7; i++) {
                const wheel = createVoxelCylinder(0.15, 0.15, 0.4, 0x333333);
                wheel.position.set(-0.48, 0.15, -1.05 + i * 0.35);
                wheel.rotation.z = Math.PI / 2;
                hullGroup.add(wheel);
                const wheelR = createVoxelCylinder(0.15, 0.15, 0.4, 0x333333);
                wheelR.position.set(0.48, 0.15, -1.05 + i * 0.35);
                wheelR.rotation.z = Math.PI / 2;
                hullGroup.add(wheelR);
            }

            group.add(hullGroup);

            // 2. 포탑
            const turretGroup = new THREE.Group();
            turretGroup.position.set(0, 0.75, 0.1);
            turretGroup.rotation.set(
                tiltX * 1.2 + seededRandom(x * 31 + z * 37) * 0.15,
                seededRandom(x * 41 + z * 43) * 0.3,
                tiltZ * 1.2 + seededRandom(x * 47 + z * 53) * 0.1
            );

            // 포탑 메인
            const turretMain = createVoxelBox(1.0, 0.35, 1.2, burntColor, 0.3, 0.7);
            turretGroup.add(turretMain);

            // 포탑 측면
            for (let side of [-1, 1]) {
                const cheek = createVoxelBox(0.12, 0.4, 1.0, burntColor, 0.4, 0.6);
                cheek.position.set(0.42 * side, 0.1, -0.2);
                cheek.rotation.y = side > 0 ? 0.35 : -0.35;
                turretGroup.add(cheek);
            }

            // 커맨더 해치
            const hatch = createVoxelBox(0.4, 0.1, 0.4, 0x333333);
            hatch.position.set(0.18, 0.4, 0.05);
            turretGroup.add(hatch);

            // 포신
            const barrel = createVoxelCylinder(0.08, 0.1, 1.5, 0x333333, 0.6, 0.4);
            barrel.position.set(0, 0.2, -0.7);
            barrel.rotation.x = -Math.PI / 2;
            turretGroup.add(barrel);

            // 머즐 브레이크
            const brake = createVoxelCylinder(0.12, 0.12, 0.15, 0x111111);
            brake.position.set(0, 0.2, -1.4);
            brake.rotation.x = -Math.PI / 2;
            turretGroup.add(brake);

            // 대공기관총
            const mg = createVoxelBox(0.1, 0.12, 0.25, 0x111111);
            mg.position.set(-0.2, 0.45, 0.1);
            turretGroup.add(mg);

            group.add(turretGroup);

            // 3. 충돌 박스
            const col = createVoxelBox(1.5, 1.5, 2.5, 0x000000);
            col.position.set(x, 0.7, z);
            col.rotation.y = group.rotation.y;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        //坦克 Hull建造 (公用函数 - 残骸でも原型維持)
        function buildTankHull(group, color, rustLevel = 0) {
            const rust = rustLevel * 0.3;
            // 메인 바디
            const body = createVoxelBox(1.35, 0.32, 2.3, color, 0.4 - rust * 0.3, 0.6 + rust * 0.4);
            body.position.y = 0.3;
            group.add(body);

            // 사이드 스커트
            const skirtL = createVoxelBox(0.08, 0.28, 2.25, color, 0.4 - rust * 0.3, 0.6 + rust * 0.4);
            skirtL.position.set(-0.65, 0.35, 0);
            group.add(skirtL);
            const skirtR = createVoxelBox(0.08, 0.28, 2.25, color, 0.4 - rust * 0.3, 0.6 + rust * 0.4);
            skirtR.position.set(0.65, 0.35, 0);
            group.add(skirtR);

            // 트랙
            const trackL = createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a, 0.1, 0.9);
            trackL.position.set(-0.48, 0.15, 0);
            group.add(trackL);
            const trackR = createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a, 0.1, 0.9);
            trackR.position.set(0.48, 0.15, 0);
            group.add(trackR);

            // 로드휠
            for (let i = 0; i < 7; i++) {
                const wheel = createVoxelCylinder(0.15, 0.15, 0.4, 0x333333);
                wheel.position.set(-0.48, 0.15, -1.05 + i * 0.35);
                wheel.rotation.z = Math.PI / 2;
                group.add(wheel);
                const wheelR = createVoxelCylinder(0.15, 0.15, 0.4, 0x333333);
                wheelR.position.set(0.48, 0.15, -1.05 + i * 0.35);
                wheelR.rotation.z = Math.PI / 2;
                group.add(wheelR);
            }
        }

        //坦克 Turret建造 (公用函数)
        function buildTankTurret(group, color, rustLevel = 0) {
            const rust = rustLevel * 0.3;
            // 포탑 베이스
            const turretMain = createVoxelBox(1.0, 0.35, 1.2, color, 0.4 - rust * 0.3, 0.6 + rust * 0.4);
            turretMain.position.set(0, 0.1, 0.15);
            group.add(turretMain);

            // 포탑 측면
            for (let side of [-1, 1]) {
                const cheek = createVoxelBox(0.12, 0.4, 1.0, color, 0.5 - rust * 0.3, 0.5 + rust * 0.5);
                cheek.position.set(0.42 * side, 0.1, -0.2);
                cheek.rotation.y = side > 0 ? 0.35 : -0.35;
                group.add(cheek);
            }

            // 해치
            const hatch = createVoxelBox(0.4, 0.1, 0.4, 0x333333);
            hatch.position.set(0.18, 0.4, 0.05);
            group.add(hatch);

            // 포신
            const tube = createVoxelCylinder(0.08, 0.1, 1.5, 0x333333, 0.6, 0.4);
            tube.position.set(0, 0.2, -0.7);
            tube.rotation.x = -Math.PI / 2;
            group.add(tube);

            // 머즐 브레이크
            const brake = createVoxelCylinder(0.12, 0.12, 0.15, 0x111111);
            brake.position.set(0, 0.2, -1.4);
            brake.rotation.x = -Math.PI / 2;
            group.add(brake);

            // 대공기관총
            const mg = createVoxelBox(0.1, 0.12, 0.25, 0x111111);
            mg.position.set(-0.2, 0.45, 0.1);
            group.add(mg);
        }

        // 1. slight_damage: 경미한 손상 -原型ほぼ維持
        function createSlightDamageWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const color = 0x2a3a2a; // 올리브 드래브
            const rustColor = 0x5c4033;

            //赫尔
            buildTankHull(group, color, 0.2);

            //포탑 (약간 비틀림)
            const turretGroup = new THREE.Group();
            turretGroup.position.set(0, 0.75, 0.1);
            turretGroup.rotation.set(0.05 * (rand - 0.5), 0.1 * rand, 0.03);

            const turretMain = createVoxelBox(1.0, 0.35, 1.2, color, 0.4, 0.6);
            turretGroup.add(turretMain);

            const barrel = createVoxelCylinder(0.08, 0.1, 1.5, 0x333333, 0.6, 0.4);
            barrel.position.set(0, 0.2, -0.7);
            barrel.rotation.x = -Math.PI / 2;
            turretGroup.add(barrel);

            group.add(turretGroup);

            // 충돌 박스
            const col = createVoxelBox(1.5, 1.5, 2.5, 0x000000);
            col.position.set(x, 0.7, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 2. heavy_damage: 심한 손상 -形态崩レ
        function createHeavyDamageWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const color = 0x3a4a3a;
            const damagedColor = 0x2a2a2a;

            //赫尔 (비틀림)
            const hullGroup = new THREE.Group();
            const hull = createVoxelBox(1.3, 0.28, 2.2, color, 0.3, 0.7);
            hull.position.y = 0.25;
            hullGroup.add(hull);

            const skirtL = createVoxelBox(0.1, 0.25, 2.1, color, 0.3, 0.7);
            skirtL.position.set(-0.65, 0.3, 0);
            hullGroup.add(skirtL);
            const skirtR = createVoxelBox(0.1, 0.25, 2.1, color, 0.3, 0.7);
            skirtR.position.set(0.65, 0.3, 0);
            hullGroup.add(skirtR);

            // 트랙 (일부欠落)
            const trackL = createVoxelBox(0.38, 0.28, 1.8, 0x1a1a1a);
            trackL.position.set(-0.45, 0.12, 0.2);
            hullGroup.add(trackL);
            const trackR = createVoxelBox(0.38, 0.28, 1.6, 0x1a1a1a);
            trackR.position.set(0.45, 0.12, -0.3);
            hullGroup.add(trackR);

            // 로드휠 (일부만)
            for (let i = 0; i < 5; i++) {
                if (i !== 2 && i !== 4) {
                    const wheel = createVoxelCylinder(0.13, 0.13, 0.38, 0x333333);
                    wheel.position.set(-0.45, 0.12, -0.9 + i * 0.4);
                    wheel.rotation.z = Math.PI / 2;
                    hullGroup.add(wheel);
                }
            }

            hullGroup.rotation.set(0.08, 0.3 * rand, 0.12);
            group.add(hullGroup);

            //포탑 (심하게 비틀림)
            const turretGroup = new THREE.Group();
            turretGroup.position.set(-0.2, 0.55, 0.2);
            turretGroup.rotation.set(0.2, 0.6 * rand, 0.15);

            const turret = createVoxelBox(0.9, 0.32, 1.1, damagedColor, 0.2, 0.8);
            turretGroup.add(turret);

            // 짧아진 포신
            const barrel = createVoxelCylinder(0.07, 0.09, 0.9, damagedColor, 0.3, 0.7);
            barrel.position.set(0, 0.15, -0.5);
            barrel.rotation.x = -Math.PI / 2 + 0.2;
            turretGroup.add(barrel);

            group.add(turretGroup);

            // 충돌 박스
            const col = createVoxelBox(1.6, 1.2, 2.3, 0x000000);
            col.position.set(x, 0.5, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 3. tilted: 기울어진 탱크
        function createTiltedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const color = 0x354a35;
            const rustColor = 0x4a3525;

            // 전체를 기울임
            const tiltAngle = 0.25 + rand * 0.15;
            const tiltDir = rand > 0.5 ? 1 : -1;

            //赫尔
            const hullGroup = new THREE.Group();
            hullGroup.rotation.z = tiltAngle * tiltDir;

            const hull = createVoxelBox(1.35, 0.32, 2.3, color, 0.35, 0.65);
            hull.position.y = 0.3;
            hullGroup.add(hull);

            const skirtL = createVoxelBox(0.08, 0.28, 2.25, color);
            skirtL.position.set(-0.65, 0.35, 0);
            hullGroup.add(skirtL);
            const skirtR = createVoxelBox(0.08, 0.28, 2.25, color);
            skirtR.position.set(0.65, 0.35, 0);
            hullGroup.add(skirtR);

            const trackL = createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a);
            trackL.position.set(-0.48, 0.15, 0);
            hullGroup.add(trackL);
            const trackR = createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a);
            trackR.position.set(0.48, 0.15, 0);
            hullGroup.add(trackR);

            for (let i = 0; i < 7; i++) {
                const wheel = createVoxelCylinder(0.15, 0.15, 0.4, 0x333333);
                wheel.position.set(-0.48, 0.15, -1.05 + i * 0.35);
                wheel.rotation.z = Math.PI / 2;
                hullGroup.add(wheel);
                const wheelR = createVoxelCylinder(0.15, 0.15, 0.4, 0x333333);
                wheelR.position.set(0.48, 0.15, -1.05 + i * 0.35);
                wheelR.rotation.z = Math.PI / 2;
                hullGroup.add(wheelR);
            }

            group.add(hullGroup);

            //포탑 (더 많이 기울어짐)
            const turretGroup = new THREE.Group();
            turretGroup.position.set(0, 0.75 + tiltAngle * 0.3, 0.1);
            turretGroup.rotation.set(tiltAngle * 0.5 * tiltDir, 0.15 * rand, 0.1);

            const turretMain = createVoxelBox(1.0, 0.35, 1.2, color);
            turretGroup.add(turretMain);

            const barrel = createVoxelCylinder(0.08, 0.1, 1.5, 0x333333);
            barrel.position.set(0, 0.2, -0.7);
            barrel.rotation.x = -Math.PI / 2;
            turretGroup.add(barrel);

            group.add(turretGroup);

            // 충돌 박스
            const col = createVoxelBox(1.8, 1.5, 2.6, 0x000000);
            col.position.set(x, 0.6, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 4. burnt: 타서 그을린 탱크
        function createBurntWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const burntColor = 0x1a1a1a;
            const charColor = 0x0d0d0d;
            const rustColor = 0x2d1a10;

            //赫尔
            const hull = createVoxelBox(1.3, 0.28, 2.2, burntColor, 0, 1);
            hull.position.set(0.1, 0.25, 0);
            hull.rotation.set(0.1, 0.25 * rand, 0.08);
            group.add(hull);

            // 사이드 스커트
            const skirtL = createVoxelBox(0.09, 0.24, 2.1, charColor, 0, 1);
            skirtL.position.set(-0.64, 0.28, 0.1);
            group.add(skirtL);
            const skirtR = createVoxelBox(0.09, 0.24, 2.1, charColor, 0, 1);
            skirtR.position.set(0.64, 0.28, -0.1);
            group.add(skirtR);

            // 트랙 (일부 녹음)
            const trackL = createVoxelBox(0.38, 0.26, 2.1, 0x111111);
            trackL.position.set(-0.46, 0.11, 0.05);
            group.add(trackL);
            const trackR = createVoxelBox(0.38, 0.26, 1.6, 0x111111);
            trackR.position.set(0.46, 0.11, 0.25);
            group.add(trackR);

            // 포탑 (뒤처짐)
            const turret = createVoxelBox(0.85, 0.3, 1.0, charColor, 0, 1);
            turret.position.set(-0.25, 0.5, 0.3);
            turret.rotation.set(0.2, 0.5 * rand, 0.15);
            group.add(turret);

            // 포신 (부서짐)
            const barrel = createVoxelCylinder(0.06, 0.08, 0.7, rustColor, 0, 1);
            barrel.position.set(-0.1, 0.15, -0.6);
            barrel.rotation.set(1.2, 0.3, 0.6);
            group.add(barrel);

            // 바퀴 (흩어짐)
            for (let i = 0; i < 4; i++) {
                const wheel = createVoxelCylinder(0.12, 0.12, 0.35, 0x222222);
                wheel.position.set(
                    -0.5 + Math.random() * 0.2,
                    0.08 + Math.random() * 0.1,
                    -0.5 + i * 0.4 + Math.random() * 0.3
                );
                wheel.rotation.set(Math.random() * 0.5, Math.random(), Math.random() * 0.5);
                group.add(wheel);
            }

            // 연료 누출
            const stain = createVoxelBox(2.0, 0.02, 2.5, 0x1a0f0a);
            stain.position.set(0, 0.01, 0);
            group.add(stain);

            const col = createVoxelBox(1.8, 1.0, 2.4, 0x000000);
            col.position.set(x, 0.4, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 5. exploded: 폭발로 산산이
        function createExplodedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const metalColor = 0x2a2a2a;
            const darkColor = 0x1f1f1f;

            //赫尔 파편
            const hull1 = createVoxelBox(0.7, 0.25, 1.0, metalColor, 0, 1);
            hull1.position.set(-0.3, 0.2, 0.4);
            hull1.rotation.set(0.3, 0.5, 0.2);
            group.add(hull1);

            const hull2 = createVoxelBox(0.5, 0.2, 0.8, darkColor, 0, 1);
            hull2.position.set(0.4, 0.12, -0.3);
            hull2.rotation.set(-0.2, 1.2, 0.4);
            group.add(hull2);

            const hull3 = createVoxelBox(0.4, 0.18, 0.6, metalColor, 0, 1);
            hull3.position.set(0.15, 0.08, 0.8);
            hull3.rotation.set(0.5, 2.1, -0.3);
            group.add(hull3);

            // 포탑 파편
            const turret1 = createVoxelBox(0.5, 0.28, 0.6, darkColor, 0, 1);
            turret1.position.set(0.2, 0.35, 0.15);
            turret1.rotation.set(0.6, 0.3, 0.3);
            group.add(turret1);

            const turret2 = createVoxelBox(0.35, 0.22, 0.4, metalColor, 0, 1);
            turret2.position.set(-0.4, 0.2, -0.2);
            turret2.rotation.set(0.9, 1.2, 0.5);
            group.add(turret2);

            // 포신 파편
            const barrel1 = createVoxelCylinder(0.06, 0.07, 0.5, metalColor, 0, 1);
            barrel1.position.set(0.5, 0.1, 0.5);
            barrel1.rotation.set(1.5, 0.5, 1.0);
            group.add(barrel1);

            const barrel2 = createVoxelCylinder(0.05, 0.06, 0.4, darkColor, 0, 1);
            barrel2.position.set(-0.3, 0.08, 0.7);
            barrel2.rotation.set(1.8, 1.8, 0.8);
            group.add(barrel2);

            // 금속 파편
            for (let i = 0; i < 10; i++) {
                const debris = createVoxelBox(
                    0.08 + Math.random() * 0.15,
                    0.04 + Math.random() * 0.08,
                    0.08 + Math.random() * 0.12,
                    i % 2 === 0 ? metalColor : darkColor
                );
                debris.position.set(
                    -0.7 + Math.random() * 1.4,
                    0.03 + Math.random() * 0.12,
                    -0.7 + Math.random() * 1.4
                );
                debris.rotation.set(Math.random() * 2, Math.random() * 3, Math.random() * 2);
                group.add(debris);
            }

            // 트랙 파편
            const trackPiece = createVoxelBox(0.35, 0.2, 0.8, 0x111111);
            trackPiece.position.set(0.6, 0.1, -0.4);
            trackPiece.rotation.set(0.3, 0.8, 0.5);
            group.add(trackPiece);

            // 크레이터
            const crater = createVoxelBox(2.5, 0.08, 2.5, 0x0a0a0a);
            crater.position.set(0, 0.04, 0);
            group.add(crater);

            const col = createVoxelBox(2.0, 0.7, 2.0, 0x000000);
            col.position.set(x, 0.25, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 6. abandoned: 방치된 탱크
        function createAbandonedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const olive = 0x3d4a3a;
            const rust = 0x5c4033;
            const darkRust = 0x3d2817;

            //赫尔 (녹슨 版本)
            const hull = createVoxelBox(1.35, 0.32, 2.3, olive, 0.3, 0.7);
            hull.position.y = 0.3;
            group.add(hull);

            const skirtL = createVoxelBox(0.08, 0.28, 2.25, rust, 0.1, 0.9);
            skirtL.position.set(-0.65, 0.35, 0);
            group.add(skirtL);
            const skirtR = createVoxelBox(0.08, 0.28, 2.25, rust, 0.1, 0.9);
            skirtR.position.set(0.65, 0.35, 0);
            group.add(skirtR);

            // 트랙
            const trackL = createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a, 0.1, 0.9);
            trackL.position.set(-0.48, 0.15, 0);
            group.add(trackL);
            const trackR = createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a, 0.1, 0.9);
            trackR.position.set(0.48, 0.15, 0);
            group.add(trackR);

            // 로드휠 (일부欠落)
            for (let i = 0; i < 7; i++) {
                if (i !== 2 && i !== 5) {
                    const wheel = createVoxelCylinder(0.15, 0.15, 0.4, 0x333333);
                    wheel.position.set(-0.48, 0.15, -1.05 + i * 0.35);
                    wheel.rotation.z = Math.PI / 2;
                    group.add(wheel);
                    const wheelR = createVoxelCylinder(0.15, 0.15, 0.4, 0x333333);
                    wheelR.position.set(0.48, 0.15, -1.05 + i * 0.35);
                    wheelR.rotation.z = Math.PI / 2;
                    group.add(wheelR);
                }
            }

            // 포탑 (녹슨)
            const turret = createVoxelBox(1.0, 0.35, 1.2, rust, 0.1, 0.9);
            turret.position.set(0, 0.75, 0.1);
            group.add(turret);

            const barrel = createVoxelCylinder(0.08, 0.1, 1.5, olive, 0.5, 0.5);
            barrel.position.set(0, 0.95, -0.55);
            barrel.rotation.x = -0.15;
            group.add(barrel);

            // 커맨더 해치
            const hatch = createVoxelBox(0.35, 0.08, 0.35, darkRust);
            hatch.position.set(0.15, 0.95, 0.05);
            group.add(hatch);

            // 추가 물건
            const crate = createVoxelBox(0.5, 0.4, 0.4, 0x354a35, 0.2, 0.8);
            crate.position.set(-0.7, 0.55, 0.5);
            crate.rotation.set(0.1, 0.4, 0.15);
            group.add(crate);

            const tarp = createVoxelBox(0.8, 0.05, 1.2, 0x2a2520);
            tarp.position.set(0.5, 0.34, 0.4);
            group.add(tarp);

            const col = createVoxelBox(1.5, 1.4, 2.5, 0x000000);
            col.position.set(x, 0.6, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 7. buried: 묻힌 탱크
        function createBuriedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const buriedColor = 0x1a1815;
            const dirtColor = 0x252015;
            const rust = 0x3d2817;

            // 많이 기울어진赫尔
            const hull = createVoxelBox(1.25, 0.28, 2.0, buriedColor, 0, 1);
            hull.position.set(0.2, 0.12, 0.15);
            hull.rotation.set(0.25, 0.4 * rand, 0.2);
            group.add(hull);

            // 묻힌 트랙
            const trackL = createVoxelBox(0.35, 0.22, 1.4, 0x111111);
            trackL.position.set(-0.42, 0.06, 0.4);
            group.add(trackL);

            // 노출된 포탑
            const turret = createVoxelBox(0.8, 0.3, 0.9, buriedColor, 0, 1);
            turret.position.set(-0.15, 0.3, -0.1);
            turret.rotation.set(0.35, 0.5 * rand, 0.25);
            group.add(turret);

            // 포신
            const barrel = createVoxelCylinder(0.07, 0.08, 1.0, rust, 0, 1);
            barrel.position.set(0.1, 0.12, -0.5);
            barrel.rotation.set(0.9, 0.2, 0.4);
            group.add(barrel);

            // 흙
            const dirt1 = createVoxelBox(1.6, 0.2, 2.0, dirtColor);
            dirt1.position.set(0, 0.04, 0);
            group.add(dirt1);
            const dirt2 = createVoxelBox(1.0, 0.12, 0.8, dirtColor);
            dirt2.position.set(0.5, 0.2, 0.6);
            group.add(dirt2);

            const col = createVoxelBox(1.8, 0.7, 2.0, 0x000000);
            col.position.set(x, 0.25, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 8. overturned: 전복된 탱크
        function createOverturnedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const flippedColor = 0x2a2a2a;
            const underColor = 0x252015;

            // 완전히 뒤집힌赫尔
            const hullGroup = new THREE.Group();
            hullGroup.rotation.x = Math.PI;

            const hull = createVoxelBox(1.35, 0.32, 2.3, flippedColor, 0, 1);
            hull.position.y = 0.3;
            hullGroup.add(hull);

            const skirtL = createVoxelBox(0.08, 0.28, 2.25, flippedColor);
            skirtL.position.set(-0.65, 0.35, 0);
            hullGroup.add(skirtL);
            const skirtR = createVoxelBox(0.08, 0.28, 2.25, flippedColor);
            skirtR.position.set(0.65, 0.35, 0);
            hullGroup.add(skirtR);

            const trackL = createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a);
            trackL.position.set(-0.48, 0.15, 0);
            hullGroup.add(trackL);
            const trackR = createVoxelBox(0.4, 0.3, 2.3, 0x1a1a1a);
            trackR.position.set(0.48, 0.15, 0);
            hullGroup.add(trackR);

            // 바퀴 (위에)
            for (let i = 0; i < 7; i++) {
                const wheel = createVoxelCylinder(0.14, 0.14, 0.38, 0x3d2817);
                wheel.position.set(-0.48, 0.25, -1.05 + i * 0.35);
                wheel.rotation.z = Math.PI / 2;
                hullGroup.add(wheel);
                const wheelR = createVoxelCylinder(0.14, 0.14, 0.38, 0x3d2817);
                wheelR.position.set(0.48, 0.25, -1.05 + i * 0.35);
                wheelR.rotation.z = Math.PI / 2;
                hullGroup.add(wheelR);
            }

            group.add(hullGroup);

            // 포탑 (아래로)
            const turretGroup = new THREE.Group();
            turretGroup.position.set(0, 0.35, 0.15);
            turretGroup.rotation.x = Math.PI + 0.2;

            const turret = createVoxelBox(1.0, 0.35, 1.2, underColor, 0, 1);
            turretGroup.add(turret);

            const barrel = createVoxelCylinder(0.08, 0.1, 1.5, underColor, 0, 1);
            barrel.position.set(0, 0.2, -0.7);
            barrel.rotation.x = -Math.PI / 2;
            turretGroup.add(barrel);

            group.add(turretGroup);

            const col = createVoxelBox(1.6, 1.3, 2.4, 0x000000);
            col.position.set(x, 0.55, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 9. turret_destroyed: 포탑만 파괴됨
        function createTurretDestroyedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const color = 0x354a35;
            const damagedColor = 0x2a2a2a;

            //赫尔 (온전)
            buildTankHull(group, color, 0.1);

            // 포탑 (파괴되어 무너짐)
            const turret = createVoxelBox(0.7, 0.25, 0.8, damagedColor, 0, 1);
            turret.position.set(-0.3, 0.45, 0.2);
            turret.rotation.set(0.3, 0.7 * rand, 0.2);
            group.add(turret);

            // 짧은 포신
            const barrel = createVoxelCylinder(0.07, 0.08, 0.4, damagedColor, 0, 1);
            barrel.position.set(-0.2, 0.2, -0.3);
            barrel.rotation.set(1.0, 0.5, 0.8);
            group.add(barrel);

            // 파편
            for (let i = 0; i < 4; i++) {
                const piece = createVoxelBox(0.12, 0.08, 0.15, damagedColor);
                piece.position.set(
                    -0.5 + Math.random() * 0.3,
                    0.04 + Math.random() * 0.08,
                    -0.2 + Math.random() * 0.6
                );
                piece.rotation.set(Math.random(), Math.random(), Math.random());
                group.add(piece);
            }

            const col = createVoxelBox(1.5, 1.2, 2.4, 0x000000);
            col.position.set(x, 0.5, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 1. burnt_wreck: 타서 그을린 잔해 (화재 후)
        function createBurntWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const burntColor = 0x1a1a1a;
            const charColor = 0x0d0d0d;
            const rustColor = 0x3d2817;
            const emberColor = 0x4a1c1c;

            // 1. 메인 헐 (심하게 기울어짐)
            const hull = createVoxelBox(1.2, 0.45, 1.8, burntColor, 0, 1);
            hull.position.set(0.1, 0.35, 0);
            hull.rotation.set(0.12 * (rand - 0.5), 0.3 * rand, 0.08);
            group.add(hull);

            // 2. 파손된 포탑 (뒤쳐짐)
            const turret = createVoxelBox(0.85, 0.4, 0.9, charColor, 0, 1);
            turret.position.set(-0.3, 0.6, 0.2);
            turret.rotation.set(0.25, 0.8, 0.15);
            group.add(turret);

            // 3. 부서진 포신 (在地上)
            const barrel1 = createVoxelCylinder(0.07, 0.07, 0.8, rustColor, 0, 1);
            barrel1.position.set(0.2, 0.15, -0.8);
            barrel1.rotation.set(1.5, 0.3, 0.8);
            group.add(barrel1);

            // 4. 탱크 벨크 (흩어진)
            for (let i = 0; i < 3; i++) {
                const wheel = createVoxelCylinder(0.12, 0.12, 0.35, 0x111111);
                wheel.position.set(
                    -0.5 + rand * 0.3 + i * 0.25,
                    0.12 + Math.random() * 0.1,
                    -0.5 + Math.random() * 1.2
                );
                wheel.rotation.z = Math.PI / 2;
                group.add(wheel);
            }

            // 5. 연료 누출 흔적
            const stain = createVoxelBox(2.0, 0.02, 2.5, 0x1a0f0a);
            stain.position.set(0, 0.01, 0);
            group.add(stain);

            // 6. 탄약盒子 파편
            for (let i = 0; i < 2; i++) {
                const box = createVoxelBox(0.15, 0.1, 0.2, rustColor);
                box.position.set(
                    -0.8 + Math.random() * 0.4,
                    0.05,
                    0.3 + Math.random() * 0.5
                );
                box.rotation.set(Math.random() * 0.5, Math.random() * 2, Math.random() * 0.5);
                group.add(box);
            }

            // 충돌 박스
            const col = createVoxelBox(1.8, 1.2, 2.2, 0x000000);
            col.position.set(x, 0.5, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 2. exploded_wreck: 폭발로 산산이 흩어진 잔해
        function createExplodedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const metalColor = 0x2a2a2a;
            const debrisColor = 0x1f1f1f;
            const hotColor = 0x3a2020;

            // 1. 메인 헐 파편 (흩어진 상태)
            const hullChunk1 = createVoxelBox(0.6, 0.3, 0.8, metalColor, 0, 1);
            hullChunk1.position.set(-0.4, 0.2, 0.3);
            hullChunk1.rotation.set(0.3, 0.5, 0.2);
            group.add(hullChunk1);

            const hullChunk2 = createVoxelBox(0.5, 0.25, 0.6, debrisColor, 0, 1);
            hullChunk2.position.set(0.5, 0.15, -0.2);
            hullChunk2.rotation.set(-0.2, 1.2, 0.4);
            group.add(hullChunk2);

            const hullChunk3 = createVoxelBox(0.4, 0.2, 0.5, metalColor, 0, 1);
            hullChunk3.position.set(0.1, 0.1, 0.7);
            hullChunk3.rotation.set(0.5, 2.1, -0.3);
            group.add(hullChunk3);

            // 2. 포탑 (뒤쳐지고 갈라짐)
            const turret1 = createVoxelBox(0.4, 0.35, 0.45, hotColor, 0, 1);
            turret1.position.set(0.2, 0.4, 0.1);
            turret1.rotation.set(0.8, 0.3, 0.1);
            group.add(turret1);

            const turret2 = createVoxelBox(0.35, 0.3, 0.4, debrisColor, 0, 1);
            turret2.position.set(-0.5, 0.25, -0.3);
            turret2.rotation.set(1.1, 1.5, 0.6);
            group.add(turret2);

            // 3. 포신 (산산이)
            const barrelPiece = createVoxelCylinder(0.06, 0.06, 0.5, metalColor, 0, 1);
            barrelPiece.position.set(0.7, 0.08, 0.5);
            barrelPiece.rotation.set(1.8, 0.5, 1.2);
            group.add(barrelPiece);

            // 4. 다수의 금속 파편
            for (let i = 0; i < 8; i++) {
                const debris = createVoxelBox(
                    0.1 + Math.random() * 0.2,
                    0.05 + Math.random() * 0.1,
                    0.1 + Math.random() * 0.15,
                    i % 2 === 0 ? metalColor : debrisColor
                );
                debris.position.set(
                    -0.8 + Math.random() * 1.6,
                    0.03 + Math.random() * 0.15,
                    -0.8 + Math.random() * 1.6
                );
                debris.rotation.set(Math.random() * 2, Math.random() * 3, Math.random() * 2);
                group.add(debris);
            }

            // 5. 크레이터 흔적
            const crater = createVoxelBox(2.5, 0.08, 2.5, 0x0a0a0a);
            crater.position.set(0, 0.04, 0);
            group.add(crater);

            // 충돌 박스
            const col = createVoxelBox(2.0, 0.8, 2.0, 0x000000);
            col.position.set(x, 0.3, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 3. abandoned_wreck: 방치되어 녹슨 폐기물
        function createAbandonedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const oliveDrab = 0x3d4a3a;
            const rust = 0x5c4033;
            const darkRust = 0x3d2817;
            const camoGreen = 0x354a35;

            // 1. 비교적 온전한 헐
            const hull = createVoxelBox(1.25, 0.48, 1.85, oliveDrab, 0.3, 0.7);
            hull.position.y = 0.4;
            hull.rotation.z = 0.03 * (rand - 0.5);
            group.add(hull);

            // 2. 녹슨 포탑
            const turret = createVoxelBox(0.95, 0.42, 1.1, rust, 0.1, 0.9);
            turret.position.set(0, 0.75, 0.1);
            group.add(turret);

            // 3. 포탑 후드
            const commanderHatch = createVoxelBox(0.35, 0.08, 0.35, darkRust);
            commanderHatch.position.set(0.15, 0.98, 0.05);
            group.add(commanderHatch);

            // 4. 포신 (약간 기울어짐)
            const barrel = createVoxelCylinder(0.085, 0.1, 1.4, oliveDrab, 0.5, 0.5);
            barrel.position.set(0, 0.85, -0.55);
            barrel.rotation.x = -0.15;
            group.add(barrel);

            // 5. 무른 Tracks
            const trackL = createVoxelBox(0.4, 0.35, 1.9, 0x1a1a1a, 0.1, 0.9);
            trackL.position.set(-0.48, 0.18, 0);
            group.add(trackL);
            const trackR = createVoxelBox(0.4, 0.35, 1.9, 0x1a1a1a, 0.1, 0.9);
            trackR.position.set(0.48, 0.18, 0);
            group.add(trackR);

            // 6. 로드휠 (일부欠落)
            for (let i = 0; i < 5; i++) {
                if (Math.random() > 0.3) {
                    const wheel = createVoxelCylinder(0.14, 0.14, 0.38, 0x2a2a2a);
                    wheel.position.set(-0.48, 0.15, -0.7 + i * 0.35);
                    wheel.rotation.z = Math.PI / 2;
                    group.add(wheel);
                }
            }

            // 7. 덮개/箱子Accumulation
            const crate = createVoxelBox(0.5, 0.4, 0.4, camoGreen, 0.2, 0.8);
            crate.position.set(-0.7, 0.55, 0.5);
            crate.rotation.set(0.1, 0.4, 0.15);
            group.add(crate);

            // 8. 덮인 물건
            const tarp = createVoxelBox(0.8, 0.05, 1.2, 0x2a2520);
            tarp.position.set(0.5, 0.42, 0.4);
            group.add(tarp);

            // 충돌 박스
            const col = createVoxelBox(1.5, 1.3, 2.0, 0x000000);
            col.position.set(x, 0.55, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 4. buried_wreck: 땅에 반쯤 묻힌 잔해
        function createBuriedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const buriedColor = 0x1a1815;
            const dirtColor = 0x252015;
            const rust = 0x3d2817;

            // 1. 묻힌 메인 헐 (많이 기울어짐)
            const hull = createVoxelBox(1.15, 0.4, 1.7, buriedColor, 0, 1);
            hull.position.set(0.15, 0.15, 0.1);
            hull.rotation.set(0.25, 0.4, 0.18);
            group.add(hull);

            // 2. 노출된 포탑
            const turret = createVoxelBox(0.75, 0.35, 0.85, buriedColor, 0, 1);
            turret.position.set(-0.2, 0.35, -0.1);
            turret.rotation.set(0.35, 0.6, 0.2);
            group.add(turret);

            // 3. 묻힌 포신
            const barrel = createVoxelCylinder(0.07, 0.08, 1.0, rust, 0, 1);
            barrel.position.set(0.1, 0.12, -0.4);
            barrel.rotation.set(0.8, 0.2, 0.3);
            group.add(barrel);

            // 4. 드러난 트랙
            const trackL = createVoxelBox(0.35, 0.25, 1.2, 0x111111);
            trackL.position.set(-0.45, 0.08, 0.3);
            group.add(trackL);

            // 5. 흙 더미
            const dirt1 = createVoxelBox(1.4, 0.25, 1.8, dirtColor);
            dirt1.position.set(0, 0.05, 0);
            group.add(dirt1);
            const dirt2 = createVoxelBox(0.8, 0.15, 0.6, dirtColor);
            dirt2.position.set(0.5, 0.25, 0.5);
            group.add(dirt2);

            // 6. 노출된 부품
            const wheel = createVoxelCylinder(0.1, 0.1, 0.3, 0x222222);
            wheel.position.set(0.5, 0.12, -0.3);
            wheel.rotation.z = Math.PI / 2;
            group.add(wheel);

            // 충돌 박스
            const col = createVoxelBox(1.6, 0.8, 1.8, 0x000000);
            col.position.set(x, 0.3, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 5. overturned_wreck: 전복된 (바퀴 위) 상태
        function createOverturnedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const flippedColor = 0x1f1f1f;
            const underColor = 0x2a2520;
            const rustColor = 0x4a3525;

            // 1. 전복된 메인 헐 (위로 뒤집힘)
            const hull = createVoxelBox(1.2, 0.45, 1.8, flippedColor, 0, 1);
            hull.position.set(0, 0.7, 0);
            hull.rotation.x = Math.PI; // 완전히 뒤집힘
            hull.rotation.z = 0.1 * (rand - 0.5);
            group.add(hull);

            // 2. 아래로 향한 포탑
            const turret = createVoxelBox(0.85, 0.4, 0.95, underColor, 0, 1);
            turret.position.set(0, 0.45, 0.15);
            turret.rotation.x = Math.PI + 0.15;
            group.add(turret);

            // 3. 위로 튀어나온 포신
            const barrel = createVoxelCylinder(0.075, 0.09, 1.3, flippedColor, 0, 1);
            barrel.position.set(0, 0.85, -0.5);
            barrel.rotation.set(-0.3, 0, 0);
            group.add(barrel);

            // 4. 바퀴 (위에 노출)
            for (let i = 0; i < 6; i++) {
                const wheel = createVoxelCylinder(0.13, 0.13, 0.35, rustColor);
                wheel.position.set(
                    -0.48,
                    0.25,
                    -0.8 + i * 0.32
                );
                wheel.rotation.z = Math.PI / 2;
                group.add(wheel);
            }

            // 5. 노출된底面 (더럽고 녹슨)
            const bottom = createVoxelBox(1.0, 0.15, 1.5, underColor);
            bottom.position.set(0, 0.08, 0);
            group.add(bottom);

            // 6. 주변 흙 파편
            for (let i = 0; i < 4; i++) {
                const dirt = createVoxelBox(0.2, 0.08, 0.25, 0x252015);
                dirt.position.set(
                    -0.7 + Math.random() * 0.4,
                    0.04,
                    -0.6 + Math.random() * 1.2
                );
                group.add(dirt);
            }

            // 충돌 박스
            const col = createVoxelBox(1.5, 1.2, 2.0, 0x000000);
            col.position.set(x, 0.5, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 6. turret_only_wreck: 포탑만 남은 상태
        function createTurretOnlyWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const turretColor = 0x1a1a1a;
            const metalColor = 0x2d2d2d;
            const rustColor = 0x4a3525;

            // 1. 분리된 포탑 (헐에서 분리)
            const turret = createVoxelBox(0.9, 0.43, 1.0, turretColor, 0, 1);
            turret.position.set(0.2, 0.45, 0.15);
            turret.rotation.set(0.2, 0.7 * rand, 0.15);
            group.add(turret);

            // 2. 커맨더 해치
            const hatch = createVoxelBox(0.32, 0.07, 0.32, metalColor);
            hatch.position.set(0.25, 0.7, 0.25);
            group.add(hatch);

            // 3. 짧게 남은 포신
            const barrel = createVoxelCylinder(0.08, 0.09, 0.5, rustColor, 0, 1);
            barrel.position.set(0.15, 0.5, -0.4);
            barrel.rotation.x = -0.4 + 0.2 * rand;
            group.add(barrel);

            // 4. 대공기관총Mount
            const mgMount = createVoxelBox(0.08, 0.15, 0.08, metalColor);
            mgMount.position.set(-0.25, 0.65, 0.3);
            group.add(mgMount);

            // 5. 포탑 부품 파편
            for (let i = 0; i < 3; i++) {
                const piece = createVoxelBox(
                    0.15 + Math.random() * 0.2,
                    0.08 + Math.random() * 0.1,
                    0.15 + Math.random() * 0.15,
                    metalColor
                );
                piece.position.set(
                    -0.5 + Math.random() * 0.3,
                    0.04 + Math.random() * 0.1,
                    -0.3 + Math.random() * 0.8
                );
                piece.rotation.set(Math.random(), Math.random(), Math.random());
                group.add(piece);
            }

            // 6. 남겨진 헐 흔적 (많이 파손)
            const hullRemnant = createVoxelBox(0.6, 0.2, 0.8, 0x151515);
            hullRemnant.position.set(-0.5, 0.1, -0.3);
            hullRemnant.rotation.y = 0.8;
            group.add(hullRemnant);

            // 충돌 박스
            const col = createVoxelBox(1.2, 1.0, 1.4, 0x000000);
            col.position.set(x, 0.4, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // 7. scraped_wreck: 스크래핑된 고철 더미
        function createScrapedWreck(x, z, rotBase, rand) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotBase;
            scene.add(group);
            wrecks.push(group);

            const scrapColor = 0x3a3a3a;
            const darkMetal = 0x252525;
            const paintRemnant = 0x2a3530;

            // 1. 납작한 고철 시트
            const scrap1 = createVoxelBox(1.4, 0.15, 1.6, scrapColor, 0, 1);
            scrap1.position.set(0.1, 0.08, 0.1);
            scrap1.rotation.set(0.08, 0.3, 0.12);
            group.add(scrap1);

            // 2. 뒤집힌 시트
            const scrap2 = createVoxelBox(0.8, 0.12, 1.0, darkMetal, 0, 1);
            scrap2.position.set(-0.4, 0.25, -0.3);
            scrap2.rotation.set(1.2, 0.8, 0.5);
            group.add(scrap2);

            // 3. 녹슨 부품 무더기
            for (let i = 0; i < 5; i++) {
                const part = createVoxelBox(
                    0.15 + Math.random() * 0.25,
                    0.08 + Math.random() * 0.12,
                    0.2 + Math.random() * 0.3,
                    i % 2 === 0 ? 0x3d2817 : darkMetal
                );
                part.position.set(
                    -0.6 + Math.random() * 1.2,
                    0.04 + Math.random() * 0.15,
                    -0.6 + Math.random() * 1.2
                );
                part.rotation.set(Math.random() * 2, Math.random() * 3, Math.random() * 2);
                group.add(part);
            }

            // 4. 트랙 벨크
            const trackPiece = createVoxelBox(0.35, 0.18, 1.2, 0x1a1a1a);
            trackPiece.position.set(0.5, 0.1, 0.2);
            trackPiece.rotation.set(0.1, -0.6, 0.15);
            group.add(trackPiece);

            // 5. 납작한휠
            for (let i = 0; i < 3; i++) {
                const wheel = createVoxelCylinder(0.1, 0.08, 0.25, 0x2a2a2a);
                wheel.position.set(-0.3 + i * 0.35, 0.05, 0.5);
                wheel.rotation.z = Math.PI / 2;
                group.add(wheel);
            }

            // 6. 흙apan
            const dirt = createVoxelBox(1.8, 0.05, 2.0, 0x201a15);
            dirt.position.set(0, 0.025, 0);
            group.add(dirt);

            // 충돌 박스
            const col = createVoxelBox(1.6, 0.5, 1.8, 0x000000);
            col.position.set(x, 0.2, z);
            col.rotation.y = rotBase;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col);
            walls.push(col);
        }

        // Helper: Create Voxel Trees
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

                    const broken = Math.random() < 0.15;
                    if (broken) continue;

                    const wire = createVoxelBox(isHorizontal ? postSpacing : 0.03, 0.03, isHorizontal ? 0.03 : postSpacing, wireColor);
                    if (isHorizontal) {
                        wire.position.set((startPos + endPos) / 2, wireH, 0);
                    } else {
                        wire.position.set(0, wireH, (startPos + endPos) / 2);
                    }
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

            for (let i = 0; i <= numPosts; i++) {
                const pos = -length / 2 + i * postSpacing;
                const postH = h - (i % 2) * 0.3;
                const colW = isHorizontal ? 0.4 : 0.4;
                const colD = isHorizontal ? 0.4 : 0.4;
                const col = createVoxelBox(colW, postH, colD, 0x000000);
                if (isHorizontal) col.position.set(x + pos, postH / 2, z);
                else col.position.set(x, postH / 2, z + pos);
                col.visible = false;
                col.userData = { type: 'fence' };
                scene.add(col);
                walls.push(col);
            }

            const colW = isHorizontal ? w : 0.2;
            const colD = isHorizontal ? 0.2 : d;
            const col = createVoxelBox(colW, h * 0.3, colD, 0x000000);
            col.position.set(x, h * 0.15, z);
            col.visible = false;
            col.userData = { type: 'fence' };
            scene.add(col);
            walls.push(col);
        }

        // Fixed props from CONFIG
        CONFIG.MAP.PROPS.forEach(prop => {
            if (prop.type === 'tree') createBurnedTree(prop.x, prop.z);
            else if (prop.type === 'hedgehog') createHedgehog(prop.x, prop.z);
            else if (prop.type === 'crate') createProp('crate', prop.x, prop.z);
            else if (prop.type === 'barrel') createProp('barrel', prop.x, prop.z);
            else if (prop.type === 'sandbags') createSandbags(prop.x, prop.z);
            else if (prop.type === 'shack') createShack(prop.x, prop.z, prop.rot || 0);
            else if (prop.type === 'watchtower') createWatchtower(prop.x, prop.z);
        });

        // Fixed Destroyed Tanks (Wrecks)
        CONFIG.MAP.WRECKS.forEach(pos => {
            createWreck(pos.x, pos.z);
        });

        CONFIG.MAP.LAYOUT.forEach(wallDef => {
            createFortressWall(wallDef);
        });

        if (CONFIG.MAP.DAMAGED_FENCE) {
            CONFIG.MAP.DAMAGED_FENCE.forEach(fenceDef => {
                createDamagedFence(fenceDef);
            });
        }

        // CRITICAL: Update all world matrices before any safety checks (getRandomSpawnPoint uses these)
        scene.updateMatrixWorld(true);

        // BAKE all collision boxes once for performance
        walls.forEach(wall => {
            const box = new THREE.Box3().setFromObject(wall);
            wallBoxes.push(box);
        });

        // 수리 정비소(Repair Station) 생성
        repairStation = new RepairStation(0, 0);

        // My Tank
        const spawn = getRandomSpawnPoint();
        myTank = new Tank(myId, myName, true);
        myTank.group.position.set(spawn.x, 0, spawn.z);
        myTank.updateHP(CONFIG.TANK.MAX_HP);

        // Bots (Now handled by updateMasterStatus once multi-channel is r        // Supabase Init
        const config = window.WCGamesConfig;
        if (config && config.SUPABASE_URL) {
            if (!supabaseClient) {
                supabaseClient = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
            }

            if (!channel) {
                channel = supabaseClient.channel('voxel-tank-multi', {
                    config: {
                        broadcast: { self: false },
                        presence: { key: myId }
                    }
                });

                setupChannelListeners();

                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        updatePresenceState();
                        setTimeout(updateMasterStatus, 500);
                    }
                });
            }
        }

        if (animationId) cancelAnimationFrame(animationId);
        animate();

        window.addEventListener('resize', () => {
            const isPC = window.matchMedia('(pointer: fine)').matches;
            if (isPC) {
                // Keep internal resolution but update camera aspect
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

/**
 * 채널 리스너 설정 - 멀티플레이어 이벤트 처리 (이동, 발사, 피격, 사망 등)
 */
function setupChannelListeners() {
    if (!channel) return;

    // Presence 이벤트 - 플레이어 입퇴장 감지
    channel.on('presence', { event: 'sync' }, () => {
        updateMasterStatus();
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        updateMasterStatus();
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        if (tanks.has(key)) {
            tanks.get(key).destroy();
            tanks.delete(key);
        }
        updateMasterStatus();
    });

    // 이동 이벤트 수신
    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
        const id = payload.i || payload.id;
        if (id === myId) return;

        let tank = tanks.get(id);
        if (!tank) {
            tank = new Tank(id, payload.n || payload.name);
            tanks.set(id, tank);
        }

        if (tank && tank.group) {
            // 직렬화 데이터(d) 처리
            if (payload.d) {
                const d = unpackTankData(payload.d);
                if (d) {
                    const targetPos = new THREE.Vector3(d.x, 0, d.z);
                    tank.group.position.lerp(targetPos, 0.4);
                    tank.group.rotation.y = lerpAngle(tank.group.rotation.y, d.r, 0.4);
                    if (tank.turretGroup) tank.turretGroup.rotation.y = lerpAngle(tank.turretGroup.rotation.y, d.tr, 0.4);
                    tank.updateHP(d.h);
                    tank.kills = d.k || 0;

                    let changed = false;
                    if (tank.levelCannon !== d.l1) { tank.levelCannon = d.l1; changed = true; }
                    if (tank.levelSpeed !== d.l2) { tank.levelSpeed = d.l2; changed = true; }
                    if (tank.levelArmor !== d.l3) { tank.levelArmor = d.l3; changed = true; }
                    if (changed) tank.updateArmorVisual();
                }
            } else {
                // 하위 호환용 레거시 처리
                if (payload.pos) {
                    const targetPos = new THREE.Vector3(payload.pos.x, payload.pos.y, payload.pos.z);
                    tank.group.position.lerp(targetPos, 0.4);
                }
                tank.group.rotation.y = lerpAngle(tank.group.rotation.y, payload.rot, 0.4);
                if (tank.turretGroup) tank.turretGroup.rotation.y = lerpAngle(tank.turretGroup.rotation.y, payload.turretRot, 0.4);
                tank.updateHP(payload.hp);
                tank.kills = payload.kills || 0;

                if (payload.levels) {
                    let changed = false;
                    if (tank.levelCannon !== payload.levels.cannon) { tank.levelCannon = payload.levels.cannon; changed = true; }
                    if (tank.levelSpeed !== payload.levels.speed) { tank.levelSpeed = payload.levels.speed; changed = true; }
                    if (tank.levelArmor !== payload.levels.armor) { tank.levelArmor = payload.levels.armor; changed = true; }
                    if (changed) tank.updateArmorVisual();
                }
            }

            tank.lastSeen = Date.now();
        }
    });

    // 발사 이벤트 수신
    channel.on('broadcast', { event: 'fire' }, ({ payload }) => {
        const id = payload.i || payload.ownerId;
        if (id === myId) return;

        let bPos, bDir;
        if (payload.p && Array.isArray(payload.p)) {
            bPos = new THREE.Vector3(payload.p[0], payload.p[1], payload.p[2]);
            bDir = new THREE.Vector3(payload.v[0], payload.v[1], payload.v[2]);
        } else {
            bPos = new THREE.Vector3(payload.pos.x, payload.pos.y, payload.pos.z);
            bDir = new THREE.Vector3(payload.dir.x, payload.dir.y, payload.dir.z);
        }

        const level = payload.l !== undefined ? payload.l : payload.level;
        const bulletScale = level ? 1.0 + (Math.min(3, level) * CONFIG.UPGRADE.CANNON.SCALE_INC) : 1.0;

        bulletManager.add(bPos, bDir, id, CONFIG.TANK.DAMAGE, bulletScale);

        const tank = tanks.get(id);
        if (tank) tank.playShootEffect();
    });

    // 피격 이벤트 수신
    channel.on('broadcast', { event: 'hit' }, ({ payload }) => {
        const sId = payload.s || payload.shooterId;
        if (sId === myId) return;
        const tId = payload.t || payload.targetId;
        const damage = payload.d || payload.damage;

        let target = (tId === myId) ? myTank : tanks.get(tId);
        if (target) {
            target.handleHit(damage, sId);
        }
    });

    // 사망 이벤트 수신
    channel.on('broadcast', { event: 'death' }, ({ payload }) => {
        // 단축 키(i) 또는 레거시 키 대응
        const vId = payload.i || payload.victimId || payload.id;
        const kId = payload.k || payload.shooterId || payload.killerId;

        const victim = (vId === myId) ? myTank : tanks.get(vId);
        if (victim) {
            if (vfx) vfx.spawnExplosion(victim.group.position);
            if (victim !== myTank) {
                victim.destroy();
                tanks.delete(vId);
            }
            updateScoreboard();
        }

        const killer = [myTank, ...Array.from(tanks.values())].find(t => t && t.id === kId);
        if (killer) {
            killer.kills++;
            updateScoreboard();
            if (killer.isLocal) syncMultiplayer();
        }
    });


    if (Game.timeoutInterval) clearInterval(Game.timeoutInterval);
    Game.timeoutInterval = setInterval(() => {
        const now = Date.now();
        tanks.forEach((tank, id) => {
            if (now - tank.lastSeen > 3000) {
                tank.destroy();
                tanks.delete(id);
            }
        });
        if (channel) updateMasterStatus();
    }, 1000);
}

window.Game = Game;

WCGames.init({
    id: 'voxel-tank',
    onStart: () => {
        WCGames.Audio.init();
        AudioSFX.init();
        Game.init();
        updatePresenceState();
    },
    onPause: updatePresenceState,
    onResume: updatePresenceState,
    onGameOver: () => {
        updatePresenceState();
        updateMasterStatus();
    },
    onRestart: () => {
        cleanupInputListeners();
        window.addEventListener('keydown', keyDownHandler);
        window.addEventListener('keyup', keyUpHandler);
        window.addEventListener('mousedown', mouseDownHandler);
        window.addEventListener('mouseup', mouseUpHandler);
        window.addEventListener('mousemove', mouseMoveHandler);
        if (bulletManager) {
            const bullets = bulletManager.getBulletArray();
            for (let i = bullets.length - 1; i >= 0; i--) {
                bulletManager.remove(i);
            }
        }
        if (!amIMaster && bots) {
            bots.forEach(b => b.destroy());
            bots.length = 0;
        }
        const spawn = getRandomSpawnPoint();
        if (myTank) {
            myTank.group.position.set(spawn.x, 0, spawn.z);
            myTank.updateHP(CONFIG.TANK.MAX_HP);
            myTank.kills = 0;
        }
        updateScoreboard();
        updatePresenceState();
        updateMasterStatus();
        syncMultiplayer();
    }
});
/**
 * 수동 공습 요청 - K 키로 호출 (현재 위치上方에 전투기 출격)
 */
function triggerManualAirstrike() {
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
    spawnFloatingText(myTank.group.position.clone().add(new THREE.Vector3(0, 3, 0)), "AIR RAID REQUESTED", "#ff3e3e");
}

// Ensure createVoxelBox supports emissive if not already
// (Looking at existing usages, they usually pass intensity or similar)
