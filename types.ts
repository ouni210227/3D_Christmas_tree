import * as THREE from 'three';

export enum TemplateType {
  TREE = 'TREE',
}

export interface HandData {
  hasHand: boolean; // Is the hand currently physically detected (or in grace period)?
  isOpen: boolean;
  isClosed: boolean;
  pinchDistance: number; // 0 to 1 normalized
  isPinching: boolean;
  palmPosition: { x: number; y: number; z: number };
}

export interface ParticleData {
  // Positions for different states
  treePos: THREE.Vector3;   // The Christmas Tree shape
  spherePos: THREE.Vector3; // The Standard Sphere shape (for Open Hand)
  
  color: THREE.Color;
  scale: number;
  rotationOffset: THREE.Euler; // Individual random rotation
  type: 'foliage' | 'orb_gold' | 'orb_red' | 'orb_silver' | 'snow' | 'cane' | 'photo_placeholder' | 'box';
}

export interface SharedState {
  hand: HandData;
  template: TemplateType;
  uploadedTexture: THREE.Texture | null;
}