import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Snowfall: React.FC = () => {
  const count = 600; // Number of snowflakes
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Generate random initial positions and properties
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        x: (Math.random() - 0.5) * 30,
        y: Math.random() * 20, // Start at various heights
        z: (Math.random() - 0.5) * 30,
        speed: 0.02 + Math.random() * 0.04, // Falling speed
        swaySpeed: 0.5 + Math.random(),     // How fast it sways side to side
        swayAmp: 0.02 + Math.random() * 0.05, // How wide it sways
        scale: 0.05 + Math.random() * 0.08    // Size
      });
    }
    return temp;
  }, []);

  useFrame((state) => {
    if (!mesh.current) return;
    
    const time = state.clock.getElapsedTime();

    particles.forEach((p, i) => {
      // Fall down
      p.y -= p.speed;
      
      // Reset to top if below ground
      if (p.y < -5) {
        p.y = 15; // Reset height
        p.x = (Math.random() - 0.5) * 30; // Randomize x/z again for variety
        p.z = (Math.random() - 0.5) * 30;
      }

      // Horizontal Sway (Wind effect)
      const swayX = Math.sin(time * p.swaySpeed + p.x * 0.5) * p.swayAmp;
      const swayZ = Math.cos(time * p.swaySpeed + p.z * 0.5) * p.swayAmp;
      
      dummy.position.set(p.x + swayX, p.y, p.z + swayZ);
      
      // Rotate the snowflake slightly
      dummy.rotation.set(time * 0.2, time * 0.1, 0);
      
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      {/* Low poly sphere acts as soft snowflake */}
      <dodecahedronGeometry args={[1, 0]} /> 
      <meshBasicMaterial color="#FFFFFF" transparent opacity={0.8} />
    </instancedMesh>
  );
};

export default Snowfall;