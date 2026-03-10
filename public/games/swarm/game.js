/**
 * Swarm Clash - 핵심 게임 로직 (Refactored)
 * 
 * 본 코드는 가독성, 유지보수성, 그리고 안정성을 최우선으로 리팩토링되었습니다.
 * 모든 로직은 모듈화되어 있으며, 각 객체는 고유한 책임을 가집니다.
 */

// --- 1. CONFIGURATION (게임 설정) ---
const CONFIG = {
    // 유닛 밸런스 설정
    balance: {
        sizeScales: [0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6], // 레벨별 크기
        statMultiplierPerLevel: 2.0, // 레벨당 스탯 증가 배수
        merge: {
            unitsRequired: 2, // 합체에 필요한 유닛 수
            bonusScaling: 1.2, // 합체 시 스탯 보너스
        }
    },
    // 진영별 기본 설정
    factions: {
        common: {
            spawnRateSeconds: 1.0,
            spawnBatch: 1,
            speed: 1.0,
            baseMaxHp: 5000,
            baseAttackRange: 175,
            baseAttackCooldown: 60,
            baseAttackDamage: 60,
            minSpawnRateSeconds: 0.1,
            reductionInterval: 100, // 이 점수마다 스폰 속도 증가
            reductionAmount: 0.05,
            // 유닛 타입별 확률
            probs: { ranged: 0.1, tanker: 0.1, mage: 0.1, healer: 0.1 }
        },
        enemy: {
            // 오크 진영 전용 레벨 생성 확률 설정
            levels: [
                { lv: 10, interval: 1700, inc: 0.005, max: 0.7 },
                { lv: 9, interval: 1500, inc: 0.005, max: 0.7 },
                { lv: 8, interval: 1300, inc: 0.005, max: 0.7 },
                { lv: 7, interval: 1100, inc: 0.005, max: 0.7 },
                { lv: 6, interval: 900, inc: 0.005, max: 0.7 },
                { lv: 5, interval: 700, inc: 0.005, max: 0.7 },
                { lv: 4, interval: 500, inc: 0.005, max: 0.7 },
                { lv: 3, interval: 300, inc: 0.005, max: 0.7 },
                { lv: 2, interval: 100, inc: 0.005, max: 0.7 }
            ]
        }
    },
    // 레이아웃 및 영역 설정
    layout: {
        baseMarginX: 20,
        baseRatioY: 0.7,
        spawnOffset: { top: -150, bottom: 150 },
        combatOffset: { top: -200, bottom: 200 },
        merge: { offsetX: -20, offsetY: 100, width: 150, height: 150 },
        safeZoneWidth: 250,
        horizonYRatio: 0.05,
        gridSize: 40 // 최적화를 위한 그리드 크기
    },
    environment: {
        lightningRateSeconds: 10,
        lightningDamage: 100,
        lightningRadius: 60
    }
};

// 유닛 타입 상수
const UNIT_TYPES = { MELEE: 0, RANGED: 1, TANKER: 3, MAGE: 4, HEALER: 5 };

// 유닛 타입별 기본 스탯
const UNIT_STATS = {
    [UNIT_TYPES.MELEE]: { hp: 15, dmg: 3, range: 19, speed: 1.0, cd: 30, w: 15, h: 23 },
    [UNIT_TYPES.RANGED]: { hp: 8, dmg: 2, range: 60, speed: 0.8, cd: 45, w: 16, h: 24 },
    [UNIT_TYPES.TANKER]: { hp: 50, dmg: 4, range: 21, speed: 0.5, cd: 40, w: 17, h: 24 },
    [UNIT_TYPES.MAGE]: { hp: 6, dmg: 5, range: 100, speed: 0.7, cd: 60, w: 16, h: 24 },
    [UNIT_TYPES.HEALER]: { hp: 8, dmg: -5, range: 120, speed: 0.9, cd: 50, w: 16, h: 24 }
};

