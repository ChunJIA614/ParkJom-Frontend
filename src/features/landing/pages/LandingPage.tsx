import { useState, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import {
  MapPin, Shield, Wallet, ChevronDown,
  Home, Menu, X, Send, CheckCircle2,
  Clock, Leaf, Users, Cpu, Mail, Phone,
  MapPinned, TrainFront,
} from 'lucide-react';
import SegmentedControl from '@/shared/ui/SegmentedControl';

/* ================================================================
   ParkJom Landing Page
   Designed in Apple style — clean, minimal, confident
   Accent: Apple system blue #007AFF
   ================================================================ */

// ─── Reusable Components ───────────────────────────────────────────────

/** Primary button — Apple style solid blue, minimal */
function PrimaryButton({
  children, className = '', ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={`inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#007AFF] text-white text-sm md:text-[15px] font-semibold tracking-[-0.01em] hover:bg-[#0066d6] active:bg-[#0055b3] transition-all duration-200 ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}

/** Secondary button — Apple style frosted glass + thin border, Hero only */
function HeroSecondaryButton({
  children, className = '', ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={`inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-white text-sm md:text-[15px] font-semibold tracking-[-0.01em] border border-white/30 bg-white/10 backdrop-blur-xl hover:bg-white/20 active:bg-white/25 transition-all duration-200 ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}

/** Fade-in Section wrapper */
function FadeInSection({ children, className = '', delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Section label + heading */
function SectionHeading({ label, title, subtitle }: {
  label: string; title: string; subtitle: string;
}) {
  return (
    <div className="max-w-[640px] mx-auto mb-14 md:mb-20">
      <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#007AFF] mb-4">
        {label}
      </p>
      <h2 className="text-[32px] md:text-[44px] font-bold text-[#1d1d1f] leading-[1.15] tracking-[-0.02em] mb-5">
        {title}
      </h2>
      <p className="text-[15px] md:text-[17px] text-[#6e6e73] leading-relaxed max-w-[520px]">
        {subtitle}
      </p>
    </div>
  );
}


/* ================================================================
   Section 1 — Hero
   Design: real parking lot photo + dark overlay + restrained typography
   ================================================================ */

function HeroSection() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden bg-[#0b0c10]">
      {/* Real photo background — corporate parking top view */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{ backgroundImage: 'url(/images/corporate-parking.jpg)' }}
      />
      {/* Frosted glass overlay — iOS style with backdrop-blur */}
      <div className="absolute inset-0 backdrop-blur-md bg-white/[0.06]" />
      {/* Dark gradient overlay — ensures text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0c10]/60 via-[#0b0c10]/40 to-[#0b0c10]/80" />
      {/* Top gradient — softer nav area */}
      <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-[#0b0c10]/80 via-transparent to-transparent pointer-events-none" />

      {/* Navigation — frosted glass */}
      <nav className="relative z-20 flex items-center justify-between px-5 md:px-10 py-4 glass-dark border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center font-extrabold text-[#111] text-[15px]">PJ</div>
          <span className="text-white font-bold text-lg tracking-[-0.02em]">ParkJom</span>
        </div>
        <div className="hidden md:flex items-center gap-10 text-[13px] font-medium">
          {['How It Works', 'Technology', 'About', 'Contact'].map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s/g, '-')}`} className="text-[#9ca3af] hover:text-white transition-colors duration-200">{l}</a>
          ))}
          <a href="/login" className="ml-2 px-5 py-2 rounded-full bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0066d6] active:bg-[#0055b3] transition-all duration-200">Sign In</a>
        </div>
        <button className="md:hidden text-white p-1.5" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-20 mx-5 bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/[0.15] shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5 flex flex-col gap-2 md:hidden">
          {['How It Works', 'Technology', 'About', 'Contact'].map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s/g, '-')}`} onClick={() => setMobileMenuOpen(false)}
              className="text-[#d1d5db] text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-white/[0.06] transition-colors">{l}</a>
          ))}
          <a href="/login" className="mt-2 text-center py-3 rounded-full bg-[#007AFF] text-white text-sm font-semibold">Sign In</a>
        </motion.div>
      )}

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 md:px-6 text-center max-w-[720px] mx-auto pb-16">
        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-[38px] sm:text-[48px] md:text-[64px] lg:text-[72px] font-bold text-white leading-[1.06] tracking-[-0.025em] mb-6"
        >
          Secure your<br />LRT parking<br /><span className="text-[#5ac8fa]">before you drive.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.55 }}
          className="text-[15px] md:text-[17px] text-[#9ca3af] max-w-[440px] leading-relaxed mb-10"
        >
          Private parking near LRT/MRT stations, secured by IoT smart bollards.
          No more circling — book, park, ride.
        </motion.p>

        {/* CTA dual buttons — with redirect param to /login */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <PrimaryButton href="/login?role=Commuter">Find Parking <MapPin size={17} /></PrimaryButton>
          <HeroSecondaryButton href="/login?role=Owner">List My Space <Home size={17} /></HeroSecondaryButton>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-5 md:gap-8 text-[#6b7280] text-[12px] font-medium"
        >
          {[
            { icon: Shield, text: 'No double‑booking' },
            { icon: Cpu, text: 'IoT Smart Bollard' },
            { icon: Wallet, text: 'Escrow protected' },
            { icon: Leaf, text: 'SDG 11' },
          ].map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-1.5"><Icon size={13} className="text-[#4b5563]" /> {text}</span>
          ))}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
        className="relative z-10 pb-8 flex justify-center">
        <a href="#how-it-works" aria-label="Scroll down" className="text-[#4b5563] hover:text-[#9ca3af] transition-colors">
          <ChevronDown size={24} />
        </a>
      </motion.div>
    </section>
  );
}


