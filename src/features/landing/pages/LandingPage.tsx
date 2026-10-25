import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { CalendarCheck, ChevronDown, ChevronRight, MapPin, TrainFront } from 'lucide-react';
import BrandLogo from '@/components/ui/BrandLogo';
import { readableTextOn } from '@/lib/contrast';
import HeroScrollCanvas, { getHeroPinViewports } from '@/components/HeroScrollCanvas';

/* ────────────────────────────────────────────────────────────────────────────
 * Apple design tokens used on this page
 *   text      #1d1d1f / secondary #6e6e73 / tertiary #86868b
 *   surfaces  #ffffff / #f5f5f7 / #000000
 *   action    #0071e3 (button) · #0066cc (link, light) · #2997ff (link, dark)
 * ──────────────────────────────────────────────────────────────────────────── */

const NAV_HEIGHT = 52;

const navigation = [
  { label: 'Overview', href: '#overview' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Stations', href: '#stations' },
];

const steps = [
  {
    icon: MapPin,
    eyebrow: 'Step 1',
    title: 'Pick your station.',
    description: 'Choose the Kelana Jaya or Ampang Line stop you ride from and see condo bays within a 3‑minute walk.',
  },
  {
    icon: CalendarCheck,
    eyebrow: 'Step 2',
    title: 'Reserve your weekday.',
    description: 'Lock in an 8AM – 6PM bay by the day or by the month. Pay in the app, and the spot is yours.',
  },
  {
    icon: TrainFront,
    eyebrow: 'Step 3',
    title: 'Park. Walk. Ride.',
    description: 'Show your Parking Pass at the condo gate, follow the walking route, and catch your train on time.',
  },
] as const;

const LINES = {
  'Kelana Jaya Line': { short: 'KJ', color: '#D50032' },
  'Ampang Line': { short: 'AG', color: '#E57200' },
} as const;

type LineName = keyof typeof LINES;

// Sample display data — replace with live availability from the parking API.
const popularStations: { station: string; line: LineName; walk: number; price: number }[] = [
  { station: 'Kelana Jaya', line: 'Kelana Jaya Line', walk: 3, price: 10 },
  { station: 'Taman Bahagia', line: 'Kelana Jaya Line', walk: 2, price: 9 },
  { station: 'Sri Rampai', line: 'Kelana Jaya Line', walk: 3, price: 8 },
  { station: 'Wangsa Maju', line: 'Kelana Jaya Line', walk: 3, price: 9 },
  { station: 'Ampang', line: 'Ampang Line', walk: 3, price: 8 },
  { station: 'Cahaya', line: 'Ampang Line', walk: 2, price: 8 },
  { station: 'Cempaka', line: 'Ampang Line', walk: 3, price: 9 },
  { station: 'Pandan Indah', line: 'Ampang Line', walk: 3, price: 8 },
];

const lineFilters = ['All', ...Object.keys(LINES)] as const;
type LineFilter = (typeof lineFilters)[number];

/* ── Primitives ─────────────────────────────────────────────────────────────── */

const btnPrimary =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-[#0071e3] px-[22px] text-[17px] tracking-[-0.022em] text-white transition-colors duration-200 hover:bg-[#0077ed]';

function TextLink({ href, children, dark = false }: { href: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-0.5 text-[17px] tracking-[-0.022em] hover:underline ${dark ? 'text-[#2997ff]' : 'text-[#0066cc]'}`}
    >
      {children}
      <ChevronRight size={17} strokeWidth={2} className="translate-y-px transition-transform group-hover:translate-x-0.5" />
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
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduceMotion ? false : { opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{
        duration: reduceMotion ? 0 : 0.9,
        delay: reduceMotion ? 0 : delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ title, intro, dark = false }: { title: string; intro: string; dark?: boolean }) {
  return (
    <div className="max-w-[820px]">
      <h2 className={`text-[40px] font-semibold leading-[1.08] tracking-[-0.015em] md:text-[56px] lg:text-[64px] ${dark ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}>
        {title}
      </h2>
      <p className={`mt-4 text-[19px] leading-[1.42] tracking-[0.012em] md:text-[21px] ${dark ? 'text-[#86868b]' : 'text-[#6e6e73]'}`}>
        {intro}
      </p>
    </div>
  );
}

/* ── Local navigation (Apple "localnav" pattern) ────────────────────────────── */

function LocalNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    // The hero occupies 1 viewport + the pinned scroll distance; stay dark until it releases.
    const update = () => {
      const heroEnd = window.innerHeight * (1 + getHeroPinViewports()) - NAV_HEIGHT;
      setOverHero(window.scrollY < heroEnd);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const dark = overHero;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 border-b transition-all duration-500 ${
        dark
          ? 'bg-gradient-to-b from-slate-950/60 to-transparent backdrop-blur-[2px] border-white/5'
          : 'border-black/[0.08] bg-[rgba(251,251,253,0.85)] backdrop-blur-[20px] backdrop-saturate-[180%]'
      }`}
    >
      <div className="mx-auto flex max-w-[1024px] items-center justify-between px-5 md:px-6" style={{ height: NAV_HEIGHT }}>
        <a
          href="/home"
          className={`inline-flex items-center gap-2 text-[21px] font-semibold tracking-[0.011em] ${dark ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}
          aria-label="ParkJom home"
        >
          <BrandLogo alt="" className="h-7 w-7" />
          ParkJom
        </a>

        <div className="flex items-center gap-4 md:gap-6">
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary navigation">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`text-[12px] tracking-[-0.01em] transition-colors ${dark ? 'text-[#d2d2d7] hover:text-white' : 'text-[#424245] hover:text-[#1d1d1f]'}`}
              >
                {item.label}
              </a>
            ))}
            <a
              href="/login"
              className={`text-[12px] tracking-[-0.01em] transition-colors ${dark ? 'text-[#d2d2d7] hover:text-white' : 'text-[#424245] hover:text-[#1d1d1f]'}`}
            >
              Sign in
            </a>
          </nav>

          <button
            type="button"
            className={`grid h-8 w-8 place-items-center md:hidden ${dark ? 'text-[#d2d2d7]' : 'text-[#424245]'}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="local-nav-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <ChevronDown size={18} className={`transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          <a
            href="/login?role=Commuter"
            className="inline-flex min-h-7 items-center rounded-full bg-[#0071e3] px-[11px] text-[12px] tracking-[-0.01em] text-white transition-colors hover:bg-[#0077ed]"
          >
            Find parking
          </a>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="local-nav-menu"
          className={`border-t px-5 pb-4 pt-2 md:hidden ${dark ? 'border-white/[0.08]' : 'border-black/[0.08]'}`}
          aria-label="Mobile navigation"
        >
          {[...navigation, { label: 'Sign in', href: '/login' }].map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`block border-b py-3 text-[17px] tracking-[-0.022em] last:border-0 ${
                dark ? 'border-white/[0.08] text-[#f5f5f7]' : 'border-black/[0.08] text-[#1d1d1f]'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

/* ── How it works ───────────────────────────────────────────────────────────── */

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white px-5 py-24 md:px-6 md:py-36">
      <div className="mx-auto max-w-[1180px]">
        <Reveal>
          <SectionHeader title="How it works." intro="Three steps between your front door and the platform." />
        </Reveal>

        <ol className="mt-14 grid gap-5 md:mt-20 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="h-full">
                <Reveal delay={index * 0.1} className="flex h-full flex-col rounded-[28px] bg-[#f5f5f7] p-8 md:p-10">
                  <Icon size={40} strokeWidth={1.5} className="text-[#0071e3]" aria-hidden="true" />
                  <p className="mt-10 text-[14px] font-semibold tracking-[-0.016em] text-[#6e6e73]">{step.eyebrow}</p>
                  <h3 className="mt-1 text-[28px] font-semibold leading-[1.14] tracking-[0.007em] text-[#1d1d1f]">{step.title}</h3>
                  <p className="mt-3 text-[17px] leading-[1.47] tracking-[-0.022em] text-[#6e6e73]">{step.description}</p>
                </Reveal>
              </li>
            );
          })}
        </ol>

        {/* Owner bento tile */}
        <Reveal className="mt-5">
          <div className="grid overflow-hidden rounded-[28px] bg-black text-[#f5f5f7] md:grid-cols-[1.1fr_1fr]">
            <div className="p-8 md:p-14">
              <p className="text-[17px] font-semibold tracking-[-0.022em] text-[#30d158]">For owners</p>
              <h3 className="mt-2 text-[36px] font-semibold leading-[1.1] tracking-[-0.01em] md:text-[48px]">
                Turn idle hours into income.
              </h3>
              <p className="mt-4 max-w-[440px] text-[17px] leading-[1.47] tracking-[-0.022em] text-[#a1a1a6]">
                Your condo bay sits empty while you're at work. Share it with nearby commuters on weekdays,{' '}
                <span className="font-semibold text-[#f5f5f7]">and keep it for yourself every evening and weekend.</span>
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <a href="/login?role=Owner" className={btnPrimary}>Become a host</a>
                <TextLink href="/login?role=Owner" dark>Learn more</TextLink>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3 md:grid-cols-1 md:border-l md:border-t-0">
              {[
                { value: 'RM250–450', label: 'Estimated monthly earnings', note: '1' },
                { value: '8AM–6PM', label: 'Weekday rental window' },
                { value: '100%', label: 'Yours on evenings & weekends' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col justify-center bg-black px-8 py-7 md:px-12">
                  <dt className="order-2 mt-1 text-[14px] tracking-[-0.016em] text-[#86868b]">
                    {stat.label}
                    {stat.note && (
                      <sup className="ml-0.5">
                        <a href={`#footnote-${stat.note}`} className="hover:text-white" aria-label={`Footnote ${stat.note}`}>{stat.note}</a>
                      </sup>
                    )}
                  </dt>
                  <dd className="order-1 bg-gradient-to-r from-[#30d158] to-[#5ac8fa] bg-clip-text text-[32px] font-semibold tracking-[-0.01em] text-transparent md:text-[40px]">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Popular stations ───────────────────────────────────────────────────────── */

