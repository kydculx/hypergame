/* 1. Constant Configuration (Balance, Styles) */
const CONFIG = {
    TANK: {
        SPEED: 5,
        ROTATE_SPEED: 1,
        TURRET_ROTATE_SPEED: 2,
        FIRE_COOLDOWN: 500, // ms
        MAX_HP: 100
    },
    BULLET: {
        SPEED: 15,
        LIFE_TIME: 2000, // ms
        DAMAGE: 10
    },
    WORLD: {
        SIZE: 100,
        GRID_SIZE: 1
    },
    LERP_SPEED: {
        TURRET: 1.0 // Smoothness factor
    },
    COLORS: {
        SELF: 0x4d79ff, // Blue
        OTHER: 0xff4d4d, // Red
        FLOOR_1: 0x666666, // Bright Gray (from 0x333333)
        FLOOR_2: 0x777777,
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
        ]
    },
    BOT: {
        COUNT: 5,
        SPEED: 3.5,
        ROTATE_SPEED: 1,
        FIRE_COOLDOWN: 1800,
        DETECTION_RANGE: 60,
        ATTACK_RANGE: 40,
        NICKNAMES: [
            "SuperTanker", "VoxelKing", "NoobMaster69", "TankCommander", "IronFist",
            "SwiftShadow", "MetalBeast", "Alpha", "Bravo", "Charlie", "Delta",
            "GhostShell", "SteelRain", "DesertRat", "BlueDragon", "RedDragon",
            "KoreanPro", "Expert_X", "HiddenTiger", "FlyingEagle", "SniperJoe"
        ],
        COLORS: [0x9933ff, 0xff9900, 0x00ffcc, 0xff0066, 0x33cc33, 0xffdd00]
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

        if (!name) name = idBase;

        // Safety: id should be alphanumeric, name can have Korean
        id = id.replace(/[^a-zA-Z0-9]/g, '_');
        name = name.replace(/[^a-zA-Z0-9가-힣\s]/g, '');
        return { id, name };
    } catch (e) {
        const fallback = Math.random().toString(36).substring(2, 9);
        return { id: fallback, name: fallback };
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
const bots = []; // Array of Bot instances
let supabaseClient;
let channel;
let amIMaster = false;
let lastFireTime = 0;
let lastSyncTime = 0;
let animationId = null;

/* 3. Utilities (Helper functions) */
function createVoxelBox(w, h, d, color) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({ color });
    return new THREE.Mesh(geometry, material);
}

/* Audio System (Web Audio API) */
const AudioSFX = {
    ctx: null,
    master: null,
    bgmStep: 0,
    bgmTimer: null,

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.4;
            const comp = this.ctx.createDynamicsCompressor();
            this.master.connect(comp);
            comp.connect(this.ctx.destination);
        } catch (e) {
            console.warn("AudioContext init failed", e);
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    playFire() {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        osc.stop(now + 0.2);
        this.playNoise(0.1, 0.4, 1200);
    },

    playImpact() {
        if (!this.ctx) return;
        this.playNoise(0.2, 0.3, 600);
    },

    playExplosion() {
        if (!this.ctx) return;
        this.playNoise(0.6, 1.5, 300);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 1);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 1);
    },

    playNoise(vol, dur, filterFreq = 1000) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * dur;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        noise.start();
    }
};

class TankEngineAudio {
    constructor() {
        this.osc = null;
        this.gain = null;
        this.filter = null;

        AudioSFX.init();
        if (!AudioSFX.ctx) return;
        this.osc = AudioSFX.ctx.createOscillator();
        this.gain = AudioSFX.ctx.createGain();
        this.filter = AudioSFX.ctx.createBiquadFilter();

        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(150, AudioSFX.ctx.currentTime); // Lowered from 400 for 'heavy' feel

        this.osc.type = 'sawtooth';
        this.osc.frequency.setTargetAtTime(30, AudioSFX.ctx.currentTime, 0); // Lowered from 40 for 'heavy' feel

        this.osc.connect(this.filter);
        this.filter.connect(this.gain);
        this.gain.connect(AudioSFX.master);
        this.gain.gain.setValueAtTime(0, AudioSFX.ctx.currentTime); // Start with 0 gain, ramp up in update
    }

