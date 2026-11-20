import { useState } from 'react';
import { Car } from 'lucide-react';

export default function ParkingPhoto({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);

  return src && !failed ? (
    <img src={src} alt="" className="parking-photo h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className="parking-photo grid h-full place-content-center justify-items-center gap-2 text-sm text-muted-foreground">
      <Car size={24} aria-hidden="true" />
      <span>No photo available</span>
    </div>
  );
}
