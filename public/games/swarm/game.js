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
            spawnRateSeconds: 1,
            spawnBatch: 1,
            speed: 1.0,
            baseMaxHp: 10000,
            baseAttackRange: 175,
            baseAttackCooldown: 60,
            baseAttackDamage: 60,
            minSpawnRateSeconds: 0.1,
            reductionInterval: 30, // 이 점수마다 스폰 속도 증가
            reductionAmount: 0.05,
            // 유닛 타입별 확률 (이외는 전부 근접유닛)
            probs: { ranged: 0.1, tanker: 0.1, mage: 0.05, healer: 0.05 }
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
    // 번개 설정
    environment: {
        lightningRateSeconds: 10,
        lightningDamage: 100,
        lightningRadius: 60
    },
    // 조작 관련 설정
    control: {
        moveOffset: 40,      // 이동 명령 시 분산 거리
        baseBuffer: 40       // 기지 정지 거리 버퍼
    }
};

// 유닛 타입 상수
const UNIT_TYPES = { MELEE: 0, RANGED: 1, TANKER: 3, MAGE: 4, HEALER: 5 };

// 유닛 타입별 기본 스탯
const UNIT_STATS = {
    [UNIT_TYPES.MELEE]: { hp: 15, dmg: 3, range: 20, speed: 1.0, cd: 30, w: 15, h: 23 },
    [UNIT_TYPES.RANGED]: { hp: 8, dmg: 2, range: 80, speed: 0.8, cd: 45, w: 16, h: 24 },
    [UNIT_TYPES.TANKER]: { hp: 50, dmg: 4, range: 25, speed: 0.5, cd: 40, w: 17, h: 24 },
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
        document.body.classList.add('wcg-ready');
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
        if (this.frames % 60 === 0) this.score++; // 1초마다 점수 증가 (가정: 60fps)

        EntityManager.update();
        CombatSystem.update();
        EffectSystem.update();
    },

    /**
     * 게임 오버 처리. 게임 상태를 변경하고 게임 오버 화면을 표시합니다.
     * @param {boolean} won - 플레이어의 승리 여부
     */
    gameOver(won) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.isStarted = false;

        // 투사체 제거 (진행중인 공격 중단)
        EntityManager.projectiles = [];

        const trans = window.WCGamesTranslation || {};
        const titleEl = document.querySelector('#game-over h1');

        titleEl.textContent = won ? (trans.victory || "VICTORY") : (trans.defeat || "DEFEAT");
        titleEl.style.color = won ? "#34d399" : "#f87171";
        document.getElementById('final-score').textContent = this.score;

        document.getElementById('game-over').classList.add('wcg-visible');
        if (window.WCGames) WCGames.gameOver(this.score);
    }
};

// --- 3. ASSET LOADER (에셋 관리) ---
const Assets = {
    sprites: {},
    loadedCount: 0,
    totalToLoad: 12, // 전체 로드해야 할 에셋 수

    /**
     * 초기 에셋 로드 시작
     */
    init() {
        this.loadImg('fullBg', 'img/background.png');
        this.loadImg('pBase', 'img/castle.png', true);

        // 로드할 유닛 목록
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

    /**
     * 이미지 에셋 로드
     * @param {string} key - 에셋 키
     * @param {string} src - 이미지 경로
     * @param {boolean} isCastle - 성 이미지 여부 (특수 처리용)
     */
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

    /**
     * 유닛 데이터 및 스프라이트 시트 로드 (JSON 기반)
     */
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

    /**
     * 유닛 스프라이트 시트 전처리 (특정 색상 투명화 및 그림자 처리)
     */
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

    /**
     * 성/기지 이미지 전처리
     */
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

    /**
     * 에셋 로드 완료 시 공통 처리 (로딩 바 및 시작 버튼 활성화)
     */
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
                document.getElementById('start-screen').classList.add('wcg-visible');
            }
        }
    }
};

