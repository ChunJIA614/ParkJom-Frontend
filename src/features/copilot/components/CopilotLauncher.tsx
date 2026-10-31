import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Loader2, Mic, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useCopilotChat } from '../hooks/useCopilotChat';
import { CopilotCardView } from './CopilotCards';

const SUGGESTIONS = [
  'Find parking near an LRT station close to me',
  'I need to reach KLCC by 9 AM tomorrow from USJ Subang',
  'Cari parking dekat MRT Kajang untuk esok',
  'When is the next train at Subang Jaya?',
];

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const getSpeechRecognition = (): (new () => SpeechRecognitionLike) | null => {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
};

/**
 * Floating "ParkJom Copilot" assistant for commuters: a launcher button plus
 * a chat panel that renders AI replies with interactive parking/transit cards.
 */
export default function CopilotLauncher() {
  const { messages, isSending, send, reset, isSignedIn } = useCopilotChat();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const reduceMotion = useReducedMotion();
  const SpeechRecognition = getSpeechRecognition();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messages, isSending, reduceMotion]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  if (!isSignedIn) return null;

  const submit = (text: string) => {
    if (!text.trim() || isSending) return;
    void send(text);
    setInput('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(input);
  };

  const toggleVoice = () => {
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-MY';
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((r) => r[0]?.transcript ?? '').join('');
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="copilot-launcher"
            type="button"
            initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduceMotion ? undefined : { scale: 0.8, opacity: 0 }}
            onClick={() => setOpen(true)}
            aria-label="Open ParkJom Copilot"
            className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 md:right-6 z-[1050] flex items-center gap-2 rounded-full bg-[#007AFF] dark:bg-[#0071E3] pl-3.5 pr-4 h-12 text-white shadow-lg shadow-[#007AFF]/30 hover:bg-[#0066d6] active:scale-95 cursor-pointer"
          >
            <Sparkles size={18} />
            <span className="text-[13px] font-semibold">Ask Copilot</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            key="copilot-panel"
            role="dialog"
            aria-label="ParkJom Copilot"
            initial={reduceMotion ? false : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed z-[1150] inset-x-0 bottom-0 top-[calc(3.75rem+env(safe-area-inset-top,0px))] rounded-t-3xl md:top-auto md:inset-x-auto md:right-6 md:bottom-6 md:h-[min(600px,calc(100dvh-5.75rem))] md:w-[400px] md:rounded-3xl flex flex-col overflow-hidden border border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7] dark:bg-[#141417] shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-[#18181C]/80 backdrop-blur border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#007AFF]/10 text-[#007AFF] dark:text-[#0A84FF]">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">ParkJom Copilot</p>
                <p className="text-[11px] text-[#6e6e73] dark:text-[#A1A1AA]">AI park-and-ride planner · may make mistakes</p>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={reset} aria-label="New chat" className="rounded-full p-2 text-[#6e6e73] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
                  <RotateCcw size={16} />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Copilot" className="rounded-full p-2 text-[#6e6e73] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
                <X size={18} />
              </button>
            </header>

            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4" aria-live="polite">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-[13px] text-[#6e6e73] dark:text-[#A1A1AA]">
                    Tell me where you're heading. I'll find a bay near a rail station and check the trains for you.
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => submit(s)}
                        className="text-left rounded-2xl bg-white dark:bg-[#18181C] border border-black/[0.06] dark:border-white/[0.08] px-3 py-2.5 text-[13px] text-[#1d1d1f] dark:text-white hover:border-[#007AFF]/40 cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'space-y-2'}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-md bg-[#007AFF] dark:bg-[#0071E3] px-3.5 py-2 text-[13px] text-white whitespace-pre-wrap'
                        : `max-w-[92%] rounded-2xl rounded-bl-md px-3.5 py-2 text-[13px] whitespace-pre-wrap ${
                          m.isError
                            ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                            : 'bg-white dark:bg-[#18181C] text-[#1d1d1f] dark:text-white border border-black/[0.06] dark:border-white/[0.08]'
                        }`
                    }
                  >
                    {m.text}
                  </div>
                  {m.cards && m.cards.length > 0 && (
                    <div className="space-y-2">
                      {m.cards.map((card, i) => <CopilotCardView key={`${m.id}-${i}`} card={card} />)}
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-[#18181C] border border-black/[0.06] dark:border-white/[0.08] px-3.5 py-2 text-[13px] text-[#6e6e73] dark:text-[#A1A1AA]">
                  <Loader2 size={14} className="animate-spin" /> Checking stations and bays…
                </div>
              )}
            </div>

            {/* Composer */}
            <form onSubmit={onSubmit} className="flex items-end gap-2 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:pb-3 bg-white/80 dark:bg-[#18181C]/80 backdrop-blur border-t border-black/[0.06] dark:border-white/[0.08]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); }
                }}
                rows={1}
                placeholder={listening ? 'Listening…' : 'Where are you heading?'}
                aria-label="Message ParkJom Copilot"
                className="flex-1 resize-none max-h-28 rounded-2xl bg-[#F5F5F7] dark:bg-[#242429] px-3.5 py-2.5 text-[14px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
              {SpeechRecognition && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                  className={`grid h-10 w-10 flex-none place-items-center rounded-full cursor-pointer ${
                    listening ? 'bg-red-500 text-white animate-pulse' : 'bg-[#F5F5F7] dark:bg-[#242429] text-[#6e6e73] dark:text-[#A1A1AA]'
                  }`}
                >
                  <Mic size={18} />
                </button>
              )}
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                aria-label="Send"
                className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[#007AFF] dark:bg-[#0071E3] text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
