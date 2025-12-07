import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { generateParticles } from '../utils/geometry';
import { HandData, TemplateType, ParticleData } from '../types';
import { UserTexture } from '../App';

interface ParticleSystemProps {
  template: TemplateType;
  handData: React.MutableRefObject<HandData>;
  userTextures?: UserTexture[];
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
const targetPos = new THREE.Vector3();

// --- Helper: Snowflake Texture Generator ---
const createSnowflakeTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    ctx.fillStyle = '#00000000'; // Transparent
    ctx.fillRect(0,0,128,128);
    
    ctx.translate(64,64);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    for(let i=0; i<6; i++) {
        ctx.save();
        ctx.rotate((Math.PI/3) * i);
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(0, -50);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-15, -20);
        ctx.lineTo(0, -30);
        ctx.lineTo(15, -20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, -35);
        ctx.lineTo(0, -45);
        ctx.lineTo(10, -35);
        ctx.stroke();
        ctx.restore();
    }
    
    ctx.beginPath();
    ctx.arc(0,0,5,0,Math.PI*2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
};

// --- Geometries ---

const TopStar = ({ rotationRef }: { rotationRef: React.MutableRefObject<THREE.Euler> }) => {
    const geo = useMemo(() => {
        const shape = new THREE.Shape();
        const outer = 0.8, inner = 0.4;
        for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? outer : inner;
            const a = (i / 10) * Math.PI * 2;
            const x = Math.cos(a + Math.PI/2) * r;
            const y = Math.sin(a + Math.PI/2) * r;
            if(i===0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();
        return new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05 });
    }, []);

    const ref = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if(ref.current) {
            // Apply global rotation
            ref.current.rotation.y = rotationRef.current.y + state.clock.getElapsedTime();
            ref.current.rotation.x = rotationRef.current.x;
            ref.current.position.y = 4.2 + Math.sin(state.clock.getElapsedTime() * 2) * 0.1;
        }
    });

    return (
        <mesh ref={ref} geometry={geo} position={[0, 4.2, 0]}>
            <meshStandardMaterial 
                color="#FFD700" 
                emissive="#FFD700" 
                emissiveIntensity={0.4} 
                metalness={1.0} 
                roughness={0.0} 
            />
        </mesh>
    );
};

const useCaneGeometry = () => {
    return useMemo(() => {
        const path = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, -0.4, 0),
            new THREE.Vector3(0, 0.2, 0),
            new THREE.Vector3(0.1, 0.4, 0),
            new THREE.Vector3(0.25, 0.3, 0),
            new THREE.Vector3(0.25, 0.2, 0),
        ]);
        return new THREE.TubeGeometry(path, 12, 0.04, 8, false);
    }, []);
};

// --- Single Photo Component (Golden Frame) ---
interface PhotoFrameProps {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    userTex: UserTexture;
    isHovered: boolean;
    isSelected: boolean;
}

