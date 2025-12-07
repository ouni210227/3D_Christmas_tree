import React, { useState, useRef, Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, Sparkles } from '@react-three/drei';
import { Upload, Maximize, Hand, Info, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import * as THREE from 'three';
import clsx from 'clsx';

import { TemplateType, HandData } from './types';
import ParticleSystem from './components/ParticleSystem';
import HandTracker from './components/HandTracker';

export interface UserTexture {
  texture: THREE.Texture;
  aspect: number;
}

function App() {
  const [userTextures, setUserTextures] = useState<UserTexture[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [handStatus, setHandStatus] = useState<string>("Searching for Hand...");
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handDataRef = useRef<HandData>({
    hasHand: false,
    isOpen: false,
    isClosed: false,
    pinchDistance: 1,
    isPinching: false,
    palmPosition: { x: 0, y: 0, z: 0 }
  });

  const handleHandUpdate = useCallback((data: HandData) => {
    handDataRef.current = data;
    
    let status = "Searching for Hand...";
    
    if (data.hasHand) {
        status = "Hand Detected: Relaxed";
        if (data.isPinching) status = "👌 Pinch: Viewing Photo";
        else if (data.isClosed) status = "✊ Fist: Rotating Tree";
        else if (data.isOpen) status = "🖐 Open: Exploding & Spinning";
    }
    
    setHandStatus(status);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsProcessing(true); // Start Loading UI
      
      const filesToLoad = Array.from(files).slice(0, 10) as File[];
      const loader = new THREE.TextureLoader();
      
      const promises = filesToLoad.map(file => {
        return new Promise<UserTexture>((resolve) => {
          const url = URL.createObjectURL(file);
          loader.load(url, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            const image = tex.image;
            const aspect = image.width / image.height;
            resolve({ texture: tex, aspect });
          });
        });
      });

      Promise.all(promises).then(textures => {
        setUserTextures(textures);
        setIsPanelExpanded(false); // Collapse controls
        setIsProcessing(false);    // End Loading UI
      });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black via-[#0a0a0a] to-[#1a1a05]">
        <Canvas camera={{ position: [0, 1, 14], fov: 40 }} dpr={[1, 2]}>
          <Suspense fallback={null}>
            <ambientLight intensity={1.5} />
            <pointLight position={[5, 8, 8]} intensity={3} color="#FFD700" distance={30} decay={2} />
            <directionalLight position={[0, 5, 10]} intensity={2} color="#FFFFFF" />
            <spotLight position={[-10, 5, -5]} angle={0.5} intensity={2} color="#FF4500" />
            
            <Environment preset="city" background={false} />
            
            <ParticleSystem template={TemplateType.TREE} handData={handDataRef} userTextures={userTextures} />
            
            <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />
            <Sparkles count={100} scale={12} size={6} speed={0.4} opacity={0.5} color="#FFF" />
            
            <OrbitControls 
                enableZoom={true} 
                enablePan={false} 
                maxPolarAngle={Math.PI / 1.4} 
                minPolarAngle={Math.PI / 3}
                autoRotate={!handDataRef.current.hasHand}
                autoRotateSpeed={0.5}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Cinematic Title Overlay */}
      <div className="absolute top-[12%] left-0 right-0 text-center pointer-events-none z-0">
        <h1 className="font-christmas text-4xl md:text-7xl text-[#FFD700] tracking-widest drop-shadow-[0_0_20px_rgba(255,215,0,0.6)] opacity-100">
          MERRY CHRISTMAS
        </h1>
        <div className="w-32 h-[2px] bg-gradient-to-r from-transparent via-[#FFD700] to-transparent mx-auto mt-4 shadow-[0_0_10px_#FFD700]"></div>
      </div>

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300">
            <Loader2 className="w-16 h-16 text-[#FFD700] animate-spin mb-6" />
            <h2 className="text-2xl font-christmas text-white tracking-widest mb-2">PROCESSING MEMORIES</h2>
            <p className="text-white/60 text-sm">Converting photos into 3D particles...</p>
        </div>
      )}

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Top Bar */}
        <div className="flex justify-between items-start pointer-events-auto">
          {/* Status Badge */}
          <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/20 text-white shadow-2xl">
            <div className="flex items-center gap-3">
               <div className={clsx("w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]", 
                  handStatus.includes("Searching") ? "bg-red-500 animate-pulse" :
                  handStatus.includes("Pinch") ? "bg-purple-500 text-purple-500 animate-pulse" :
                  handStatus.includes("Fist") ? "bg-red-500 text-red-500" :
                  handStatus.includes("Open") ? "bg-green-500 text-green-500" : 
                  "bg-blue-400 text-blue-400"
                )}></div>
               <span className="text-sm font-medium tracking-wide text-gray-200 uppercase">{handStatus}</span>
            </div>
          </div>

          <button 
            onClick={toggleFullscreen}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all border border-white/20 text-white hover:text-[#FFD700]"
          >
            <Maximize size={20} />
          </button>
        </div>

        {/* Bottom Left Collapsible Controls */}
        <div className="pointer-events-auto flex flex-col items-start max-w-sm w-full relative">
            
            {/* Toggle Arrow (Always visible, sits on top of the panel) */}
            <button 
                onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                className="mb-2 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-white/80 hover:text-white transition-all shadow-lg"
                title={isPanelExpanded ? "Minimize Controls" : "Show Controls"}
            >
                {isPanelExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>

            {/* Expandable Panel Content */}
            <div className={clsx(
                "w-full flex flex-col gap-3 overflow-hidden transition-all duration-300 ease-in-out origin-bottom",
                isPanelExpanded ? "max-h-[400px] opacity-100 scale-100" : "max-h-0 opacity-0 scale-95"
            )}>
                {/* Guide */}
                <div className="bg-black/70 backdrop-blur-md p-4 rounded-xl border border-white/20 text-gray-200 text-xs shadow-xl">
                    <div className="flex items-center gap-2 mb-3 font-bold text-[#FFD700] uppercase tracking-wider">
                        <Info size={14} /> Controls
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 bg-white/5 p-2 rounded border border-white/5"><Hand size={14} className="rotate-90 text-red-400"/> ✊ Fist: Rotate</div>
                        <div className="flex items-center gap-2 bg-white/5 p-2 rounded border border-white/5">🖐 Open: Explode</div>
                        <div className="flex items-center gap-2 bg-white/5 p-2 rounded col-span-2 border border-white/5">👌 Pinch: View Photo</div>
                    </div>
                </div>

                {/* Upload Button */}
                <label className="cursor-pointer group block">
                    <div className="bg-gradient-to-r from-[#FFD700]/10 to-[#FFA500]/10 hover:from-[#FFD700]/20 hover:to-[#FFA500]/20 backdrop-blur-md p-4 rounded-xl border border-[#FFD700]/50 text-center transition-all flex items-center justify-center gap-3 text-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                        <Upload size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-bold tracking-widest text-sm">ADD PHOTOS</span>
                    </div>
                    <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
                </label>
            </div>
        </div>
      </div>

      <HandTracker onHandUpdate={handleHandUpdate} />
    </div>
  );
}

export default App;