// --- 2. GAME ENGINE (코어 엔진) ---
const Engine = {
    canvas: null,
    ctx: null,
    frames: 0,
    score: 0,
    isStarted: false,
    isGameOver: false,

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        window.addEventListener('resize', () => this.resize());
        this.resize();
        Input.init();
        Assets.init();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.isStarted && EntityManager.playerBase) {
            EntityManager.syncBasePositions();
        }
    },

    startLoop() {
        const loop = () => {
            if (!this.isGameOver) {
                this.update();
                Renderer.draw();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    update() {
        if (!this.isStarted || this.isGameOver) return;
        this.frames++;
        if (this.frames % 60 === 0) this.score++;

        EntityManager.update();
        CombatSystem.update();
        EffectSystem.update();
    },

    gameOver(won) {
        if (this.isGameOver) return;
        this.isGameOver = true;

        const titleEl = document.querySelector('#game-over h1');
        const trans = window.WCGamesTranslation || {};

        titleEl.textContent = won ? (trans.victory || "VICTORY") : (trans.defeat || "DEFEAT");
        titleEl.style.color = won ? "#34d399" : "#f87171";
        document.getElementById('final-score').textContent = this.score;

        if (window.WCGames) WCGames.gameOver(this.score);
    }
};

// --- 3. ASSET LOADER (에셋 관리) ---
const Assets = {
    sprites: {},
    loadedCount: 0,
    totalToLoad: 12,

    init() {
        this.loadImg('fullBg', 'img/background.png');
        this.loadImg('pBase', 'img/castle.png', true);

        const units = [
            { team: 0, type: UNIT_TYPES.MELEE, file: 'img/human_melee.json' },
            { team: 0, type: UNIT_TYPES.RANGED, file: 'img/human_ranged.json' },
            { team: 0, type: UNIT_TYPES.TANKER, file: 'img/human_tanker.json' },
            { team: 0, type: UNIT_TYPES.MAGE, file: 'img/human_mage.json' },
            { team: 0, type: UNIT_TYPES.HEALER, file: 'img/human_healer.json' },
            { team: 1, type: UNIT_TYPES.MELEE, file: 'img/orc_melee.json' },
            { team: 1, type: UNIT_TYPES.RANGED, file: 'img/orc_ranged.json' },
            { team: 1, type: UNIT_TYPES.TANKER, file: 'img/orc_tanker.json' },
            { team: 1, type: UNIT_TYPES.MAGE, file: 'img/orc_mage.json' },
            { team: 1, type: UNIT_TYPES.HEALER, file: 'img/orc_healer.json' }
        ];
        units.forEach(u => this.loadUnit(u.team, u.type, u.file));
    },

    loadImg(key, src, isCastle = false) {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            if (isCastle) {
                this.sprites[key] = this.processBaseImage(img);
            } else {
                this.sprites[key] = img;
            }
            this.onAssetLoaded();
        };
        img.onerror = () => this.onAssetLoaded();
    },

    async loadUnit(team, type, jsonFile) {
        try {
            const res = await fetch(`./${jsonFile}`);
            const meta = await res.json();
            const dir = jsonFile.includes('/') ? jsonFile.substring(0, jsonFile.lastIndexOf('/') + 1) : '';

            const img = new Image();
            img.src = `./${dir}${meta.image_path}`;
            img.onload = () => {
                const processed = this.processUnitSheet(img);
                const key = (team === 0 ? 'p' : 'e') + type;
                this.sprites[key + 'Sheet'] = processed;
                this.sprites[key + 'Meta'] = meta;
                this.onAssetLoaded();
            };
        } catch (e) {
            this.onAssetLoaded();
        }
    },

    processUnitSheet(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            // 마젠타(투명) 제거 및 그림자 처리
            if ((r > 150 && b > 150 && g < 150)) d[i + 3] = 0;
            else if (Math.abs(r - 128) < 30 && Math.abs(g - 128) < 30 && Math.abs(b - 128) < 30) {
                d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 100;
            }
        }
        ctx.putImageData(data, 0, 0);
        return canvas;
    },

    processBaseImage(img) {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        try {
            const data = x.getImageData(0, 0, c.width, c.height);
            const d = data.data;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i] > 150 && d[i + 2] > 150 && d[i + 1] < 120) d[i + 3] = 0;
            }
            x.putImageData(data, 0, 0);
        } catch (e) { }
        return c;
    },

    onAssetLoaded() {
        this.loadedCount++;
        const btn = document.querySelector('#start-screen button');
        if (btn) {
            if (this.loadedCount < this.totalToLoad) {
                btn.innerText = `Loading... (${this.loadedCount}/${this.totalToLoad})`;
            } else {
                btn.disabled = false;
                btn.classList.remove('loading');
                btn.innerText = (window.WCGamesTranslation && window.WCGamesTranslation.play) || "Start Battle";
            }
        }
    }
};

