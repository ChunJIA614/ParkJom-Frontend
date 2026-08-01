import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cpu,
  Footprints,
  Home,
  Lock,
  MapPin,
  Menu,
  Navigation,
  ShieldCheck,
  TrainFront,
  Wallet,
  X,
} from 'lucide-react';
import BrandLogo from '@/shared/ui/BrandLogo';

const navigation = [
  { label: 'How it feels', href: '#journey' },
  { label: 'For everyone', href: '#roles' },
  { label: 'Near your line', href: '#nearby' },
  { label: 'Built for trust', href: '#trust' },
];

const storyMoments = [
  {
    eyebrow: 'Before you leave',
    title: 'Know where the first leg ends.',
    description: 'Choose your rail station, compare nearby bays, and see the walk and rate before you start the car.',
    detail: 'One clear decision before the morning gets busy.',
    image: '/images/parkjom-reservation-campaign.webp',
    alt: 'A commuter checking a parking reservation near an LRT station',
    icon: MapPin,
  },
  {
    eyebrow: 'When you arrive',
    title: 'No circling. No second guessing.',
    description: 'Your Parking Pass keeps the bay, vehicle, arrival guidance, and access state together when you need them.',
    detail: 'The right information stays close at hand.',
    image: '/images/parkjom-access-campaign.webp',
    alt: 'A commuter using a digital parking pass at a smart parking bay',
    icon: Lock,
  },
  {
    eyebrow: 'The rest of the way',
    title: 'Leave the parking chase behind.',
    description: 'Park, follow the short walking route, and step onto the line already taking you where you need to go.',
    detail: 'A calmer handoff from car to city.',
    image: '/images/parkjom-aerial-campaign.webp',
    alt: 'Parking bays beside an elevated rail station in Kuala Lumpur',
    icon: TrainFront,
  },
] as const;

const roles = [
  {
    eyebrow: 'For commuters',
    title: 'Make the morning feel more certain.',
    description: 'Find parking near your station, reserve before leaving, and carry arrival and access in one Parking Pass.',
    href: '/login?role=Commuter',
    cta: 'Find parking',
    icon: TrainFront,
    tone: 'blue',
    features: ['Station-first discovery', 'Walking distance up front', 'One pass from arrival to access'],
  },
  {
    eyebrow: 'For parking owners',
    title: 'Let an available bay do more.',
    description: 'Share your space on your terms, set availability, and follow each booking from a focused owner workspace.',
    href: '/login?role=Owner',
    cta: 'List a parking bay',
    icon: Home,
    tone: 'green',
    features: ['Guided space onboarding', 'Availability in your control', 'Clear booking and payout status'],
  },
] as const;

const parkingHighlights = [
  {
    line: 'Kelana Jaya Line',
    station: 'Taman Tun Dr Ismail',
    description: 'Reservable bays within a short walk of the station.',
    meta: 'From RM2.50 / hour',
    icon: TrainFront,
  },
  {
    line: 'Kajang Line',
    station: 'Cochrane',
    description: 'Trusted parking with a covered route towards the platform.',
    meta: 'From RM3.00 / hour',
    icon: Footprints,
  },
  {
    line: 'Ampang Line',
    station: 'Sri Petaling',
    description: 'Nearby bays with smart access available throughout the day.',
    meta: 'From RM2.00 / hour',
    icon: Cpu,
  },
  {
    line: 'Kelana Jaya Line',
    station: 'Sri Rampai',
    description: 'Neighbourhood parking a few minutes from the rail line.',
    meta: 'From RM2.50 / hour',
    icon: Home,
  },
  {
    line: 'Kajang Line',
    station: 'Taman Midah',
    description: 'Verified bays with a guided arrival in your Parking Pass.',
    meta: 'From RM2.20 / hour',
    icon: Navigation,
  },
] as const;