function PopularStations() {
  const [filter, setFilter] = useState<LineFilter>('All');
  const visible = filter === 'All' ? popularStations : popularStations.filter((s) => s.line === filter);

  return (
    <section id="stations" className="bg-[#f5f5f7] px-5 py-24 md:px-6 md:py-36">
      <div className="mx-auto max-w-[1180px]">
        <Reveal className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <SectionHeader
            title="Find your station."
            intro="Live at core stations on the Kelana Jaya and Ampang lines, with more on the way."
          />
          <TextLink href="/login?role=Commuter">See all stations</TextLink>
        </Reveal>

        {/* Segmented control */}
        <div className="mt-12 flex justify-center md:justify-start">
          <div className="inline-flex rounded-full bg-[#e8e8ed] p-1" role="group" aria-label="Filter by line">
            {lineFilters.map((option) => {
              const active = filter === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(option)}
                  className={`rounded-full px-4 py-1.5 text-[14px] tracking-[-0.016em] transition-all duration-300 md:px-5 ${
                    active ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.12)]' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  {option === 'All' ? 'All lines' : option.replace(' Line', '')}
                </button>
              );
            })}
          </div>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Popular LRT stations">
          {visible.map((item) => {
            const line = LINES[item.line];
            return (
              <li key={item.station}>
                <a
                  href="/login?role=Commuter"
                  className="group flex h-full flex-col rounded-[18px] bg-white p-6 transition-shadow duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
                >
                  <span className="inline-flex items-center gap-2 text-[12px] tracking-[-0.01em] text-[#6e6e73]">
                    <span
                      className="grid h-5 min-w-7 place-items-center rounded-[5px] px-1 text-[10px] font-semibold"
                      style={{ backgroundColor: line.color, color: readableTextOn(line.color) }}
                    >
                      {line.short}
                    </span>
                    {item.line}
                  </span>
                  <h3 className="mt-5 text-[24px] font-semibold leading-[1.17] tracking-[0.009em] text-[#1d1d1f]">{item.station}</h3>
                  <p className="mt-2 text-[14px] leading-[1.43] tracking-[-0.016em] text-[#6e6e73]">
                    {item.walk} min walk · Weekdays 8AM – 6PM
                  </p>
                  <div className="mt-8 flex items-end justify-between">
                    <p className="text-[14px] tracking-[-0.016em] text-[#6e6e73]">
                      From <span className="text-[17px] font-semibold tracking-[-0.022em] text-[#1d1d1f]">RM{item.price}</span>/day
                    </p>
                    <span className="inline-flex items-center text-[14px] tracking-[-0.016em] text-[#0066cc] group-hover:underline">
                      Reserve <ChevronRight size={15} strokeWidth={2} />
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ── Footer (Apple "globalfooter" pattern) ──────────────────────────────────── */

const footerColumns = [
  {
    title: 'Commuters',
    links: [
      { label: 'Find parking', href: '/login?role=Commuter' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Stations', href: '#stations' },
    ],
  },
  {
    title: 'Owners',
    links: [
      { label: 'Rent out your bay', href: '/login?role=Owner' },
      { label: 'Become a host', href: '/login?role=Owner' },
    ],
  },
  {
    title: 'Coverage',
    links: [
      { label: 'Kelana Jaya Line', href: '#stations' },
      { label: 'Ampang Line', href: '#stations' },
    ],
  },
  {
    title: 'Account',
    links: [{ label: 'Sign in', href: '/login' }],
  },
];

function Footer() {
  return (
    <footer className="bg-[#f5f5f7] px-5 pb-6 text-[12px] leading-[1.33] tracking-[-0.01em] text-[#6e6e73] md:px-6">
      <div className="mx-auto max-w-[1024px]">
        <ol className="space-y-2 border-t border-[#d2d2d7] pt-4">
          <li id="footnote-1">
            1. Estimated monthly earnings are illustrative and depend on station, demand, number of days listed and platform fees.
          </li>
          <li>Walking times are approximate and measured from the condo exit to the station entrance.</li>
        </ol>

        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-[#d2d2d7] pt-6 sm:grid-cols-4">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h3 className="font-semibold text-[#1d1d1f]">{col.title}</h3>
              <ul className="mt-2 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-[#424245] hover:underline">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-[#d2d2d7] pt-4 sm:flex-row sm:justify-between">
          <p>Copyright © 2026 ParkJom. All rights reserved.</p>
          <p className="text-[#424245]">Malaysia</p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-white font-sans text-[#1d1d1f] antialiased">
      <LocalNav />
      <main>
        <HeroScrollCanvas />
        <HowItWorks />
        <PopularStations />
      </main>
      <Footer />
    </div>
  );
}