// --- 4. INPUT HANDLER (입력 처리) ---
const Input = {
    selection: { active: false, startX: 0, startY: 0, endX: 0, endY: 0 },

    init() {
        const cvs = Engine.canvas;
        cvs.addEventListener('pointerdown', e => this.onDown(e));
        cvs.addEventListener('pointermove', e => this.onMove(e));
        cvs.addEventListener('pointerup', e => this.onUp(e));
        window.addEventListener('contextmenu', e => e.preventDefault());
    },

    onDown(e) {
        if (!Engine.isStarted || Engine.isGameOver) return;
        this.selection.active = true;
        this.selection.startX = this.selection.endX = e.clientX;
        this.selection.startY = this.selection.endY = e.clientY;
    },

    onMove(e) {
        if (!this.selection.active) return;
        this.selection.endX = e.clientX;
        this.selection.endY = e.clientY;
    },

    onUp(e) {
        if (!this.selection.active) return;
        this.selection.active = false;
        const dist = Math.hypot(this.selection.endX - this.selection.startX, this.selection.endY - this.selection.startY);

        if (dist < 10) EntityManager.issueMoveCommand(e.clientX, e.clientY);
        else EntityManager.selectUnitsInBox(this.selection);
    }
};

// --- 5. ENTITY MANAGER (개체 관리) ---
class Unit {
    constructor(x, y, team, type, level = 1, extra = null) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.x = x; this.y = y; this.team = team; this.type = type; this.level = level;

        const stats = UNIT_STATS[type] || UNIT_STATS[UNIT_TYPES.MELEE];
        const scale = CONFIG.balance.sizeScales[Math.min(level, CONFIG.balance.sizeScales.length) - 1];

        this.maxHp = extra?.maxHp || stats.hp;
        this.damage = extra?.damage || stats.dmg;
        this.speed = stats.speed * CONFIG.factions.common.speed;
        this.range = (type === UNIT_TYPES.MELEE || type === UNIT_TYPES.TANKER) ? (stats.w * scale + 5) : stats.range;
        this.cooldownMax = stats.cd;
        this.width = stats.w * scale;
        this.height = stats.h * scale;

        if (level > 1 && !extra) {
            const mult = Math.pow(CONFIG.balance.statMultiplierPerLevel, level - 1);
            this.maxHp = Math.ceil(this.maxHp * mult);
            this.damage = Math.ceil(this.damage * mult);
        }

        this.hp = extra?.hp || this.maxHp;
        this.vx = 0; this.vy = 0;
        this.target = null;
        this.state = 0; // 0: Idle/Forward, 1: Command, 2: Attack
        this.selected = false;
        this.attackTarget = null;
        this.attackCooldown = 0;
    }

    update() {
        if (this.attackCooldown > 0) this.attackCooldown--;

        const perspective = 0.5 + (this.y / Engine.canvas.height) * 0.7;
        const currentSpeed = this.speed * perspective;

        if (this.state === 0) { // 자동 전진
            const dir = this.team === 0 ? 1 : -1;
            this.vx = currentSpeed * dir * 0.5;
            this.vy = (EntityManager.playerBase.y - this.y) * 0.001;
        } else if (this.state === 1 && this.target) { // 명령 이동
            const dx = this.target.x - this.x, dy = this.target.y - this.y;
            const d = Math.hypot(dx, dy);
            if (d < currentSpeed) {
                this.x = this.target.x; this.y = this.target.y;
                this.state = 0; this.target = null;
            } else {
                this.vx = (dx / d) * currentSpeed * 1.5;
                this.vy = (dy / d) * currentSpeed * 1.5;
            }
        } else if (this.state === 2 && this.attackTarget) { // 공격 상태
            const target = this.attackTarget;
            if (target.hp <= 0) { this.state = 0; this.attackTarget = null; return; }

            const dx = target.x - this.x, dy = target.y - this.y;
            const d = Math.hypot(dx, dy);
            const effRange = this.range * perspective;

            if (d < effRange) {
                this.vx = 0; this.vy = 0;
                if (this.attackCooldown <= 0) this.performAttack(target);
            } else {
                this.vx = (dx / d) * currentSpeed * 1.2;
                this.vy = (dy / d) * currentSpeed * 1.2;
            }
        }

        this.x += this.vx; this.y += this.vy;
        this.applyConstraints();
    }

    performAttack(target) {
        if ([UNIT_TYPES.RANGED, UNIT_TYPES.MAGE, UNIT_TYPES.HEALER].includes(this.type)) {
            EntityManager.projectiles.push(new Projectile(this, target));
            // 사운드 효과
            const s = { [UNIT_TYPES.RANGED]: [800, 600], [UNIT_TYPES.MAGE]: [800, 1500], [UNIT_TYPES.HEALER]: [1200, 1600] }[this.type];
            if (s && Math.random() > 0.5) WCGames.Audio.play(s, this.type === UNIT_TYPES.RANGED ? 'triangle' : 'sine', 0.05, 0.05);
        } else {
            target.hp -= this.damage;
            EffectSystem.addSlash(this, target);
            if (Math.random() > 0.8) WCGames.Audio.play([150, 50], 'sawtooth', 0.05, 0.05);
        }
        this.attackCooldown = this.cooldownMax;
    }

    applyConstraints() {
        // 화면 깊이 제한
        const minY = EntityManager.playerBase.y + CONFIG.layout.combatOffset.top;
        const maxY = EntityManager.playerBase.y + CONFIG.layout.combatOffset.bottom;
        this.y = Math.max(minY, Math.min(maxY, this.y));

        // 팀 동료 간 분리 (Separation)
        EntityManager.units.forEach(other => {
            if (other !== this && other.team === this.team) {
                const dx = this.x - other.x, dy = this.y - other.y;
                const dSq = dx * dx + dy * dy;
                if (dSq < this.width * this.width) {
                    this.x += dx * 0.02; this.y += dy * 0.02;
                }
            }
        });
    }
}

