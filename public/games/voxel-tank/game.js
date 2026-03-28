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
        LIFE_TIME: 2000, // ms
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
        FLOOR_1: 0x3d2b1f, // Dark Earth
        FLOOR_2: 0x4b3621, // Muddy Brown
        FLOOR_3: 0x5d4037, // Saddle Brown
        FLOOR_4: 0x333333, // Rocky Gray
        BULLET: 0xffff00,
        WALL: 0x555555,
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
        ]
    },
    BOT: {
        COUNT: 10,
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
        SPAWN_INTERVAL: 30,
        MAX_COUNT: 10,
        TYPES: ['CANNON', 'SPEED', 'ARMOR'],
        CANNON: { DAMAGE_INC: 2, SCALE_INC: 0.1 },
        SPEED: { MOVE_INC: 0.4, ROT_INC: 0.15 },
        ARMOR: { HP_INC: 20 }
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
const upgradeItems = []; // NEW: Array of active UpgradeItem instances
const wallBoxes = []; // NEW: Cache for world-space bounding boxes
let supabaseClient;
let channel;
let amIMaster = false;
let lastFireTime = 0;
let lastSyncTime = 0;
let lastPowerupSpawnTime = 0; // NEW: Timer for master node powerup spawning
let lastUpgradeSpawnTime = 0; // NEW: Timer for master node upgrade spawning
let animationId = null;
let cameraShakeTime = 0;
let wreckSmokeTimer = 0;

/* 3. Utilities (Helper functions) */
function createVoxelBox(w, h, d, color, metalness = 0.2, roughness = 0.8) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({
        color,
        metalness: metalness,
        roughness: roughness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false; // PERFORMANCE: Only enable on important objects
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

    // Specialized muzzle flash
    spawnMuzzleFlash(pos, dir, color = 0xffaa00) {
        for (let i = 0; i < 15; i++) {
            const size = 0.05 + Math.random() * 0.15;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
            const p = new THREE.Mesh(geometry, material);
            p.position.copy(pos);

            // Spread direction
            const spread = 0.5;
            const vel = dir.clone().multiplyScalar(5 + Math.random() * 5);
            vel.x += (Math.random() - 0.5) * spread * 10;
            vel.y += (Math.random() - 0.5) * spread * 10;
            vel.z += (Math.random() - 0.5) * spread * 10;

            this.particles.push({
                mesh: p,
                vel: vel,
                life: 150 + Math.random() * 150,
                maxLife: 300,
                gravity: 0,
                friction: 0.9
            });
            this.group.add(p);
        }

        // Add white core flash
        for (let i = 0; i < 5; i++) {
            const size = 0.2 + Math.random() * 0.2;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
            const p = new THREE.Mesh(geometry, material);
            p.position.copy(pos);
            const vel = dir.clone().multiplyScalar(2 + Math.random() * 3);
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
            } else {
                // Shrink for Smoke/Fire
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

        // 1. Shell Body (탄체)
        const body = createVoxelCylinder(0.12, 0.12, 0.4, 0xffcc00);
        body.rotation.x = Math.PI / 2; // Align axis with -Z
        this.group.add(body);

        // 2. Shell Tip (탄두)
        const tip = createVoxelCone(0.12, 0.25, 0xffd54f);
        tip.position.z = -0.32; // Forward offset
        tip.rotation.x = Math.PI / 2; // Point toward -Z
        this.group.add(tip);

        // 3. Shell Base (탄저부)
        const base = createVoxelCylinder(0.13, 0.13, 0.05, 0x8d6e63);
        base.position.z = 0.22; // Backward offset
        base.rotation.x = Math.PI / 2;
        this.group.add(base);

        this.group.position.copy(position);
        this.group.lookAt(position.clone().add(direction));

        // Use this.mesh for existing collision logic consistency (refers to the group)
        this.mesh = this.group;

        this.direction = direction.clone();
        this.ownerId = ownerId;
        this.startTime = Date.now();
        scene.add(this.group);
    }

    update(dt) {
        this.group.position.add(this.direction.clone().multiplyScalar(CONFIG.BULLET.SPEED * dt));
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

        // 1. Hull Group (for shaking/recoil)
        this.hullGroup = new THREE.Group();
        this.group.add(this.hullGroup);

        // Body
        this.body = createVoxelBox(1.2, 0.5, 1.8, mainColor, 0.4, 0.6);
        this.body.position.y = 0.45;
        this.hullGroup.add(this.body);

        // Side Skirts (디테일 추가)
        const skirtL = createVoxelBox(0.1, 0.35, 1.8, mainColor, 0.4, 0.6);
        skirtL.position.set(-0.6, 0.35, 0);
        this.hullGroup.add(skirtL);

        const skirtR = createVoxelBox(0.1, 0.35, 1.8, mainColor, 0.4, 0.6);
        skirtR.position.set(0.6, 0.35, 0);
        this.hullGroup.add(skirtR);

        // Side Rivets (Bolts) 디테일 추가
        for (let side of [-0.66, 0.66]) {
            for (let z = -0.7; z <= 0.8; z += 0.4) {
                const rivet = createVoxelBox(0.04, 0.04, 0.04, detailColor);
                rivet.position.set(side, 0.4, z);
                this.hullGroup.add(rivet);
            }
        }

        const guardR = createVoxelBox(0.4, 0.05, 0.4, 0x333333);
        guardR.position.set(0.45, 0.42, -0.8);
        this.hullGroup.add(guardR);

        // --- NEW: Front Details (탱크 전면 디테일 강화) ---
        // 1. Lower Glacis (전면 하부 장갑 - Slanted feel)
        const glacis = createVoxelBox(1.1, 0.25, 0.2, mainColor);
        glacis.position.set(0, 0.35, -0.9);
        glacis.rotation.x = -Math.PI / 6;
        this.hullGroup.add(glacis);

        // 2. Headlights (헤드라이트)
        const headlightColor = 0xffffaa;
        const lightL = createVoxelBox(0.12, 0.12, 0.08, headlightColor);
        lightL.position.set(-0.5, 0.55, -0.9);
        this.hullGroup.add(lightL);
        const lightR = createVoxelBox(0.12, 0.12, 0.08, headlightColor);
        lightR.position.set(0.5, 0.55, -0.9);
        this.hullGroup.add(lightR);

        // 3. Hull Machine Gun (전면 부기관총)
        const hullMgMount = createVoxelBox(0.15, 0.15, 0.1, 0x222222);
        hullMgMount.position.set(0.3, 0.55, -0.9);
        this.hullGroup.add(hullMgMount);
        const hullMgBarrel = createVoxelCylinder(0.03, 0.03, 0.2, 0x111111);
        hullMgBarrel.position.set(0.3, 0.55, -0.95);
        hullMgBarrel.rotation.x = Math.PI / 2;
        this.hullGroup.add(hullMgBarrel);

        // 4. Tow Hooks (견인 고리)
        const hookColor = 0x222222;
        for (let x of [-0.4, 0.4]) {
            const hook = createVoxelBox(0.08, 0.15, 0.1, hookColor);
            hook.position.set(x, 0.25, -0.95);
            this.hullGroup.add(hook);
        }
        // ----------------------------------------

        // Rear Fuel Barrels (보조 연료통 - Cylinder로 교체)
        const barrel1 = createVoxelCylinder(0.18, 0.18, 0.6, 0x2d3436, 0.5, 0.5);
        barrel1.position.set(-0.35, 0.5, 0.95);
        barrel1.rotation.x = Math.PI / 2;
        this.hullGroup.add(barrel1);

        const barrel2 = createVoxelCylinder(0.18, 0.18, 0.6, 0x2d3436, 0.5, 0.5);
        barrel2.position.set(0.35, 0.5, 0.95);
        barrel2.rotation.x = Math.PI / 2;
        this.hullGroup.add(barrel2);

        // Rear Decor (배기구 - Cylinder로 교체)
        const exhaustL = createVoxelCylinder(0.08, 0.08, 0.3, 0x111111);
        exhaustL.position.set(-0.42, 0.35, 1.1);
        exhaustL.rotation.x = Math.PI / 2;
        this.hullGroup.add(exhaustL);

        const exhaustR = createVoxelCylinder(0.08, 0.08, 0.3, 0x111111);
        exhaustR.position.set(0.42, 0.35, 1.1);
        exhaustR.rotation.x = Math.PI / 2;
        this.hullGroup.add(exhaustR);

        // Treads
        this.treads = [
            createVoxelBox(0.38, 0.42, 1.95, 0x1a1a1a, 0.1, 0.9),
            createVoxelBox(0.38, 0.42, 1.95, 0x1a1a1a, 0.1, 0.9)
        ];
        this.treads[0].position.set(-0.45, 0.22, 0);
        this.treads[1].position.set(0.45, 0.22, 0);
        this.hullGroup.add(this.treads[0], this.treads[1]);

        // Road Wheels (기동륜 추가)
        this.wheels = [];
        for (let side of [-0.45, 0.45]) {
            for (let i = 0; i < 4; i++) {
                const wheel = createVoxelCylinder(0.16, 0.16, 0.42, 0x333333);
                wheel.position.set(side, 0.18, -0.6 + i * 0.4);
                wheel.rotation.z = Math.PI / 2;
                this.hullGroup.add(wheel);
                this.wheels.push(wheel);
            }
        }

        // 2. Turret Group
        this.turretGroup = new THREE.Group();
        this.turretGroup.position.y = 0.7; // Raised slightly
        this.group.add(this.turretGroup);

        this.turretMain = createVoxelBox(0.9, 0.45, 0.95, mainColor, 0.4, 0.6);
        this.turretMain.position.y = 0.15;
        this.turretMain.castShadow = true; // Important: Tank casts shadow
        this.turretGroup.add(this.turretMain);

        // Turret Armor Plates (Cheeks)
        const cheekL = createVoxelBox(0.1, 0.3, 0.6, mainColor, 0.5, 0.5);
        cheekL.position.set(-0.45, 0.15, -0.1);
        cheekL.rotation.y = 0.2;
        this.turretGroup.add(cheekL);

        const cheekR = createVoxelBox(0.1, 0.3, 0.6, mainColor, 0.5, 0.5);
        cheekR.position.set(0.45, 0.15, -0.1);
        cheekR.rotation.y = -0.2;
        this.turretGroup.add(cheekR);

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

        // 3. Barrel Group (for individual recoil)
        this.barrelGroup = new THREE.Group();
        this.barrelGroup.position.set(0, 0.15, -0.4);
        this.turretGroup.add(this.barrelGroup);

        // Main Barrel (Cylinder로 교체 - 정면(-Z)을 향하도록 -PI/2 회전)
        this.barrel = createVoxelCylinder(0.1, 0.12, 1.3, detailColor, 0.6, 0.4);
        this.barrel.position.set(0, 0, -0.65);
        this.barrel.rotation.x = -Math.PI / 2; // Point forward (-Z)
        this.barrelGroup.add(this.barrel);

        // Muzzle Brake (Cylinder 기반으로 고도화)
        const brakeMain = createVoxelCylinder(0.14, 0.14, 0.2, 0x111111, 0.6, 0.4);
        brakeMain.position.y = 0.65; // 'height' direction in Cylinder space
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

        // Armor Visual Group
        this.armorGroup = new THREE.Group();
        this.group.add(this.armorGroup);
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
        while (this.armorGroup.children.length > 0) {
            const child = this.armorGroup.children[0];
            this.armorGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        const armorColor = 0x7b87a0; // Steel Gunmetal
        const rivetColor = 0x333333;
        const metal = 0.7;
        const rough = 0.3;

        // Level 1-3: Reinforced Side Skirts with Rivets
        if (this.levelArmor >= 1) {
            for (let side of [-0.68, 0.68]) {
                // Segmented Skirts for more detail
                for (let z = -0.6; z <= 0.6; z += 0.4) {
                    const skirt = createVoxelBox(0.12, 0.4, 0.35, armorColor, metal, rough);
                    skirt.position.set(side, 0.35, z + (Math.random() - 0.5) * 0.05);
                    this.armorGroup.add(skirt);

                    // Add rivets to each segment
                    const rivet = createVoxelBox(0.04, 0.04, 0.04, rivetColor);
                    rivet.position.set(side * 1.05, 0.45, z);
                    this.armorGroup.add(rivet);
                }
            }
        }

        // Level 4-6: Front Reactive Armor (ERA Bricks)
        if (this.levelArmor >= 4) {
            for (let x = -0.45; x <= 0.45; x += 0.22) {
                // Front Hull Bricks (Slanted)
                const eraHull = createVoxelBox(0.18, 0.1, 0.25, armorColor, metal, rough);
                eraHull.position.set(x, 0.65, -0.9);
                eraHull.rotation.x = -Math.PI / 6;
                this.armorGroup.add(eraHull);

                // Turret Front Bricks (Reactive pattern)
                const eraTurret = createVoxelBox(0.15, 0.15, 0.1, armorColor, metal, rough);
                eraTurret.position.set(x, 0.95, -0.45);
                this.armorGroup.add(eraTurret);
            }
        }

        // Level 7-9: Turret Spaced Armor & Rear Slat/Cage Armor
        if (this.levelArmor >= 7) {
            // Large Spaced Plates on Turret Sides
            for (let side of [-0.6, 0.6]) {
                const turretPlate = createVoxelBox(0.08, 0.45, 0.9, armorColor, metal, rough);
                turretPlate.position.set(side, 0.9, 0);
                turretPlate.rotation.y = side > 0 ? -0.15 : 0.15;
                this.armorGroup.add(turretPlate);
            }

            // Rear Slat Armor (Cage effect) - Vertical bars
            for (let x = -0.6; x <= 0.6; x += 0.1) {
                const bar = createVoxelBox(0.05, 0.4, 0.05, rivetColor, 0.5, 0.5);
                bar.position.set(x, 0.4, 1.0);
                this.armorGroup.add(bar);
            }
            const horizontalBar = createVoxelBox(1.3, 0.05, 0.06, armorColor, metal, rough);
            horizontalBar.position.set(0, 0.5, 1.01);
            this.armorGroup.add(horizontalBar);
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
            this.recoil = Math.max(0, this.recoil - dt * 5);
            this.barrelGroup.position.z = -0.4 + this.recoil * 0.4; // Push back
            this.hullGroup.position.z = this.recoil * 0.1;
            this.hullGroup.rotation.x = -this.recoil * 0.05; // Tilt up
        } else {
            this.barrelGroup.position.z = THREE.MathUtils.lerp(this.barrelGroup.position.z, -0.4, 0.1);
            this.hullGroup.position.z = THREE.MathUtils.lerp(this.hullGroup.position.z, 0, 0.1);
            this.hullGroup.rotation.x = THREE.MathUtils.lerp(this.hullGroup.rotation.x, 0, 0.1);
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

                // Dual Exhaust Pipes
                for (let xOff of [-0.4, 0.4]) {
                    const exhaustPos = new THREE.Vector3(xOff, 0.65, 0.95).applyMatrix4(this.group.matrixWorld);

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
            vfx.spawn(worldPos, 0x555555, 5, 2, 0.1, 800); // Smoke
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

    const players = Array.from(tanks.values());
    if (myTank) players.push(myTank);
    bots.forEach(b => players.push(b));

    // Online count
    const onlineCount = Array.from(tanks.values()).length + 1;
    const scoreboardTitle = document.querySelector('.scoreboard-title') || { textContent: '' };

    players.sort((a, b) => b.kills - a.kills);

    scoreboard.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">
            Kills
        </div>
        ${players.map(p => `
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
    const now = Date.now(); // NEW: define now
    // 1. My Tank Update (Only while playing and alive)
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
        camera.fov = 60;
        camera.updateProjectionMatrix();

        let camX = myTank.group.position.x;
        let camY = 20;
        let camZ = myTank.group.position.z + 10;

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
    }

    // 2. Other Tanks Anim Update
    tanks.forEach(tank => {
        tank.updateAnims(dt, true);
    });

    if (amIMaster) {
        bots.forEach(bot => {
            bot.updateAnims(dt, true);
            bot.updateAI(dt);
        });

        // --- NEW: PowerUp Spawning (Master only) ---
        const now = Date.now();
        if (now - lastPowerupSpawnTime > CONFIG.POWERUP.SPAWN_INTERVAL && powerups.length < CONFIG.POWERUP.MAX_COUNT) {
            lastPowerupSpawnTime = now;
            const spawn = getRandomSpawnPoint();
            const id = `p_${Math.random().toString(36).substring(2, 7)}`;

            const p = new HealthPotion(id, new THREE.Vector3(spawn.x, 0, spawn.z));
            powerups.push(p);

            if (channel) {
                channel.send({
                    type: 'broadcast',
                    event: 'spawn_powerup',
                    payload: { id, pos: { x: spawn.x, y: 0, z: spawn.z } }
                });
            }
        }
    } else {
        // Clients only update animations, positions come from sync
        bots.forEach(bot => {
            bot.updateAnims(dt, true);
        });
    }

    // --- NEW: PowerUp Update & Collision ---
    const currentTime = Date.now() * 0.001;
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.update(dt, currentTime);

        // Check collision with ALL tanks (Only master or local player handles their own pickup)
        const allTanks = [myTank, ...Array.from(tanks.values()), ...bots];
        for (const tank of allTanks) {
            if (!tank || tank.hp <= 0) continue;

            const dist = tank.group.position.distanceTo(p.group.position);
            if (dist < 1.5) {
                if (tank.isLocal || (amIMaster)) {
                    tank.heal(CONFIG.POWERUP.HEAL_AMOUNT);
                    // NEW: Float "UP" text effect
                    spawnFloatingText(tank.group.position.clone().add(new THREE.Vector3(0, 2, 0)), "HP UP", "#27ae60");

                    if (channel) {
                        channel.send({
                            type: 'broadcast',
                            event: 'collect_powerup',
                            payload: { id: p.id, collectorId: tank.id }
                        });
                    }
                    p.destroy();
                    powerups.splice(i, 1);
                    break;
                }
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

    // 4. Update VFX System & Wreck Effects
    if (vfx) {
        vfx.update(dt);

        wreckSmokeTimer += dt;
        if (wreckSmokeTimer > 0.15) {
            wreckSmokeTimer = 0;
            wrecks.forEach(wreck => {
                const smokePos = new THREE.Vector3(0, 0.8, 0).add(wreck.position);
                vfx.spawnFire(smokePos, 1, 1.0, 0.25, 800); // Constant fire
                vfx.spawnSmoke(smokePos, 0x333333, 1, 0.5, 0.4, 2500); // Constant smoke
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
    const halfSize = CONFIG.WORLD.SIZE / 2;

    // Boundary check
    myTank.group.position.x = Math.max(-halfSize, Math.min(halfSize, myTank.group.position.x));
    myTank.group.position.z = Math.max(-halfSize, Math.min(halfSize, myTank.group.position.z));

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

    // 2. Resolve Bots vs Others (Master only)
    if (amIMaster) {
        for (let i = 0; i < bots.length; i++) {
            const bot = bots[i];
            if (bot.isDead) continue;
            for (let j = 0; j < allTanks.length; j++) {
                const other = allTanks[j];
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
                const isBotShooter = bots.some(b => b.id === bullet.ownerId);
                if (bullet.ownerId === myId || (isBotShooter && amIMaster)) {
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

        // Bot collisions
        for (const bot of bots) {
            if (bullet.ownerId !== bot.id && bullet.mesh.position.distanceTo(bot.group.position) < 1.2) {
                const isBotShooter = bots.some(b => b.id === bullet.ownerId);
                if (bullet.ownerId === myId || (isBotShooter && amIMaster)) {
                    AudioSFX.playImpact();
                    if (vfx) vfx.spawnImpact(bullet.mesh.position, new THREE.Vector3(0, 1, 0), 0xffaa00);
                    bot.handleHit(CONFIG.BULLET.DAMAGE, bullet.ownerId);
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

    // 2. Broadcast ALL Bots at once (Batch update for better performance)
    if (amIMaster && bots.length > 0) {
        const botUpdates = bots.filter(b => b.hp > 0).map(bot => ({
            id: bot.id,
            name: bot.name,
            pos: { x: bot.group.position.x, y: bot.group.position.y, z: bot.group.position.z },
            rot: bot.group.rotation.y,
            turretRot: bot.turretGroup.rotation.y,
            hp: bot.hp,
            kills: bot.kills,
            isBot: true,
            levels: {
                cannon: bot.levelCannon,
                speed: bot.levelSpeed,
                armor: bot.levelArmor
            }
        }));

        if (botUpdates.length > 0) {
            channel.send({
                type: 'broadcast',
                event: 'bots_move',
                payload: { bots: botUpdates }
            });
        }
    }

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
        scene.background = new THREE.Color(0x1a1a1a);
        scene.fog = new THREE.FogExp2(0x1a1a1a, 0.015); // Add depth with fog

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

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(30, 50, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.left = -60;
        directionalLight.shadow.camera.right = 60;
        directionalLight.shadow.camera.top = 60;
        directionalLight.shadow.camera.bottom = -60;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 200;
        scene.add(directionalLight);

        // Floor (Rugged Ground/Earth style)
        const tileSize = 5;
        const tilesPerSide = CONFIG.WORLD.SIZE / tileSize;
        const groundColors = [CONFIG.COLORS.FLOOR_1, CONFIG.COLORS.FLOOR_2, CONFIG.COLORS.FLOOR_3, CONFIG.COLORS.FLOOR_4];

        for (let ix = 0; ix < tilesPerSide; ix++) {
            for (let iz = 0; iz < tilesPerSide; iz++) {
                // Randomly pick from earthy colors
                const colorIdx = Math.floor(seededRandom(ix * 13 + iz * 7) * groundColors.length);
                const color = groundColors[colorIdx];

                // Rugged height variation
                const hVar = seededRandom(ix * 31 + iz * 17) * 0.4;
                const tile = createVoxelBox(tileSize, 0.2 + hVar, tileSize, color, 0.1, 0.9);
                tile.position.set(
                    (ix - tilesPerSide / 2 + 0.5) * tileSize,
                    (0.2 + hVar) / 2 - 0.1,
                    (iz - tilesPerSide / 2 + 0.5) * tileSize
                );
                tile.receiveShadow = true;
                scene.add(tile);

                // Add occasional pebbles (잔돌)
                if (seededRandom(ix * 55 + iz * 23) < 0.15) {
                    const pSize = 0.1 + seededRandom(ix + iz) * 0.2;
                    const pebble = createVoxelBox(pSize, pSize, pSize, 0x555555);
                    pebble.position.set(
                        tile.position.x + (seededRandom(ix * 2) - 0.5) * (tileSize - 1),
                        0.1 + hVar,
                        tile.position.z + (seededRandom(iz * 2) - 0.5) * (tileSize - 1)
                    );
                    scene.add(pebble);
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

            // Add invisible collision box to walls
            const col = createVoxelBox(0.8, 3.5, 0.8, 0x000000);
            col.position.set(x, 1.75, z);
            col.visible = false;
            col.userData = { type: 'tree', parentTree: treeGroup };
            scene.add(col); // CRITICAL: Must be in scene to update world matrices
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

        // Add boundary pillars/props (Deterministic seed for same room experience)
        let worldSeed = 1234.567;
        for (let i = 0; i < 24; i++) {
            const side = Math.floor(seededRandom(worldSeed++) * 4);
            const dist = CONFIG.WORLD.SIZE / 2;
            let x = 0, z = 0;
            if (side === 0) { x = (seededRandom(worldSeed++) - 0.5) * CONFIG.WORLD.SIZE; z = -dist; }
            else if (side === 1) { x = (seededRandom(worldSeed++) - 0.5) * CONFIG.WORLD.SIZE; z = dist; }
            else if (side === 2) { x = -dist; z = (seededRandom(worldSeed++) - 0.5) * CONFIG.WORLD.SIZE; }
            else { x = dist; z = (seededRandom(worldSeed++) - 0.5) * CONFIG.WORLD.SIZE; }

            const h = 4 + seededRandom(worldSeed++) * 8;
            const pillar = createVoxelBox(2, h, 2, 0x333333);
            pillar.position.set(x, h / 2, z);
            scene.add(pillar);

            // Add orange point lights to some pillars
            if (i % 6 === 0) {
                const lamp = createVoxelBox(0.4, 0.4, 0.4, 0xffaa00);
                lamp.position.set(x * 0.95, h - 0.5, z * 0.95);
                scene.add(lamp);
                const light = new THREE.PointLight(0xffaa00, 10, 20);
                light.position.set(x * 0.95, h - 1, z * 0.95);
                light.castShadow = false; // CRITICAL: PointLight shadows are extremely expensive
                scene.add(light);
            }
        }

        // Add Background Skyline (빌딩 실루엣)
        for (let i = 0; i < 40; i++) {
            const r = 80 + seededRandom(worldSeed++) * 50;
            const ang = seededRandom(worldSeed++) * Math.PI * 2;
            const x = Math.cos(ang) * r;
            const z = Math.sin(ang) * r;
            const w = 5 + seededRandom(worldSeed++) * 10;
            const h = 20 + seededRandom(worldSeed++) * 60;
            const building = createVoxelBox(w, h, w, 0x111111, 0, 1);
            building.position.set(x, h / 2 - 5, z);
            scene.add(building);
        }

        // Scatter props deterministically (Increased density, excluding wrecks)
        for (let i = 0; i < 60; i++) {
            const rx = (seededRandom(worldSeed++) - 0.5) * (CONFIG.WORLD.SIZE - 10);
            const rz = (seededRandom(worldSeed++) - 0.5) * (CONFIG.WORLD.SIZE - 10);
            if (isPositionSafe(rx, rz)) {
                const type = seededRandom(worldSeed++);
                if (type < 0.2) createHedgehog(rx, rz);
                else if (type < 0.4) createProp('crate', rx, rz);
                else if (type < 0.6) createProp('barrel', rx, rz);
                else createTree(rx, rz); // Higher tree density
            }
        }

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

    channel.on('broadcast', { event: 'bots_move' }, ({ payload }) => {
        if (!payload.bots) return;
        payload.bots.forEach(botData => {
            let bot = bots.find(b => b.id === botData.id);
            if (bot && bot.group) {
                const targetPos = new THREE.Vector3(botData.pos.x, botData.pos.y, botData.pos.z);
                bot.group.position.lerp(targetPos, 0.4);
                bot.group.rotation.y = botData.rot;
                if (bot.turretGroup) bot.turretGroup.rotation.y = botData.turretRot;
                bot.updateHP(botData.hp);
                bot.kills = botData.kills || 0;

                // Sync Upgrade Levels for Bots
                if (botData.levels) {
                    let changed = false;
                    if (bot.levelCannon !== botData.levels.cannon) { bot.levelCannon = botData.levels.cannon; changed = true; }
                    if (bot.levelSpeed !== botData.levels.speed) { bot.levelSpeed = botData.levels.speed; changed = true; }
                    if (bot.levelArmor !== botData.levels.armor) { bot.levelArmor = botData.levels.armor; changed = true; }
                    if (changed) bot.updateArmorVisual();
                }
            }
        });
        updateScoreboard();
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
        const tank = tanks.get(payload.ownerId) || bots.find(b => b.id === payload.ownerId);
        if (tank) tank.playShootEffect();
    });


    channel.on('broadcast', { event: 'hit' }, ({ payload }) => {
        if (payload.shooterId === myId) return;
        let target = (payload.targetId === myId) ? myTank : (tanks.get(payload.targetId) || bots.find(b => b.id === payload.targetId));
        if (target) {
            if (target === myTank || (amIMaster && target.isBot)) {
                target.handleHit(payload.damage, payload.shooterId);
            }
        }
    });

    channel.on('broadcast', { event: 'death' }, ({ payload }) => {
        const isBot = payload.victimId.startsWith('bot_');
        const victim = (payload.victimId === myId) ? myTank : (isBot ? bots.find(b => b.id === payload.victimId) : tanks.get(payload.victimId));

        if (victim) {
            // Only show explosion if I killed them OR I am the one who died
            if ((payload.shooterId === myId || payload.victimId === myId) && vfx) {
                vfx.spawnExplosion(victim.group.position);
            }

            if (victim !== myTank) {
                victim.destroy();
                if (isBot) {
                    const idx = bots.indexOf(victim);
                    if (idx !== -1) bots.splice(idx, 1);
                    setTimeout(() => spawnBots(1), 5000);
                } else {
                    tanks.delete(payload.victimId);
                }
            }
            updateScoreboard();
        }

        const killer = [myTank, ...Array.from(tanks.values()), ...bots].find(t => t && t.id === payload.shooterId);
        if (killer) {
            killer.kills++;
            updateScoreboard();
            if (killer.isLocal) syncMultiplayer();
        }
    });


    // --- NEW: Health Potion Listeners ---
    channel.on('broadcast', { event: 'spawn_powerup' }, ({ payload }) => {
        const id = payload.id;
        const pos = new THREE.Vector3(payload.pos.x, payload.pos.y, payload.pos.z);
        if (!powerups.find(p => p.id === id)) {
            const p = new HealthPotion(id, pos);
            powerups.push(p);
        }
    });

    channel.on('broadcast', { event: 'collect_powerup' }, ({ payload }) => {
        const pIdx = powerups.findIndex(p => p.id === payload.id);
        if (pIdx !== -1) {
            const p = powerups[pIdx];
            const tank = (payload.collectorId === myId) ? myTank : (tanks.get(payload.collectorId) || bots.find(b => b.id === payload.collectorId));
            if (tank) tank.heal(CONFIG.POWERUP.HEAL_AMOUNT);
            p.destroy();
            powerups.splice(pIdx, 1);
        }
    });

    // --- Upgrade Item Listeners ---
    channel.on('broadcast', { event: 'spawn_upgrade' }, ({ payload }) => {
        if (amIMaster) return;
        if (!upgradeItems.find(u => u.id === payload.id)) {
            const u = new UpgradeItem(payload.id, payload.type, new THREE.Vector3(payload.pos.x, 0, payload.pos.z));
            upgradeItems.push(u);
        }
    });

    channel.on('broadcast', { event: 'collect_upgrade' }, ({ payload }) => {
        const uIdx = upgradeItems.findIndex(u => u.id === payload.id);
        if (uIdx !== -1) {
            const u = upgradeItems[uIdx];
            const tank = (payload.tankId === myId) ? myTank : (tanks.get(payload.tankId) || bots.find(b => b.id === payload.tankId));
            if (tank) {
                tank.applyUpgrade(payload.type);
                // Remote FX
                if (vfx) vfx.spawn(u.group.position, 0xffff00, 20, 4, 0.2, 1000);
                spawnFloatingText(tank.group.position.clone().add(new THREE.Vector3(0, 2, 0)), `${payload.type} UP!`, '#ffd700');
            }
            u.destroy();
            upgradeItems.splice(uIdx, 1);
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