const PhotoFrame: React.FC<PhotoFrameProps> = ({ 
    position, 
    rotation, 
    userTex, 
    isHovered, 
    isSelected
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const targetScale = useRef(new THREE.Vector3(1, 1, 1));
    const targetPos = useRef(position.clone());
    const targetRot = useRef(rotation.clone());
    
    const { camera } = useThree();

    // Base dimensions adjusted by aspect ratio
    const baseHeight = 1.2;
    const baseWidth = baseHeight * userTex.aspect;
    
    useFrame((state, delta) => {
        if (!groupRef.current) return;

        if (isSelected) {
            // VIEW MODE: Fly to front of camera
            const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const centerPos = new THREE.Vector3()
                .copy(camera.position)
                .add(direction.multiplyScalar(5.0)); // 5 units in front
                
            targetPos.current.copy(centerPos);
            targetRot.current.copy(camera.rotation);
            targetScale.current.setScalar(2.0); 
            
        } else if (isHovered) {
             // HOVER MODE: Pop out slightly
             targetScale.current.setScalar(0.45); 
             targetPos.current.copy(position);
             targetPos.current.y += Math.sin(state.clock.elapsedTime * 3) * 0.1;
             targetRot.current.copy(rotation);
        } else {
             // IDLE MODE: Sit on tree
             targetScale.current.setScalar(0.35); 
             targetPos.current.copy(position);
             targetRot.current.copy(rotation);
        }

        const speed = 10 * delta; 
        groupRef.current.position.lerp(targetPos.current, speed);
        groupRef.current.scale.lerp(targetScale.current, speed);
        
        if (isSelected) {
             groupRef.current.quaternion.slerp(camera.quaternion, speed);
        } else {
             const targetQ = new THREE.Quaternion().setFromEuler(targetRot.current);
             groupRef.current.quaternion.slerp(targetQ, speed);
        }
    });

    return (
        <group ref={groupRef}>
             {/* Frame Back */}
             <mesh position={[0, 0, -0.06]}>
                <boxGeometry args={[baseWidth + 0.2, baseHeight + 0.2, 0.05]} />
                <meshStandardMaterial 
                    color="#FFD700" 
                    metalness={1.0} 
                    roughness={0.2}
                    emissive="#B8860B"
                    emissiveIntensity={0.2}
                />
             </mesh>
             
             {/* Photo */}
             <mesh position={[0, 0, 0]}>
                <planeGeometry args={[baseWidth, baseHeight]} />
                <meshBasicMaterial map={userTex.texture} side={THREE.DoubleSide} toneMapped={false} />
             </mesh>
             
             {/* Frame Rim */}
             <mesh position={[0, 0, 0.02]}>
                 <boxGeometry args={[baseWidth + 0.1, baseHeight + 0.1, 0.02]} />
                 <meshStandardMaterial color="#FFD700" metalness={1.0} roughness={0.0} emissive="#FFD700" emissiveIntensity={0.3} wireframe />
             </mesh>
        </group>
    );
};

// --- Photo Collection Manager ---
const PhotoGroup = ({ 
    data, 
    textures, 
    handData,
    rotationRef,
    isExplodedRef
}: { 
    data: ParticleData[], 
    textures: UserTexture[], 
    handData: React.MutableRefObject<HandData>,
    rotationRef: React.MutableRefObject<THREE.Euler>,
    isExplodedRef: React.MutableRefObject<boolean>
}) => {
    
    const [displayProps, setDisplayProps] = useState<{pos: THREE.Vector3, rot: THREE.Euler}[]>([]);
    const [closestIndex, setClosestIndex] = useState<number>(-1);
    
    const activePhotos = useMemo(() => {
        return data.slice(0, textures.length).map((p, i) => ({
            ...p,
            userTex: textures[i]
        }));
    }, [data, textures]);

    const { camera } = useThree();

    useFrame((state) => {
        if (activePhotos.length === 0) return;

        const { isPinching } = handData.current;
        const isExploded = isExplodedRef.current;
        const time = state.clock.getElapsedTime();
        
        const globalQ = new THREE.Quaternion().setFromEuler(rotationRef.current);
        let minDistance = Infinity;
        let idx = -1;
        const newDisplayProps: {pos: THREE.Vector3, rot: THREE.Euler}[] = [];

        activePhotos.forEach((p, i) => {
            const localPos = new THREE.Vector3();
            
            if (isExploded) {
                // Sphere state
                localPos.copy(p.spherePos);
            } else {
                // Tree state
                localPos.copy(p.treePos);
                localPos.y += Math.sin(time * 1.5 + i) * 0.05;
            }

            // Calculate exact world position
            const worldPos = localPos.clone().applyQuaternion(globalQ);
            
            // Calculate final rotation for the frame itself
            const baseQ = new THREE.Quaternion().setFromEuler(p.rotationOffset);
            const finalQ = globalQ.clone().multiply(baseQ);
            const finalRot = new THREE.Euler().setFromQuaternion(finalQ);

            newDisplayProps.push({ pos: worldPos, rot: finalRot });

            // LOGIC FIX: Use simple Euclidean distance to camera.
            // The photo closest to the camera lens is the one we want to interact with.
            const distance = worldPos.distanceTo(camera.position);
            
            if (distance < minDistance) {
                minDistance = distance;
                idx = i;
            }
        });
        
        setDisplayProps(newDisplayProps);

        // Only highlight if it's reasonably close (front half of the sphere)
        // Camera is at 14, Sphere radius ~3.5. Center is 0. 
        // Front face is ~10.5 units away. Back face is ~17.5 units away.
        // We set a threshold of 12.0 to ensure we only pick things on the front.
        if (minDistance < 12.0) {
            setClosestIndex(idx);
        } else {
            setClosestIndex(-1);
        }
    });

    const { isPinching } = handData.current;

    return (
        <group>
            {activePhotos.map((p, i) => {
                const currentProp = displayProps[i] || { pos: p.treePos, rot: p.rotationOffset };
                return (
                    <PhotoFrame 
                        key={i}
                        position={currentProp.pos}
                        rotation={currentProp.rot}
                        userTex={p.userTex}
                        isHovered={closestIndex === i}
                        isSelected={closestIndex === i && isPinching}
                    />
                );
            })}
        </group>
    );
};

// --- Main System ---

const ParticleSystem: React.FC<ParticleSystemProps> = ({ template, handData, userTextures = [] }) => {
  const foliageGeo = useMemo(() => new THREE.TetrahedronGeometry(0.25), []);
  const orbGeo = useMemo(() => new THREE.SphereGeometry(0.15, 16, 16), []);
  const snowGeo = useMemo(() => new THREE.PlaneGeometry(0.5, 0.5), []);
  const snowTex = useMemo(() => createSnowflakeTexture(), []);
  const caneGeo = useCaneGeometry();
  
  const particles = useMemo(() => generateParticles(template), [template]);
  
  const groups = useMemo(() => {
      const g: Record<string, ParticleData[]> = {
          foliage: [], orb_gold: [], orb_red: [], orb_silver: [], snow: [], cane: [], photo_placeholder: []
      };
      particles.forEach(p => {
          if (g[p.type]) g[p.type].push(p);
      });
      return g;
  }, [particles]);
  
  // --- Refs for Interaction Logic ---
  const containerRotation = useRef(new THREE.Euler(0, 0, 0));
  const prevHandPos = useRef({ x: 0, y: 0 });
  const wasTrackingRef = useRef(false);
  const isExplodedRef = useRef(false);

  useFrame((state, delta) => {
     const { hasHand, isOpen, isClosed, palmPosition } = handData.current;
     
     // --- SHAPE STATE MACHINE ---
     if (hasHand) {
         if (isOpen) isExplodedRef.current = true;
         if (isClosed) isExplodedRef.current = false;
     }

     // --- ROTATION CONTROL: DIRECT & TIGHT ---
     if (hasHand) {
         // Reset reference if just started tracking
         if (!wasTrackingRef.current) {
             prevHandPos.current = { x: palmPosition.x, y: palmPosition.y };
             wasTrackingRef.current = true;
         }

         // Calculate raw Delta
         const dx = palmPosition.x - prevHandPos.current.x;
         const dy = palmPosition.y - prevHandPos.current.y;
         
         // DEADZONE LOGIC
         // Ignore micro-movements (jitter) from the camera
         // Only rotate if movement is significant
         const DEADZONE = 0.003; 

         if (Math.abs(dx) > DEADZONE || Math.abs(dy) > DEADZONE) {
             const sensitivity = 0.8; // Lower sensitivity for "heavier", controlled feel
             
             if (isClosed) {
                 // FIST: Y-axis only
                 containerRotation.current.y += dx * sensitivity;
                 containerRotation.current.x = THREE.MathUtils.lerp(containerRotation.current.x, 0, 0.1);
             } else if (isOpen) {
                 // OPEN: 2-Axis rotation
                 containerRotation.current.x += dy * sensitivity;
                 containerRotation.current.y += dx * sensitivity;
             }
         }
         
         // Always update prev pos, so we track relative movement from current frame
         prevHandPos.current = { x: palmPosition.x, y: palmPosition.y };

     } else {
         wasTrackingRef.current = false;
     }

     // FIXED: Auto-level tree when in tree mode
     // If not exploded (i.e. Tree Shape), gently bring X/Z rotation to 0 to stand upright
     if (!isExplodedRef.current) {
        // Use a lerp factor to smoothly right the ship
        // 5% correction per frame ensures it stands up within a second or so
        containerRotation.current.x = THREE.MathUtils.lerp(containerRotation.current.x, 0, 0.05);
        containerRotation.current.z = THREE.MathUtils.lerp(containerRotation.current.z, 0, 0.05);
     }
  });

  return (
    <group>
        {template === TemplateType.TREE && <TopStar rotationRef={containerRotation} />}
        
        {/* Only render subsystems if they have data to avoid empty mesh errors */}
        {groups.foliage.length > 0 && <SubSystem data={groups.foliage} geometry={foliageGeo} isExplodedRef={isExplodedRef} type="foliage" rotationRef={containerRotation} />}
        {groups.orb_gold.length > 0 && <SubSystem data={groups.orb_gold} geometry={orbGeo} isExplodedRef={isExplodedRef} type="orb_gold" rotationRef={containerRotation} />}
        {groups.orb_red.length > 0 && <SubSystem data={groups.orb_red} geometry={orbGeo} isExplodedRef={isExplodedRef} type="orb_red" rotationRef={containerRotation} />}
        {groups.orb_silver.length > 0 && <SubSystem data={groups.orb_silver} geometry={orbGeo} isExplodedRef={isExplodedRef} type="orb_silver" rotationRef={containerRotation} />}
        {groups.snow.length > 0 && <SubSystem data={groups.snow} geometry={snowGeo} isExplodedRef={isExplodedRef} type="snow" texture={snowTex} rotationRef={containerRotation} />}
        {groups.cane.length > 0 && <SubSystem data={groups.cane} geometry={caneGeo} isExplodedRef={isExplodedRef} type="cane" rotationRef={containerRotation} />}
        
        {groups.photo_placeholder.length > 0 && 
            <PhotoGroup 
                data={groups.photo_placeholder} 
                textures={userTextures} 
                handData={handData} 
                rotationRef={containerRotation}
                isExplodedRef={isExplodedRef}
            />
        }
    </group>
  );
};

const SubSystem = ({ 
    data, 
    geometry, 
    isExplodedRef, 
    type, 
    texture,
    rotationRef 
}: { 
    data: ParticleData[], 
    geometry: THREE.BufferGeometry, 
    isExplodedRef: React.MutableRefObject<boolean>, 
    type: string, 
    texture?: THREE.Texture,
    rotationRef: React.MutableRefObject<THREE.Euler>
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const currentPositions = useMemo(() => new Float32Array(data.length * 3), [data]);
    
    useEffect(() => {
        data.forEach((p, i) => {
            currentPositions[i*3] = p.treePos.x;
            currentPositions[i*3+1] = p.treePos.y;
            currentPositions[i*3+2] = p.treePos.z;
            
            tempColor.set(p.color);
            if (meshRef.current) meshRef.current.setColorAt(i, tempColor);
        });
        
        // Safety check: ensure instanceColor exists before setting needsUpdate
        if (meshRef.current && meshRef.current.instanceColor) {
            meshRef.current.instanceColor.needsUpdate = true;
        }
    }, [data, currentPositions]);

    useFrame((state) => {
        if (!meshRef.current) return;
        
        const isExploded = isExplodedRef.current;
        const time = state.clock.getElapsedTime();
        const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(rotationRef.current);

        for (let i = 0; i < data.length; i++) {
            const p = data[i];
            
            // 1. Calculate Local Target Position
            if (isExploded) {
                targetPos.copy(p.spherePos);
            } else {
                targetPos.copy(p.treePos);
                targetPos.y += Math.sin(time * 1.5 + i) * 0.05;
            }

            // 2. Smooth Interpolation
            const ix = i * 3;
            const iy = i * 3 + 1;
            const iz = i * 3 + 2;
            const lerpFactor = 0.08; 
            currentPositions[ix] += (targetPos.x - currentPositions[ix]) * lerpFactor;
            currentPositions[iy] += (targetPos.y - currentPositions[iy]) * lerpFactor;
            currentPositions[iz] += (targetPos.z - currentPositions[iz]) * lerpFactor;

            // 3. Apply Global Rotation
            tempObject.position.set(currentPositions[ix], currentPositions[iy], currentPositions[iz]);
            tempObject.position.applyMatrix4(rotMatrix);
            
            tempObject.scale.setScalar(p.scale);
            
            // 4. Handle Individual Rotation
            const baseQ = new THREE.Quaternion().setFromEuler(p.rotationOffset);
            
            if (type === 'cane') {
                 const animQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, time, 0));
                 tempObject.quaternion.copy(new THREE.Quaternion().setFromEuler(rotationRef.current).multiply(baseQ).multiply(animQ));
            } else if (type === 'snow') {
                 tempObject.quaternion.copy(state.camera.quaternion);
                 tempObject.rotateZ(time);
            } else {
                 tempObject.quaternion.copy(new THREE.Quaternion().setFromEuler(rotationRef.current).multiply(baseQ));
            }
            
            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);
        }
        
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    let matProps: any = {};
    switch (type) {
        case 'orb_gold':
            matProps = { 
                color: "#FFD700", // Standard Gold
                metalness: 1.0, 
                roughness: 0.15, // Shiny but not mirror
                emissive: "#B8860B", // Dark Goldenrod for slight self-illumination
                emissiveIntensity: 0.4
            };
            break;
        case 'orb_red':
             matProps = { color: "#FF0000", metalness: 0.6, roughness: 0.2, emissive: "#880000", emissiveIntensity: 0.5 };
             break;
        case 'orb_silver':
             matProps = { color: "#FFFFFF", metalness: 1.0, roughness: 0.1, emissive: "#444444", emissiveIntensity: 0.3 };
             break;
        case 'foliage':
             matProps = { color: "#2E8B57", metalness: 0.1, roughness: 0.8 }; 
             break;
        case 'snow':
             matProps = { map: texture, transparent: true, opacity: 1.0, color: "#FFFFFF", depthWrite: false, side: THREE.DoubleSide };
             break;
        case 'cane':
             matProps = { color: "#FF0000", metalness: 0.2, roughness: 0.4 }; 
             break;
        default:
             matProps = { color: "#FFFFFF" };
    }

    return (
        <instancedMesh ref={meshRef} args={[geometry, undefined, data.length]}>
            <meshStandardMaterial {...matProps} />
        </instancedMesh>
    );
};

export default ParticleSystem;