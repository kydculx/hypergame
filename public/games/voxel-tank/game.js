import * as THREE from 'three';

/* 1. Constant Configuration (Balance, Styles) */
const CONFIG = {
    TANK: {
        FORWARD_SPEED: 5,
        BACKWARD_SPEED: 0,
        ROTATE_SPEED: 4,
        TURRET_ROTATE_SPEED: 4,
        FIRE_COOLDOWN: 1000, // ms
        MAX_HP: 100
    },
    BULLET: {
        SPEED: 30,
        LIFE_TIME: 1500, // ms
        DAMAGE: 10
    },
    WORLD: {
        SIZE: 150,
        GRID_SIZE: 1
    },
    LERP_SPEED: {
        TURRET: 4.0 // Smoothness factor
    },
    COLORS: {
        SELF: 0x4d79ff, // Blue
        OTHER: 0xff4d4d, // Red
        FLOOR_1: 0x1a1412, // Scorched Earth
        FLOOR_2: 0x252019, // Ash Ground
        FLOOR_3: 0x1f1c18, // Charred Soil
        FLOOR_4: 0x2a2520, // Burnt Rubble
        BULLET: 0xffff00,
        WALL: 0x3a3530,
        BOT: 0x9933ff // Purple for bots
    },
    MAP: {
        LAYOUT: [
            // Corners - L-shaped barriers
            { x: -30, z: -30, w: 10, d: 2 }, { x: -34, z: -26, w: 2, d: 10 },
            { x: 30, z: -30, w: 10, d: 2 }, { x: 34, z: -26, w: 2, d: 10 },
            { x: -30, z: 30, w: 10, d: 2 }, { x: -34, z: 26, w: 2, d: 10 },
            { x: 30, z: 30, w: 10, d: 2 }, { x: 34, z: 26, w: 2, d: 10 },
            // Middle Cross-style barriers
            { x: 0, z: 25, w: 20, d: 2 }, { x: 0, z: -25, w: 20, d: 2 },
            { x: 25, z: 0, w: 2, d: 20 }, { x: -25, z: 0, w: 2, d: 20 },
            // Outer small cover
            { x: -40, z: 0, w: 4, d: 4 }, { x: 40, z: 0, w: 4, d: 4 },
            { x: 0, z: -40, w: 4, d: 4 }, { x: 0, z: 40, w: 4, d: 4 }
        ],
        WRECKS: [
            { x: -15, z: -15 }, { x: 15, z: 15 },
            { x: -18, z: 20 }, { x: 22, z: -12 },
            { x: 5, z: 35 }, { x: -35, z: 8 }
        ],
        PROPS: [
            { type: 'tree', x: -20, z: -25 }, { type: 'tree', x: 25, z: -30 },
            { type: 'tree', x: -30, z: 15 }, { type: 'tree', x: 35, z: 20 },
            { type: 'tree', x: -15, z: 35 }, { type: 'tree', x: 10, z: -40 },
            { type: 'hedgehog', x: -25, z: 0 }, { type: 'hedgehog', x: 30, z: 10 },
            { type: 'hedgehog', x: 0, z: -35 }, { type: 'hedgehog', x: -10, z: 40 },
            { type: 'crate', x: -35, z: -20 }, { type: 'crate', x: 20, z: 35 },
            { type: 'crate', x: 40, z: -15 }, { type: 'crate', x: -25, z: 30 },
            { type: 'barrel', x: 15, z: -20 }, { type: 'barrel', x: -40, z: 25 },
            { type: 'barrel', x: 35, z: -35 }, { type: 'barrel', x: -20, z: 10 }
        ]
    },
    BOT: {
        COUNT: 15,
        FORWARD_SPEED: 5,
        BACKWARD_SPEED: 3,
        ROTATE_SPEED: 4,
        FIRE_COOLDOWN: 1800,
        DETECTION_RANGE: 30,
        ATTACK_RANGE: 20,
        // NICKNAMES is now generated dynamically as GuestXXXX
        NAME_PREFIX: "Guest",
        COLORS: [0x9933ff, 0xff9900, 0x00ffcc, 0xff0066, 0x33cc33, 0xffdd00]
    },
    POWERUP: {
        HEAL_AMOUNT: 30,
        SPAWN_INTERVAL: 60,
        MAX_COUNT: 10
    },
    UPGRADE: {
        TYPES: ['CANNON', 'SPEED', 'ARMOR'],
        CANNON: { DAMAGE_INC: 2, SCALE_INC: 0.15 },
        SPEED: { MOVE_INC: 0.4, ROT_INC: 0.15 },
        ARMOR: { HP_INC: 30 }
    },
    AIRSTRIKE: {
        INTERVAL_MIN: 30,
        INTERVAL_MAX: 60,
        PLANE_SPEED: 25,
        PLANE_HEIGHT: 10,
        BOMB_COUNT: 10,
        BOMB_INTERVAL: 0.15,
        BOMB_DAMAGE: 45,
        BOMB_RADIUS: 6,
        TARGETING_RADIUS: 25,
        FALL_SPEED: 18
    },
    REPAIR_STATION: {
        RADIUS: 1.5, // 수리 반경
        HEAL_RATE: 8.0, // 초당 회복량
        COLOR_PAD: 0x2d3436, // 기본 패드 색상
        COLOR_GLOW: 0x00b894 // 회복 중인 상태의 발광 색상
    },
    CAMERA: {
        HEIGHT: 20,
        OFFSET_Z: 10,
        FOV: 90
    }
};

/* 1.5 Deterministic Random for World Sync */
function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function lerpAngle(a, b, t) {
    let d = b - a;
    while (d < -Math.PI) d += Math.PI * 2;
    while (d > Math.PI) d -= Math.PI * 2;
    return a + d * t;
}

