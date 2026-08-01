import { CalendarCheck2, CarFront, LockKeyholeOpen, TrainFront } from 'lucide-react';

interface JourneyStripProps {
  activeStep?: number;
}

const steps = [
  { label: 'Reserve', helper: 'Secure your bay', icon: CalendarCheck2 },
  { label: 'Arrive', helper: 'Follow the route', icon: CarFront },
  { label: 'Unlock', helper: 'Access your bay', icon: LockKeyholeOpen },
  { label: 'Ride', helper: 'Continue by rail', icon: TrainFront },
];

export default function JourneyStrip({ activeStep = 0 }: JourneyStripProps) {
  return (
    <ol className="journey-strip" aria-label="Parking journey">
      {steps.map(({ label, helper, icon: Icon }, index) => (
        <li key={label} className={index <= activeStep ? 'is-active' : ''} aria-current={index === activeStep ? 'step' : undefined}>
          <span className="journey-strip__icon"><Icon size={18} /></span>
          <span>
            <strong>{label}</strong>
            <small>{helper}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