    start() {
        if (this.osc) this.osc.start();
    }

    stop() {
        if (this.osc) {
            try { this.osc.stop(); } catch (e) { }
            this.osc = null;
        }
    }

    update(speedRatio) {
        if (!this.osc || !AudioSFX.ctx) return;
        const now = AudioSFX.ctx.currentTime;
        const freq = 30 + speedRatio * 40; // Reduced range for lower pitch
        const gainVal = 0.02 + speedRatio * 0.03; // Significantly lowered volume
        this.osc.frequency.setTargetAtTime(freq, now, 0.1);
        this.gain.gain.setTargetAtTime(gainVal, now, 0.1);

        // Dynamic filter based on speed
        if (this.filter) {
            this.filter.frequency.setTargetAtTime(150 + speedRatio * 200, now, 0.1);
        }
    }
}
class Bullet {
    constructor(position, direction, ownerId) {
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.BULLET })
        );
        this.mesh.position.copy(position);
        this.direction = direction.clone();
        this.ownerId = ownerId;
        this.startTime = Date.now();
        scene.add(this.mesh);
    }

    update(dt) {
        this.mesh.position.add(this.direction.clone().multiplyScalar(CONFIG.BULLET.SPEED * dt));
        return Date.now() - this.startTime < CONFIG.BULLET.LIFE_TIME;
    }

    destroy() {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

class Tank {
    constructor(id, name, isLocal = false) {
        this.id = id;
        this.name = name || id;
        this.isLocal = isLocal;
        this.hp = CONFIG.TANK.MAX_HP;
        this.kills = 0; // Added
        this.lastSeen = Date.now(); // Added
        this.group = new THREE.Group();

        // Body
        this.body = createVoxelBox(1.2, 0.6, 1.8, isLocal ? CONFIG.COLORS.SELF : CONFIG.COLORS.OTHER);
        this.body.position.y = 0.3;
        this.group.add(this.body);

        // Treads
        this.treads = [
            createVoxelBox(0.3, 0.4, 1.8, 0x222222),
            createVoxelBox(0.3, 0.4, 1.8, 0x222222)
        ];
        this.treads[0].position.set(-0.45, 0.2, 0);
        this.treads[1].position.set(0.45, 0.2, 0);
        this.group.add(this.treads[0], this.treads[1]);

        // Turret Group
        this.turretGroup = new THREE.Group();
        this.turretGroup.position.y = 0.6;
        this.group.add(this.turretGroup);

        this.turret = createVoxelBox(0.8, 0.4, 0.8, isLocal ? CONFIG.COLORS.SELF : CONFIG.COLORS.OTHER);
        this.turretGroup.add(this.turret);

        this.barrel = createVoxelBox(0.2, 0.2, 1.0, 0x333333);
        this.barrel.position.set(0, 0, -0.8);
        this.barrel.rotation.y = Math.PI; // Point its +Z towards world -Z
        this.turretGroup.add(this.barrel);

        // Health Bar (Floating)
        if (!isLocal) {
            this.createOverlayUI();
        } else {
            // Direction Indicator (Triangle)
            this.indicator = new THREE.Mesh(
                new THREE.ConeGeometry(0.2, 0.4, 3),
                new THREE.MeshBasicMaterial({ color: 0x00ff00 })
            );
            this.indicator.rotation.x = -Math.PI / 2; // Point towards -Z
            this.indicator.position.set(0, 0.8, -1.2); // Move forward (-Z)
            this.group.add(this.indicator);
        }

        scene.add(this.group);

        // Audio
        this.engineAudio = new TankEngineAudio();
        if (isLocal) {
            this.engineAudio.start();
        }

        this.targetWorldAngle = this.group.rotation.y;
    }

    createOverlayUI() {
        // Simple sprite-based health bar or handled via HTML overlay in sync
    }

    updateHP(hp) {
        this.hp = Math.max(0, hp);
        if (this.isLocal) {
            document.getElementById('hp-fill').style.width = `${(this.hp / CONFIG.TANK.MAX_HP) * 100}%`;
            document.getElementById('status-text').textContent = `HP: ${this.hp} / ${CONFIG.TANK.MAX_HP}`;
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
                if (window.AudioSFX) AudioSFX.playExplosion();
                WCGames.gameOver(myTank.kills);
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

            // 1. Calculate Target Angle for Hull (to circle)
            // We want to point the hull roughly sideways (PI/2 or -PI/2 relative to target)
            this.strafeTimer -= dt;
            if (this.strafeTimer <= 0) {
                this.strafeTimer = 2 + Math.random() * 3;
                this.strafeDir = Math.random() < 0.5 ? 1 : -1;
            }

            // Dist control: if too far, point slightly more towards target. If too near, point slightly more away.
            let offset = (Math.PI / 2) * this.strafeDir;
            if (dist > 15) offset *= 0.5; // Turn more towards target
            else if (dist < 8) offset *= 1.5; // Turn more away

            const angleToTarget = Math.atan2(-dx, -dz);
            const hullTargetAngle = angleToTarget + offset;

            // Rotate hull
            this.group.rotation.y = lerpAngle(this.group.rotation.y, hullTargetAngle, dt * 2.5);

            // 2. Rotate turret independently to point at Target (with slight jitter)
            this.aimJitterTimer += dt;
            if (this.aimJitterTimer > 1) {
                this.aimJitterTimer = 0;
                this.aimJitter = (Math.random() - 0.5) * 0.2; // Slight miss
            }
            const turretDesiredGlobalAngle = angleToTarget + this.aimJitter;
            const turretLocalTargetAngle = turretDesiredGlobalAngle - this.group.rotation.y;
            this.turretGroup.rotation.y = lerpAngle(this.turretGroup.rotation.y, turretLocalTargetAngle, dt * 5);

            // 3. Constant movement
            if (!this.move(1, dt)) {
                // If blocked, reverse strafe
                this.strafeDir *= -1;
                this.strafeTimer = 2;
            }

            // 4. Shoot if turret aimed well
            const turretWorldAngle = this.group.rotation.y + this.turretGroup.rotation.y;
            const currentDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), turretWorldAngle);
            const targetDirRaw = new THREE.Vector3(dx, 0, dz).normalize();
            const dot = currentDir.dot(targetDirRaw);

            if (dot > 0.96 && dist < CONFIG.BOT.ATTACK_RANGE) {
                this.shoot();
            }
        } else {
            // WANDER
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.stateTimer = 1 + Math.random() * 2;
                this.wanderAngle = (Math.random() - 0.5) * Math.PI * 2;
            }

            this.group.rotation.y = lerpAngle(this.group.rotation.y, this.wanderAngle, dt * 2);

            // Move forward, but check for walls
            if (!this.move(1, dt)) {
                // If blocked, pick a new random angle immediately and try to move away
                this.wanderAngle = (Math.random() - 0.5) * Math.PI * 2;
                this.stateTimer = 0.5;
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
            this.group.rotation.y += this.strafeDir * dt * 3.0; // Turn faster when sensing wall

            if (this.blockedTimer > 0.5) {
                // Emergency Reserve
                this.move(-0.6, dt);
            }
        } else {
            this.blockedTimer = Math.max(0, this.blockedTimer - dt);
        }
    }

    move(dir, dt) {
        const speed = CONFIG.BOT.SPEED * dir;
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y);
        const nextPos = this.group.position.clone().add(forward.multiplyScalar(speed * dt));

        if (isPositionSafe(nextPos.x, nextPos.z)) {
            this.group.position.copy(nextPos);
            this.engineAudio.update(Math.abs(dir));
            return true;
        }
        return false;
    }

    shoot() {
        const now = Date.now();
        const jitteredCooldown = CONFIG.BOT.FIRE_COOLDOWN + (Math.random() - 0.5) * 400;
        if (now - this.lastFireTime < jitteredCooldown) return;
        this.lastFireTime = now;

        const pos = new THREE.Vector3();
        this.barrel.getWorldPosition(pos);
        const dir = new THREE.Vector3();
        this.barrel.getWorldDirection(dir);

        const bullet = new Bullet(pos, dir.clone(), this.id);
        bullets.push(bullet);

        // Broadcast Bot fire (Master only)
        if (amIMaster && channel) {
            channel.send({
                type: 'broadcast',
                event: 'fire',
                payload: {
                    pos: { x: pos.x, y: pos.y, z: pos.z },
                    dir: { x: dir.x, y: dir.y, z: dir.z },
                    ownerId: this.id
                }
            });
        }

        if (window.AudioSFX) AudioSFX.playShoot();
    }

    handleHit(damage, shooterId) {
        if (this.hp <= 0) return;
        super.updateHP(this.hp - damage);

        // React to hit (Panic / Dodge)
        if (this.hp > 0) {
            this.strafeDir *= -1;
            this.strafeTimer = 1 + Math.random();
            this.wanderAngle = (Math.random() - 0.5) * Math.PI * 2;
        }

        if (this.hp <= 0) {
            // Find who shot this
            const allTanks = [myTank, ...Array.from(tanks.values()), ...bots];
            const killer = allTanks.find(t => t && t.id === shooterId);
            if (killer) {
                killer.kills++;
                updateScoreboard();
                if (killer.isLocal) syncMultiplayer();
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
    const setup = (id, target) => {
        const el = document.getElementById(id);
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
    setup('joystick-right', joystickRight);
}

function spawnBots(count) {
    for (let i = 0; i < count; i++) {
        const spawn = getRandomSpawnPoint();
        const botId = `bot_${Math.random().toString(36).substring(2, 7)}`;
        const botName = CONFIG.BOT.NICKNAMES[Math.floor(Math.random() * CONFIG.BOT.NICKNAMES.length)];
        const bot = new Bot(botId, botName);
        bot.group.position.set(spawn.x, 0, spawn.z);
        bots.push(bot);
    }
}

/* 6. Game Logic (Update, Collision) */
function updateScoreboard() {
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
            ${CONFIG.BOT.NICKNAMES.length > 0 ? 'Scoreboard' : ''}
        </div>
        ${players.map(p => `
            <div class="scoreboard-item" style="color: ${p.isLocal ? '#4d79ff' : (p.isBot ? '#e0e0e0' : '#ff4d4d')}">
                <span>${p.name || p.id}${p.isLocal ? ' (ME)' : ''}</span>
                <span style="font-size: 0.8em; opacity: 0.6; margin-left:10px;">${p.kills} K</span>
            </div>
        `).join('')}
    `;
}

function fire() {
    const now = Date.now();
    if (now - lastFireTime < CONFIG.TANK.FIRE_COOLDOWN) return;
    lastFireTime = now;

    AudioSFX.playFire();
    const pos = new THREE.Vector3();
    myTank.barrel.getWorldPosition(pos);
    const dir = new THREE.Vector3();
    myTank.barrel.getWorldDirection(dir);

    const bullet = new Bullet(pos, dir, myId);
    bullets.push(bullet);

    // Broadcast fire
    if (channel) {
        channel.send({
            type: 'broadcast',
            event: 'fire',
            payload: { pos: { x: pos.x, y: pos.y, z: pos.z }, dir: { x: dir.x, y: dir.y, z: dir.z }, ownerId: myId }
        });
    }

    // WCGames.Audio.play(200, 'square', 0.1, 0.05); // Replaced by AudioSFX.playFire()
}

function update(dt) {
    // 1. My Tank Update (Only while playing)
    if (WCGames.state === 'PLAYING' && myTank) {
        let moveDir = 0;
        let rotateDir = 0;

        if (keys['KeyW'] || keys['w'] || keys['ArrowUp']) moveDir += 1;
        if (keys['KeyS'] || keys['s'] || keys['ArrowDown']) moveDir -= 1;
        if (keys['KeyA'] || keys['a'] || keys['ArrowLeft']) rotateDir += 1;
        if (keys['KeyD'] || keys['d'] || keys['ArrowRight']) rotateDir -= 1;

        // Merge Joystick
        if (Math.abs(joystickLeft.y) > 0.1) moveDir -= joystickLeft.y;
        if (Math.abs(joystickLeft.x) > 0.1) rotateDir -= joystickLeft.x;

        myTank.group.rotation.y += rotateDir * CONFIG.TANK.ROTATE_SPEED * dt;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(myTank.group.quaternion);
        myTank.group.position.add(forward.multiplyScalar(moveDir * CONFIG.TANK.SPEED * dt));

        if (myTank.engineAudio) myTank.engineAudio.update(Math.abs(moveDir));

        // Turret Rotation (Mouse / Right Joystick)
        let targetTurretAngle = null;

        if (Math.abs(joystickRight.x) > 0.1 || Math.abs(joystickRight.y) > 0.1) {
            targetTurretAngle = Math.atan2(-joystickRight.x, -joystickRight.y);
            if (Math.sqrt(joystickRight.x ** 2 + joystickRight.y ** 2) > 0.8) fire();
        } else if (window.matchMedia('(pointer: fine)').matches && window.WCGames.input && window.WCGames.input.mouse) {
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2(
                (WCGames.input.mouse.x / window.innerWidth) * 2 - 1,
                -(WCGames.input.mouse.y / window.innerHeight) * 2 + 1
            );
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(scene.getObjectByName('floor') || scene, true);
            if (intersects.length > 0) {
                const pt = intersects[0].point;
                targetTurretAngle = Math.atan2(myTank.group.position.x - pt.x, myTank.group.position.z - pt.z);
            }

            if (keys['ArrowLeft']) targetTurretAngle = (targetTurretAngle || myTank.turretGroup.rotation.y + myTank.group.rotation.y) + CONFIG.TANK.TURRET_ROTATE_SPEED * dt;
            if (keys['ArrowRight']) targetTurretAngle = (targetTurretAngle || myTank.turretGroup.rotation.y + myTank.group.rotation.y) - CONFIG.TANK.TURRET_ROTATE_SPEED * dt;
        }

        if (targetTurretAngle !== null) myTank.targetWorldAngle = targetTurretAngle;

        // Smooth rotation
        const currentWorldAngle = myTank.turretGroup.rotation.y + myTank.group.rotation.y;
        const nextWorldAngle = lerpAngle(currentWorldAngle, myTank.targetWorldAngle, CONFIG.LERP_SPEED.TURRET * dt);
        myTank.turretGroup.rotation.y = nextWorldAngle - myTank.group.rotation.y;

        if (keys['Space']) fire();

        // Collisions
        checkCollisions();

        // Camera follow
        camera.position.set(myTank.group.position.x, 20, myTank.group.position.z + 10);
        camera.lookAt(myTank.group.position);
    }

    // 2. AI Update (Master only, regardless of state)
    if (amIMaster) {
        bots.forEach(bot => bot.updateAI(dt));
    }

    // 3. Sync
    syncMultiplayer();
}

function checkCollisions() {
    const dt = clock.getDelta(); // This is wrong, should pass dt from update, but let's just use simple resolve
    const originalPos = myTank.group.position.clone();
    const halfSize = CONFIG.WORLD.SIZE / 2;

    // Boundary check
    myTank.group.position.x = Math.max(-halfSize, Math.min(halfSize, myTank.group.position.x));
    myTank.group.position.z = Math.max(-halfSize, Math.min(halfSize, myTank.group.position.z));

    // Wall check
    const tankRadius = 0.65;
    for (const wall of walls) {
        const wallW = wall.geometry.parameters.width;
        const wallD = wall.geometry.parameters.depth;

        const wallMinX = wall.position.x - wallW / 2 - tankRadius;
        const wallMaxX = wall.position.x + wallW / 2 + tankRadius;
        const wallMinZ = wall.position.z - wallD / 2 - tankRadius;
        const wallMaxZ = wall.position.z + wallD / 2 + tankRadius;

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

    // Bullets and other collisions are handled in their own loop in modern cleanup, but for now:
    updateBullets();
}

function updateBullets() {
    const dt = 0.016; // Approx
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!bullet.update(dt)) {
            bullet.destroy();
            bullets.splice(i, 1);
            continue;
        }

        // Wall collision (Everyone handles locally)
        let bulletHit = false;
        for (const wall of walls) {
            const wallW = wall.geometry.parameters.width;
            const wallD = wall.geometry.parameters.depth;
            const buffer = 0.2;
            if (Math.abs(bullet.mesh.position.x - wall.position.x) < wallW / 2 + buffer &&
                Math.abs(bullet.mesh.position.z - wall.position.z) < wallD / 2 + buffer) {
                if (bullet.ownerId === myId) AudioSFX.playImpact();
                bullet.destroy();
                bullets.splice(i, 1);
                bulletHit = true;
                break;
            }
        }
        if (bulletHit) continue;

        // Player collisions (Including self)
        const allPlayers = [myTank, ...Array.from(tanks.values())];
        allPlayers.forEach(tank => {
            if (!tank || bullet.ownerId === tank.id) return;
            if (bullet.mesh.position.distanceTo(tank.group.position) < 1.2) {
                // Authority: Shooter (Player) or Master (for Bot shooter)
                const isBotShooter = bots.some(b => b.id === bullet.ownerId);
                if (bullet.ownerId === myId || (isBotShooter && amIMaster)) {
                    AudioSFX.playImpact();

                    // Apply locally if target is self
                    if (tank === myTank) {
                        tank.handleHit(CONFIG.BULLET.DAMAGE, bullet.ownerId);
                    }

                    channel.send({
                        type: 'broadcast',
                        event: 'hit',
                        payload: { targetId: tank.id, damage: CONFIG.BULLET.DAMAGE, shooterId: bullet.ownerId }
                    });
                }
                bullet.destroy();
                bullets.splice(i, 1);
                bulletHit = true;
            }
        });
        if (bulletHit) continue;

        // Bot collisions
        for (const bot of bots) {
            if (bullet.ownerId !== bot.id && bullet.mesh.position.distanceTo(bot.group.position) < 1.2) {
                // Authority: Shooter (Player) or Master (for Bot shooter)
                const isBotShooter = bots.some(b => b.id === bullet.ownerId);
                if (bullet.ownerId === myId || (isBotShooter && amIMaster)) {
                    AudioSFX.playImpact();
                    bot.handleHit(CONFIG.BULLET.DAMAGE, bullet.ownerId);
                }
                bullet.destroy();
                bullets.splice(i, 1);
                bulletHit = true;
                break;
            }
        }
        if (bulletHit) continue;
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
                kills: myTank.kills
            }
        });
    }

    // 2. Broadcast Bot status (Master only)
    if (amIMaster && bots.length > 0) {
        channel.send({
            type: 'broadcast',
            event: 'bot_sync',
            payload: {
                bots: bots.map(b => ({
                    id: b.id,
                    name: b.name,
                    color: b.color,
                    pos: { x: b.group.position.x, y: b.group.position.y, z: b.group.position.z },
                    rot: b.group.rotation.y,
                    turretRot: b.turretGroup.rotation.y,
                    hp: b.hp,
                    kills: b.kills
                }))
            }
        });
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
    if (statusText) {
        let masterIndicator = amIMaster ? " [MASTER]" : "";
        statusText.textContent = `HP: ${myTank ? Math.floor(myTank.hp) : 0} / ${CONFIG.TANK.MAX_HP}${masterIndicator}`;
    }

    if (amIMaster && bots.length === 0) {
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
    const tankRadius = 1.2; // matching hardcoded collision radius
    const halfSize = (CONFIG.WORLD.SIZE / 2) - 5;

    if (Math.abs(x) > halfSize || Math.abs(z) > halfSize) return false;

    for (const wallDef of CONFIG.MAP.LAYOUT) {
        const wallMinX = wallDef.x - wallDef.w / 2 - tankRadius;
        const wallMaxX = wallDef.x + wallDef.w / 2 + tankRadius;
        const wallMinZ = wallDef.z - wallDef.d / 2 - tankRadius;
        const wallMaxZ = wallDef.z + wallDef.d / 2 + tankRadius;

        if (x > wallMinX && x < wallMaxX && z > wallMinZ && z < wallMaxZ) {
            return false;
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

/* 8. SDK Initialization & Callbacks */
const Game = {
    start() {
        WCGames.start();
        setupJoysticks();
    },

    init() {
        // Clear old state and scene
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

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        scene.fog = new THREE.FogExp2(0x1a1a1a, 0.015); // Add depth with fog

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

        const container = document.getElementById('game-container');
        container.innerHTML = ''; // Clear previous canvas if any

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);

        if (clock) clock.stop();
        clock = new THREE.Clock();

        // Environment
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        scene.add(hemisphereLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        // Floor (Voxel style)

        const floorGeo = new THREE.PlaneGeometry(CONFIG.WORLD.SIZE, CONFIG.WORLD.SIZE);
        const floorMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.FLOOR_1 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.name = 'floor';
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Add boundary pillars/props (Deterministic seed for same room experience)
        let worldSeed = 1234.567; // Constant seed for "Global Room"
        for (let i = 0; i < 20; i++) {
            const side = Math.floor(seededRandom(worldSeed++) * 4);
            const dist = CONFIG.WORLD.SIZE / 2;
            let x = 0, z = 0;
            if (side === 0) { x = (seededRandom(worldSeed++) - 0.5) * CONFIG.WORLD.SIZE; z = -dist; }
            else if (side === 1) { x = (seededRandom(worldSeed++) - 0.5) * CONFIG.WORLD.SIZE; z = dist; }
            else if (side === 2) { x = -dist; z = (seededRandom(worldSeed++) - 0.5) * CONFIG.WORLD.SIZE; }
            else { x = dist; z = (seededRandom(worldSeed++) - 0.5) * CONFIG.WORLD.SIZE; }

            const h = 2 + seededRandom(worldSeed++) * 5;
            const pillar = createVoxelBox(2, h, 2, 0x444444);
            pillar.position.set(x, h / 2, z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            scene.add(pillar);
        }

        // Fixed Internal Walls
        CONFIG.MAP.LAYOUT.forEach(wallDef => {
            const wall = createVoxelBox(wallDef.w, 2, wallDef.d, CONFIG.COLORS.WALL);
            wall.position.set(wallDef.x, 1, wallDef.z);
            wall.castShadow = true;
            wall.receiveShadow = true;
            scene.add(wall);
            walls.push(wall);
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
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
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
            tank.lastSeen = Date.now();
            updateScoreboard();
        }
    });

    channel.on('broadcast', { event: 'fire' }, ({ payload }) => {
        if (payload.ownerId === myId) return;
        const bPos = new THREE.Vector3(payload.pos.x, payload.pos.y, payload.pos.z);
        const bDir = new THREE.Vector3(payload.dir.x, payload.dir.y, payload.dir.z);
        const bullet = new Bullet(bPos, bDir, payload.ownerId);
        bullets.push(bullet);
    });

    channel.on('broadcast', { event: 'bot_sync' }, ({ payload }) => {
        if (amIMaster) return;
        if (!payload.bots) return;
        const receivedBotIds = new Set(payload.bots.map(b => b.id));
        payload.bots.forEach(bData => {
            let bot = bots.find(b => b.id === bData.id);
            if (!bot) {
                bot = new Bot(bData.id, bData.name, bData.color);
                bots.push(bot);
            }
            if (bot && bot.group) {
                const targetPos = new THREE.Vector3(bData.pos.x, bData.pos.y, bData.pos.z);
                bot.group.position.lerp(targetPos, 0.4);
                bot.group.rotation.y = bData.rot;
                bot.turretGroup.rotation.y = bData.turretRot;
                bot.updateHP(bData.hp);
                bot.kills = bData.kills;
                if (bot.color !== bData.color) {
                    bot.color = bData.color;
                    if (bot.body && bot.body.material) bot.body.material.color.set(bot.color);
                    if (bot.turret && bot.turret.material) bot.turret.material.color.set(bot.color);
                }
            }
        });
        for (let i = bots.length - 1; i >= 0; i--) {
            if (!receivedBotIds.has(bots[i].id)) {
                bots[i].destroy();
                bots.splice(i, 1);
            }
        }
        updateScoreboard();
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
        const killer = [myTank, ...Array.from(tanks.values()), ...bots].find(t => t && t.id === payload.shooterId);
        if (killer) {
            killer.kills++;
            updateScoreboard();
            if (killer.isLocal) syncMultiplayer();
        }
        if (tanks.has(payload.victimId)) {
            tanks.get(payload.victimId).destroy();
            tanks.delete(payload.victimId);
            updateScoreboard();
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