/* ================================================================
   Section 2 — How It Works
   ================================================================ */
function HowItWorksSection() {
  const [activeTab, setActiveTab] = useState<'commuter' | 'owner'>('commuter');

  const commuterSteps = [
    { title: 'Search nearby stations', desc: 'Find available private parking spots near your LRT/MRT station on the interactive map.', image: '/images/commuter-transit.jpg' },
    { title: 'Book and pay in seconds', desc: "Reserve your spot. Payment is held in escrow — you're only charged after a successful session.", image: '/images/corporate-parking.jpg' },
    { title: 'Unlock, park, ride', desc: 'Scan the QR code on the IoT bollard. It lowers instantly. Park, catch your train, and go.', image: '/images/iot-bollard.jpg' },
  ];

  const ownerSteps = [
    { title: 'List your parking bay', desc: 'Register your private space in under 3 minutes. Set your own schedule and pricing.', image: '/images/owner-property.jpg' },
    { title: 'Let the system do the work', desc: 'Our IoT bollard handles access autonomously. No key handovers, no coordination needed.', image: '/images/iot-bollard.jpg' },
    { title: 'Get paid, automatically', desc: 'Earnings settle to your wallet after each session. Overstay? Auto-detected and auto-charged.', image: '/images/corporate-parking.jpg' },
  ];

  const steps = activeTab === 'commuter' ? commuterSteps : ownerSteps;

  return (
    <section id="how-it-works" className="py-24 md:py-32 px-5 md:px-10 bg-white">
      <div className="max-w-[1120px] mx-auto">
        <FadeInSection>
          <SectionHeading label="How it works" title="Designed for both sides of the driveway."
            subtitle="A seamless experience whether you're parking or earning." />
        </FadeInSection>

        <FadeInSection delay={0.1}>
          <div className="flex justify-center mb-14 md:mb-20">
            <SegmentedControl
              options={[
                { value: 'commuter' as const, icon: TrainFront, label: 'For Commuters' },
                { value: 'owner' as const, icon: Home, label: 'For Owners' },
              ]}
              value={activeTab}
              onChange={(value) => setActiveTab(value as 'commuter' | 'owner')}
            />
          </div>
        </FadeInSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step, i) => (
            <FadeInSection key={step.title} delay={0.15 + i * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                className="ios-card overflow-hidden h-full"
              >
                <div className="relative h-44 overflow-hidden">
                  <img src={step.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className="absolute bottom-3 left-4 text-white text-[11px] font-bold tracking-wider uppercase">
                    Step {i + 1}
                  </span>
                </div>
                <div className="p-6 md:p-7">
                  <h3 className="text-xl font-bold text-[#111] tracking-[-0.01em] mb-2.5">{step.title}</h3>
                  <p className="text-[14px] md:text-[15px] text-[#5f6368] leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ================================================================
   Section 3 — Why ParkJom
   ================================================================ */
function WhyParkJomSection() {
  const features = [
    { icon: Cpu, label: 'Physical-grade protection', title: 'IoT Smart Bollard',
      desc: 'ESP32-powered hardware with Bluetooth and offline JWT QR authentication. Infrared sensors detect overstay and trigger automatic penalties.' },
    { icon: Shield, label: 'Mathematical guarantee', title: 'No double‑booking. Ever.',
      desc: "Optimistic Concurrency Control ensures two commuters can never book the same bay — even under peak load. It's mathematics, not marketing." },
    { icon: Wallet, label: 'Zero trust required', title: 'Escrow & auto settlement',
      desc: 'Funds held in escrow, released only after a clean session. Overstay penalties are automatic. No disputes, no awkward follow‑ups.' },
  ];

  return (
    <section id="technology" className="py-24 md:py-32 px-5 md:px-10 bg-[#f8f9fa]">
      <div className="max-w-[1120px] mx-auto">
        <FadeInSection>
          <SectionHeading label="Why ParkJom" title="Technology that removes doubt."
            subtitle="Hardware and software working together to eliminate every failure mode." />
        </FadeInSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <FadeInSection key={f.title} delay={0.1 + i * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                className="ios-card p-7 md:p-9 h-full"
              >
                <div className="w-10 h-10 rounded-xl bg-[#e8f0fe] flex items-center justify-center mb-6">
                  <f.icon size={20} className="text-[#007AFF]" />
                </div>
                <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#9ca3af] mb-2">{f.label}</p>
                <h3 className="text-xl font-bold text-[#111] tracking-[-0.01em] mb-3">{f.title}</h3>
                <p className="text-[14px] leading-relaxed text-[#5f6368]">{f.desc}</p>
              </motion.div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ================================================================
   Section 4 — About Us
   ================================================================ */
function AboutUsSection() {
  return (
    <section id="about" className="py-24 md:py-32 px-5 md:px-10 bg-white">
      <div className="max-w-[1120px] mx-auto">
        <FadeInSection>
          <SectionHeading label="About us" title="Built in Malaysia, for Malaysia."
            subtitle="ParkJom started with a simple question: why are hundreds of private parking bays empty while commuters circle the station?" />
        </FadeInSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20">
          <FadeInSection delay={0.1}>
            <div className="space-y-8">
              <div className="inline-flex items-center gap-3 bg-[#fef3c7] rounded-xl px-4 py-2.5">
                <span className="text-[11px] font-bold text-[#92400e] tracking-wider">SDG 11</span>
                <span className="text-[13px] text-[#a16207] font-medium">Sustainable Cities &amp; Communities</span>
              </div>
              <p className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] leading-[1.15] tracking-[-0.02em]">
                Reducing traffic,<br /><span className="text-[#007AFF]">one parked car at a time.</span>
              </p>
              <p className="text-[15px] text-[#5f6368] leading-relaxed max-w-[460px]">
                Every weekday morning, official Park &amp; Ride lots in Greater KL fill up before 8:30 AM.
                Meanwhile, private bays in nearby TOD condominiums sit idle.
                ParkJom bridges this gap — reducing congestion, emissions, and frustration.
              </p>
              <div className="flex gap-8 pt-2">
                {[
                  { v: '8:30 AM', l: 'Park & Ride full by' },
                  { v: '~40%', l: 'Private bays idle daily' },
                  { v: 'Zero', l: 'Double‑booking risk' },
                ].map(({ v, l }) => (
                  <div key={l}>
                    <p className="text-[28px] md:text-[32px] font-bold text-[#007AFF] tracking-[-0.02em]">{v}</p>
                    <p className="text-[12px] text-[#9ca3af] mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <div className="bg-[#f8f9fa] rounded-2xl border border-[#e8eaed] p-7 md:p-9">
              <p className="text-[13px] font-semibold text-[#1d1d1f] mb-6 flex items-center gap-2">
                <Users size={16} className="text-[#007AFF]" /> Team
              </p>
              {[
                { initials: 'OJK', name: 'Ooi Jun Kang', role: 'Mobile &amp; User Services',
                  desc: 'Crafting the commuter and owner experience across iOS and Android.' },
                { initials: 'CCJ', name: 'Chaw Chun Jia', role: 'Backend, IoT &amp; Admin',
                  desc: 'Distributed backend, ESP32 firmware, OCC logic, and admin operations.' },
              ].map((m) => (
                <div key={m.name} className="flex gap-4 mb-6 last:mb-0">
                  <div className="w-11 h-11 rounded-xl bg-[#007AFF] flex items-center justify-center text-white font-bold text-[13px] shrink-0">{m.initials}</div>
                  <div>
                    <p className="font-semibold text-[#1d1d1f] text-[15px]">{m.name}</p>
                    <p className="text-[13px] text-[#007AFF] font-medium mb-1">{m.role}</p>
                    <p className="text-[13px] text-[#5f6368] leading-relaxed">{m.desc}</p>
                  </div>
                </div>
              ))}
              <div className="mt-7 pt-6 border-t border-[#e8eaed]">
                <p className="text-[13px] text-[#9ca3af] italic leading-relaxed">
                  "We built ParkJom because we've missed the train too many times circling for parking. This is the solution we wish had existed."
                </p>
              </div>
            </div>
          </FadeInSection>
        </div>
      </div>
    </section>
  );
}


/* ================================================================
   Section 5 — Contact
   ================================================================ */
function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => { setSent(false); setForm({ name: '', email: '', message: '' }); }, 3000);
  };

  return (
    <section id="contact" className="py-24 md:py-32 px-5 md:px-10 bg-[#f8f9fa]">
      <div className="max-w-[1120px] mx-auto">
        <FadeInSection>
          <SectionHeading label="Contact" title="Let's talk."
            subtitle="Questions, feedback, or partnership inquiries — we read every message." />
        </FadeInSection>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 max-w-[880px] mx-auto">
          <FadeInSection delay={0.1} className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="space-y-5">
              {[
                { key: 'name', label: 'Name', placeholder: 'Ali bin Ahmad', type: 'text' },
                { key: 'email', label: 'Email', placeholder: 'ali@example.com', type: 'email' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-[12px] font-semibold text-[#5f6368] mb-1.5">{label}</label>
                  <input type={type} required value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-0 py-3 bg-transparent border-b border-[#d2d2d7] text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:border-[#007AFF] transition-colors" />
                </div>
              ))}
              <div>
                <label className="block text-[12px] font-semibold text-[#5f6368] mb-1.5">Message</label>
                <textarea required rows={3} value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us what's on your mind..."
                  className="w-full px-0 py-3 bg-transparent border-b border-[#d2d2d7] text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:border-[#007AFF] transition-colors resize-none" />
              </div>
              <button type="submit" disabled={sent}
                className={`mt-3 px-8 py-3 rounded-full text-[14px] font-semibold transition-all duration-200 ${
                  sent ? 'bg-[#34c759] text-white' : 'bg-[#007AFF] text-white hover:bg-[#0066d6] active:bg-[#0055b3]'
                }`}>
                {sent ? <span className="flex items-center gap-2"><CheckCircle2 size={16} /> Sent</span>
                      : <span className="flex items-center gap-2"><Send size={15} /> Send message</span>}
              </button>
            </form>
          </FadeInSection>

          <FadeInSection delay={0.2} className="lg:col-span-2 space-y-5">
            {[
              { icon: Mail, label: 'Email', value: 'hello@parkjom.my' },
              { icon: Phone, label: 'Phone', value: '+60 3-XXXX XXXX' },
              { icon: MapPinned, label: 'Location', value: 'Kuala Lumpur, Malaysia' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon size={17} className="text-[#9ca3af]" />
                <div>
                  <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">{label}</p>
                  <p className="text-[14px] text-[#333] font-medium">{value}</p>
                </div>
              </div>
            ))}
            <div className="pt-5 border-t border-[#e8eaed]">
              <div className="flex items-center gap-2 mb-1.5">
                <Clock size={15} className="text-[#9ca3af]" />
                <span className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">Support hours</span>
              </div>
              <p className="text-[14px] text-[#333]">Mon–Fri, 9 AM – 6 PM MYT</p>
              <p className="text-[12px] text-[#9ca3af] mt-0.5">We typically respond within 2 hours.</p>
            </div>
          </FadeInSection>
        </div>
      </div>
    </section>
  );
}


/* ================================================================
   Section 6 — Footer
   ================================================================ */
function FooterSection() {
  return (
    <footer className="bg-[#111] text-[#9ca3af] pt-16 md:pt-20 pb-8 px-5 md:px-10">
      <div className="max-w-[1120px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-14">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center font-extrabold text-[#111] text-[15px]">PJ</div>
              <span className="text-white font-bold text-lg">ParkJom</span>
            </div>
            <p className="text-[13px] leading-relaxed max-w-[200px]">P2P transit parking with IoT smart bollard technology.</p>
          </div>
          {[
            { title: 'Product', links: ['How It Works', 'For Commuters', 'For Owners', 'Pricing'] },
            { title: 'Company', links: ['About', 'Blog', 'Careers', 'Press'] },
            { title: 'Legal', links: ['Terms', 'Privacy', 'Cookies', 'Refunds'] },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-white text-[13px] font-semibold mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => <li key={l}><a href="#" className="text-[13px] hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-7 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-[#6b7280]">&copy; 2026 ParkJom. All rights reserved.</p>
          <div className="flex gap-3">
            {['TW', 'FB', 'IG', 'LI'].map((s) => (
              <span key={s} className="w-7 h-7 rounded-md bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-[#6b7280]">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}


/* ================================================================
   Combined Export
   ================================================================ */
export default function LandingPage() {
  return (
    <div className="font-sans text-[#111] antialiased">
      <HeroSection />
      <HowItWorksSection />
      <WhyParkJomSection />
      <AboutUsSection />
      <ContactSection />
      <FooterSection />
    </div>
  );
}