function normalizeAngle(angle) {
    while (angle <= -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
}

/* 1.6 Terrain Height Function (Disabled) */
function getTerrainHeight(x, z) {
    return 0;
}

function getTerrainNormal(x, z) {
    return new THREE.Vector3(0, 1, 0);
}

/* 2. State & Variables (Runtime variables) */
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

        // Append session key to ensure uniqueness for same user in multiple tabs
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
let myId = identity.id;
let myName = identity.name;
let scene, camera, renderer, clock;
let myTank;
const tanks = new Map(); // ID -> Tank instance
const bullets = [];
const walls = []; // Array of wall meshes
const trees = []; // Array of tree groups for animation
const wrecks = []; // Array of destroyed tanks for smoke vfx
const bots = []; // Array of Bot instances
const powerups = []; // NEW: Array of active HealthPotion instances
const wallBoxes = []; // NEW: Cache for world-space bounding boxes
const airstrikePlanes = []; // NEW: Array of active FighterPlane instances
const airstrikeBombs = []; // NEW: active AirstrikeBomb instances
let repairStation; // NEW: 단일 수리 정비소 인스턴스
let airstrikeWarningActive = false;
let nextAirstrikeTime = 0; // NEW: Timer for next airstrike event
let supabaseClient;
let channel;
let amIMaster = false;
let lastFireTime = 0;
let lastSyncTime = 0;
let lastPowerupSpawnTime = 0;
let animationId = null;
let cameraShakeTime = 0;
let wreckSmokeTimer = 0;
let directionalLight; // Global for shadow follow

/* 3. Utilities (Helper functions) */
function createVoxelBox(w, h, d, color, metalness = 0.2, roughness = 0.8) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({
        color,
        metalness: metalness,
        roughness: roughness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true; // Enabled for tank, crates, etc.
    mesh.receiveShadow = true;
    return mesh;
}

function createVoxelCylinder(radiusTop, radiusBottom, height, color, metalness = 0.2, roughness = 0.8) {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 12);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function createVoxelCone(radius, height, color) {
    const geometry = new THREE.ConeGeometry(radius, height, 12);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/* Helper to create floating emoji labels for items */
function createItemLabel(emoji) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1, 1, 1);
    return sprite;
}

/* Particle System for VFX */
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.MAX_PARTICLES = 1000;
        this.group = new THREE.Group();
        scene.add(this.group);

        // --- PERFORMANCE: Shared objects ---
        this.sharedGeo = new THREE.BoxGeometry(1, 1, 1);
        this.materials = new Map(); // Cache for materials
        // Pre-create common ones
        this.getMat = (color, opacity = 1) => {
            const key = `${color}_${opacity}`;
            if (!this.materials.has(key)) {
                this.materials.set(key, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }));
            }
            return this.materials.get(key);
        };
    }

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

    // Specialized welding sparks (용접 스파크 - 3색 조합 & 고중력)
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

    spawnMuzzleFlash(pos, dir, color = 0xffaa00) {
        for (let i = 0; i < 20; i++) {
            const size = 0.08 + Math.random() * 0.18;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
            const p = new THREE.Mesh(geometry, material);
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

        for (let i = 0; i < 6; i++) {
            const size = 0.25 + Math.random() * 0.25;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
            const p = new THREE.Mesh(geometry, material);
            p.position.copy(pos);
            const vel = dir.clone().multiplyScalar(3 + Math.random() * 4);
            this.particles.push({ mesh: p, vel: vel, life: 50 + Math.random() * 50, maxLife: 100, gravity: 0 });
            this.group.add(p);
        }
    }

    // NEW: Specialized heal burst effect (정제된 힐 이펙트)
    spawnHeal(pos) {
        const color = 0x00ff00; // Pure Green
        const count = 12; // Reduced from 30
        const mat = this.getMat(color, 0.7);
        for (let i = 0; i < count; i++) {
            const p = new THREE.Mesh(this.sharedGeo, mat);
            const size = 0.08 + Math.random() * 0.1; // Slightly smaller
            p.scale.setScalar(size);

            // Start closer to the tank
            const angle = Math.random() * Math.PI * 2;
            const radius = 0.4 + Math.random() * 0.4;
            p.position.set(
                pos.x + Math.cos(angle) * radius,
                pos.y + Math.random() * 0.5,
                pos.z + Math.sin(angle) * radius
            );

            // Gentler upward movement
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                1.0 + Math.random() * 1.5, // Slower
                (Math.random() - 0.5) * 0.3
            );

            this.particles.push({
                mesh: p,
                vel: vel,
                life: 600 + Math.random() * 400, // Shorter life
                maxLife: 1000,
                gravity: -0.5, // Less anti-gravity
                friction: 0.96
            });
            this.group.add(p);
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

/* Audio System (Web Audio API) */
const AudioSFX = {
    ctx: null,
    master: null,
    buffers: {}, // Cache for loaded sounds

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
            this.load('explosion.mp3', 'explosion'); // NEW: Explosion sound
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

/* 4. PowerUp & Item Classes */
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

        const body = createVoxelCylinder(0.08, 0.08, 0.35, 0xd4a017);
        body.rotation.x = Math.PI / 2;
        this.group.add(body);

        const tip = createVoxelCone(0.08, 0.18, 0xffcc00);
        tip.position.z = -0.26;
        tip.rotation.x = Math.PI / 2;
        this.group.add(tip);

        const tracerGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 })
        );
        tracerGlow.position.z = -0.32;
        this.group.add(tracerGlow);

        const base = createVoxelCylinder(0.09, 0.09, 0.04, 0x8d6e63);
        base.position.z = 0.18;
        base.rotation.x = Math.PI / 2;
        this.group.add(base);

        const casing = createVoxelCylinder(0.06, 0.06, 0.08, 0x654321);
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
        if (this.trailTimer > 0.02 && vfx) {
            this.trailTimer = 0;
            const trailPos = this.group.position.clone();
            vfx.particles.push({
                mesh: new THREE.Mesh(
                    new THREE.SphereGeometry(0.04, 4, 4),
                    new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5 })
                ),
                vel: new THREE.Vector3(0, 0.5, 0),
                life: 200,
                maxLife: 200,
                gravity: 0,
                friction: 0.95
            });
            vfx.particles[vfx.particles.length - 1].mesh.position.copy(trailPos);
            vfx.group.add(vfx.particles[vfx.particles.length - 1].mesh);
        }

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
    constructor() {
        this.group = new THREE.Group();
        this.position = new THREE.Vector3(0, 0, 0);
        this.group.position.copy(this.position);

        const baseSize = CONFIG.REPAIR_STATION.RADIUS * 4.5;
        const baseColor = 0x3d3d3d;
        const metalDark = 0x2d2d2d;
        const metalAccent = 0x4a4a4a;
        const hazardOrange = 0xff6b35;
        const warningStripes = 0xf39c12;
        const techCyan = 0x00d4aa;
        const boltSilver = 0xc0c0c0;

        const base = createVoxelBox(baseSize, 0.5, baseSize, baseColor, 0.2, 0.8);
        base.position.y = 0.25;
        base.receiveShadow = true;
        this.group.add(base);

        const edgeTrim = createVoxelBox(baseSize + 0.2, 0.08, baseSize + 0.2, metalAccent, 0.8, 0.2);
        edgeTrim.position.y = 0.54;
        this.group.add(edgeTrim);

        for (let side of [-1, 1]) {
            const hStrip = createVoxelBox(baseSize, 0.06, 0.3, warningStripes);
            hStrip.position.set(0, 0.53, side * (baseSize / 2 - 0.2));
            this.group.add(hStrip);

            const vStrip = createVoxelBox(0.3, 0.06, baseSize, warningStripes);
            vStrip.position.set(side * (baseSize / 2 - 0.2), 0.53, 0);
            this.group.add(vStrip);

            for (let i = 0; i < 3; i++) {
                const grate = createVoxelBox(0.8, 0.04, 0.4, 0x1a1a1a);
                grate.position.set(side * (baseSize / 3 - i * 0.3), 0.52, 0);
                this.group.add(grate);
            }
        }

        this.pylons = [];
        this.strobes = [];
        const pillarDist = baseSize / 2 + 0.8;
        const pHeight = 6.0;

        for (let x of [-1, 1]) {
            for (let z of [-1, 1]) {
                const pillar = new THREE.Group();
                pillar.position.set(x * pillarDist, 0.5, z * pillarDist);

                const body = createVoxelBox(1.2, pHeight, 1.2, hazardOrange, 0.3, 0.7);
                body.position.y = pHeight / 2;
                pillar.add(body);

                const trim = createVoxelBox(1.3, 0.1, 1.3, metalDark);
                trim.position.y = pHeight - 0.5;
                pillar.add(trim);

                const basePlate = createVoxelBox(1.4, 0.3, 1.4, metalAccent, 0.9, 0.1);
                basePlate.position.y = 0.15;
                pillar.add(basePlate);

                for (let j = 0; j < 4; j++) {
                    const bolt = createVoxelBox(0.12, 0.12, 0.12, boltSilver, 1.0, 0.1);
                    const angle = (j / 4) * Math.PI * 2 + Math.PI / 4;
                    bolt.position.set(Math.cos(angle) * 0.55, 0.3, Math.sin(angle) * 0.55);
                    pillar.add(bolt);
                }

                const cylinder = createVoxelCylinder(0.2, 0.2, pHeight * 0.85, boltSilver, 0.95, 0.05);
                cylinder.position.set(x * -0.3, pHeight / 2, z * -0.3);
                pillar.add(cylinder);

                const lightBase = createVoxelBox(0.3, 0.15, 0.15, metalDark);
                lightBase.position.set(0, pHeight - 0.3, 0.6);
                pillar.add(lightBase);

                const light = createVoxelBox(0.25, 0.25, 0.1, 0xff8c00);
                light.position.set(0, pHeight - 0.1, 0.65);
                if (light.material) {
                    light.material.emissive = new THREE.Color(0xff8c00);
                    light.material.emissiveIntensity = 0.5;
                }
                pillar.add(light);
                this.strobes.push(light);

                this.group.add(pillar);
                this.pylons.push(pillar);
            }

            const beamX = createVoxelBox(baseSize + 3.0, 0.8, 0.8, metalDark, 0.9, 0.1);
            beamX.position.set(0, pHeight + 0.5, x * pillarDist);
            this.group.add(beamX);

            const beamCapX = createVoxelBox(0.4, 0.4, 0.9, metalAccent);
            beamCapX.position.set(0, pHeight + 0.9, x * pillarDist);
            this.group.add(beamCapX);

            const beamZ = createVoxelBox(0.8, 0.8, baseSize + 3.0, metalDark, 0.9, 0.1);
            beamZ.position.set(x * pillarDist, pHeight + 0.5, 0);
            this.group.add(beamZ);

            const beamCapZ = createVoxelBox(0.9, 0.4, 0.4, metalAccent);
            beamCapZ.position.set(x * pillarDist, pHeight + 0.9, 0);
            this.group.add(beamCapZ);
        }

        const gantryCenter = new THREE.Group();
        gantryCenter.position.set(0, pHeight + 0.5, 0);

        const winchBase = createVoxelBox(1.6, 1.0, 1.6, metalDark, 0.8, 0.2);
        winchBase.position.y = 0.5;
        gantryCenter.add(winchBase);

        const winchDrum = createVoxelCylinder(0.5, 0.5, 1.2, metalAccent, 0.9, 0.1);
        winchDrum.position.y = 1.0;
        winchDrum.rotation.x = Math.PI / 2;
        gantryCenter.add(winchDrum);

        const winchMotor = createVoxelBox(0.6, 0.5, 0.6, 0x1a1a1a);
        winchMotor.position.set(0.8, 0.8, 0);
        gantryCenter.add(winchMotor);

        this.group.add(gantryCenter);

        this.hookWire = createVoxelCylinder(0.04, 0.04, 3.0, 0x555555);
        this.hookWire.position.set(0, pHeight - 1.0, 0);
        this.group.add(this.hookWire);

        this.hookGroup = new THREE.Group();
        this.hookGroup.position.set(0, pHeight - 2.5, 0);

        const hookTop = createVoxelBox(0.6, 0.3, 0.6, metalDark);
        this.hookGroup.add(hookTop);

        const hookArm = createVoxelBox(0.15, 0.8, 0.15, metalAccent);
        hookArm.position.y = -0.55;
        this.hookGroup.add(hookArm);

        const hookClaw = createVoxelBox(0.5, 0.15, 0.5, hazardOrange);
        hookClaw.position.y = -1.0;
        this.hookGroup.add(hookClaw);

        this.group.add(this.hookGroup);

        this.addCables(pillarDist, pHeight);

        this.arms = [];
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? -1 : 1;
            const armGroup = new THREE.Group();
            armGroup.position.set(side * (pillarDist - 0.3), 0.5, 0);

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

        this.addProps(baseSize, pHeight);

        scene.add(this.group);
        this.animTime = 0;
    }

    addCables(dist, height) {
        for (let i = 0; i < 4; i++) {
            const sideX = i < 2 ? -1 : 1;
            const sideZ = i % 2 === 0 ? -1 : 1;

            const cable = createVoxelCylinder(0.04, 0.04, dist * 0.85, 0x222222);
            cable.position.set(sideX * (dist * 0.65), height + 0.4, sideZ * (dist * 0.65));
            cable.rotation.y = Math.atan2(sideZ, sideX);
            cable.rotation.z = Math.PI / 5;
            this.group.add(cable);
        }
    }

    addProps(baseSize, pHeight) {
        const metalDark = 0x2d2d2d;
        const hazardOrange = 0xff6b35;
        const techCyan = 0x00d4aa;

        const cab = createVoxelBox(1.2, 2.0, 1.0, metalDark, 0.7, 0.3);
        cab.position.set(-baseSize / 2 - 2.5, 1.0, baseSize / 4);
        this.group.add(cab);

        const cabRoof = createVoxelBox(1.4, 0.2, 1.2, 0x1a1a1a);
        cabRoof.position.set(-baseSize / 2 - 2.5, 2.1, baseSize / 4);
        this.group.add(cabRoof);

        const screenFrame = createVoxelBox(0.8, 0.5, 0.1, metalDark);
        screenFrame.position.set(-baseSize / 2 - 2.5, 1.6, baseSize / 4 + 0.46);
        this.group.add(screenFrame);

        this.monitorDisplay = createVoxelBox(0.7, 0.4, 0.02, techCyan);
        this.monitorDisplay.position.set(-baseSize / 2 - 2.5, 1.6, baseSize / 4 + 0.52);
        if (this.monitorDisplay.material) {
            this.monitorDisplay.material.emissive = new THREE.Color(techCyan);
            this.monitorDisplay.material.emissiveIntensity = 0.3;
        }
        this.group.add(this.monitorDisplay);

        this.beacon = new THREE.Group();
        this.beacon.position.set(0, pHeight + 1.2, 0);
        this.group.add(this.beacon);

        const bBase = createVoxelBox(0.5, 0.4, 0.5, metalDark);
        this.beacon.add(bBase);

        const bPole = createVoxelBox(0.15, 0.8, 0.15, 0x4a4a4a);
        bPole.position.y = 0.6;
        this.beacon.add(bPole);

        this.beaconLight = createVoxelCylinder(0.2, 0.15, 0.3, 0xff0000);
        this.beaconLight.position.y = 1.15;
        if (this.beaconLight.material) {
            this.beaconLight.material.emissive = new THREE.Color(0xff0000);
            this.beaconLight.material.emissiveIntensity = 0.5;
        }
        this.beacon.add(this.beaconLight);

        for (let side of [-1, 1]) {
            const oilStain = createVoxelBox(1.5, 0.01, 1.0, 0x1a1a1a, 0.1, 1.0);
            oilStain.position.set(side * (baseSize / 4), 0.52, 0);
            this.group.add(oilStain);
        }

        for (let h = 0; h < 3; h++) {
            const barrel = createVoxelCylinder(0.25, 0.3, 1.5, hazardOrange, 0.5, 0.5);
            barrel.position.set(baseSize / 2 + 2.5, 0.75 + h * 0.5, -baseSize / 4 + h * 0.3);
            barrel.rotation.z = 0.2 * h;
            this.group.add(barrel);
        }

        const toolBox = createVoxelBox(1.0, 0.6, 0.8, metalDark, 0.8, 0.2);
        toolBox.position.set(baseSize / 2 + 2.5, 0.3, baseSize / 2 - 1);
        this.group.add(toolBox);

        const toolHandle = createVoxelBox(0.8, 0.1, 0.1, 0xff6b35);
        toolHandle.position.set(baseSize / 2 + 2.5, 0.65, baseSize / 2 - 1);
        this.group.add(toolHandle);
    }

    update(dt) {
        this.animTime += dt;
        const isRepairing = myTank && myTank.hp > 0 &&
            myTank.group.position.distanceTo(this.position) < (CONFIG.REPAIR_STATION.RADIUS + 2.0) &&
            myTank.hp < myTank.maxHp;

        // 1. 비콘 라이트 애니메이션
        if (this.beaconLight) {
            if (isRepairing) {
                this.beacon.rotation.y += dt * 8;
                this.beaconLight.material.emissive.setHex(0xff0000);
                this.beaconLight.material.emissiveIntensity = 1.0 + Math.sin(this.animTime * 15) * 0.5;
            } else {
                this.beaconLight.material.emissiveIntensity = 0.2;
            }
        }

        // Hook 애니메이션
        if (this.hookGroup) {
            if (isRepairing) {
                const hookOffset = Math.sin(this.animTime * 3) * 0.3;
                this.hookGroup.position.y = -2.5 + hookOffset;
            }
        }

        // 2. 진단 모니터 깜빡임
        if (this.monitorDisplay) {
            if (isRepairing) {
                const flicker = Math.random() < 0.1 ? 0.2 : 0.8 + Math.random() * 0.4;
                this.monitorDisplay.material.emissive.setHex(0x2ecc71);
                this.monitorDisplay.material.emissiveIntensity = flicker;
                if (Math.random() < 0.05) {
                    this.monitorDisplay.material.color.setHex(Math.random() < 0.5 ? 0x2ecc71 : 0x3498db);
                }
            } else {
                this.monitorDisplay.material.emissiveIntensity = 0.2;
                this.monitorDisplay.material.color.setHex(0x2ecc71);
            }
        }

        this.strobes.forEach((light, i) => {
            if (isRepairing) {
                const flash = 0.5 + Math.sin(this.animTime * 18 + i) * 0.5;
                light.material.emissive.setHex(0xffaa00);
                light.material.emissiveIntensity = flash * 1.5;
            } else {
                light.material.emissiveIntensity = 0;
            }
        });

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
    }

    healTank(tank, dt) {
        const newHp = Math.min(tank.maxHp, tank.hp + CONFIG.REPAIR_STATION.HEAL_RATE * dt);
        tank.updateHP(newHp);
        if (Math.random() < 0.04) AudioSFX.playHeal();
    }
}

