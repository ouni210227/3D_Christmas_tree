import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HandData } from '../types';

interface UserPhotoProps {
  texture: THREE.Texture | null;
  handData: React.MutableRefObject<HandData>;
}

const UserPhoto: React.FC<UserPhotoProps> = ({ texture, handData }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (!groupRef.current) return;
    
    const { isPinching } = handData.current;
    
    let targetScale = 0;
    
    if (texture) {
        // Normal size is smaller to fit in tree, Pinch makes it huge
        targetScale = isPinching ? 3.5 : 1.2;
    }

    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    
    // Always face camera but keep upright
    groupRef.current.lookAt(0, 0, 12);
  });

  if (!texture) return null;

  // Aspect ratio correction (assume square or logic to handle it)
  // For simplicity, we make a square frame like the reference
  return (
    <group ref={groupRef} position={[0, 0.5, 0.5]}>
      {/* Photo */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.8, 1.8]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Golden Frame - Backing */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2, 2, 0.05]} />
        <meshStandardMaterial 
            color="#FFD700" 
            metalness={1.0} 
            roughness={0.2} 
        />
      </mesh>
      
      {/* Golden Frame - Border Rim */}
      <mesh position={[0, 0, 0.03]}>
         <ringGeometry args={[0.9, 1.0, 4]} thetaStart={Math.PI/4} />
         <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.1} />
      </mesh>
    </group>
  );
};

export default UserPhoto;