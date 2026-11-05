import React from 'react';
import { Car, MapPin } from 'lucide-react';

interface GracePeriodRoadAnimationProps {
  graceProgress: number;
  isFinalizingBooking: boolean;
  destinationName: string;
}

export const GracePeriodRoadAnimation: React.FC<GracePeriodRoadAnimationProps> = ({
  graceProgress,
  isFinalizingBooking,
  destinationName,
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto my-auto py-8 sm:py-12 select-none">
      {/* ── Scenery Container (Skyline + Roadside Trees & Streetlamps) ── */}
      <div
        className="relative w-full h-28 sm:h-32 overflow-hidden flex items-end pointer-events-none"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        }}
      >
        {/* 1. Skyline Silhouette Layer (Far City - Slow 24s Continuous Parallax) */}
        <div className="absolute inset-x-0 bottom-3 pointer-events-none">
          <div className="animate-drive-skyline">
            {[0, 1].map((copyIndex) => (
              <svg
                key={`skyline-tile-${copyIndex}`}
                className="shrink-0 h-24 sm:h-28 w-[700px] sm:w-[850px] text-white"
                viewBox="0 0 800 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id={`skyline-grad-${copyIndex}`} x1="0" y1="0" x2="0" y2="100">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.08" />
                  </linearGradient>
                  <linearGradient id={`skyline-far-${copyIndex}`} x1="0" y1="0" x2="0" y2="100">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.03" />
                  </linearGradient>
                </defs>

                {/* Background Silhouette (Far layer) */}
                <g fill={`url(#skyline-far-${copyIndex})`}>
                  <rect x="0" y="45" width="30" height="55" rx="2" />
                  <rect x="65" y="25" width="45" height="75" rx="3" />
                  <polygon points="87.5,12 86,25 89,25" />
                  <rect x="170" y="35" width="38" height="65" rx="2" />
                  <rect x="230" y="18" width="50" height="82" rx="3" />
                  <line x1="255" y1="18" x2="255" y2="6" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                  <rect x="330" y="40" width="42" height="60" rx="2" />
                  <rect x="420" y="20" width="55" height="80" rx="3" />
                  <rect x="520" y="30" width="36" height="70" rx="2" />
                  <rect x="600" y="15" width="48" height="85" rx="3" />
                  <line x1="624" y1="15" x2="624" y2="4" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                  <rect x="690" y="38" width="40" height="62" rx="2" />
                  <rect x="760" y="28" width="40" height="72" rx="3" />
                </g>

                {/* Midground Silhouette (Main Architectural Tier) */}
                <g fill={`url(#skyline-grad-${copyIndex})`}>
                  {/* Building 1 - Tiered residential */}
                  <rect x="25" y="40" width="42" height="60" rx="3" />
                  <rect x="32" y="32" width="28" height="8" rx="2" />

                  {/* Building 2 - Tech campus pavilion */}
                  <rect x="80" y="55" width="48" height="45" rx="2.5" />

                  {/* Building 3 - Skyscraper with stepped crown */}
                  <rect x="138" y="20" width="56" height="80" rx="3" />
                  <rect x="146" y="10" width="40" height="10" rx="2" />
                  <rect x="156" y="4" width="20" height="6" rx="1.5" />
                  <line x1="166" y1="4" x2="166" y2="0" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                  <circle cx="166" cy="0" r="1.5" fill="#EF4444" />

                  {/* Building 4 - Slender tower */}
                  <rect x="204" y="42" width="36" height="58" rx="2.5" />

                  {/* Building 5 - Stepped mid-rise */}
                  <rect x="250" y="35" width="44" height="65" rx="3" />

                  {/* Building 6 - Landmark Spire Tower */}
                  <rect x="304" y="24" width="52" height="76" rx="3" />
                  <polygon points="330,8 322,24 338,24" />
                  <line x1="330" y1="8" x2="330" y2="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />

                  {/* Building 7 - Commercial office */}
                  <rect x="366" y="48" width="40" height="52" rx="2" />

                  {/* Building 8 - Tall Corporate HQ */}
                  <rect x="416" y="16" width="58" height="84" rx="3" />
                  <rect x="426" y="8" width="38" height="8" rx="2" />
                  <line x1="445" y1="8" x2="445" y2="0" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                  <circle cx="445" cy="0" r="1.5" fill="#EF4444" />

                  {/* Building 9 - Minimalist cube tower */}
                  <rect x="484" y="46" width="34" height="54" rx="2" />

                  {/* Building 10 - Contemporary angled block */}
                  <rect x="528" y="32" width="46" height="68" rx="3" />

                  {/* Building 11 - Medium rise */}
                  <rect x="584" y="50" width="38" height="50" rx="2" />

                  {/* Building 12 - High-rise landmark */}
                  <rect x="632" y="22" width="54" height="78" rx="3" />
                  <line x1="659" y1="22" x2="659" y2="8" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />

                  {/* Building 13 - Residential tower */}
                  <rect x="696" y="44" width="42" height="56" rx="2.5" />

                  {/* Building 14 - Edge transition block */}
                  <rect x="748" y="36" width="36" height="64" rx="2.5" />
                </g>

                {/* Subtle Ambient Architectural Windows */}
                <g>
                  {/* Building 1 windows */}
                  <rect x="32" y="46" width="5" height="3" rx="0.8" fill="#FDE047" opacity="0.35" />
                  <rect x="42" y="46" width="5" height="3" rx="0.8" fill="#FDE047" opacity="0.35" />
                  <rect x="52" y="46" width="5" height="3" rx="0.8" fill="#FFFFFF" opacity="0.2" />
                  <rect x="32" y="56" width="5" height="3" rx="0.8" fill="#FFFFFF" opacity="0.2" />
                  <rect x="42" y="56" width="5" height="3" rx="0.8" fill="#FDE047" opacity="0.35" />
                  <rect x="52" y="56" width="5" height="3" rx="0.8" fill="#FDE047" opacity="0.35" />

                  {/* Building 3 windows */}
                  <rect x="146" y="28" width="6" height="4" rx="0.8" fill="#FDE047" opacity="0.35" />
                  <rect x="156" y="28" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />
                  <rect x="166" y="28" width="6" height="4" rx="0.8" fill="#FDE047" opacity="0.35" />
                  <rect x="176" y="28" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />
                  <rect x="146" y="40" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />
                  <rect x="156" y="40" width="6" height="4" rx="0.8" fill="#FDE047" opacity="0.35" />
                  <rect x="166" y="40" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />
                  <rect x="176" y="40" width="6" height="4" rx="0.8" fill="#FDE047" opacity="0.35" />

                  {/* Building 6 windows */}
                  <rect x="314" y="34" width="5" height="3" rx="0.8" fill="#FDE047" opacity="0.3" />
                  <rect x="324" y="34" width="5" height="3" rx="0.8" fill="#FFFFFF" opacity="0.2" />
                  <rect x="334" y="34" width="5" height="3" rx="0.8" fill="#FDE047" opacity="0.3" />
                  <rect x="314" y="46" width="5" height="3" rx="0.8" fill="#FFFFFF" opacity="0.2" />
                  <rect x="324" y="46" width="5" height="3" rx="0.8" fill="#FDE047" opacity="0.3" />

                  {/* Building 8 windows */}
                  <rect x="426" y="26" width="6" height="4" rx="0.8" fill="#FDE047" opacity="0.35" />
                  <rect x="436" y="26" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />
                  <rect x="446" y="26" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />
                  <rect x="456" y="26" width="6" height="4" rx="0.8" fill="#FDE047" opacity="0.35" />
                  <rect x="426" y="38" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />
                  <rect x="436" y="38" width="6" height="4" rx="0.8" fill="#FDE047" opacity="0.35" />
                  <rect x="456" y="38" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />

                  {/* Building 12 windows */}
                  <rect x="642" y="32" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />
                  <rect x="652" y="32" width="6" height="4" rx="0.8" fill="#FDE047" opacity="0.3" />
                  <rect x="662" y="32" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />
                  <rect x="642" y="44" width="6" height="4" rx="0.8" fill="#FDE047" opacity="0.3" />
                  <rect x="652" y="44" width="6" height="4" rx="0.8" fill="#FFFFFF" opacity="0.25" />
                </g>
              </svg>
            ))}
          </div>
        </div>

        {/* 2. Roadside Greenery & Streetlamps Layer (Brisk 9s Continuous Parallax) */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none">
          <div className="animate-drive-trees">
            {[0, 1].map((copyIndex) => (
              <svg
                key={`foliage-tile-${copyIndex}`}
                className="shrink-0 h-12 sm:h-14 w-[700px] sm:w-[850px]"
                viewBox="0 0 800 55"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Streetlamp Warm Light Beam Gradient */}
                  <linearGradient id={`lamp-cone-${copyIndex}`} x1="0" y1="0" x2="0" y2="100%">
                    <stop offset="0%" stopColor="#FDE047" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#FDE047" stopOpacity="0" />
                  </linearGradient>
                  {/* Tree Foliage Dual Tones */}
                  <linearGradient id={`tree-emerald-${copyIndex}`} x1="0" y1="0" x2="0" y2="100%">
                    <stop offset="0%" stopColor="#34D399" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id={`tree-mint-${copyIndex}`} x1="0" y1="0" x2="0" y2="100%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#047857" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id={`tree-cypress-${copyIndex}`} x1="0" y1="0" x2="0" y2="100%">
                    <stop offset="0%" stopColor="#059669" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#064E3B" stopOpacity="0.85" />
                  </linearGradient>
                </defs>

                {/* Verge Base Trim */}
                <path
                  d="M0 55 C 50 53, 100 54, 150 55 C 200 53, 250 54, 300 55 C 350 53, 400 54, 450 55 C 500 53, 550 54, 600 55 C 650 53, 700 54, 750 55 C 780 54, 800 55, 800 55 Z"
                  fill="#047857"
                  opacity="0.3"
                />

                {/* Tree 1: Broadleaf Oak Tree (x: 25) */}
                <g transform="translate(25, 6)">
                  <path d="M17 48 L17 30 Q17 26 19 24 Q21 26 21 30 L21 48 Z" fill="#64748B" />
                  <path
                    d="M19 4 C 13 4, 8 8, 8 14 C 4 15, 2 19, 2 23 C 2 28, 6 32, 11 32 C 13 32, 15 31, 16.5 30 C 18 33, 21 34, 24 33 C 28 33, 31 30, 32 27 C 35 26, 37 23, 37 19 C 37 15, 34 11, 29 11 C 28.5 7, 24 4, 19 4 Z"
                    fill={`url(#tree-emerald-${copyIndex})`}
                  />
                  <circle cx="19" cy="18" r="7" fill="#6EE7B7" opacity="0.3" />
                </g>

                {/* Streetlamp 1 (x: 105) */}
                <g transform="translate(105, 4)">
                  <polygon points="19,8 5,50 33,50" fill={`url(#lamp-cone-${copyIndex})`} />
                  <path d="M6 50 L6 10 Q6 4 14 4 L19 4" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                  <rect x="17" y="3" width="7" height="3" rx="1.5" fill="#E2E8F0" />
                  <circle cx="20.5" cy="6" r="1.5" fill="#FDE047" />
                </g>

                {/* Tree 2: Slender Cypress (x: 175) */}
                <g transform="translate(175, 4)">
                  <rect x="9" y="38" width="2.5" height="12" rx="1" fill="#64748B" />
                  <path
                    d="M10 2 C 6 8, 3 18, 3 28 C 3 35, 6 40, 10 40 C 14 40, 17 35, 17 28 C 17 18, 14 8, 10 2 Z"
                    fill={`url(#tree-cypress-${copyIndex})`}
                  />
                  <path
                    d="M10 5 C 7.5 10, 5 19, 5 28 C 5 33, 7.5 37, 10 37 C 12.5 37, 15 33, 15 28 C 15 19, 12.5 10, 10 5 Z"
                    fill="#34D399"
                    opacity="0.25"
                  />
                </g>

                {/* Roadside Bush / Hedge (x: 235) */}
                <g transform="translate(235, 34)">
                  <path
                    d="M0 18 Q 8 6, 16 12 Q 24 4, 32 10 Q 40 6, 48 18 Z"
                    fill={`url(#tree-mint-${copyIndex})`}
                    opacity="0.85"
                  />
                </g>

                {/* Tree 3: Rounded Linden Tree (x: 305) */}
                <g transform="translate(305, 8)">
                  <path d="M16 46 L16 28 Q16 24 18 22 Q20 24 20 28 L20 46 Z" fill="#64748B" />
                  <path
                    d="M18 3 C 12 3, 7 8, 7 14 C 3 16, 1 20, 1 24 C 1 29, 5 33, 10 33 C 12 33, 14 32, 15.5 31 C 17 34, 21 35, 24 33 C 28 33, 31 30, 32 26 C 35 25, 36 21, 36 18 C 36 13, 32 9, 27 9 C 26 5, 22 3, 18 3 Z"
                    fill={`url(#tree-mint-${copyIndex})`}
                  />
                  <circle cx="21" cy="16" r="6" fill="#A7F3D0" opacity="0.3" />
                </g>

                {/* Tree 4: Paired Evergreen & Low Bush (x: 395) */}
                <g transform="translate(395, 10)">
                  <polygon points="12,4 4,20 20,20" fill="#047857" opacity="0.75" />
                  <polygon points="12,12 2,28 22,28" fill="#047857" opacity="0.8" />
                  <polygon points="12,20 1,36 23,36" fill="#047857" opacity="0.85" />
                  <rect x="10.5" y="36" width="3" height="8" fill="#64748B" />
                  <circle cx="26" cy="34" r="8" fill={`url(#tree-emerald-${copyIndex})`} />
                </g>

                {/* Streetlamp 2 (x: 485) */}
                <g transform="translate(485, 4)">
                  <polygon points="19,8 5,50 33,50" fill={`url(#lamp-cone-${copyIndex})`} />
                  <path d="M6 50 L6 10 Q6 4 14 4 L19 4" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                  <rect x="17" y="3" width="7" height="3" rx="1.5" fill="#E2E8F0" />
                  <circle cx="20.5" cy="6" r="1.5" fill="#FDE047" />
                </g>

                {/* Tree 5: Spreading Elm Tree (x: 555) */}
                <g transform="translate(555, 6)">
                  <path d="M19 48 L19 28 Q19 24 21 22 Q23 24 23 28 L23 48 Z" fill="#64748B" />
                  <path
                    d="M21 3 C 14 3, 9 8, 9 14 C 4 15, 2 20, 2 24 C 2 30, 7 34, 12 34 C 14.5 34, 17 33, 18.5 31 C 20.5 34, 24 35, 27 34 C 32 34, 35 30, 36 27 C 39 26, 41 22, 41 18 C 41 13, 37 9, 31 9 C 30 5, 26 3, 21 3 Z"
                    fill={`url(#tree-emerald-${copyIndex})`}
                  />
                  <circle cx="25" cy="18" r="8" fill="#6EE7B7" opacity="0.25" />
                </g>

                {/* Tree 6: Slender Cypress with Companion Shrub (x: 655) */}
                <g transform="translate(655, 4)">
                  <rect x="9" y="38" width="2.5" height="12" rx="1" fill="#64748B" />
                  <path
                    d="M10 2 C 6 8, 3 18, 3 28 C 3 35, 6 40, 10 40 C 14 40, 17 35, 17 28 C 17 18, 14 8, 10 2 Z"
                    fill={`url(#tree-cypress-${copyIndex})`}
                  />
                  <circle cx="22" cy="42" r="6" fill="#10B981" opacity="0.8" />
                </g>

                {/* Verge Hedge Transition (x: 735) */}
                <g transform="translate(735, 32)">
                  <path
                    d="M0 20 Q 10 6, 20 12 Q 30 4, 40 12 Q 50 8, 60 20 Z"
                    fill={`url(#tree-mint-${copyIndex})`}
                    opacity="0.85"
                  />
                </g>
              </svg>
            ))}
          </div>
        </div>
      </div>

      {/* ── The Road Highway Progress Bar ── */}
      <div className="relative w-full h-14 sm:h-16 rounded-2xl bg-[#1c1c1e] overflow-hidden flex items-center shadow-2xl">
        {/* Road Shoulders (Solid white edges) */}
        <div className="absolute top-1.5 inset-x-0 h-0.5 bg-white/15" />
        <div className="absolute bottom-1.5 inset-x-0 h-0.5 bg-white/15" />

        {/* Dashed Center Road Markings with Hardware-Accelerated Continuous Motion */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 overflow-hidden pointer-events-none">
          <div
            className="animate-road-stripes h-full w-[calc(100%+80px)]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to right, rgba(255,255,255,0.35) 0, rgba(255,255,255,0.35) 20px, transparent 20px, transparent 40px)',
            }}
          />
        </div>

        {/* Travelled Lane Highlight (Apple Blue Progress) */}
        <div
          className="absolute inset-y-0 left-0 bg-[#007AFF]/20 transition-all duration-75 ease-linear pointer-events-none"
          style={{ width: `${Math.min(100, Math.max(0, graceProgress))}%` }}
        />

        {/* ── The Car Driving Forward (Facing Right with Subtle Suspension Bounce) ── */}
        <div
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75 ease-linear z-20"
          style={{
            left: `calc(${Math.min(88, Math.max(2, graceProgress))}% - 14px)`,
          }}
        >
          <div className="relative flex items-center animate-car-bounce">
            {/* Custom High-Fidelity SVG Car (Explicitly Facing Forward to Right) */}
            <svg
              width="48"
              height="28"
              viewBox="0 0 44 26"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_4px_12px_rgba(0,122,255,0.6)]"
            >
              {/* Car Body - Rear on Left, Front Hood on Right */}
              <path
                d="M4 14C4 12.8954 4.89543 12 6 12H11.5L16.2 6.4C16.697 5.80357 17.4326 5.45455 18.2121 5.45455H28.5C29.6046 5.45455 30.5 6.34998 30.5 7.45455V12H38C39.6569 12 41 13.3431 41 15V19C41 19.5523 40.5523 20 40 20H4C3.44772 20 3 19.5523 3 19V15C3 14.4477 3.44772 14 4 14Z"
                fill="#007AFF"
              />
              {/* Windows */}
              <path d="M17.5 7H22.5V11H14L17.5 7Z" fill="#E0F2FE" opacity="0.85" />
              <path d="M24.5 7H28.5C29.0523 7 29.5 7.44772 29.5 8V11H24.5V7Z" fill="#E0F2FE" opacity="0.85" />
              {/* Headlight on Front Right */}
              <path d="M40 14H41.5V17H40V14Z" fill="#FDE047" />
              {/* Wheels */}
              <circle cx="12" cy="20" r="4" fill="#0A0A0C" stroke="#94A3B8" strokeWidth="1.2" />
              <circle cx="32" cy="20" r="4" fill="#0A0A0C" stroke="#94A3B8" strokeWidth="1.2" />
              <circle cx="12" cy="20" r="1.5" fill="#E2E8F0" />
              <circle cx="32" cy="20" r="1.5" fill="#E2E8F0" />
            </svg>
            {/* Forward Headlight Beam */}
            <div className="absolute left-[44px] top-1/2 -translate-y-1/2 w-8 h-8 bg-gradient-to-r from-yellow-300/35 to-transparent blur-[3px] rounded-r-full pointer-events-none" />
          </div>
        </div>

        {/* Destination Parking Bay Target at End of Road */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ${
              graceProgress >= 95
                ? 'bg-[#007AFF] text-white shadow-[0_0_16px_rgba(0,122,255,0.8)] scale-110'
                : 'bg-white/[0.08] text-white/80'
            }`}
            title={destinationName}
          >
            <MapPin size={18} strokeWidth={2.4} />
          </div>
        </div>
      </div>

      {/* Road Trip Labels */}
      <div className="flex items-center justify-between text-xs text-[#86868b] font-medium mt-3 px-1">
        <span className="flex items-center gap-1.5 text-white/70">
          <Car size={13} className="text-[#007AFF]" />
          <span>Start Point</span>
        </span>
        <span className="flex items-center gap-1.5 text-white/90 font-semibold truncate max-w-[260px]">
          <MapPin size={13} className="text-[#007AFF] shrink-0" />
          <span className="truncate">{destinationName}</span>
        </span>
      </div>
    </div>
  );
};