class Tank {
    constructor(id, name, isLocal = false) {
        this.id = id;
        this.name = name || id;
        this.isLocal = isLocal;
        this.kills = 0;
        this.lastSeen = Date.now();
        this.group = new THREE.Group();

        // Upgrade Levels (0 to 9)
        this.levelCannon = 0;
        this.levelSpeed = 0;
        this.levelArmor = 0;

        // Base Stats
        this.hp = CONFIG.TANK.MAX_HP;
        this.maxHp = CONFIG.TANK.MAX_HP;

        const mainColor = isLocal ? CONFIG.COLORS.SELF : CONFIG.COLORS.OTHER;
        const detailColor = 0x333333;

        // 1. Hull Group (Lower & Upper) - LEOPARD STYLE (Low & Long)
        this.hullGroup = new THREE.Group();
        this.group.add(this.hullGroup);

        // Main Body (낮고 길게)
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
        this.exhaustTimer = 0; // NEW: Timer for exhaust smoke
        this.targetWorldAngle = this.group.rotation.y;
        this.lastFireTime = 0; // NEW: Initialize lastFireTime for shooting logic

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
        const now = Date.now();
        const cooldown = (this.isBot ? CONFIG.BOT.FIRE_COOLDOWN : CONFIG.TANK.FIRE_COOLDOWN) + jitter;
        if (now - this.lastFireTime < cooldown) return;
        this.lastFireTime = now;

        const pos = new THREE.Vector3();
        this.muzzlePoint.getWorldPosition(pos);
        const pivotPos = new THREE.Vector3();
        this.barrelGroup.getWorldPosition(pivotPos);
        const dir = pos.clone().sub(pivotPos).normalize();

        // --- Cannon Upgrades: Scale & Multi-shot ---
        let bulletScale = 1.0 + (Math.min(3, this.levelCannon) * CONFIG.UPGRADE.CANNON.SCALE_INC);
        let bulletDamage = CONFIG.TANK.DAMAGE + (this.levelCannon * CONFIG.UPGRADE.CANNON.DAMAGE_INC);

        const spawnBullet = (startPos, direction) => {
            const bullet = new Bullet(startPos, direction, this.id);
            bullet.damage = bulletDamage;
            bullet.group.scale.setScalar(bulletScale);
            bullets.push(bullet);
            return bullet;
        };

        if (this.levelCannon < 4) {
            // Level 0-3: Single Shot (Scales up)
            spawnBullet(pos, dir);
        } else if (this.levelCannon < 7) {
            // Level 4-6: Double Shot (Parallel)
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.turretGroup.getWorldQuaternion(new THREE.Quaternion()));
            const posL = pos.clone().add(right.clone().multiplyScalar(-0.2));
            const posR = pos.clone().add(right.clone().multiplyScalar(0.2));
            spawnBullet(posL, dir);
            spawnBullet(posR, dir);
        } else {
            // Level 7-9: Triple Shot (Spread)
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.turretGroup.getWorldQuaternion(new THREE.Quaternion()));
            spawnBullet(pos, dir);

