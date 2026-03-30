/**
 * Voxel Tank 유틸리티 함수
 * 재사용 가능한 헬퍼 함수들을 관리합니다.
 */
import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * 박스 형태의 복셀 메시지를 생성합니다.
 * @param {number} w - 너비
 * @param {number} h - 높이
 * @param {number} d - 깊이
 * @param {number} color - 색상
 * @param {number} metalness - 금속성
 * @param {number} roughness - 거칠기
 * @returns {THREE.Mesh} 생성된 메시
 */
export function createVoxelBox(w, h, d, color, metalness = 0, roughness = 0.9) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({
        color,
        metalness: metalness,
        roughness: roughness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/**
 * 원통 형태의 복셀 메시지를 생성합니다.
 * @param {number} radiusTop - 상단 반지름
 * @param {number} radiusBottom - 하단 반지름
 * @param {number} height - 높이
 * @param {number} color - 색상
 * @param {number} metalness - 금속성
 * @param {number} roughness - 거칠기
 * @returns {THREE.Mesh} 생성된 메시
 */
export function createVoxelCylinder(radiusTop, radiusBottom, height, color, metalness = 0.2, roughness = 0.8, segments = 12) {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/**
 * 원뿔 형태의 복셀 메시지를 생성합니다.
 * @param {number} radius - 반지름
 * @param {number} height - 높이
 * @param {number} color - 색상
 * @returns {THREE.Mesh} 생성된 메시
 */
export function createVoxelCone(radius, height, color) {
    const geometry = new THREE.ConeGeometry(radius, height, 12);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/**
 * 아이템 아이콘 레이블을 생성합니다.
 * @param {string} emoji - 이모지 문자
 * @returns {THREE.Sprite} 생성된 스프라이트
 */
export function createItemLabel(emoji) {
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

/**
 * 발자국(트랙마크) 관리자
 * 탱크와 독립적으로 발자국을 관리합니다.
 */
export class TrackMarkManager {
    constructor(scene) {
        this.scene = scene;
        this.tracks = [];
        this.lifetimes = [];
        this.maxTracks = 500;
        this.trackLifetime = 8000;
        this.trackGeo = new THREE.BoxGeometry(0.2, 0.003, 0.4);
        this.trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 });
    }

    add(x, z, angle) {
        const trackGap = 0.5;
        for (let side = -1; side <= 1; side += 2) {
            const offset = trackGap * side;
            const tx = x + Math.cos(angle) * offset;
            const tz = z - Math.sin(angle) * offset;
            
            const track = new THREE.Mesh(this.trackGeo, this.trackMat);
            track.position.set(tx, 0.01, tz);
            track.rotation.y = angle;
            this.scene.add(track);
            this.tracks.push(track);
            this.lifetimes.push(Date.now());
        }
        if (this.tracks.length > this.maxTracks) {
            const removeCount = this.tracks.length - this.maxTracks;
            for (let i = 0; i < removeCount; i++) {
                this.remove(0);
            }
        }
    }

    remove(index) {
        const track = this.tracks[index];
        this.scene.remove(track);
        this.tracks.splice(index, 1);
        this.lifetimes.splice(index, 1);
    }

    update() {
        const now = Date.now();
        for (let i = this.tracks.length - 1; i >= 0; i--) {
            const age = now - this.lifetimes[i];
            if (age > this.trackLifetime) {
                this.remove(i);
            }
        }
    }
}

/**
 * 총알 관리자
 * 탱크와 독립적으로 총알을 관리합니다.
 */
export class BulletManager {
    constructor(scene) {
        this.scene = scene;
        this.bullets = [];
        
        // 공유 지오메트리 및 재질 (메모리 효율)
        this.bodyGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 12);
        this.bodyMat = new THREE.MeshBasicMaterial({ color: 0xd4a017 });
        
        this.tipGeo = new THREE.ConeGeometry(0.08, 0.18, 12);
        this.tipMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        
        this.baseGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12);
        this.baseMat = new THREE.MeshBasicMaterial({ color: 0x8d6e63 });
        
        this.casingGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12);
        this.casingMat = new THREE.MeshBasicMaterial({ color: 0x654321 });
    }

    /**
     * 총알을 추가합니다.
     * @param {THREE.Vector3} position - 시작 위치
     * @param {THREE.Vector3} direction - 이동 방향
     * @param {string} ownerId - 소유자 ID
     * @param {number} damage - 데미지
     * @param {number} scale - 크기
     */
    add(position, direction, ownerId, damage = CONFIG.TANK.DAMAGE, scale = 1.0) {
        const group = new THREE.Group();
        
        const body = new THREE.Mesh(this.bodyGeo, this.bodyMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);
        
        const tip = new THREE.Mesh(this.tipGeo, this.tipMat);
        tip.position.z = -0.26;
        tip.rotation.x = Math.PI / 2;
        group.add(tip);
        
        const base = new THREE.Mesh(this.baseGeo, this.baseMat);
        base.position.z = 0.18;
        base.rotation.x = Math.PI / 2;
        group.add(base);
        
        const casing = new THREE.Mesh(this.casingGeo, this.casingMat);
        casing.position.z = 0.22;
        casing.rotation.x = Math.PI / 2;
        group.add(casing);
        
        group.position.copy(position);
        group.lookAt(position.clone().add(direction));
        group.scale.setScalar(scale);
        
        this.scene.add(group);
        
        this.bullets.push({
            group,
            direction: direction.clone(),
            ownerId,
            damage,
            startTime: Date.now(),
            trailTimer: 0
        });
    }

    remove(index) {
        const bullet = this.bullets[index];
        this.scene.remove(bullet.group);
        bullet.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        this.bullets.splice(index, 1);
    }

    // 특정 총알 제거 (외부 호출용)
    removeBullet(bullet) {
        const index = this.bullets.indexOf(bullet);
        if (index !== -1) {
            this.remove(index);
        }
    }

    // 총알 배열 반환 (호환성)
    getBulletArray() {
        return this.bullets;
    }

    update(dt) {
        const now = Date.now();
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // 위치 업데이트
            bullet.group.position.add(bullet.direction.clone().multiplyScalar(CONFIG.BULLET.SPEED * dt));
            
            // 수명 확인
            if (now - bullet.startTime > CONFIG.BULLET.LIFE_TIME) {
                this.remove(i);
            }
        }
    }
}
