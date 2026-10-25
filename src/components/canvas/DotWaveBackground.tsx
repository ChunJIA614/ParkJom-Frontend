import { useEffect, useRef, memo } from 'react';
import { InteractiveDotWave, type DotWaveOptions } from './InteractiveDotWave';

export interface DotWaveBackgroundProps extends Partial<DotWaveOptions> {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * DotWaveBackground
 *
 * Production-ready React component mounting the high-performance
 * InteractiveDotWave 3D Transit Matrix Canvas engine.
 */
export const DotWaveBackground = memo(function DotWaveBackground({
  className = '',
  style,
  ...options
}: DotWaveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<InteractiveDotWave | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new InteractiveDotWave(canvas, options);
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Update options if props change dynamically
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateOptions(options);
    }
  }, [options]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none z-0 ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        tabIndex={-1}
      />
    </div>
  );
});

export default DotWaveBackground;