class Projectile {
    constructor(source, target) {
        this.x = source.x; this.y = source.y;
        this.sx = source.x; this.sy = source.y;
        this.z = 0; this.target = target;
        this.team = source.team; this.type = source.type;
        this.damage = source.damage;
        this.speed = source.type === UNIT_TYPES.RANGED ? 4 : 3;
        this.isHeal = source.type === UNIT_TYPES.HEALER;
        this.isMagic = source.type === UNIT_TYPES.MAGE;
        this.isCannon = source.isCannon || false;
        this.active = true;
    }

    update() {
        if (!this.target || this.target.hp <= 0) { this.active = false; return; }
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const d = Math.hypot(dx, dy);

        if (d < this.speed) {
            this.hit();
        } else {
            this.x += (dx / d) * this.speed;
            this.y += (dy / d) * this.speed;
            // 포물선 궤적 계산
            const total = Math.hypot(this.target.x - this.sx, this.target.y - this.sy);
            const curr = Math.hypot(this.x - this.sx, this.y - this.sy);
            const p = Math.max(0, Math.min(1, curr / Math.max(1, total)));
            const peak = Math.min(60, Math.max(15, total * 0.25));
            this.z = peak * 4 * p * (1 - p);
            EffectSystem.addProjectileTrail(this);
        }
    }

    hit() {
        const target = this.target;
        if (this.isHeal) {
            target.hp = Math.min(target.maxHp, target.hp + Math.abs(this.damage));
            EffectSystem.addHealEffect(target);
        } else {
            target.hp -= this.damage;
            EffectSystem.addHitEffect(target, this.isCannon, this.isMagic);
        }
        this.active = false;
    }
}

