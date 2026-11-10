import { useEffect, useState } from 'react';
import { CalendarCheck, ChevronDown, ChevronRight, MapPin, TrainFront, Wallet, TicketCheck, Building2, Bell } from 'lucide-react';
import BrandLogo from '@/components/ui/BrandLogo';
import TransitCoverage from '../components/TransitCoverage';
import Reveal from '../components/Reveal';
import OwnerIntro from '../components/OwnerIntro';
import HeroScrollCanvas from '@/features/landing/components/HeroScrollCanvas';
import { useAuth } from '@/features/auth/context/AuthContext';

const NAV_HEIGHT = 52;

const navigation = [
  { label: 'Overview', href: '#overview' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Transit network', href: '#stations' },
];

const steps = [
  {
    icon: MapPin,
    eyebrow: 'Step 1',
    title: 'Pick your station.',
    description: 'Explore rail and bus connections across the Klang Valley, then browse verified parking near your station.',
  },
  {
    icon: CalendarCheck,
    eyebrow: 'Step 2',
    title: 'Choose your parking.',
    description: 'Compare the rate, available dates, and bay features. Select your vehicle and review the booking before you pay.',
  },
  {
    icon: TrainFront,
    eyebrow: 'Step 3',
    title: 'Park. Walk. Ride.',
    description: 'Keep your Parking Pass, booking details, and supported gate controls together in the app. Then continue your journey.',
  },
] as const;

/* ── Primitives ─────────────────────────────────────────────────────────────── */

function SectionHeader({ title, intro, dark = false }: { title: string; intro: string; dark?: boolean }) {
  return (
    <div className="max-w-[820px]">
      <h2 className={`text-[40px] font-semibold leading-[1.08] tracking-[-0.015em] md:text-[56px] lg:text-[64px] ${dark ? 'text-[#f5f5f7]' : 'text-[#203b55]'}`}>
        {title}
      </h2>
      <p className={`mt-4 text-[19px] leading-[1.42] tracking-[0.012em] md:text-[21px] ${dark ? 'text-[#86868b]' : 'text-[#65717a]'}`}>
        {intro}
      </p>
    </div>
  );
}

/* ── Local navigation (Apple "localnav" pattern) ────────────────────────────── */

function LocalNav() {
  const { continueAsGuest } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    // Measure the actual hero so this also follows short screens and reduced motion.
    const update = () => {
      const hero = document.getElementById('overview');
      setOverHero(Boolean(hero && hero.getBoundingClientRect().bottom > NAV_HEIGHT));
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
      style={{ paddingTop: 'var(--parkjom-safe-top)', backgroundColor: menuOpen ? (dark ? '#11191e' : '#fbfbfd') : undefined }}
      className={`fixed top-0 inset-x-0 z-50 border-b transition-all duration-500 ${
        dark
          ? 'bg-gradient-to-b from-slate-950/60 to-transparent backdrop-blur-[2px] border-white/5'
          : 'border-black/[0.08] bg-[rgba(251,251,253,0.85)] backdrop-blur-[20px] backdrop-saturate-[180%]'
      }`}
    >
      <div className="mx-auto flex max-w-[1024px] items-center justify-between px-5 md:px-6" style={{ height: NAV_HEIGHT }}>
        <a
          href="/home"
          className={`inline-flex min-h-11 items-center gap-2 text-[21px] font-semibold tracking-[0.011em] ${dark ? 'text-[#f5f5f7]' : 'text-[#203b55]'}`}
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
                className={`text-[12px] tracking-[-0.01em] transition-colors ${dark ? 'text-[#d2d2d7] hover:text-white' : 'text-[#424245] hover:text-[#203b55]'}`}
              >
                {item.label}
              </a>
            ))}
            <a
              href="/commuter"
              onClick={() => continueAsGuest()}
              className={`text-[12px] tracking-[-0.01em] transition-colors ${dark ? 'text-[#d2d2d7] hover:text-white' : 'text-[#424245] hover:text-[#203b55]'}`}
            >
              Browse as Guest
            </a>
            <a
              href="/login"
              className={`text-[12px] tracking-[-0.01em] transition-colors ${dark ? 'text-[#d2d2d7] hover:text-white' : 'text-[#424245] hover:text-[#203b55]'}`}
            >
              Sign in
            </a>
          </nav>

          <button
            type="button"
            className={`grid h-11 w-11 place-items-center md:hidden ${dark ? 'text-[#d2d2d7]' : 'text-[#424245]'}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="local-nav-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <ChevronDown size={18} className={`transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          <a
            href="/login?role=Commuter"
            className="inline-flex min-h-11 items-center rounded-xl bg-[#0071e3] px-[11px] text-[12px] tracking-[-0.01em] text-white transition-colors hover:bg-[#0077ed]"
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
          {[
            ...navigation,
            { label: 'Browse as Guest', href: '/commuter', isGuestAction: true },
            { label: 'Sign in', href: '/login' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => {
                if ('isGuestAction' in item && item.isGuestAction) continueAsGuest();
                setMenuOpen(false);
              }}
              className={`block border-b py-3 text-[17px] tracking-[-0.022em] last:border-0 ${
                dark ? 'border-white/[0.08] text-[#f5f5f7]' : 'border-black/[0.08] text-[#203b55]'
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
    <section id="how-it-works" className="scroll-mt-24 bg-[#fdfcf8] px-5 py-24 md:px-6 md:py-36">
      <div className="mx-auto max-w-[1180px]">
        <Reveal>
          <SectionHeader title="How it works." intro="From finding a bay to keeping your Parking Pass handy." />
        </Reveal>

        <ol className="mt-14 grid gap-5 md:mt-20 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="h-full">
                <Reveal delay={index * 0.1} className="flex h-full flex-col rounded-3xl border border-[#e1e6e3] bg-white p-8 md:p-10">
                  <Icon size={40} strokeWidth={1.5} className="text-[#0071e3]" aria-hidden="true" />
                  <p className="mt-10 text-[14px] font-semibold tracking-[-0.016em] text-[#65717a]">{step.eyebrow}</p>
                  <h3 className="mt-1 text-[28px] font-semibold leading-[1.14] tracking-[0.007em] text-[#203b55]">{step.title}</h3>
                  <p className="mt-3 text-[17px] leading-[1.47] tracking-[-0.022em] text-[#65717a]">{step.description}</p>
                </Reveal>
              </li>
            );
          })}
        </ol>

        <OwnerIntro />
      </div>
    </section>
  );
}

function AppFeatures() {
  const features = [
    { icon: TrainFront, title: 'Your transit connections', text: 'Rail lines, stations, and Rapid KL bus routes on one map.' },
    { icon: TicketCheck, title: 'Your Parking Pass', text: 'Booking details and supported bay access controls, ready when you arrive.' },
    { icon: Wallet, title: 'Your parking wallet', text: 'Top up, pay for parking, and keep track of your transactions.' },
    { icon: Bell, title: 'Your booking updates', text: 'Parking and account notifications together in one inbox.' },
  ];
  return (
    <section id="app-features" className="scroll-mt-24 bg-[#fdfcf8] px-5 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-[1180px]">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#58788c]">Made for the everyday commute</p>
            <h2 className="mt-4 text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#203b55] md:text-[56px]">A few less things<br />to think about.</h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[#65717a]">Plan the connection, find your bay, and keep the details close. ParkJom brings the small parts of your journey together.</p>
          </Reveal>
          <Reveal delay={0.1}><img src="/illustrations/commute-sketch.png" alt="A blue-ink sketch of a commuter walking from their car to the station." width="1536" height="1024" loading="lazy" className="w-full mix-blend-multiply" /></Reveal>
        </div>
        <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({icon: Icon, title, text}, index) => <Reveal key={title} delay={index * 0.06} className="border-t border-[#d7dfdf] pt-6"><Icon size={25} strokeWidth={1.5} className="text-[#58788c]" /><h3 className="mt-4 text-lg font-semibold tracking-tight text-[#203b55]">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[#65717a]">{text}</p></Reveal>)}
        </div>
        <Reveal className="mt-12 flex flex-col justify-between gap-5 border-t border-[#d7dfdf] pt-7 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4"><Building2 size={26} strokeWidth={1.5} className="mt-1 shrink-0 text-[#58788c]" /><div><h3 className="font-semibold text-[#203b55]">Looking after a property?</h3><p className="mt-1 text-sm leading-relaxed text-[#65717a]">Property Desk gives building teams their own space for bookings and access operations.</p></div></div>
          <a href="/login?role=PropertyManagement" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-[#244b6a]">Open Property Desk <ChevronRight size={17} /></a>
        </Reveal>
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
      { label: 'Transit network', href: '#stations' },
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
      { label: 'LRT & MRT lines', href: '#stations' },
      { label: 'Monorail & BRT', href: '#stations' },
      { label: 'Bus connections', href: '#stations' },
    ],
  },
  {
    title: 'Account',
    links: [{ label: 'Sign in', href: '/login' }, { label: 'Property Desk', href: '/login?role=PropertyManagement' }],
  },
];

function Footer() {
  return (
    <footer className="bg-[#f4f5f1] px-5 pb-6 text-[12px] leading-[1.33] tracking-[-0.01em] text-[#65717a] md:px-6">
      <div className="mx-auto max-w-[1024px]">
        <p className="border-t border-[#d2d2d7] pt-4 leading-relaxed">Available parking, rates, and access arrangements vary by property and listing. Review the details in the app before booking.</p>

        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-[#d2d2d7] pt-6 sm:grid-cols-4">
          {footerColumns.map((col) => (
            <Reveal key={col.title}>
              <h3 className="font-semibold text-[#203b55]">{col.title}</h3>
              <ul className="mt-2 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="inline-flex min-h-11 items-center text-[#424245] hover:underline sm:min-h-6">{link.label}</a>
                  </li>
                ))}
              </ul>
            </Reveal>
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
    <div className="landing-page min-h-screen bg-white font-sans text-[#203b55] antialiased">
      <LocalNav />
      <main>
        <HeroScrollCanvas />
        <HowItWorks />
        <AppFeatures />
        <TransitCoverage />
      </main>
      <Footer />
    </div>
  );
}
