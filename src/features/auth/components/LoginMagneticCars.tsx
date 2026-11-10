import { useEffect, useRef } from 'react';
import { InteractiveDotWave } from '@/components/canvas/InteractiveDotWave';

export default function LoginMagneticCars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new InteractiveDotWave(canvas, {
      transparent: true,
      mode: 'cars',
      carScale: 1.65,
      interactionRadius: 290,
      magneticPullXY: 66,
      magneticPullZ: 110,
      waveAmplitudeY: 3,
      waveAmplitudeZ: 0,
      glowEnabled: false,
    });
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => {
      if (document.hidden) engine.stop();
      else engine.setReducedMotion(motion.matches);
    };
    syncMotion();
    motion.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncMotion);
    return () => {
      motion.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncMotion);
      engine.destroy();
    };
  }, []);

  return <div className="login-cars-layer" aria-hidden="true"><canvas ref={canvasRef} tabIndex={-1} /></div>;
}