function Brand({ light = false }: { light?: boolean }) {
  return (
    <a
      href="/"
      className={`inline-flex items-center gap-2.5 ${light ? 'text-white' : 'text-[#102234]'}`}
      aria-label="ParkJom home"
    >
      <BrandLogo alt="" className="h-9 w-9 shadow-sm" />
      <span className="text-[17px] font-semibold tracking-[-0.025em]">ParkJom</span>
    </a>
  );
}

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-72px' });
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{
        duration: reduceMotion ? 0 : 0.65,
        delay: reduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionIntro({
  label,
  title,
  description,
  light = false,
}: {
  label: string;
  title: string;
  description: string;
  light?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${light ? 'text-[#8ed4ff]' : 'text-[#1469d8]'}`}>
        {label}
      </p>
      <h2 className={`mt-5 text-[36px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[44px] md:text-[56px] ${light ? 'text-white' : 'text-[#102234]'}`}>
        {title}
      </h2>
      <p className={`mt-6 max-w-2xl text-[16px] leading-7 md:text-[18px] md:leading-8 ${light ? 'text-white/68' : 'text-[#5f6f7d]'}`}>
        {description}
      </p>
    </div>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    setScrolled(window.scrollY > 28);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  useMotionValueEvent(scrollY, 'change', (value) => {
    setScrolled(value > 28);
  });

  const solid = scrolled || menuOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300 ${
        solid
          ? 'border-black/[0.07] bg-white/90 shadow-[0_8px_30px_rgba(16,34,52,0.05)] backdrop-blur-2xl'
          : 'border-white/10 bg-gradient-to-b from-[#071521]/55 to-transparent'
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 md:px-8">
        <Brand light={!solid} />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-[13px] font-medium transition-colors ${solid ? 'text-[#526474] hover:text-[#102234]' : 'text-white/78 hover:text-white'}`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a href="/login" className={`px-3 py-2 text-[13px] font-semibold ${solid ? 'text-[#102234]' : 'text-white'}`}>
            Sign in
          </a>
          <a
            href="/login?role=Commuter"
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold transition-all hover:-translate-y-0.5 ${
              solid ? 'bg-[#1469d8] text-white shadow-[0_10px_24px_rgba(20,105,216,0.22)]' : 'bg-white text-[#102234] shadow-[0_10px_30px_rgba(0,0,0,0.16)]'
            }`}
          >
            Find parking <ArrowRight size={15} />
          </a>
        </div>

        <button
          type="button"
          className={`grid h-11 w-11 place-items-center rounded-full transition-colors md:hidden ${solid ? 'text-[#102234] hover:bg-black/[0.05]' : 'bg-black/20 text-white hover:bg-black/30'}`}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {menuOpen && (
        <nav id="mobile-navigation" className="border-t border-black/[0.06] bg-white px-5 pb-5 pt-3 md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-[1240px] flex-col">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-[14px] font-medium text-[#102234] hover:bg-[#f2f5f6]"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-black/[0.06] pt-4">
              <a href="/login" className="grid min-h-11 place-items-center rounded-xl border border-black/[0.1] text-[13px] font-semibold text-[#102234]">
                Sign in
              </a>
              <a href="/login?role=Commuter" className="grid min-h-11 place-items-center rounded-xl bg-[#1469d8] text-[13px] font-semibold text-white">
                Find parking
              </a>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 28, mass: 0.35 });
  const mediaY = useTransform(progress, [0, 1], ['0%', '10%']);
  const mediaScale = useTransform(progress, [0, 1], [1.015, 1.075]);
  const contentY = useTransform(progress, [0, 0.8], [0, -34]);
  const contentOpacity = useTransform(progress, [0, 0.72], [1, 0.72]);

  return (
    <section ref={sectionRef} id="intro" className="landing-hero relative min-h-[760px] overflow-hidden bg-[#071827] text-white md:min-h-[100svh]">
      <motion.img
        src="/images/parkjom-hero-campaign.webp"
        alt="A commuter walking from a parked car towards an elevated rail station in Kuala Lumpur"
        className="landing-hero-media absolute inset-0 h-[112%] w-full object-cover object-[58%_center]"
        style={reduceMotion ? undefined : { y: mediaY, scale: mediaScale }}
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,17,30,0.94)_0%,rgba(4,17,30,0.75)_42%,rgba(4,17,30,0.14)_78%),linear-gradient(0deg,rgba(4,17,30,0.68)_0%,transparent_44%)]" />
      <div className="landing-hero-glow absolute inset-0" />

      <motion.div
        className="relative mx-auto flex min-h-[760px] max-w-[1240px] flex-col justify-end px-5 pb-8 pt-32 md:min-h-[100svh] md:px-8 md:pb-9"
        style={reduceMotion ? undefined : { y: contentY, opacity: contentOpacity }}
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[760px] pb-12 md:pb-16"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-[#071827]/30 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-[#65d58a] shadow-[0_0_14px_rgba(101,213,138,0.8)]" />
            Parking that connects with rail
          </div>
          <h1 className="mt-7 max-w-[720px] text-[52px] font-semibold leading-[0.91] tracking-[-0.06em] text-white sm:text-[68px] md:text-[86px] lg:text-[96px]">
            Less time looking. More day ahead.
          </h1>
          <p className="mt-7 max-w-[590px] text-[17px] leading-7 text-white/72 md:text-[19px] md:leading-8">
            Reserve a trusted bay near your LRT or MRT station, walk the last few minutes, and let the city carry you from there.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="/login?role=Commuter"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ffffff] px-7 text-[14px] font-semibold text-[#102234] shadow-[0_16px_38px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:bg-[#f7fbff] active:translate-y-0"
            >
              Find parking near a station <ArrowRight size={17} />
            </a>
            <a
              href="/login?role=Owner"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/22 bg-white/10 px-7 text-[14px] font-semibold text-white backdrop-blur-xl transition hover:bg-white/16"
            >
              List your parking bay
            </a>
          </div>
        </motion.div>

        <div className="grid gap-5 border-t border-white/18 pt-6 text-white/66 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-[12px] font-medium">
            <span className="inline-flex items-center gap-2"><MapPin size={15} className="text-[#8ed4ff]" /> Station-first search</span>
            <span className="inline-flex items-center gap-2"><Clock3 size={15} className="text-[#8ed4ff]" /> Walk and rate before booking</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[#8ed4ff]" /> Guided arrival and access</span>
          </div>
          <a href="#journey" className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:text-[#8ed4ff]">
            See the journey <ArrowDownRight size={16} />
          </a>
        </div>
      </motion.div>
    </section>
  );
}

function PromiseStrip() {
  const promises = [
    { icon: MapPin, title: 'Plan before you drive', copy: 'Start with the station and see the nearby options.' },
    { icon: Footprints, title: 'Know the final walk', copy: 'Distance stays visible while you compare bays.' },
    { icon: Lock, title: 'Arrive with context', copy: 'Your pass keeps the handoff clear and close.' },
  ];

  return (
    <section className="relative z-10 bg-[#f6f7f4] px-5 py-12 md:px-8 md:py-16" aria-label="ParkJom experience principles">
      <div className="mx-auto grid max-w-[1240px] gap-px overflow-hidden rounded-[24px] border border-[#dfe5e2] bg-[#dfe5e2] md:grid-cols-3">
        {promises.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex gap-4 bg-white p-6 md:p-7">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#eaf3ff] text-[#1469d8]"><Icon size={19} /></span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#102234]">{item.title}</h2>
                <p className="mt-1.5 text-[13px] leading-5 text-[#6b7985]">{item.copy}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StoryMoment({
  moment,
  index,
  active,
  onEnter,
}: {
  moment: (typeof storyMoments)[number];
  index: number;
  active: boolean;
  onEnter: (index: number) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { margin: '-36% 0px -36% 0px' });
  const Icon = moment.icon;

  useEffect(() => {
    if (isInView) onEnter(index);
  }, [index, isInView, onEnter]);

  return (
    <article ref={ref} className="flex min-h-[auto] items-center py-9 lg:min-h-[68vh] lg:py-16">
      <div className={`w-full rounded-[28px] border p-5 transition-[background-color,border-color,box-shadow,transform] duration-500 sm:p-7 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none ${active ? 'border-[#cbd9e3] bg-white shadow-[0_20px_60px_rgba(31,59,78,0.09)] lg:translate-x-2' : 'border-[#e1e5e2] bg-white/55'}`}>
        <div className="relative mb-7 aspect-[4/3] overflow-hidden rounded-[22px] bg-[#d9e3e8] lg:hidden">
          <img src={moment.image} alt={moment.alt} className="h-full w-full object-cover" loading="lazy" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071827]/40 via-transparent to-transparent" />
        </div>
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-full transition-colors duration-500 ${active ? 'bg-[#1469d8] text-white' : 'bg-[#e7ecea] text-[#657581]'}`}>
            <Icon size={18} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a8a96]">{String(index + 1).padStart(2, '0')} · {moment.eyebrow}</span>
        </div>
        <h3 className="mt-6 max-w-[520px] text-[31px] font-semibold leading-[1.03] tracking-[-0.04em] text-[#102234] sm:text-[38px] lg:text-[44px]">{moment.title}</h3>
        <p className="mt-5 max-w-[520px] text-[15px] leading-7 text-[#5f6f7d] md:text-[17px]">{moment.description}</p>
        <p className="mt-6 inline-flex items-center gap-2 text-[12px] font-semibold text-[#1469d8]"><CheckCircle2 size={15} /> {moment.detail}</p>
      </div>
    </article>
  );
}