            const dirL = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.15);
            const dirR = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.15);
            spawnBullet(pos, dirL);
            spawnBullet(pos, dirR);
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
                    pos: { x: pos.x, y: pos.y, z: pos.z },
                    dir: { x: dir.x, y: dir.y, z: dir.z },
                    ownerId: this.id,
                    level: this.levelCannon
                }
            });
        }
    }

    updateAnims(dt, isMoving) {
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
            if (this.exhaustTimer > 0.08) { // High frequency
                this.exhaustTimer = 0;

                // Real-wheel displacement for velocity calc
                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
                const exhaustVel = forward.multiplyScalar(2.0); // Push smoke backwards

                // Dual Exhaust Pipes (Synchronized with new embedded position)
                for (let xOff of [-0.48, 0.48]) {
                    const exhaustPos = new THREE.Vector3(xOff, 0.65, 1.23).applyMatrix4(this.group.matrixWorld);

                    // Main Smoke (Premium Growth)
                    vfx.spawnExhaust(exhaustPos, 0x99aabb, 1, 0.4, 0.3, 1500);

                    // Hot Exhaust Core
                    if (Math.random() < 0.4) {
                        vfx.spawnExhaust(exhaustPos, 0x555555, 1, 0.6, 0.25, 800);
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
                        payload: { victimId: myId, shooterId: shooterId }
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

class Bot extends Tank {
    constructor(id, name, syncedColor = null) {
        super(id, name, false);
        this.isBot = true;
        this.lastFireTime = 0;
        this.target = null;
        this.state = 'WANDER';
        this.stateTimer = 0;
        this.strafeTimer = 0;
        this.aimJitter = (Math.random() - 0.5) * 0.1;
        this.aimJitterTimer = 0;
        this.blockedTimer = 0;
        this.strafeDir = Math.random() < 0.5 ? 1 : -1;

        // Change bot color and name (Use synced color if provided, otherwise random)
        this.color = syncedColor || (CONFIG.BOT && CONFIG.BOT.COLORS ? CONFIG.BOT.COLORS[Math.floor(Math.random() * CONFIG.BOT.COLORS.length)] : 0x9933ff);

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
        let nearestDist = CONFIG.BOT.DETECTION_RANGE;
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

            // Rotate hull (Using BOT speed now)
            let hullRotDiff = hullTargetAngle - this.group.rotation.y;
            while (hullRotDiff < -Math.PI) hullRotDiff += Math.PI * 2;
            while (hullRotDiff > Math.PI) hullRotDiff -= Math.PI * 2;
            const hullStep = CONFIG.BOT.ROTATE_SPEED * dt;
            this.group.rotation.y += Math.max(-hullStep, Math.min(hullStep, hullRotDiff));

            // 2. Rotate turret independently (Aim at target)
            this.aimJitterTimer += dt;
            if (this.aimJitterTimer > 1) {
                this.aimJitterTimer = 0;
                this.aimJitter = (Math.random() - 0.5) * 0.15;
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
                // Blend forward and target directions for curved steering
                const targetVec = new THREE.Vector3(-Math.sin(hullTargetAngle), 0, -Math.cos(hullTargetAngle));
                const currentForward = new THREE.Vector3(-Math.sin(this.group.rotation.y), 0, -Math.cos(this.group.rotation.y));
                const blendedDir = currentForward.clone().multiplyScalar(0.8).add(targetVec.multiplyScalar(0.2)).normalize();

                const effectiveDir = moveDir > 0 ? moveDir * botSpeedScale : moveDir;
                if (!this.move(effectiveDir, dt, blendedDir)) {
                    // Blocked! Try to escape intelligently
                    this.group.rotation.y += (this.strafeDir * 2.0) * dt; // Turn harder
                    this.move(-0.5, dt); // Try backing up (Directly backwards)
                }
            }

            // 4. Intelligence: Shoot only if turret aimed well AND line of sight is clear
            const turretWorldAngle = this.group.rotation.y + this.turretGroup.rotation.y;
            const currentDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), turretWorldAngle);
            const targetDirRaw = new THREE.Vector3(dx, 0, dz).normalize();
            const dot = currentDir.dot(targetDirRaw);

            if (dot > 0.97 && dist < CONFIG.BOT.ATTACK_RANGE) {
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
                const wanderTargetVec = new THREE.Vector3(-Math.sin(this.wanderAngle), 0, -Math.cos(this.wanderAngle));
                const wanderForward = new THREE.Vector3(-Math.sin(this.group.rotation.y), 0, -Math.cos(this.group.rotation.y));
                const blendedWanderDir = wanderForward.clone().multiplyScalar(0.8).add(wanderTargetVec.multiplyScalar(0.2)).normalize();

                if (!this.move(1.0 * wanderSpeedScale, dt, blendedWanderDir)) {
                    // If blocked, pick a new random angle immediately and try to move away
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
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y);
        const probeDist = 3.5;
        const probePos = this.group.position.clone().add(forward.multiplyScalar(probeDist));

        if (!isPositionSafe(probePos.x, probePos.z)) {
            this.blockedTimer += dt;
            // Force rotation away from the wall
            this.group.rotation.y += this.strafeDir * dt * (3.0 + (this.rotSpeedBonus || 0)); // Turn faster when sensing wall

            if (this.blockedTimer > 0.5) {
                // Emergency Reserve
                this.move(-0.6, dt);
            }
        } else {
            this.blockedTimer = Math.max(0, this.blockedTimer - dt);
        }
    }

    move(dir, dt, customDir = null) {
        const moveSpeed = (dir >= 0 ? CONFIG.BOT.FORWARD_SPEED : CONFIG.BOT.BACKWARD_SPEED) + (this.moveSpeedBonus || 0);
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

/* 5. Input Handling (Pointer, Keyboard) */
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', e => {
    keys[e.code] = false;
    keys[e.key.toLowerCase()] = false;
});

// Mouse Button Handling
const mouseButtons = { left: false, right: false };
window.addEventListener('mousedown', e => {
    if (e.button === 0) mouseButtons.left = true;
    if (e.button === 2) mouseButtons.right = true;
});
window.addEventListener('mouseup', e => {
    if (e.button === 0) mouseButtons.left = false;
    if (e.button === 2) mouseButtons.right = false;
});

// Mobile Joysticks
const joystickLeft = { x: 0, y: 0 };
const joystickRight = { x: 0, y: 0 };

// Initialize Input tracking if not provided by core
if (!window.WCGames.input) {
    window.WCGames.input = { mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 } };
    window.addEventListener('mousemove', (e) => {
        window.WCGames.input.mouse.x = e.clientX;
        window.WCGames.input.mouse.y = e.clientY;
    });
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
                const dist = Math.min(60, Math.sqrt(dx * dx + dy * dy));
                const angle = Math.atan2(dy, dx);

                const moveX = Math.cos(angle) * dist;
                const moveY = Math.sin(angle) * dist;
                knob.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;

                target.x = moveX / 60;
                target.y = moveY / 60;

                if (e.cancelable) e.preventDefault();
            };

            const handleStart = (e) => {
                if (active) return;
                const touch = e.touches ? e.changedTouches[0] : e;
                if (e.touches) touchId = touch.identifier;

                active = true;
                const rect = el.getBoundingClientRect();
                startPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
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

            el.addEventListener('touchstart', handleStart, { passive: false });
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);
            window.addEventListener('touchcancel', handleEnd);

            el.addEventListener('mousedown', handleStart);
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

/* 6. Game Logic (Update, Collision) */
let lastScoreUpdate = 0;
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

function fire() {
    if (!myTank || myTank.hp <= 0) return;
    myTank.shoot();
}

function update(dt) {
    const now = Date.now();

    // 수리 정비소(Repair Station) 상태 업데이트
    if (repairStation) repairStation.update(dt);

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
                if (mouseButtons.left || mouseButtons.right || distToMouse > 15) {
                    targetTurretAngle = Math.atan2(myTank.group.position.x - pt.x, myTank.group.position.z - pt.z);
                    isManualAim = true;
                }
            }
        }

        // 3. Auto Aim (Priority if not actively overriding)
        const nearestEnemyPos = findNearestEnemy(myTank.group.position, CONFIG.BOT.DETECTION_RANGE);

        if (!isManualAim && nearestEnemyPos) {
            targetTurretAngle = Math.atan2(myTank.group.position.x - nearestEnemyPos.x, myTank.group.position.z - nearestEnemyPos.z);

            // Auto Fire Check
            const currentWorldAngle = myTank.turretGroup.rotation.y + myTank.group.rotation.y;
            const angleDiff = Math.abs(normalizeAngle(currentWorldAngle - targetTurretAngle));
            const distToEnemy = myTank.group.position.distanceTo(nearestEnemyPos);

            // Sync attack range with AI (CONFIG.BOT.ATTACK_RANGE)
            if (angleDiff < 0.2 && distToEnemy < CONFIG.BOT.ATTACK_RANGE) {
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

        if (keys['Space'] || mouseButtons.left) fire();


        // Collisions
        checkCollisions();

        // 8. Reverted Camera Follow (Top-down Fixed Offset)
        camera.fov = CONFIG.CAMERA.FOV;
        camera.updateProjectionMatrix();

        let camX = myTank.group.position.x;
        let camY = CONFIG.CAMERA.HEIGHT;
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

        const dist = myTank.group.position.distanceTo(p.group.position);
        if (dist < 1.5) {
            myTank.heal(CONFIG.POWERUP.HEAL_AMOUNT);
            spawnFloatingText(myTank.group.position.clone().add(new THREE.Vector3(0, 2, 0)), "HP UP", "#27ae60");
            p.destroy();
            powerups.splice(i, 1);
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

    // 공습 경고 연출 (진입 3초 전)
    const warningTime = 3000;
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
            div.style.fontSize = '48px';
            div.style.fontWeight = 'bold';
            div.style.textShadow = '0 0 10px #000';
            div.style.zIndex = '1000';
            div.style.pointerEvents = 'none';
            div.style.fontFamily = 'monospace';
            div.innerText = '⚠️ AIR RAID WARNING ⚠️';
            document.body.appendChild(div);
        } else {
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
            const victim = allPotentialTargets[Math.floor(Math.random() * allPotentialTargets.length)];
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
        if (wreckSmokeTimer > 0.08) {
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

function checkCollisions() {
    const dt = clock.getDelta(); // This is wrong, should pass dt from update, but let's just use simple resolve
    const originalPos = myTank.group.position.clone();

    const tileBound = (CONFIG.WORLD.SIZE / 2) - 1;
    myTank.group.position.x = Math.max(-tileBound, Math.min(tileBound, myTank.group.position.x));
    myTank.group.position.z = Math.max(-tileBound, Math.min(tileBound, myTank.group.position.z));

    // Wall check
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
    const dt = 0.016;
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!bullet.update(dt)) {
            bullet.destroy();
            bullets.splice(i, 1);
            continue;
        }

        let hit = false;

        // Wall collision
        for (const wall of walls) {
            const wallW = wall.geometry.parameters.width;
            const wallD = wall.geometry.parameters.depth;
            const wallH = wall.geometry.parameters.height || 1;

            if (Math.abs(bullet.mesh.position.x - wall.position.x) < wallW / 2 + 0.2 &&
                Math.abs(bullet.mesh.position.z - wall.position.z) < wallD / 2 + 0.2 &&
                Math.abs(bullet.mesh.position.y - wall.position.y) < wallH / 2 + 0.5) {

                if (vfx) {
                    const normal = bullet.mesh.position.clone().sub(wall.position).normalize();
                    vfx.spawnImpact(bullet.mesh.position, normal, 0xaaaaaa);

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
            bullet.destroy();
            bullets.splice(i, 1);
            continue;
        }

        // Player collisions
        const allPlayers = [myTank, ...Array.from(tanks.values())];
        for (const tank of allPlayers) {
            if (!tank || bullet.ownerId === tank.id) continue;
            if (bullet.mesh.position.distanceTo(tank.group.position) < 1.2) {
                // If I shot a player OR my local bot shot a player, broadcast the hit
                const isMyBotShooter = bots.some(b => b.id === bullet.ownerId);
                if (bullet.ownerId === myId || isMyBotShooter) {
                    AudioSFX.playImpact();
                    if (vfx) vfx.spawnImpact(bullet.mesh.position, new THREE.Vector3(0, 1, 0), 0xffaa00);
                    if (tank === myTank) tank.handleHit(CONFIG.BULLET.DAMAGE, bullet.ownerId);
                    channel.send({
                        type: 'broadcast',
                        event: 'hit',
                        payload: { targetId: tank.id, damage: CONFIG.BULLET.DAMAGE, shooterId: bullet.ownerId }
                    });
                }
                hit = true;
                break;
            }
        }
        if (hit) {
            bullet.destroy();
            bullets.splice(i, 1);
            continue;
        }

        // Bot collisions (Local only)
        for (const bot of bots) {
            if (bullet.ownerId !== bot.id && bullet.mesh.position.distanceTo(bot.group.position) < 1.2) {
                AudioSFX.playImpact();
                if (vfx) vfx.spawnImpact(bullet.mesh.position, new THREE.Vector3(0, 1, 0), 0xffaa00);
                bot.handleHit(CONFIG.BULLET.DAMAGE, bullet.ownerId);
                hit = true;
                break;
            }
        }
        if (hit) {
            bullet.destroy();
            bullets.splice(i, 1);
            continue;
        }
    }
}

function syncMultiplayer() {
    if (!channel) return;

    const now = Date.now();
    if (now - lastSyncTime < 40) return; // 25fps sync
    lastSyncTime = now;

    // 1. Broadcast My Status (Only if playing)
    if (WCGames.state === 'PLAYING' && myId && myTank) {
        channel.send({
            type: 'broadcast',
            event: 'move',
            payload: {
                id: myId,
                name: myName,
                pos: { x: myTank.group.position.x, y: myTank.group.position.y, z: myTank.group.position.z },
                rot: myTank.group.rotation.y,
                turretRot: myTank.turretGroup.rotation.y,
                hp: myTank.hp,
                kills: myTank.kills,
                levels: {
                    cannon: myTank.levelCannon,
                    speed: myTank.levelSpeed,
                    armor: myTank.levelArmor
                }
            }
        });
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

/* 7. Rendering */
function animate() {
    animationId = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    update(dt);
    syncMultiplayer();
    renderer.render(scene, camera);
}

/* 7. Collision & Spawn Utils */
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

/* 8. SDK Initialization & Callbacks */
const Game = {
    start() {
        WCGames.start();
        setupJoysticks();
    },

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
        if (typeof bullets !== 'undefined') {
            bullets.forEach(b => b.destroy());
            bullets.length = 0;
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

        vfx = new ParticleSystem();
        cameraShakeTime = 0;
        scene.background = new THREE.Color(0x12100e);
        scene.fog = new THREE.FogExp2(0x12100e, 0.025);

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

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
            renderer.domElement.style.backgroundColor = '#111'; // Black bars for non-16:9 screens
        }

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

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
        directionalLight.shadow.mapSize.width = 2048; // Higher quality for Voxel detail
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.left = -40; // Tighter box for higher density
        directionalLight.shadow.camera.right = 40;
        directionalLight.shadow.camera.top = 40;
        directionalLight.shadow.camera.bottom = -40;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 150;
        directionalLight.shadow.bias = -0.0005; // Fix shadow acne on voxels
        scene.add(directionalLight);
        scene.add(directionalLight.target); // Need to add target specifically for following

        const tileSize = 5;
        const tilesPerSide = CONFIG.WORLD.SIZE / tileSize;
        const groundColors = [CONFIG.COLORS.FLOOR_1, CONFIG.COLORS.FLOOR_2, CONFIG.COLORS.FLOOR_3, CONFIG.COLORS.FLOOR_4];

        for (let ix = 0; ix < tilesPerSide; ix++) {
            for (let iz = 0; iz < tilesPerSide; iz++) {
                const colorIdx = Math.floor(seededRandom(ix * 13 + iz * 7) * groundColors.length);
                const color = groundColors[colorIdx];

                const tileX = (ix - tilesPerSide / 2 + 0.5) * tileSize;
                const tileZ = (iz - tilesPerSide / 2 + 0.5) * tileSize;

                const tileH = 0.2;
                const tile = createVoxelBox(tileSize, tileH, tileSize, color, 0.1, 0.9);
                tile.position.set(tileX, -0.1, tileZ);
                tile.receiveShadow = true;
                scene.add(tile);

                if (seededRandom(ix * 55 + iz * 23) < 0.15) {
                    const pSize = 0.1 + seededRandom(ix + iz) * 0.2;
                    const pebble = createVoxelBox(pSize, pSize, pSize, 0x2a2520);
                    pebble.position.set(
                        tileX + (seededRandom(ix * 2) - 0.5) * (tileSize - 1),
                        0.05,
                        tileZ + (seededRandom(iz * 2) - 0.5) * (tileSize - 1)
                    );
                    scene.add(pebble);
                }

                if (seededRandom(ix * 31 + iz * 17) < 0.12) {
                    const crack = createVoxelBox(1.5, 0.02, 0.08, 0x0d0a08, 0, 1);
                    crack.position.set(
                        tileX + (seededRandom(ix) - 0.5) * (tileSize - 2),
                        0.01,
                        tileZ + (seededRandom(iz) - 0.5) * (tileSize - 2)
                    );
                    crack.rotation.y = seededRandom(ix + iz * 3) * Math.PI;
                    scene.add(crack);
                }

                if (seededRandom(ix * 41 + iz * 29) < 0.08) {
                    const mud = createVoxelBox(1.2, 0.03, 0.9, 0x1a120d, 0, 1);
                    mud.position.set(
                        tileX + (seededRandom(ix * 3) - 0.5) * (tileSize - 2),
                        0.015,
                        tileZ + (seededRandom(iz * 3) - 0.5) * (tileSize - 2)
                    );
                    scene.add(mud);
                }

                if (seededRandom(ix * 17 + iz * 43) < 0.1) {
                    const debris = createVoxelBox(0.3, 0.15, 0.4, 0x252220, 0, 0.9);
                    debris.position.set(
                        tileX + (seededRandom(ix * 7) - 0.5) * (tileSize - 2),
                        0.075,
                        tileZ + (seededRandom(iz * 7) - 0.5) * (tileSize - 2)
                    );
                    debris.rotation.y = seededRandom(ix * iz) * Math.PI * 2;
                    scene.add(debris);
                }
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
            const color = 0x222222;
            const s = 1.2;
            const b1 = createVoxelBox(s, 0.15, 0.15, color, 0.7, 0.3); // Metallic hedgehog
            const b2 = createVoxelBox(s, 0.15, 0.15, color, 0.7, 0.3); // Metallic hedgehog
            const b3 = createVoxelBox(s, 0.15, 0.15, color, 0.7, 0.3); // Metallic hedgehog
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
                const crate = createVoxelBox(0.8, 0.8, 0.8, 0x5d4037, 0, 0.8); // Matte wood crate
                crate.position.set(x, 0.4, z);
                crate.userData = { isBreakable: true, type: 'crate' };
                scene.add(crate);
                walls.push(crate);

                // Rivet details on crate
                for (let i = 0; i < 4; i++) {
                    const d = createVoxelBox(0.82, 0.1, 0.1, 0x3e2723, 0, 0.8); // Matte wood details
                    d.position.set(x, 0.4 + (i % 2 ? 0.3 : -0.3), z);
                    crate.add(d); // Attach to crate for easier removal
                }
            } else if (type === 'barrel') {
                const barrel = createVoxelCylinder(0.3, 0.3, 0.9, 0xc62828, 0.6, 0.4); // Metallic barrel
                barrel.position.set(x, 0.45, z);
                barrel.userData = { isBreakable: true, type: 'barrel' };
                scene.add(barrel);
                walls.push(barrel);

                // Barrel rings
                const r1 = createVoxelCylinder(0.32, 0.32, 0.05, 0x333333, 0.7, 0.3); // Metallic rings
                r1.position.y = 0.2;
                barrel.add(r1);
                const r2 = createVoxelCylinder(0.32, 0.32, 0.05, 0x333333, 0.7, 0.3); // Metallic rings
                r2.position.y = -0.2;
                barrel.add(r2);
            }
        }

        // Helper: Create Destroyed Tank (Wreck)
        function createWreck(x, z) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = seededRandom(x * 7 + z) * Math.PI * 2;
            scene.add(group);
            wrecks.push(group);

            // Burnt/Rusty Materials
            const burntColor = 0x1a1a1a;
            const rustColor = 0x5d4037;

            // 1. Hull (slightly tilted)
            const hull = createVoxelBox(1.2, 0.5, 1.8, burntColor, 0, 1);
            hull.position.y = 0.45;
            hull.rotation.z = 0.05;
            group.add(hull);

            // 2. Turret (damaged/misaligned)
            const turret = createVoxelBox(0.9, 0.45, 0.95, burntColor, 0, 1);
            turret.position.set(0.1, 0.85, 0);
            turret.rotation.set(0.1, 0.5, 0.05);
            group.add(turret);

            // 3. Barrel (broken/tilted)
            const barrel = createVoxelCylinder(0.08, 0.08, 1.2, rustColor, 0, 1);
            barrel.position.set(0.5, 0.9, -0.6);
            barrel.rotation.set(1.2, 0, -0.2);
            group.add(barrel);

            // 4. Detail: Tracks (slightly off)
            const trackL = createVoxelBox(0.38, 0.42, 1.95, 0x111111);
            trackL.position.set(-0.45, 0.22, 0);
            group.add(trackL);
            const trackR = createVoxelBox(0.38, 0.42, 1.95, 0x111111);
            trackR.position.set(0.48, 0.2, 0.05);
            trackR.rotation.y = 0.05;
            group.add(trackR);

            // Add to walls for collision
            const col = createVoxelBox(1.5, 1.5, 2.0, 0x000000);
            col.position.set(x, 0.75, z);
            col.rotation.y = group.rotation.y;
            col.visible = false;
            col.userData = { type: 'wreck' };
            scene.add(col); // CRITICAL: Must be in scene to update world matrices
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

        // Helper: Create Fortress Wall (단조로움 해결을 위한 다층 구조 장벽)
        function createFortressWall(wallDef) {
            const { x, z, w, d } = wallDef;
            const h = 2.4; // Slightly taller
            const color = CONFIG.COLORS.WALL;
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            scene.add(group);

            // 1. Foundation (기초부 - Slightly wider and darker)
            const foundation = createVoxelBox(w + 0.4, 0.4, d + 0.4, 0x333333);
            foundation.position.y = 0.2;
            group.add(foundation);

            // 2. Main Wall Body
            const main = createVoxelBox(w, h - 0.4, d, color);
            main.position.y = h / 2 + 0.2;
            group.add(main);

            // 3. Crenelations (상단 총안구 - Jagged top)
            const cSize = 0.4;
            const isHorizontal = w > d;
            if (isHorizontal) {
                const count = Math.floor(w / (cSize * 2));
                for (let i = 0; i < count; i++) {
                    const c = createVoxelBox(cSize, cSize, d, color);
                    c.position.set(-w / 2 + cSize + i * cSize * 2, h + 0.2, 0);
                    group.add(c);
                }
            } else {
                const count = Math.floor(d / (cSize * 2));
                for (let i = 0; i < count; i++) {
                    const c = createVoxelBox(w, cSize, cSize, color);
                    c.position.set(0, h + 0.2, -d / 2 + cSize + i * cSize * 2);
                    group.add(c);
                }
            }

            // 4. Detail: Reinforcement Pillars (보강 필러)
            const pillarW = isHorizontal ? 0.3 : w + 0.1;
            const pillarD = isHorizontal ? d + 0.1 : 0.3;
            for (let i of [-1, 1]) {
                const p = createVoxelBox(pillarW, h, pillarD, 0x444444);
                if (isHorizontal) p.position.set(i * (w / 2 - 0.2), h / 2, 0);
                else p.position.set(0, h / 2, i * (d / 2 - 0.2));
                group.add(p);
            }

            // 5. Warning Stripe (중앙 노란 띠)
            const sW = isHorizontal ? 0.1 : w + 0.05;
            const sD = isHorizontal ? d + 0.05 : 0.1;
            const stripe = createVoxelBox(sW, h - 0.8, sD, 0xffaa00, 0.5, 0.5);
            stripe.position.y = h / 2 + 0.2;
            group.add(stripe);

            // Add invisible collision box to walls array
            const col = createVoxelBox(w + 0.2, h + 0.5, d + 0.2, 0x000000);
            col.position.set(x, h / 2 + 0.2, z);
            col.visible = false;
            col.userData = { type: 'fortress' };
            scene.add(col); // CRITICAL: Must be in scene to update world matrices
            walls.push(col);
        }

        // Fixed props from CONFIG
        CONFIG.MAP.PROPS.forEach(prop => {
            if (prop.type === 'tree') createBurnedTree(prop.x, prop.z);
            else if (prop.type === 'hedgehog') createHedgehog(prop.x, prop.z);
            else if (prop.type === 'crate') createProp('crate', prop.x, prop.z);
            else if (prop.type === 'barrel') createProp('barrel', prop.x, prop.z);
        });

        // Fixed Destroyed Tanks (Wrecks)
        CONFIG.MAP.WRECKS.forEach(pos => {
            createWreck(pos.x, pos.z);
        });

        CONFIG.MAP.LAYOUT.forEach(wallDef => {
            createFortressWall(wallDef);
        });

        // CRITICAL: Update all world matrices before any safety checks (getRandomSpawnPoint uses these)
        scene.updateMatrixWorld(true);

        // BAKE all collision boxes once for performance
        walls.forEach(wall => {
            const box = new THREE.Box3().setFromObject(wall);
            wallBoxes.push(box);
        });

        // 맵 중앙 수리 정비소(Repair Station) 생성
        repairStation = new RepairStation();

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

function setupChannelListeners() {
    if (!channel) return;

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

    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
        if (payload.id === myId) return;
        let tank = tanks.get(payload.id);
        if (!tank) {
            tank = new Tank(payload.id, payload.name);
            tanks.set(payload.id, tank);
        }
        if (tank && tank.group) {
            if (payload.pos) {
                const targetPos = new THREE.Vector3(payload.pos.x, payload.pos.y, payload.pos.z);
                tank.group.position.lerp(targetPos, 0.4);
            }
            tank.group.rotation.y = payload.rot;
            if (tank.turretGroup) tank.turretGroup.rotation.y = payload.turretRot;
            tank.updateHP(payload.hp);
            tank.kills = payload.kills || 0;

            // Sync Upgrade Levels for Other Players
            if (payload.levels) {
                let changed = false;
                if (tank.levelCannon !== payload.levels.cannon) { tank.levelCannon = payload.levels.cannon; changed = true; }
                if (tank.levelSpeed !== payload.levels.speed) { tank.levelSpeed = payload.levels.speed; changed = true; }
                if (tank.levelArmor !== payload.levels.armor) { tank.levelArmor = payload.levels.armor; changed = true; }
                if (changed) tank.updateArmorVisual();
            }

            tank.lastSeen = Date.now();
        }
    });

    channel.on('broadcast', { event: 'fire' }, ({ payload }) => {
        if (payload.ownerId === myId) return;
        const bPos = new THREE.Vector3(payload.pos.x, payload.pos.y, payload.pos.z);
        const bDir = new THREE.Vector3(payload.dir.x, payload.dir.y, payload.dir.z);
        const bullet = new Bullet(bPos, bDir, payload.ownerId);

        // Handle upgraded bullet visuals for others
        if (payload.level) {
            let bulletScale = 1.0 + (Math.min(3, payload.level) * CONFIG.UPGRADE.CANNON.SCALE_INC);
            bullet.group.scale.setScalar(bulletScale);
        }
        bullets.push(bullet);

        // Show firing effect for other players
        const tank = tanks.get(payload.ownerId);
        if (tank) tank.playShootEffect();
    });

    channel.on('broadcast', { event: 'hit' }, ({ payload }) => {
        if (payload.shooterId === myId) return;
        // Only respond to hits on human players (self or others)
        let target = (payload.targetId === myId) ? myTank : tanks.get(payload.targetId);
        if (target) {
            target.handleHit(payload.damage, payload.shooterId);
        }
    });

    channel.on('broadcast', { event: 'death' }, ({ payload }) => {
        // Only respond to deaths of human players
        const victim = (payload.victimId === myId) ? myTank : tanks.get(payload.victimId);

        if (victim) {
            if (vfx) vfx.spawnExplosion(victim.group.position);
            if (victim !== myTank) {
                victim.destroy();
                tanks.delete(payload.victimId);
            }
            updateScoreboard();
        }

        const killer = [myTank, ...Array.from(tanks.values())].find(t => t && t.id === payload.shooterId);
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
        if (bullets) {
            bullets.forEach(b => b.destroy());
            bullets.length = 0;
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