const EntityManager = {
    units: [], projectiles: [], playerBase: { x: 0, y: 0, hp: 0, cooldown: 0 },
    mergeZone: { x: 0, y: 0, w: 0, h: 0 },
    grid: {},

    reset() {
        this.units = []; this.projectiles = [];
        this.playerBase = {
            x: CONFIG.layout.baseMarginX,
            y: Engine.canvas.height * CONFIG.layout.baseRatioY,
            hp: CONFIG.factions.common.baseMaxHp,
            cooldown: 0
        };
        this.syncBasePositions();
        this.syncMergeZone();
    },

    syncBasePositions() {
        this.playerBase.x = CONFIG.layout.baseMarginX;
        this.playerBase.y = Engine.canvas.height * CONFIG.layout.baseRatioY;
        this.syncMergeZone();
    },

    syncMergeZone() {
        const l = CONFIG.layout.merge;
        this.mergeZone = {
            x: this.playerBase.x + l.offsetX,
            y: this.playerBase.y + l.offsetY,
            w: l.width, h: l.height
        };
    },

    update() {
        this.handleSpawning();
        this.updateGrid();
        this.units.forEach(u => u.update());
        this.projectiles = this.projectiles.filter(p => p.active);
        this.projectiles.forEach(p => p.update());
        this.handleBaseDefense();
        this.handleAutoMerge();
        this.cleanup();
    },

    updateGrid() {
        this.grid = {};
        this.units.forEach(u => {
            const k = `${Math.floor(u.x / CONFIG.layout.gridSize)},${Math.floor(u.y / CONFIG.layout.gridSize)}`;
            if (!this.grid[k]) this.grid[k] = [];
            this.grid[k].push(u);
        });
    },

    handleSpawning() {
        // 플레이어/적 스폰 로직
        const getRate = (conf) => {
            const red = Math.floor(Engine.score / conf.reductionInterval);
            return Math.max(conf.minSpawnRateSeconds, conf.spawnRateSeconds - (red * conf.reductionAmount));
        };

        const pInt = Math.max(1, Math.floor(getRate(CONFIG.factions.common) * 60));
        if (Engine.frames % pInt === 0) this.spawnBatch(0);

        const eInt = Math.max(1, Math.floor(getRate(CONFIG.factions.common) * 60));
        if (Engine.frames % eInt === 0) this.spawnBatch(1);
    },

    spawnBatch(team) {
        const conf = team === 0 ? CONFIG.factions.common : CONFIG.factions.common;
        for (let i = 0; i < conf.spawnBatch; i++) {
            const x = team === 0 ? -60 + Math.random() * -20 : Engine.canvas.width + 60 + Math.random() * 20;
            const minY = this.playerBase.y + CONFIG.layout.spawnOffset.top;
            const maxY = this.playerBase.y + CONFIG.layout.spawnOffset.bottom;
            const y = minY + Math.random() * (maxY - minY);

            let level = 1;
            if (team === 1) {
                for (const cfg of CONFIG.factions.enemy.levels) {
                    if (Math.random() < Math.min(cfg.max, (Engine.score / cfg.interval) * cfg.inc)) {
                        level = cfg.lv; break;
                    }
                }
            }
            this.units.push(new Unit(x, y, team, this.getRandType(), level));
        }
    },

    getRandType() {
        const p = CONFIG.factions.common.probs;
        const r = Math.random();
        if (r < p.ranged) return UNIT_TYPES.RANGED;
        if (r < p.ranged + p.tanker) return UNIT_TYPES.TANKER;
        if (r < p.ranged + p.tanker + p.mage) return UNIT_TYPES.MAGE;
        if (r < p.ranged + p.tanker + p.mage + p.healer) return UNIT_TYPES.HEALER;
        return UNIT_TYPES.MELEE;
    },

    handleBaseDefense() {
        if (this.playerBase.cooldown > 0) this.playerBase.cooldown--;
        if (this.playerBase.hp > 0 && this.playerBase.cooldown === 0) {
            const rangeSq = Math.pow(CONFIG.factions.common.baseAttackRange, 2);
            const target = this.units.find(u => u.team === 1 && u.hp > 0 && Math.hypot(u.x - this.playerBase.x, u.y - this.playerBase.y) < CONFIG.factions.common.baseAttackRange);
            if (target) {
                const shot = new Projectile(this.playerBase, target);
                shot.isCannon = true; shot.damage = CONFIG.factions.common.baseAttackDamage;
                shot.speed = 12;
                this.projectiles.push(shot);
                this.playerBase.cooldown = CONFIG.factions.common.baseAttackCooldown;
                WCGames.Audio.play([200, 100], 'square', 0.2, 0.1);
            }
        }
        if (this.playerBase.hp <= 0) Engine.gameOver(false);
    },

    handleAutoMerge() {
        const groups = {};
        const centerX = this.mergeZone.x + this.mergeZone.w / 2;
        const centerY = this.mergeZone.y + this.mergeZone.h / 2;
        const rx = this.mergeZone.w / 2, ry = rx * 0.35;

        this.units.filter(u => u.team === 0 && u.hp > 0).forEach(u => {
            const dx = u.x - centerX, dy = u.y - centerY;
            if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.2) {
                const k = `${u.type}_${u.level}`;
                if (!groups[k]) groups[k] = [];
                groups[k].push(u);
            }
        });

        for (const k in groups) {
            if (groups[k].length >= CONFIG.balance.merge.unitsRequired) {
                this.mergeUnits(groups[k].slice(0, CONFIG.balance.merge.unitsRequired));
            }
        }
    },

    mergeUnits(targets) {
        const t = targets[0], bonus = CONFIG.balance.merge.bonusScaling;
        const sum = targets.reduce((acc, u) => {
            u.hp = 0; // 기존 유닛 제거
            return { hp: acc.hp + u.hp, max: acc.max + u.maxHp, dmg: acc.dmg + u.damage, x: acc.x + u.x, y: acc.y + u.y };
        }, { hp: 0, max: 0, dmg: 0, x: 0, y: 0 });

        const count = targets.length;
        const merged = new Unit(sum.x / count, sum.y / count, 0, t.type, t.level + 1, {
            hp: Math.ceil(sum.max * bonus), maxHp: Math.ceil(sum.max * bonus), damage: Math.ceil(sum.dmg * bonus)
        });
        this.units.push(merged);
        EffectSystem.addMergeEffect(merged.x, merged.y);
        WCGames.Audio.play([150, 400], 'square', 0.4, 0.4);
    },

    issueMoveCommand(x, y) {
        this.units.filter(u => u.selected && u.team === 0).forEach(u => {
            u.target = { x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 40 };
            u.state = 1; u.selected = false;
        });
    },

    selectUnitsInBox(box) {
        const minX = Math.min(box.startX, box.endX), maxX = Math.max(box.startX, box.endX);
        const minY = Math.min(box.startY, box.endY), maxY = Math.max(box.startY, box.endY);
        this.units.filter(u => u.team === 0).forEach(u => {
            u.selected = (u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY);
        });
    },

    cleanup() {
        this.units = this.units.filter(u => {
            if (u.hp <= 0) EffectSystem.addDeathEffect(u);
            return u.hp > 0 && u.x > -150 && u.x < Engine.canvas.width + 150;
        });
    }
};