function JourneyStory() {
  const [activeMoment, setActiveMoment] = useState(0);
  const reduceMotion = useReducedMotion();

  return (
    <section id="journey" className="scroll-mt-20 bg-[#f6f7f4] px-5 pb-24 pt-12 md:px-8 md:pb-32 md:pt-20">
      <div className="mx-auto max-w-[1240px]">
        <Reveal className="grid gap-8 border-b border-[#dfe5e2] pb-12 md:grid-cols-[1fr_0.72fr] md:items-end md:pb-16">
          <SectionIntro
            label="Designed around real mornings"
            title="A calmer start changes the whole journey."
            description="ParkJom removes the small uncertainties that make parking feel bigger than it should—from choosing a bay to walking onto the platform."
          />
          <p className="max-w-md text-[14px] leading-7 text-[#71808b] md:justify-self-end">
            The page moves at your pace too: no scroll lock, no forced carousel, and no long wait before the useful part.
          </p>
        </Reveal>

        <div className="mt-8 lg:grid lg:grid-cols-[1.08fr_0.82fr] lg:gap-20">
          <div className="hidden lg:block">
            <div className="sticky top-24 h-[calc(100svh-8rem)] min-h-[610px] max-h-[800px] overflow-hidden rounded-[32px] bg-[#102234] shadow-[0_28px_80px_rgba(16,34,52,0.16)]">
              <div className="absolute inset-0" aria-hidden="true">
                {storyMoments.map((moment, index) => (
                  <motion.img
                    key={moment.image}
                    src={moment.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    animate={{ opacity: index === activeMoment ? 1 : 0, scale: index === activeMoment ? 1 : 1.025 }}
                    transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#071827]/80 via-[#071827]/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-8 text-white">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#9ed9ff]">The ParkJom handoff</p>
                  <p className="mt-3 max-w-sm text-[18px] font-medium leading-7 text-white/82">From a reserved bay to the line that moves your day.</p>
                </div>
                <div className="flex gap-2" aria-label={`Journey step ${activeMoment + 1} of ${storyMoments.length}`}>
                  {storyMoments.map((moment, index) => (
                    <span key={moment.eyebrow} className={`h-1.5 rounded-full transition-all duration-500 ${index === activeMoment ? 'w-9 bg-white' : 'w-1.5 bg-white/38'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            {storyMoments.map((moment, index) => (
              <StoryMoment key={moment.title} moment={moment} index={index} active={activeMoment === index} onEnter={setActiveMoment} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleSection() {
  return (
    <section id="roles" className="scroll-mt-20 bg-white px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-[1240px]">
        <Reveal className="grid gap-8 md:grid-cols-[1fr_0.68fr] md:items-end">
          <SectionIntro
            label="One platform, two human needs"
            title="Useful on both sides of the bay."
            description="Commuters get a more certain first mile. Owners get a straightforward way to share space without losing control of it."
          />
          <p className="max-w-md text-[14px] leading-7 text-[#71808b] md:justify-self-end">Choose the workspace that matches what you came to do today. The journey stays connected behind the scenes.</p>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {roles.map((role, index) => {
            const Icon = role.icon;
            const commuter = role.tone === 'blue';
            return (
              <Reveal key={role.title} delay={index * 0.08} className="h-full">
                <a
                  href={role.href}
                  className={`group relative flex h-full min-h-[430px] flex-col overflow-hidden rounded-[30px] border p-7 transition-all duration-500 hover:-translate-y-1 md:p-10 ${
                    commuter
                      ? 'border-[#d5e5f6] bg-[#eff6fc] hover:shadow-[0_24px_70px_rgba(20,105,216,0.12)]'
                      : 'border-[#dce9df] bg-[#f2f8f2] hover:shadow-[0_24px_70px_rgba(42,126,72,0.11)]'
                  }`}
                >
                  <div className={`absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl ${commuter ? 'bg-[#8ed4ff]/25' : 'bg-[#8be0a5]/25'}`} />
                  <span className={`relative grid h-13 w-13 place-items-center rounded-[17px] ${commuter ? 'bg-[#1469d8] text-white' : 'bg-[#2d8651] text-white'}`}><Icon size={23} /></span>
                  <p className="relative mt-9 text-[11px] font-semibold uppercase tracking-[0.17em] text-[#72828e]">{role.eyebrow}</p>
                  <h3 className="relative mt-3 max-w-lg text-[32px] font-semibold leading-[1.03] tracking-[-0.04em] text-[#102234] md:text-[40px]">{role.title}</h3>
                  <p className="relative mt-5 max-w-lg text-[15px] leading-7 text-[#5f6f7d]">{role.description}</p>
                  <ul className="relative mt-7 grid gap-3 sm:grid-cols-3" aria-label={`${role.eyebrow} features`}>
                    {role.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[12px] font-medium leading-5 text-[#5f6f7d]">
                        <CheckCircle2 size={15} className={`mt-0.5 shrink-0 ${commuter ? 'text-[#1469d8]' : 'text-[#2d8651]'}`} /> {feature}
                      </li>
                    ))}
                  </ul>
                  <span className={`relative mt-auto inline-flex items-center gap-2 pt-9 text-[13px] font-semibold ${commuter ? 'text-[#1469d8]' : 'text-[#2d8651]'}`}>
                    {role.cta} <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </a>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function NearbySection() {
  return (
    <section id="nearby" className="scroll-mt-20 overflow-hidden bg-[#102234] px-5 py-24 text-white md:px-8 md:py-32">
      <div className="mx-auto max-w-[1240px]">
        <Reveal className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <SectionIntro
            label="Closer to the line"
            title="Start with the station you already know."
            description="Explore parking around familiar LRT and MRT stops, then compare the details that matter to your morning."
            light
          />
          <a href="/login?role=Commuter" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-5 text-[13px] font-semibold text-white transition hover:bg-white/16">
            Explore all parking <ArrowRight size={15} />
          </a>
        </Reveal>

        <div
          className="landing-station-rail mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-5"
          tabIndex={0}
          aria-label="Parking near Rapid KL stations"
        >
          {parkingHighlights.map((parking, index) => {
            const Icon = parking.icon;
            return (
              <a
                key={parking.station}
                href="/login?role=Commuter"
                className="group flex min-h-[300px] w-[82vw] max-w-[390px] shrink-0 snap-start flex-col rounded-[26px] border border-white/12 bg-white/[0.07] p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-white/24 hover:bg-white/[0.11] md:w-[360px]"
              >
                <div className="flex items-start justify-between gap-5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ed4ff]">{parking.line}</span>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white/10 text-white"><Icon size={19} /></span>
                </div>
                <p className="mt-12 text-[12px] font-medium text-white/45">0{index + 1}</p>
                <h3 className="mt-3 text-[25px] font-semibold leading-tight tracking-[-0.035em] text-white">{parking.station}</h3>
                <p className="mt-3 text-[14px] leading-6 text-white/58">{parking.description}</p>
                <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/10 pt-5">
                  <span className="text-[12px] font-semibold text-white/78">{parking.meta}</span>
                  <ArrowRight size={17} className="text-[#8ed4ff] transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </a>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] font-medium text-white/42 md:hidden">Swipe to explore nearby stations</p>
      </div>
    </section>
  );
}

function TrustSection() {
  const principles = [
    { icon: ShieldCheck, title: 'A reservation you can read at a glance', description: 'Bay, vehicle, rate, and session status stay visible instead of being buried across screens.' },
    { icon: Cpu, title: 'Access that understands the moment', description: 'Arrival checks and smart-bay access are connected to the Parking Pass you already have open.' },
    { icon: Wallet, title: 'Clear handoffs for both sides', description: 'Owners can follow bookings and payouts while commuters keep the active journey in view.' },
  ];

  return (
    <section id="trust" className="scroll-mt-20 bg-[#f6f7f4] px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-[1240px]">
        <Reveal className="grid gap-10 md:grid-cols-[0.82fr_1.18fr] md:items-start">
          <SectionIntro
            label="Built for trust"
            title="Good parking should fade into the journey."
            description="The product is designed to make each handoff feel obvious, so people can spend less attention on parking and more on where they are going."
          />
          <div className="overflow-hidden rounded-[28px] border border-[#dfe5e2] bg-white">
            {principles.map((principle, index) => {
              const Icon = principle.icon;
              return (
                <div key={principle.title} className={`grid gap-5 p-6 sm:grid-cols-[56px_1fr] sm:p-8 ${index > 0 ? 'border-t border-[#e3e8e5]' : ''}`}>
                  <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-[#eaf3ff] text-[#1469d8]"><Icon size={22} /></span>
                  <div>
                    <h3 className="text-[18px] font-semibold tracking-[-0.025em] text-[#102234]">{principle.title}</h3>
                    <p className="mt-2 text-[14px] leading-6 text-[#657581]">{principle.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCallToAction() {
  return (
    <section className="bg-[#f6f7f4] px-5 pb-24 md:px-8 md:pb-32">
      <Reveal className="landing-final-cta relative mx-auto max-w-[1240px] overflow-hidden rounded-[32px] bg-[#1469d8] px-6 py-16 text-white md:px-14 md:py-20">
        <div className="absolute -right-20 -top-40 h-96 w-96 rounded-full bg-[#8ed4ff]/24 blur-3xl" />
        <div className="absolute -bottom-44 -left-24 h-96 w-96 rounded-full bg-[#65d58a]/16 blur-3xl" />
        <div className="relative grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/66">Your next journey can start lighter</p>
            <h2 className="mt-5 max-w-3xl text-[40px] font-semibold leading-[0.98] tracking-[-0.05em] md:text-[58px]">Make room for the rest of your day.</h2>
            <p className="mt-6 max-w-xl text-[16px] leading-7 text-white/72">Choose the path that fits today—find a bay near your line or put an available space to work.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <a href="/login?role=Commuter" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-[14px] font-semibold text-[#102234] transition hover:-translate-y-0.5">
              Find parking <ArrowRight size={16} />
            </a>
            <a href="/login?role=Owner" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-7 text-[14px] font-semibold text-white transition hover:bg-white/16">
              List your bay <Home size={16} />
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#dfe5e2] bg-[#f6f7f4] px-5 py-9 md:px-8">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Brand />
          <p className="mt-2 text-[11px] text-[#7a8994]">Transit-adjacent parking for Malaysia.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer navigation">
          {navigation.map((item) => <a key={item.href} href={item.href} className="text-[12px] font-medium text-[#62727f] hover:text-[#102234]">{item.label}</a>)}
          <a href="/login" className="text-[12px] font-semibold text-[#1469d8]">Sign in</a>
        </nav>
        <p className="text-[11px] text-[#7a8994]">© 2026 ParkJom</p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-[#f6f7f4] font-sans text-[#102234] antialiased">
      <Header />
      <main>
        <HeroSection />
        <div aria-hidden="true" className="h-20 bg-[linear-gradient(180deg,#071827_0%,#0b1f31_42%,#f6f7f4_100%)] md:h-24" />
        <PromiseStrip />
        <JourneyStory />
        <RoleSection />
        <NearbySection />
        <TrustSection />
        <FinalCallToAction />
      </main>
      <Footer />
    </div>
  );
}
