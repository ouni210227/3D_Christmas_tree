import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandData } from '../types';
import { Camera, AlertCircle, X, CameraOff } from 'lucide-react';

interface HandTrackerProps {
  onHandUpdate: (data: HandData) => void;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onHandUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastVideoTime = useRef(-1);
  const lastProcessTime = useRef(0);
  const requestRef = useRef<number>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [showOverlay, setShowOverlay] = useState(true); 
  
  // Smoothing vars
  const smoothedRef = useRef({ x: 0, y: 0, pinch: 1 });
  
  // State persistence
  const persistenceRef = useRef({
    fistFrames: 0,
    pinchFrames: 0,
    openFrames: 0,
    lastState: 'NEUTRAL' 
  });

  // GRACE PERIOD CONFIGURATION
  const GRACE_LIMIT = 40; 
  const missingHandFramesRef = useRef(0);
  
  const lastValidHandDataRef = useRef<HandData>({
    hasHand: false,
    isOpen: false,
    isClosed: false,
    isPinching: false,
    pinchDistance: 1,
    palmPosition: { x: 0, y: 0, z: 0 }
  });

  // 1. Initialize MediaPipe
  useEffect(() => {
    let active = true;
    const initVision = async () => {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );
            if (!active) return;
            const landmarkAgent = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1,
                minHandDetectionConfidence: 0.5, 
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            if (active) setHandLandmarker(landmarkAgent);
        } catch (e) {
            console.error(e);
            if (active) setError("Failed to load AI model.");
        }
    };
    initVision();
    return () => { active = false; };
  }, []);

  // 2. Start Camera Function
  const startCamera = async () => {
      setError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError("Camera not supported on this browser.");
          return;
      }
      
      try {
        // DETECT DEVICE TYPE FOR ROBUSTNESS
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Mobile: Try strict User Facing. Desktop: Just use default (works 99% of time).
        const constraints = {
            video: isMobile 
                ? { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } }
                : true 
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for video to be ready
          videoRef.current.onloadeddata = () => {
              setIsStreaming(true);
              setShowOverlay(false); 
              predict();
          };
        }
      } catch (err: any) {
        console.error("Camera Init Error:", err);
        setError("Could not access camera. Please check permissions.");
      }
  };

  // 3. Auto-start attempt
  useEffect(() => {
      if (handLandmarker && !isStreaming && !error && showOverlay) {
          startCamera();
      }
  }, [handLandmarker]);

  // 4. Prediction Loop
  const predict = () => {
      const now = performance.now();
      if (now - lastProcessTime.current < 30) {
          requestRef.current = requestAnimationFrame(predict);
          return;
      }
      lastProcessTime.current = now;

      if (handLandmarker && videoRef.current && !videoRef.current.paused && videoRef.current.readyState === 4) {
          try {
             if (videoRef.current.currentTime !== lastVideoTime.current) {
                lastVideoTime.current = videoRef.current.currentTime;
                const results = handLandmarker.detectForVideo(videoRef.current, now);
                
                let rawX = 0;
                let rawY = 0;
                let targetPinch = 1;

                let frameIsFist = false;
                let frameIsPinch = false;
                let frameIsOpen = false;
                let hasHand = false;

                if (results.landmarks && results.landmarks.length > 0) {
                  hasHand = true;
                  missingHandFramesRef.current = 0;

                  const lm = results.landmarks[0];
                  const d = (i: number, j: number) => Math.hypot(lm[i].x - lm[j].x, lm[i].y - lm[j].y, lm[i].z - lm[j].z);

                  rawX = (0.5 - lm[0].x) * 6; 
                  rawY = (0.5 - lm[0].y) * 6;
                  const palmScale = d(0, 9);

                  if (palmScale > 0) {
                      const pinchDist = d(4, 8);
                      const normPinch = pinchDist / palmScale;
                      targetPinch = Math.min(Math.max(normPinch, 0), 1);

                      const tips = [8, 12, 16, 20];
                      let foldedCount = 0;
                      let extendedCount = 0;

                      tips.forEach(t => {
                          const dist = d(0, t);
                          if (dist < palmScale * 1.4) foldedCount++; 
                          if (dist > palmScale * 1.7) extendedCount++;
                      });

                      const middleFingerDist = d(0, 12);
                      const isMiddleExtended = middleFingerDist > palmScale * 1.5;

                      if (foldedCount >= 3) {
                          frameIsFist = true;
                      } else if (extendedCount >= 3) {
                          frameIsOpen = true;
                      } else if (normPinch < 0.5 && isMiddleExtended) {
                          frameIsPinch = true;
                      }
                  }
                }

                if (hasHand) {
                    const p = persistenceRef.current;
                    const THRESHOLD = 3; 

                    if (frameIsFist) p.fistFrames++; else p.fistFrames = 0;
                    if (frameIsPinch) p.pinchFrames++; else p.pinchFrames = 0;
                    if (frameIsOpen) p.openFrames++; else p.openFrames = 0;

                    let finalState = p.lastState;

                    if (p.pinchFrames > THRESHOLD) finalState = 'PINCH';
                    else if (p.fistFrames > THRESHOLD) finalState = 'FIST';
                    else if (p.openFrames > THRESHOLD) finalState = 'OPEN';
                    else {
                        if (p.fistFrames === 0 && p.pinchFrames === 0 && p.openFrames === 0) {
                             finalState = 'NEUTRAL';
                        }
                    }
                    p.lastState = finalState;

                    const alpha = 0.3;
                    smoothedRef.current.x += (rawX - smoothedRef.current.x) * alpha;
                    smoothedRef.current.y += (rawY - smoothedRef.current.y) * alpha;
                    smoothedRef.current.pinch += (targetPinch - smoothedRef.current.pinch) * alpha;

                    const newData: HandData = {
                        hasHand: true,
                        isOpen: finalState === 'OPEN',
                        isClosed: finalState === 'FIST',
                        isPinching: finalState === 'PINCH',
                        pinchDistance: smoothedRef.current.pinch,
                        palmPosition: { x: smoothedRef.current.x, y: smoothedRef.current.y, z: 0 }
                    };

                    lastValidHandDataRef.current = newData;
                    onHandUpdate(newData);

                } else {
                    missingHandFramesRef.current++;
                    if (missingHandFramesRef.current < GRACE_LIMIT) {
                        onHandUpdate(lastValidHandDataRef.current);
                    } else {
                        persistenceRef.current.lastState = 'NEUTRAL';
                        const resetData: HandData = {
                            hasHand: false,
                            isOpen: false,
                            isClosed: false,
                            isPinching: false,
                            pinchDistance: 1,
                            palmPosition: { x: 0, y: 0, z: 0 } 
                        };
                        onHandUpdate(resetData);
                    }
                }
             }
          } catch (e) { }
      }
      requestRef.current = requestAnimationFrame(predict);
    };

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

  return (
    <>
        {/* SINGLE VIDEO ELEMENT - Critical for compatibility */}
        <video 
            ref={videoRef} 
            className="fixed bottom-4 right-4 z-50 w-24 h-16 rounded-lg overflow-hidden border border-white/10 opacity-30 pointer-events-none bg-black object-cover transform -scale-x-100" 
            autoPlay 
            playsInline 
            muted 
        />
        
        {/* Start / Error Overlay */}
        {(!isStreaming && showOverlay) && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/20 shadow-2xl max-w-sm w-full text-center relative">
                    
                    <button 
                        onClick={() => setShowOverlay(false)}
                        className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                        <X size={24} />
                    </button>

                    {error ? (
                        <>
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Camera Issue</h3>
                            <p className="text-gray-400 mb-6 text-sm">{error}</p>
                            <button 
                                onClick={() => startCamera()}
                                className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Try Again
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-[#FFD700]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#FFD700]">
                                <Camera size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Enable Hand Tracking</h3>
                            <p className="text-gray-400 mb-6 text-sm">
                                Use your camera to control the 3D particles.
                                <br/>
                                <span className="text-xs opacity-60 block mt-2">Connecting...</span>
                            </p>
                            <button 
                                onClick={() => startCamera()}
                                disabled={!handLandmarker}
                                className="w-full py-3 bg-[#FFD700] text-black font-bold rounded-xl hover:bg-[#FDB931] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {handLandmarker ? "Start Experience" : "Loading AI Model..."}
                            </button>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* Floating Re-Open Button */}
        {(!isStreaming && !showOverlay) && (
            <button
                onClick={() => setShowOverlay(true)}
                className="fixed bottom-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-white transition-all shadow-lg hover:scale-110"
            >
                <CameraOff size={24} />
            </button>
        )}
    </>
  );
};

export default HandTracker;