// --- 4. INPUT HANDLER (입력 처리) ---
const Input = {
    selection: { active: false, startX: 0, startY: 0, endX: 0, endY: 0 },

    /**
     * 입력 이벤트 바인딩
     */
    init() {
        const cvs = Engine.canvas;
        cvs.addEventListener('pointerdown', e => this.onDown(e));
        cvs.addEventListener('pointermove', e => this.onMove(e));
        cvs.addEventListener('pointerup', e => this.onUp(e));
        window.addEventListener('contextmenu', e => e.preventDefault());
    },

    /**
     * 포인터 다운 (선택 시작)
     */
    onDown(e) {
        if (!Engine.isStarted || Engine.isGameOver) return;
        this.selection.active = true;
        this.selection.startX = this.selection.endX = e.clientX;
        this.selection.startY = this.selection.endY = e.clientY;
    },

    /**
     * 포인터 이동 (박스 선택 영역 갱신)
     */
    onMove(e) {
        if (!this.selection.active) return;
        this.selection.endX = e.clientX;
        this.selection.endY = e.clientY;
    },

    /**
     * 포인터 업 (선택 완료 및 명령 수행)
     */
    onUp(e) {
        if (!this.selection.active) return;
        this.selection.active = false;
        const dist = Math.hypot(this.selection.endX - this.selection.startX, this.selection.endY - this.selection.startY);

        if (dist < 10) EntityManager.issueMoveCommand(e.clientX, e.clientY);
        else EntityManager.selectUnitsInBox(this.selection);
    }
};