// --- 6. COMBAT SYSTEM (전투 시스템) ---
const CombatSystem = {
    update() {
        EntityManager.units.forEach(u => this.handleTargeting(u));
    },

    handleTargeting(u) {
        if (u.hp <= 0) return;

        // 기지 공격 우선
        if (u.team === 1 && Math.hypot(u.x - EntityManager.playerBase.x, u.y - EntityManager.playerBase.y) < 150 && u.x < EntityManager.playerBase.x + 80) {
            u.attackTarget = EntityManager.playerBase; u.state = 2; return;
        }
        if (u.team === 0 && u.x > Engine.canvas.width - 40) { u.state = 0; return; }

        // 주기적 타겟팅 업데이트 (성능 최적화)
        if ((Engine.frames + u.id.length) % 10 !== 0) return;
        if (u.state === 2 && u.attackTarget?.hp > 0) return;

        const aggroRange = (u.type === UNIT_TYPES.RANGED ? 120 : 80);
        const grid = EntityManager.grid;
        const cx = Math.floor(u.x / CONFIG.layout.gridSize), cy = Math.floor(u.y / CONFIG.layout.gridSize);

        let best = null, bestDist = aggroRange * aggroRange;

        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let y = cy - 1; y <= cy + 1; y++) {
                (grid[`${x},${y}`] || []).forEach(n => {
                    if (n.hp <= 0) return;
                    const isTarget = u.type === UNIT_TYPES.HEALER ? (n.team === u.team && n.hp < n.maxHp && n !== u) : (n.team !== u.team);
                    if (isTarget) {
                        const d = Math.pow(n.x - u.x, 2) + Math.pow(n.y - u.y, 2);
                        if (d < bestDist) { bestDist = d; best = n; }
                    }
                });
            }
        }
        if (best) { u.attackTarget = best; u.state = 2; }
        else if (u.state === 2) u.state = 0;
    }
};

// --- 7. EFFECT SYSTEM (시각 효과) ---
const EffectSystem = {
    particles: [], lightnings: [],

    update() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy; p.life--;
            return p.life > 0;
        });
        this.lightnings = this.lightnings.filter(l => {
            l.life--; return l.life > 0;
        });
        this.handleRandomLightning();
    },

    addSlash(u, target) {
        const x = (u.x + target.x) / 2, y = (u.y + target.y) / 2;
        const color = u.team === 0 ? "#60a5fa" : "#fb923c";
        for (let i = 0; i < 3; i++) this.addParticle(x, y, color);
        const slash = { x, y, vx: (u.team === 0 ? 5 : -5), vy: (Math.random() - 0.5) * 5, life: 10, max: 10, color: "#fff" };
        this.particles.push(slash);
    },

    addParticle(x, y, color, extra = {}) {
        this.particles.push({
            x, y, color,
            vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
            life: 5 + Math.random() * 20, max: 25, ...extra
        });
    },

    addProjectileTrail(p) {
        if (Engine.frames % 2 !== 0) return;
        let color = p.isCannon ? (p.team === 0 ? "rgba(96,165,250,0.5)" : "rgba(244,63,94,0.5)") :
            p.isMagic ? (p.team === 0 ? "#bfdbfe" : "#fef08a") :
                p.isHeal ? "#4ade80" : null;
        if (color) this.addParticle(p.x, p.y - p.z, color, { vx: 0, vy: p.isHeal ? -0.5 : 0, life: 10 });
    },

    addHealEffect(t) {
        for (let i = 0; i < 6; i++) {
            this.addParticle(t.x, t.y - 10, "#4ade80", { isCross: true, vy: -1, life: 40 });
        }
    },

    addHitEffect(t, isCannon, isMagic) {
        const color = isCannon ? "#fef08a" : isMagic ? (t.team === 0 ? "#60a5fa" : "#fbbf24") : "#fff";
        const count = isCannon ? 6 : 4;
        for (let i = 0; i < count; i++) this.addParticle(t.x, t.y - 10, color);
    },

    addMergeEffect(x, y) {
        for (let i = 0; i < 20; i++) this.addParticle(x, y, "#fcd34d", { vy: (Math.random() - 0.5) * 8 - 3, life: 40 });
    },

    addDeathEffect(u) {
        const color = u.team === 0 ? "#3b82f6" : "#ef4444";
        for (let i = 0; i < 10; i++) this.addParticle(u.x, u.y, color);
        if (Math.random() > 0.8) WCGames.Audio.play([100, 30], 'square', 0.05, 0.1);
    },

    handleRandomLightning() {
        if (Engine.frames > 0 && Engine.frames % (CONFIG.environment.lightningRateSeconds * 60) === 0) {
            const x = Math.random() * Engine.canvas.width;
            const minY = Engine.canvas.height * 0.55, maxY = Engine.canvas.height * 0.85;
            const y = minY + Math.random() * (maxY - minY);
            this.lightnings.push({ x, y, life: 15, max: 15 });
            WCGames.Audio.play([2000, 800], 'sawtooth', 0.15, 0.1);

            EntityManager.units.forEach(u => {
                if (Math.hypot(u.x - x, u.y - y) < CONFIG.environment.lightningRadius) {
                    u.hp -= CONFIG.environment.lightningDamage;
                }
            });
        }
    }
};

