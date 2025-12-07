import * as THREE from 'three';
import { ParticleData, TemplateType } from '../types';

// Exact Counts as requested
const COUNTS = {
  FOLIAGE: 400,
  ORB_GOLD: 500,
  ORB_RED: 30,
  ORB_SILVER: 20,
  SNOW: 20,
  CANE: 10,
  PHOTO: 10,
};

export const generateParticles = (type: TemplateType): ParticleData[] => {
  const particles: ParticleData[] = [];
  
  // Helper to generate a point on a sphere surface (fibonacci sphere for even distribution)
  const getSpherePoint = (radius: number = 3.5) => {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    ).multiplyScalar(radius);
  };
  
  const getExplosionPoint = () => {
      const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
      return dir.multiplyScalar(6 + Math.random() * 8); 
  };

  if (type === TemplateType.TREE) {
    
    const addParticle = (p: Partial<ParticleData>) => {
        let spherePos: THREE.Vector3;
        
        // FIX 2: For Photos, ALWAYS force them to be on the sphere surface radius
        if (p.type === 'photo_placeholder') {
             spherePos = getSpherePoint(3.5);
        } else {
             // For other particles, keep the random "core vs explosion" look
             const isCore = Math.random() < 0.8; 
             if (isCore) {
                spherePos = getSpherePoint(3.5);
             } else {
                spherePos = getExplosionPoint();
             }
        }

        particles.push({
            treePos: p.treePos!,
            spherePos: spherePos,
            color: p.color!,
            scale: p.scale!,
            rotationOffset: p.rotationOffset || new THREE.Euler(),
            type: p.type as any
        });
    };

    // 1. FOLIAGE
    for (let i = 0; i < COUNTS.FOLIAGE; i++) {
      // FIX 1: Weighted Height for Cone Distribution
      // Instead of uniform height, we use square root distribution to put more points at the bottom
      // h goes from -4 (bottom) to 4 (top). 
      // u = 0 -> h = -4 (bottom), u = 1 -> h = 4 (top)
      // We want more points near -4. 
      const u = Math.random();
      // Formula: h = Top - (TotalHeight * sqrt(u))
      // This spreads points according to the surface area of a cone
      const h = 4 - (8 * Math.sqrt(u));
      
      const maxR = (4 - h) * 0.5;
      const r = Math.sqrt(Math.random()) * maxR; // Uniform disk sampling at that height
      const angle = Math.random() * Math.PI * 2;
      
      addParticle({
        treePos: new THREE.Vector3(Math.cos(angle)*r, h, Math.sin(angle)*r),
        color: new THREE.Color('#228B22').lerp(new THREE.Color('#006400'), Math.random()),
        scale: Math.random() * 0.4 + 0.3,
        rotationOffset: new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, 0),
        type: 'foliage'
      });
    }

    // 2. GOLD ORBS
    for (let i = 0; i < COUNTS.ORB_GOLD; i++) {
        // FIX 1: Weighted Height for Cone Distribution (Same as foliage)
        const u = Math.random();
        // Slightly less aggressive curve for orbs to keep some at top, but mostly bottom
        // Using pow 0.6 instead of 0.5 (sqrt) to bias slightly less to bottom than foliage
        const h = 3.8 - (7.8 * Math.pow(u, 0.6));
        
        const maxR = (4 - h) * 0.55; 
        const angle = i * 0.5; // Spiral placement
        
        // Jitter radius slightly so they aren't perfectly on the "skin"
        const r = maxR * (0.9 + Math.random() * 0.2);
        
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;

        addParticle({
            treePos: new THREE.Vector3(x, h, z),
            color: new THREE.Color('#FFD700'),
            scale: (Math.random() * 0.4 + 0.4) * 1.5, 
            rotationOffset: new THREE.Euler(0, Math.random()*Math.PI, 0),
            type: 'orb_gold'
        });
    }

    // 3. RED ORBS (Uniformly distributed vertically is okay for low count features)
    for (let i = 0; i < COUNTS.ORB_RED; i++) {
        const h = (Math.random() * 6) - 3;
        const maxR = (4 - h) * 0.58;
        const angle = Math.random() * Math.PI * 2;
        addParticle({
            treePos: new THREE.Vector3(Math.cos(angle)*maxR, h, Math.sin(angle)*maxR),
            color: new THREE.Color('#DC143C'),
            scale: 1.0, 
            type: 'orb_red'
        });
    }

    // 4. SILVER ORBS
    for (let i = 0; i < COUNTS.ORB_SILVER; i++) {
        const h = (Math.random() * 7) - 3.5;
        const maxR = (4 - h) * 0.58;
        const angle = Math.random() * Math.PI * 2;
        addParticle({
            treePos: new THREE.Vector3(Math.cos(angle)*maxR, h, Math.sin(angle)*maxR),
            color: new THREE.Color('#C0C0C0'),
            scale: 0.9,
            type: 'orb_silver'
        });
    }

    // 5. SNOWFLAKES
    for (let i = 0; i < COUNTS.SNOW; i++) {
        const h = (Math.random() * 8) - 3;
        const r = (4 - h) * 0.7;
        const angle = Math.random() * Math.PI * 2;
        addParticle({
            treePos: new THREE.Vector3(Math.cos(angle)*r, h, Math.sin(angle)*r),
            color: new THREE.Color('#FFFFFF'),
            scale: 1.2,
            rotationOffset: new THREE.Euler(Math.random(), Math.random(), Math.random()),
            type: 'snow'
        });
    }

    // 6. CANDY CANES
    for (let i = 0; i < COUNTS.CANE; i++) {
        const h = (Math.random() * 5) - 3.5;
        const r = (4 - h) * 0.6;
        const angle = Math.random() * Math.PI * 2;
        addParticle({
            treePos: new THREE.Vector3(Math.cos(angle)*r, h, Math.sin(angle)*r),
            color: new THREE.Color('#FF0000'),
            scale: 0.8,
            rotationOffset: new THREE.Euler(Math.random()*0.5, Math.random()*Math.PI, 0),
            type: 'cane'
        });
    }

    // 7. PHOTO PLACEHOLDERS - 10
    // UPDATED: Placed in the prominent middle/upper section (h: -1.0 to 2.5)
    for (let i = 0; i < COUNTS.PHOTO; i++) {
         const h = (i / (COUNTS.PHOTO - 1)) * 3.5 - 1.0; 
         // Spiral distribution
         const angle = i * 1.8; 
         // Radius: slightly pushed out from foliage
         const r = (4 - h) * 0.55 + 0.4;
         
         addParticle({
            treePos: new THREE.Vector3(Math.cos(angle)*r, h, Math.sin(angle)*r),
            color: new THREE.Color('#FFD700'),
            scale: 0.25, 
            rotationOffset: new THREE.Euler(0, -angle, 0), // Face outwards
            type: 'photo_placeholder'
         });
    }

  }

  return particles;
};