// --- 5. ENTITY MANAGER (개체 관리) ---
/**
 * 게임의 개별 유닛 클래스
 */
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

        // 레벨에 따른 스탯 배율 적용
        if (level > 1 && !extra) {
            const mult = Math.pow(CONFIG.balance.statMultiplierPerLevel, level - 1);
            this.maxHp = Math.ceil(this.maxHp * mult);
            this.damage = Math.ceil(this.damage * mult);
        }

        this.hp = extra?.hp || this.maxHp;
        this.vx = 0; this.vy = 0;
        this.target = null;
        this.state = 0; // 0: Idle/Forward(자동 전진), 1: Command(명령 이동), 2: Attack(공격)
        this.selected = false;
        this.attackTarget = null;
        this.attackCooldown = 0;
    }

    /**
     * 유닛 상태 업데이트 (매 프레임 호출)
     */
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
            let effRange = this.range * perspective;
            if (target === EntityManager.playerBase) effRange += 80; // 거대 기지 보정

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

    /**
     * 공격 수행 (원거리는 투사체 발사, 근거리는 즉시 데미지)
     * @param {object} target - 공격 대상
     */
    performAttack(target) {
        if ([UNIT_TYPES.RANGED, UNIT_TYPES.MAGE, UNIT_TYPES.HEALER].includes(this.type)) {
            EntityManager.projectiles.push(new Projectile(this, target));
            // 타입별 공격 사운드
            const s = { [UNIT_TYPES.RANGED]: [800, 600], [UNIT_TYPES.MAGE]: [800, 1500], [UNIT_TYPES.HEALER]: [1200, 1600] }[this.type];
            if (s && Math.random() > 0.5) WCGames.Audio.play(s, this.type === UNIT_TYPES.RANGED ? 'triangle' : 'sine', 0.05, 0.05);
        } else {
            target.hp = Math.max(0, target.hp - this.damage);
            EffectSystem.addSlash(this, target);
            if (Math.random() > 0.8) WCGames.Audio.play([150, 50], 'sawtooth', 0.05, 0.05);
        }
        this.attackCooldown = this.cooldownMax;
    }

    /**
     * 이동 제약 조건 적용 (화면 밖 이탈 방지 및 유닛 간 겹침 방지)
     */
    applyConstraints() {
        // 화면 깊이(Y축) 제한
        const minY = EntityManager.playerBase.y + CONFIG.layout.combatOffset.top;
        const maxY = EntityManager.playerBase.y + CONFIG.layout.combatOffset.bottom;
        this.y = Math.max(minY, Math.min(maxY, this.y));

        // 팀 동료 간 분리 (Separation: 유닛들이 너무 겹치지 않게 함)
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

/**
 * 원거리 공격을 위한 투사체 클래스
 */
class Projectile {
    constructor(source, target) {
        const sourceH = source.height || 40; // 기지일 경우 기본 높이 약 80의 절반
        const targetH = target.height || 40;

        this.startZ = sourceH * 0.5;
        this.endZ = targetH * 0.5;
        this.z = this.startZ;

        this.x = source.x; this.y = source.y;
        this.sx = source.x; this.sy = source.y;
        this.target = target;
        this.team = source.team ?? 0; // 기지는 팀 0
        this.type = source.type ?? UNIT_TYPES.RANGED; // 기지 포탑은 기본적으로 RANGED 취급
        this.damage = source.damage || source.baseAttackDamage || 1;
        this.speed = this.type === UNIT_TYPES.RANGED ? 4 : 3;
        this.isHeal = this.type === UNIT_TYPES.HEALER;
        this.isMagic = this.type === UNIT_TYPES.MAGE;
        this.isCannon = source.isCannon || (source === EntityManager.playerBase); // 기지 포탄은 캐논 처리
        this.active = true;
    }

    update() {
        if (!this.target || this.target.hp <= 0) { this.active = false; return; }

        // 이전 위치 저장 (각도 계산용)
        const prevX = this.x, prevY = this.y, prevZ = this.z;

        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const d = Math.hypot(dx, dy);

        if (d < this.speed) {
            this.hit(); // 명중
        } else {
            this.x += (dx / d) * this.speed;
            this.y += (dy / d) * this.speed;

            // 포물선 궤적(Z) 계산 (시작/종료 높이 보정 포함)
            const total = Math.hypot(this.target.x - this.sx, this.target.y - this.sy);
            const curr = Math.hypot(this.x - this.sx, this.y - this.sy);
            const p = Math.max(0, Math.min(1, curr / Math.max(1, total)));
            const peak = Math.min(60, Math.max(15, total * 0.25));

            // 선형 보정 + 포물선 곡선
            const baseZ = (this.startZ * (1 - p)) + (this.endZ * p);
            this.z = baseZ + (peak * 4 * p * (1 - p));

            // 현재 이동 각도 계산 (3D 궤적 고려하여 화면상의 실제 각도 산출)
            if (this.type === UNIT_TYPES.RANGED || this.isCannon) {
                const visualY = this.y - this.z;
                const prevVisualY = prevY - prevZ;
                this.visualAngle = Math.atan2(visualY - prevVisualY, this.x - prevX);
            }

            EffectSystem.addProjectileTrail(this);
        }
    }

    /**
     * 투사체 명중 시 처리 (데미지 또는 힐 적용)
     */
    hit() {
        const target = this.target;
        if (this.isHeal) {
            target.hp = Math.min(target.maxHp, target.hp + Math.abs(this.damage));
            EffectSystem.addHealEffect(target);
        } else {
            target.hp = Math.max(0, target.hp - this.damage);
            EffectSystem.addHitEffect(target, this.isCannon, this.isMagic);
        }
        this.active = false;
    }
}

/**
 * 모든 게임 개체(유닛, 투사체, 기지)를 관리하는 매니저
 */
const EntityManager = {
    units: [], projectiles: [], playerBase: { x: 0, y: 0, hp: 0, cooldown: 0 },
    mergeZone: { x: 0, y: 0, w: 0, h: 0 },
    grid: {}, // 최적화를 위한 공간 분할 그리드

    /**
     * 매니저 상태 초기화
     */
    reset() {
        this.units = []; this.projectiles = [];
        this.playerBase = {
            x: CONFIG.layout.baseMarginX,
            y: Engine.canvas.height * CONFIG.layout.baseRatioY,
            hp: CONFIG.factions.common.baseMaxHp,
            maxHp: CONFIG.factions.common.baseMaxHp,
            cooldown: 0
        };
        this.syncBasePositions();
        this.syncMergeZone();
    },

    /**
     * 기지 위치 동기화 (화면 크기 변경 시 호출)
     */
    syncBasePositions() {
        this.playerBase.x = CONFIG.layout.baseMarginX;
        this.playerBase.y = Engine.canvas.height * CONFIG.layout.baseRatioY;
        this.syncMergeZone();
    },

    /**
     * 머지 존(마법진) 위치 동기화
     */
    syncMergeZone() {
        const l = CONFIG.layout.merge;
        this.mergeZone = {
            x: this.playerBase.x + l.offsetX,
            y: this.playerBase.y + l.offsetY,
            w: l.width, h: l.height
        };
    },

    /**
     * 전체 엔티티 상태 업데이트 (매 프레임)
     */
    update() {
        this.handleSpawning();   // 유닛 생성 처리
        this.updateGrid();        // 공간 분할 그리드 갱신
        this.units.forEach(u => u.update());
        this.projectiles = this.projectiles.filter(p => p.active);
        this.projectiles.forEach(p => p.update());
        this.handleBaseDefense(); // 기지 방어 포탑 로직
        this.handleAutoMerge();   // 자동 합체 로직
        this.cleanup();           // 사망 및 화면 이탈 유닛 정리
    },

    /**
     * 최적화를 위해 유닛들을 그리드에 배치하여 타겟팅 시 검색 범위 제한
     */
    updateGrid() {
        this.grid = {};
        this.units.forEach(u => {
            const k = `${Math.floor(u.x / CONFIG.layout.gridSize)},${Math.floor(u.y / CONFIG.layout.gridSize)}`;
            if (!this.grid[k]) this.grid[k] = [];
            this.grid[k].push(u);
        });
    },

    /**
     * 시간에 따른 유닛 자동 생성(Spawn) 처리
     */
    handleSpawning() {
        const getRate = (conf) => {
            const red = Math.floor(Engine.score / conf.reductionInterval);
            return Math.max(conf.minSpawnRateSeconds, conf.spawnRateSeconds - (red * conf.reductionAmount));
        };

        const pInt = Math.max(1, Math.floor(getRate(CONFIG.factions.common) * 60));
        if (Engine.frames % pInt === 0) this.spawnBatch(0);

        const eInt = Math.max(1, Math.floor(getRate(CONFIG.factions.common) * 60));
        if (Engine.frames % eInt === 0) this.spawnBatch(1);
    },

    /**
     * 유닛 묶음 스폰
     * @param {number} team - 스폰할 유닛의 팀 (0: 플레이어, 1: 적)
     */
    spawnBatch(team) {
        const conf = team === 0 ? CONFIG.factions.common : CONFIG.factions.common;
        for (let i = 0; i < conf.spawnBatch; i++) {
            const x = team === 0 ? -60 + Math.random() * -20 : Engine.canvas.width + 60 + Math.random() * 20;
            const minY = this.playerBase.y + CONFIG.layout.spawnOffset.top;
            const maxY = this.playerBase.y + CONFIG.layout.spawnOffset.bottom;
            const y = minY + Math.random() * (maxY - minY);

            // 적군의 경우 점수에 따라 고레벨 유닛 생성 확률 조정
            let level = 1;
            if (team === 1) {
                for (const cfg of CONFIG.factions.enemy.levels) {
                    // interval 점수를 넘었을 때만 해당 레벨 등장 가능
                    if (Engine.score >= cfg.interval) {
                        if (Math.random() < Math.min(cfg.max, (Engine.score / cfg.interval) * cfg.inc)) {
                            level = cfg.lv; break;
                        }
                    }
                }
            }
            this.units.push(new Unit(x, y, team, this.getRandType(), level));
        }
    },

    /**
     * 확률에 기반한 무작위 유닛 타입 반환
     * @returns {string} 무작위 유닛 타입
     */
    getRandType() {
        const p = CONFIG.factions.common.probs;
        const r = Math.random();
        if (r < p.ranged) return UNIT_TYPES.RANGED;
        if (r < p.ranged + p.tanker) return UNIT_TYPES.TANKER;
        if (r < p.ranged + p.tanker + p.mage) return UNIT_TYPES.MAGE;
        if (r < p.ranged + p.tanker + p.mage + p.healer) return UNIT_TYPES.HEALER;
        return UNIT_TYPES.MELEE;
    },

    /**
     * 기지 근처의 적을 자동 공격하는 방어 로직
     */
    handleBaseDefense() {
        if (this.playerBase.cooldown > 0) this.playerBase.cooldown--;
        if (this.playerBase.hp > 0 && this.playerBase.cooldown === 0) {
            const range = CONFIG.factions.common.baseAttackRange;
            const target = this.units.find(u => u.team === 1 && u.hp > 0 && Math.hypot(u.x - this.playerBase.x, u.y - this.playerBase.y) < range);
            if (target) {
                const shot = new Projectile(this.playerBase, target);
                shot.isCannon = true; shot.damage = CONFIG.factions.common.baseAttackDamage;
                shot.speed = 12;
                this.projectiles.push(shot);
                this.playerBase.cooldown = CONFIG.factions.common.baseAttackCooldown;
                // 성 대포의 묵직한 발사음 (Sawtooth, 낮고 굵은 Frequency로 쾅 하는 폭발음 연출)
                WCGames.Audio.play([150, 40], 'sawtooth', 0.3, 0.15);
            }
        }
        // 기지 체력이 0 이하가 되면 게임 오버 (패배)
        if (this.playerBase.hp <= 0 && Engine.isStarted) {
            Engine.gameOver(false);
        }
    },

    /**
     * 마법진 영역 안의 동일 타입/레벨 유닛 자동 합체 처리
     */
    handleAutoMerge() {
        const groups = {};
        const centerX = this.mergeZone.x + this.mergeZone.w / 2;
        const centerY = this.mergeZone.y + this.mergeZone.h / 2;
        const rx = this.mergeZone.w / 2, ry = rx * 0.35;

        this.units.filter(u => u.team === 0 && u.hp > 0).forEach(u => {
            const dx = u.x - centerX, dy = u.y - centerY;
            // 타원형 영역 안인지 판정
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
        let count = 0;
        const offset = CONFIG.control.moveOffset;
        
        // 이동 가능 영역 제한 (화면 밖 비정상 타겟 방지)
        const minY = EntityManager.playerBase.y + CONFIG.layout.combatOffset.top;
        const maxY = EntityManager.playerBase.y + CONFIG.layout.combatOffset.bottom;
        const minX = 0;
        const maxX = Engine.canvas.width;

        this.units.forEach(u => {
            if (u.selected && u.team === 0) {
                let tx = x + (Math.random() - 0.5) * offset;
                let ty = y + (Math.random() - 0.5) * offset;
                
                // 타겟을 제한하여 무한히 멈춰있는 버그 방지
                tx = Math.max(minX, Math.min(maxX, tx));
                ty = Math.max(minY, Math.min(maxY, ty));

                u.target = { x: tx, y: ty };
                u.state = 1; u.selected = false; count++;
            }
        });
        if (count > 0 && Math.random() > 0.5) WCGames.Audio.play([400, 600], 'sine', 0.05, 0.05);
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
    /**
     * 전체 유닛의 전투 로직 업데이트
     */
    update() {
        EntityManager.units.forEach(u => this.handleTargeting(u));
    },

    /**
     * 개별 유닛의 타겟팅 및 공격 상태 처리
     * @param {object} u - 처리할 유닛
     */
    handleTargeting(u) {
        if (u.hp <= 0) return;

        // 플레이어 기지 공격 판정 (적군 유닛 전용, 힐러 제외)
        if (u.team === 1 && u.type !== UNIT_TYPES.HEALER) {
            const dx = u.x - EntityManager.playerBase.x, dy = u.y - EntityManager.playerBase.y;
            const dist = Math.hypot(dx, dy);
            // 기지 충돌 범위 (성 이미지 큰 반경 고려)
            if (dist < 120) {
                u.attackTarget = EntityManager.playerBase;
                u.state = 2; // 공격 상태 전환
                return;
            }
        }

        // 플레이어 유닛은 오른쪽 끝(적 진영 전초선)에서 정지
        const baseBuffer = CONFIG.control.baseBuffer;
        if (u.team === 0 && u.x > Engine.canvas.width - baseBuffer) { 
            u.state = 0; 
            u.vx = 0; 
            u.x = Engine.canvas.width - baseBuffer; // 확실히 멈추도록 x 클램프
            return; 
        }

        // 주기적 타겟팅 업데이트 (성능 최적화: 10프레임마다 실행)
        if ((Engine.frames + u.id.length) % 10 !== 0) return;
        if (u.state === 2 && u.attackTarget?.hp > 0) return;

        const aggroRange = (u.type === UNIT_TYPES.RANGED ? 120 : 80);
        const grid = EntityManager.grid;
        const cx = Math.floor(u.x / CONFIG.layout.gridSize), cy = Math.floor(u.y / CONFIG.layout.gridSize);

        let best = null, bestDist = aggroRange * aggroRange;

        // 인접 그리드 검색 (최적화)
        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let y = cy - 1; y <= cy + 1; y++) {
                (grid[`${x},${y}`] || []).forEach(n => {
                    if (n.hp <= 0) return;
                    // 힐러는 아군 치유, 나머지는 적군 공격
                    const isTarget = u.type === UNIT_TYPES.HEALER ? (n.team === u.team && n.hp < n.maxHp && n !== u) : (n.team !== u.team);
                    if (isTarget) {
                        const d = Math.pow(n.x - u.x, 2) + Math.pow(n.y - u.y, 2);
                        if (d < bestDist) { bestDist = d; best = n; }
                    }
                });
            }
        }

        if (best) {
            u.attackTarget = best; u.state = 2; // 타겟 발견 시 공격 상태로 전환
        } else if (u.state === 2) {
            u.state = 1; // 타겟 유실 시 이동 상태로 전환
        }
    }
};

// --- 7. EFFECT SYSTEM (이펙트 및 파티클 관리) ---
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

    /**
     * 보조 파티클 생성 (단순 이동 및 수명 관리)
     * @param {number} x - 발생 X 좌표
     * @param {number} y - 발생 Y 좌표
     * @param {string} color - 파티클 색상
     * @param {object} extra - 추가 속성 (vx, vy, life, max, isCross 등)
     */
    addParticle(x, y, color, extra = {}) {
        this.particles.push({
            x, y, color,
            vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
            life: 5 + Math.random() * 20, max: 25, ...extra
        });
    },

    /**
     * 투사체 이동 경로 이펙트 생성
     * @param {object} p - 투사체 객체
     */
    addProjectileTrail(p) {
        if (Engine.frames % 2 !== 0) return;
        let color = p.isCannon ? (p.team === 0 ? "rgba(96,165,250,0.5)" : "rgba(244,63,94,0.5)") :
            p.isMagic ? (p.team === 0 ? "#bfdbfe" : "#fbbf24") :
                p.isHeal ? "#4ade80" :
                    (p.type === UNIT_TYPES.RANGED ? (p.team === 0 ? "rgba(229,231,235,0.4)" : "rgba(251,146,60,0.4)") : null);
        if (color) this.addParticle(p.x, p.y - p.z, color, { vx: 0, vy: p.isHeal ? -0.5 : 0, life: 10 });
    },

    /**
     * 힐(치유) 이펙트 생성 - 수직으로 반짝이며 올라가는 효과
     * @param {object} t - 치유 대상 유닛
     */
    addHealEffect(t) {
        // 더 섬세하고 수직으로 반짝이며 올라가는 힐 이펙트
        for (let i = 0; i < 10; i++) {
            const rx = (Math.random() - 0.5) * (t.width || 20);
            const ry = Math.random() * -20;
            const vy = -0.5 - Math.random() * 1.5;
            const life = 20 + Math.random() * 40;
            this.addParticle(t.x + rx, t.y + ry, "#4ade80", {
                vx: (Math.random() - 0.5) * 0.2,
                vy: vy,
                life: life,
                max: life,
                isCross: Math.random() > 0.7 // 가끔씩만 십자가 모양
            });
        }
    },

    /**
     * 투사체 타격 이펙트 생성
     * @param {object} t - 피격 대상
     * @param {boolean} isCannon - 대포 여부
     * @param {boolean} isMagic - 마법 여부
     */
    addHitEffect(t, isCannon, isMagic) {
        const color = isCannon ? "#fef08a" : isMagic ? (t.team === 0 ? "#60a5fa" : "#fbbf24") : "#fff";
        const count = isCannon ? 6 : 4;
        for (let i = 0; i < count; i++) this.addParticle(t.x, t.y - 10, color);
    },

    /**
     * 유닛 합체(머지) 이펙트 생성 - 금빛 반짝임 효과
     * @param {number} x - 발생 X 좌표
     * @param {number} y - 발생 Y 좌표
     */
    addMergeEffect(x, y) {
        // 더 우아하고 반짝이는 금빛 머지 이펙트
        for (let i = 0; i < 15; i++) {
            const rx = (Math.random() - 0.5) * 30;
            const ry = (Math.random() - 0.5) * 20;
            const vy = -1 - Math.random() * 2; // 위로 떠오르는 느낌
            const life = 30 + Math.random() * 30;
            this.addParticle(x + rx, y + ry, i % 2 === 0 ? "#fcd34d" : "#fef9c3", {
                vx: (Math.random() - 0.5) * 1.5,
                vy: vy,
                life: life,
                max: life,
                isCross: Math.random() > 0.6 // 반짝이는 십자가 효과
            });
        }
    },

    /**
     * 유닛 사망 이펙트 생성
     * @param {object} u - 사망한 유닛
     */
    addDeathEffect(u) {
        const color = u.team === 0 ? "#3b82f6" : "#ef4444";
        for (let i = 0; i < 10; i++) this.addParticle(u.x, u.y, color);
        if (Math.random() > 0.8) WCGames.Audio.play([100, 30], 'square', 0.05, 0.1);
    },

    /**
     * 무작위 번개 효과 생성 및 처리
     * 일정 주기마다 번개를 발생시키고 범위 내 유닛에게 피해를 줍니다.
     */
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
    /**
     * 메인 렌더링 루프
     */
    draw() {
        const ctx = Engine.ctx;
        ctx.imageSmoothingEnabled = false;

        // 배경 그리기
        if (Assets.sprites.fullBg) {
            ctx.drawImage(Assets.sprites.fullBg, 0, 0, Engine.canvas.width, Engine.canvas.height);
        } else {
            ctx.fillStyle = "#1c1917"; ctx.fillRect(0, 0, Engine.canvas.width, Engine.canvas.height);
        }

        if (!Engine.isStarted) return;

        // 머지 존(마법진) 그리기
        this.drawMergeZone();

        // 뎁스 소팅 (Y축 기준 정렬하여 위아래 레이어 처리)
        const q = [{ isBase: true, obj: EntityManager.playerBase, y: EntityManager.playerBase.y }];
        EntityManager.units.forEach(u => q.push({ isBase: false, obj: u, y: u.y }));
        q.sort((a, b) => a.y - b.y).forEach(r => this.drawObject(r));

        // 각종 효과 및 UI 그리기
        this.drawProjectiles();
        this.drawLightnings();
        this.drawParticles();
        this.drawUI();
    },

    /**
     * 머지 존(마법진) 렌더링
     */
    drawMergeZone() {
        const mz = EntityManager.mergeZone;
        if (!mz || mz.w === 0) return;
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
            const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
            ctx.fillStyle = `rgba(251,191,36,${0.3 * pulse})`;
            ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    },

    /**
     * 개별 객체(유닛 또는 기지) 렌더링
     * @param {object} r - 정렬된 렌더링 객체 정보
     */
    drawObject(r) {
        const ctx = Engine.ctx;
        if (r.isBase) {
            // 성/기지 그리기 (플레이어 진영)
            const b = r.obj;
            const spr = Assets.sprites.pBase;
            if (spr) {
                const scale = 1 + (b.y / Engine.canvas.height);
                const w = 220 * scale;
                const h = w * (spr.height / spr.width);
                // 기지는 약간 왼쪽으로 치우치게 그려 전체 화면을 웅장하게 표현
                ctx.drawImage(spr, -w / 1.3, b.y - h + 20, w, h);
            }
            this.drawBaseHp(b);
        } else {
            // 유닛 및 애니메이션 그리기
            const u = r.obj;
            const perspective = 0.5 + 0.7 * ((u.y - Engine.canvas.height * 0.05) / (Engine.canvas.height * 0.95));
            const key = (u.team === 0 ? 'p' : 'e') + u.type;
            const sheet = Assets.sprites[key + 'Sheet'], meta = Assets.sprites[key + 'Meta'];

            if (sheet && meta) {
                // state === 2(공격 목표 포착)이더라도, 아직 접근 중(vx, vy 존재)이라면 걷기 애니메이션 출력
                const isMoving = Math.abs(u.vx) > 0.1 || Math.abs(u.vy) > 0.1;
                const anim = (u.state === 2 && !isMoving) ? 'attack' : 'walk';
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
            // 선택된 유닛 강조 표시
            if (u.selected) {
                ctx.strokeStyle = "#a7f3d0"; ctx.lineWidth = 1;
                ctx.strokeRect(u.x - u.width, u.y - u.height * 2, u.width * 2, u.height * 2);
            }
        }
    },

    drawBaseHp(base) {
        const ctx = Engine.ctx, w = Engine.canvas.width * 0.7, h = 18, x = (Engine.canvas.width - w) / 2, y = 100;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, w, h);
        const grad = ctx.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, "#1e40af"); grad.addColorStop(1, "#60a5fa");
        ctx.fillStyle = grad;
        const currentHp = Math.max(0, base.hp);
        ctx.fillRect(x + 1, y + 1, Math.max(0, (currentHp / CONFIG.factions.common.baseMaxHp) * w - 2), h - 2);

        // 체력 수치 텍스트 표시
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`HP: ${Math.ceil(currentHp)} / ${CONFIG.factions.common.baseMaxHp}`, x + w / 2, y + h / 2 + 1);
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
            } else if (p.type === UNIT_TYPES.RANGED && !p.isCannon) {
                // 가느다란 화살 표현 (오크는 더 눈에 띄는 주황색 계열 적용)
                ctx.strokeStyle = p.team === 0 ? "#e5e7eb" : "#fb923c";
                ctx.lineWidth = 2.5;
                ctx.translate(p.x, p.y - p.z);
                ctx.rotate(p.visualAngle); // 화면상의 실제 이동 각도로 회전

                ctx.beginPath();
                ctx.moveTo(-6, 0); ctx.lineTo(6, 0); // 화살 몸통
                ctx.stroke();

                // 화살촉 (작은 점 또는 선)
                ctx.fillStyle = p.team === 0 ? "#94a3b8" : "#ea580c";
                ctx.fillRect(5, -1, 3, 2);
            }
            else {
                ctx.fillStyle = p.isCannon ? (p.team === 0 ? "#93c5fd" : "#fda4af") : (p.team === 0 ? "#22d3ee" : "#f97316");
                ctx.beginPath();
                if (p.isCannon) {
                    ctx.shadowColor = p.team === 0 ? "#3b82f6" : "#e11d48";
                    ctx.shadowBlur = 10;
                    ctx.arc(p.x, p.y - p.z, sz * 2.5, 0, Math.PI * 2);
                }
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
        document.getElementById('start-screen').classList.remove('wcg-visible');
        Engine.isStarted = true;
        Engine.isGameOver = false;
        Engine.frames = 0;
        Engine.score = 0;
        EntityManager.reset();
    },
    restart() {
        document.getElementById('game-over').classList.remove('wcg-visible');
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