// --- 8. RENDERER (렌더링 엔진) ---
const Renderer = {
    draw() {
        const ctx = Engine.ctx;
        ctx.imageSmoothingEnabled = false;

        // 배경
        if (Assets.sprites.fullBg) {
            ctx.drawImage(Assets.sprites.fullBg, 0, 0, Engine.canvas.width, Engine.canvas.height);
        } else {
            ctx.fillStyle = "#1c1917"; ctx.fillRect(0, 0, Engine.canvas.width, Engine.canvas.height);
        }

        if (!Engine.isStarted) return;

        this.drawMergeZone();

        // 뎁스 소팅 (Y축 기준)
        const q = [{ isBase: true, obj: EntityManager.playerBase, y: EntityManager.playerBase.y }];
        EntityManager.units.forEach(u => q.push({ isBase: false, obj: u, y: u.y }));
        q.sort((a, b) => a.y - b.y).forEach(r => this.drawObject(r));

        this.drawProjectiles();
        this.drawLightnings();
        this.drawParticles();
        this.drawUI();
    },

    drawMergeZone() {
        const mz = EntityManager.mergeZone;
        if (mz.x === 0) return;
        const ctx = Engine.ctx, pulse = Math.sin(Engine.frames * 0.05) * 0.2 + 0.8;
        const cx = mz.x + mz.w / 2, cy = mz.y + mz.h / 2;
        const rx = mz.w / 2, ry = rx * 0.35;

        ctx.save();
        ctx.shadowBlur = 10; ctx.shadowColor = "rgba(251,191,36,0.5)";
        ctx.strokeStyle = `rgba(251,191,36,${0.5 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();

        // 회전하는 룬 효과
        const rot = Engine.frames * 0.02;
        for (let i = 0; i < 8; i++) {
            const a = rot + (i * Math.PI * 2) / 8;
            ctx.moveTo(cx + Math.cos(a) * rx * 0.8, cy + Math.sin(a) * ry * 0.8);
            ctx.lineTo(cx + Math.cos(a) * rx * 0.95, cy + Math.sin(a) * ry * 0.95);
        }
        ctx.stroke();
        ctx.restore();
    },

    drawObject(r) {
        const ctx = Engine.ctx;
        if (r.isBase) {
            const spr = Assets.sprites.pBase;
            const scale = 1 + (r.obj.y / Engine.canvas.height);
            const w = 220 * scale, h = w * (spr.height / spr.width);
            ctx.drawImage(spr, -w / 1.3, r.obj.y - h + 20, w, h);
            this.drawBaseHp(r.obj, -w / 1.3, r.obj.y - h + 20, w, h);
        } else {
            const u = r.obj;
            const perspective = 0.5 + 0.7 * ((u.y - Engine.canvas.height * 0.05) / (Engine.canvas.height * 0.95));
            const key = (u.team === 0 ? 'p' : 'e') + u.type;
            const sheet = Assets.sprites[key + 'Sheet'], meta = Assets.sprites[key + 'Meta'];

            if (sheet && meta) {
                const anim = u.state === 2 ? 'attack' : 'walk';
                const group = meta.groups.find(g => g.name === anim) || meta.groups[0];
                const frame = group.items[Math.floor(Date.now() / (1000 / (group.fps || 10))) % group.items.length];
                const [sx, sy, sw, sh] = frame.rect, [ax, ay] = frame.anchor;
                const visualScale = perspective * 0.5 * (u.height / (UNIT_STATS[u.type]?.h || 16));

                ctx.save();
                ctx.translate(u.x, u.y);
                if (u.team === 1) ctx.scale(-1, 1);
                ctx.drawImage(sheet, sx, sy, sw, sh, -ax * visualScale, -ay * visualScale, sw * visualScale, sh * visualScale);
                ctx.restore();
            }
            if (u.selected) {
                ctx.strokeStyle = "#a7f3d0"; ctx.lineWidth = 1;
                ctx.strokeRect(u.x - u.width, u.y - u.height * 2, u.width * 2, u.height * 2);
            }
        }
    },

    drawBaseHp(base) {
        const ctx = Engine.ctx, w = Engine.canvas.width * 0.7, h = 10, x = (Engine.canvas.width - w) / 2, y = 100;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, w, h);
        const grad = ctx.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, "#1e40af"); grad.addColorStop(1, "#60a5fa");
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + 1, Math.max(0, (base.hp / CONFIG.factions.common.baseMaxHp) * w - 2), h - 2);
    },

    drawProjectiles() {
        const ctx = Engine.ctx;
        EntityManager.projectiles.forEach(p => {
            const perspective = (p.y / Engine.canvas.height);
            const sz = 3 * perspective;
            ctx.save();
            if (p.isMagic) {
                ctx.shadowColor = p.team === 0 ? "#60a5fa" : "#fbbf24"; ctx.shadowBlur = 10;
                ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y - p.z, sz * 1.5, 0, Math.PI * 2); ctx.fill();
            } else if (p.isHeal) {
                ctx.fillStyle = "#bbf7d0"; ctx.fillRect(p.x - sz, p.y - p.z - sz * 2, sz * 2, sz * 4); ctx.fillRect(p.x - sz * 2, p.y - p.z - sz, sz * 4, sz * 2);
            } else {
                ctx.fillStyle = p.isCannon ? (p.team === 0 ? "#60a5fa" : "#f43f5e") : (p.team === 0 ? "#22d3ee" : "#f97316");
                ctx.beginPath();
                if (p.isCannon) ctx.arc(p.x, p.y - p.z, sz * 2, 0, Math.PI * 2);
                else ctx.rect(p.x - sz / 2, p.y - p.z - sz / 2, sz, sz);
                ctx.fill();
            }
            ctx.restore();
        });
    },

    drawLightnings() {
        EffectSystem.lightnings.forEach(l => {
            const ctx = Engine.ctx;
            ctx.strokeStyle = `rgba(167,243,208,${l.life / l.max})`;
            ctx.lineWidth = 2 + (l.life / l.max) * 8;
            ctx.beginPath(); ctx.moveTo(l.x, -20);
            let cy = -20, cx = l.x;
            while (cy < l.y) {
                cx += (Math.random() - 0.5) * 40; cy += 30 + Math.random() * 40;
                ctx.lineTo(Math.min(l.x + 50, Math.max(l.x - 50, cx)), Math.min(l.y, cy));
            }
            ctx.stroke();
            if (l.life > l.max - 3) {
                ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(0, 0, Engine.canvas.width, Engine.canvas.height);
            }
        });
    },

    drawParticles() {
        const ctx = Engine.ctx;
        EffectSystem.particles.forEach(p => {
            ctx.globalAlpha = p.life / p.max;
            ctx.fillStyle = p.color;
            const sz = 2 * (p.y / Engine.canvas.height);
            if (p.isCross) {
                ctx.fillRect(p.x - sz / 2, p.y - sz * 3, sz, sz * 6); ctx.fillRect(p.x - sz * 3, p.y - sz / 2, sz * 6, sz);
            } else {
                ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
            }
        });
        ctx.globalAlpha = 1.0;
    },

    drawUI() {
        const ctx = Engine.ctx;
        if (Input.selection.active) {
            const s = Input.selection, x = Math.min(s.startX, s.endX), y = Math.min(s.startY, s.endY);
            const w = Math.abs(s.endX - s.startX), h = Math.abs(s.endY - s.startY);
            ctx.fillStyle = "rgba(167,243,208,0.2)"; ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
            ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
        }
        document.getElementById('score').textContent = Engine.score;
    }
};

// --- 9. GLOBAL INTERFACE ---
window.SwarmGame = {
    start() {
        document.getElementById('start-screen').style.display = 'none';
        Engine.isStarted = true;
        Engine.isGameOver = false;
        Engine.frames = 0;
        Engine.score = 0;
        EntityManager.reset();
    },
    restart() {
        document.getElementById('game-over').style.display = 'none';
        this.start();
    }
};

// WCGames 플랫폼 초기화
if (window.WCGames) {
    WCGames.init({
        id: 'swarm',
        onStart: () => { WCGames.Audio.init(); SwarmGame.start(); },
        onRestart: () => { WCGames.Audio.init(); SwarmGame.restart(); }
    });
}

Engine.init();
Engine.startLoop();
