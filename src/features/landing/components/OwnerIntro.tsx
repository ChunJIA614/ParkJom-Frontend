import { ArrowUpRight, CalendarDays, LayoutDashboard, Tag } from 'lucide-react';
import Reveal from './Reveal';

const benefits = [
  { icon: CalendarDays, title: 'Your schedule', detail: 'Choose the dates and hours your bay is available.' },
  { icon: Tag, title: 'Your listing', detail: 'Set your rates, add photos, and keep the details up to date.' },
  { icon: LayoutDashboard, title: 'One dashboard', detail: 'Follow your bookings, reviews, and rental earnings.' },
];

export default function OwnerIntro() {
  return (
    <Reveal className="mt-8">
      <div id="for-owners" className="relative grid gap-9 overflow-hidden rounded-3xl border border-[#dce5e3] bg-[#f0f4f1] p-7 sm:p-10 md:grid-cols-[1fr_1fr] md:gap-14 md:p-14">
        <div className="flex flex-col items-start justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b623d]">For parking owners</p>
          <h3 className="mt-4 max-w-md text-[35px] font-semibold leading-[1.1] tracking-[-0.04em] text-[#203b55] md:text-[46px]">Your bay.<br />On your terms.</h3>
          <svg viewBox="0 0 180 14" className="mt-3 h-3 w-40 text-[#d79561]" aria-hidden="true"><path d="M3 8c29-5 59 3 86-2s58-4 87-1M27 12c41-3 75 1 117-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          <p className="mt-5 max-w-[420px] text-base leading-relaxed text-[#65717a]">An empty bay can help someone make their next connection. List it when you do not need it, with the availability and price that work for you.</p>
          <a href="/login?role=Owner" className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#244b6a] px-5 text-sm font-medium text-white transition-colors hover:bg-[#315d7d]">List your parking bay <ArrowUpRight size={18} /></a>
        </div>
        <div className="grid content-center gap-3">
          {benefits.map(({ icon: Icon, title, detail }, index) => (
            <Reveal key={title} delay={index * 0.08}>
              <div className="flex items-start gap-4 rounded-2xl border border-[#dce5e3] bg-[#fdfcf8] p-5">
                <Icon size={24} strokeWidth={1.5} className="mt-1 shrink-0 text-[#58788c]" />
                <div><h4 className="text-lg font-semibold tracking-tight text-[#203b55]">{title}</h4><p className="mt-1 text-sm leading-relaxed text-[#65717a]">{detail}</p></div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
