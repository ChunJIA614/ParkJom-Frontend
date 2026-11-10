import { useEffect, useState } from 'react';
import { ArrowUpRight, BusFront, TrainFront } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { readableTextOn } from '@/lib/contrast';
import { getTransitRoutes } from '@/services/gtfsApi';
import { buildRouteCatalog, type CoverageRoute } from '../lib/routeCatalog';
import Reveal from './Reveal';

export default function TransitCoverage() {
  const { continueAsGuest } = useAuth();
  const [routes, setRoutes] = useState<CoverageRoute[]>([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const controller = new AbortController();
    let receivedApiRoutes = false;
    // The bundled map remains available when the public route service is offline.
    void fetch('/data/kl_rail_lines.json', { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        if (!receivedApiRoutes && !controller.signal.aborted) {
          setRoutes(buildRouteCatalog((data.features ?? []).map((feature: { properties: Record<string, unknown> }) => feature.properties)));
        }
      }).catch(() => {});
    void getTransitRoutes(controller.signal).then(data => {
      const catalogue = buildRouteCatalog(data.map(route => ({ ...route })));
      if (catalogue.length && !controller.signal.aborted) {
        receivedApiRoutes = true;
        setRoutes(catalogue);
      }
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  const categories = ['All', ...new Set(routes.map(route => route.category))];
  const visible = filter === 'All' ? routes : routes.filter(route => route.category === filter);
  const openMap = () => continueAsGuest();

  return (
    <section id="stations" className="scroll-mt-24 bg-[#f4f5f1] px-5 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-[1180px]">
        <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-[720px]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#58788c]">A little closer to everywhere</p>
            <h2 className="mt-4 text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#203b55] md:text-[56px]">Your line. Your connection.</h2>
            <p className="mt-5 text-[17px] leading-relaxed text-[#65717a] md:text-[19px]">Explore the full rail network in ParkJom, then connect the dots with stations, bus routes, and nearby parking.</p>
          </div>
          <a href="/commuter?tab=map" onClick={openMap} className="inline-flex min-h-11 shrink-0 items-center gap-2 font-medium text-[#244b6a] hover:underline">Open transit map <ArrowUpRight size={19} /></a>
        </Reveal>

        <Reveal className="mt-9"><div className="flex flex-wrap gap-2" role="group" aria-label="Filter transit routes">
          {categories.map(category => (
            <button key={category} type="button" aria-pressed={filter === category} onClick={() => setFilter(category)} className={`min-h-11 rounded-full border px-5 text-sm transition-colors ${filter === category ? 'border-[#244b6a] bg-[#244b6a] text-white' : 'border-[#d7dfdf] bg-transparent text-[#4d6577] hover:bg-white'}`}>{category === 'All' ? 'All lines' : category}</button>
          ))}
        </div></Reveal>

        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Transit routes available in ParkJom">
          {visible.map((route, index) => (
            <li key={route.id}>
              <Reveal className="h-full" delay={index % 4 * 0.05}>
              <a href={`/commuter?tab=map&line=${encodeURIComponent(route.id)}`} onClick={openMap} className="group flex h-full min-h-[188px] flex-col rounded-2xl border border-[#e1e6e3] bg-[#fdfcf8] p-6 transition-colors hover:border-[#6d8ba0]">
                <span className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-h-7 min-w-9 items-center justify-center rounded-md px-2 text-[11px] font-bold" style={{ backgroundColor: route.color, color: readableTextOn(route.color) }}>{route.shortName}</span>
                  <span className="text-xs text-[#71808a]">{route.category}</span>
                </span>
                <h3 className="mb-6 mt-5 text-[21px] font-semibold leading-tight tracking-[-0.025em] text-[#203b55]">{route.name}</h3>
                <span className="mt-auto flex items-center justify-between gap-2 text-sm text-[#58788c]">Explore the line <ArrowUpRight size={17} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
              </a>
              </Reveal>
            </li>
          ))}
        </ul>
        {!routes.length && <p className="mt-6 text-sm text-[#65717a]">Open the transit map to explore routes and stations.</p>}

        <Reveal className="mt-5 flex flex-col justify-between gap-5 rounded-2xl border border-dashed border-[#bdcccf] p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <BusFront size={27} strokeWidth={1.5} className="mt-1 shrink-0 text-[#58788c]" />
            <div><h3 className="font-semibold text-[#203b55]">The journey goes beyond the station.</h3><p className="mt-1 max-w-[650px] text-sm leading-relaxed text-[#65717a]">Find Rapid KL bus routes and stops in the map alongside your rail connections.</p></div>
          </div>
          <a href="/commuter?tab=map" onClick={openMap} className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-[#244b6a]">Plan your connection <TrainFront size={17} /></a>
        </Reveal>
        <p className="mt-5 max-w-[850px] text-xs leading-relaxed text-[#71808a]">The map shows transit coverage. Parking prices, walking distances, and available dates depend on each verified listing. Check the app and the transport operator for current availability and service information.</p>
      </div>
    </section>
  );
}
