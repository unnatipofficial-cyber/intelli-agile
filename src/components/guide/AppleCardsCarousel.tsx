import { AnimatePresence, motion } from "framer-motion";
import { IconArrowNarrowLeft, IconArrowNarrowRight, IconX } from "@tabler/icons-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";
import { staggeredEnter } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * AppleCardsCarousel — a horizontal deck of tall photo cards that expand into
 * a full-screen modal when opened.
 *
 * Structure follows the classic Apple-card pattern: a scroll container with
 * arrow buttons that enable/disable based on scroll position, a context that
 * lets each card tell the carousel where to scroll after it closes, and a
 * modal that locks page scroll and dismisses on Escape or an outside click.
 *
 * Adaptations from the reference implementation:
 *  - Card entrance uses the shared `staggeredEnter` token instead of a
 *    hand-picked `0.2s × index` delay, so the cascade is capped and uses the
 *    product's curve.
 *  - Scroll locking is on <html> (the real scroller), saved and restored
 *    rather than clobbered, because the guide page also runs Lenis.
 *  - BlurImage degrades to a gradient placeholder when a cover fails to load,
 *    so a dead CDN link never leaves a blank card.
 */

export interface CarouselCardData {
  src: string;
  title: string;
  category: string;
  content: ReactNode;
}

interface CarouselProps {
  items: ReactElement[];
  initialScroll?: number;
}

export const CarouselContext = createContext<{
  onCardClose: (index: number) => void;
  currentIndex: number;
}>({
  onCardClose: () => {},
  currentIndex: 0,
});

/* ── Demo wrapper ──────────────────────────────────────────────── */

export default function AppleCardsCarouselDemo({
  cards,
  kicker = "The tour, in ten cards",
  title = "Every section of AIE, as a card you can open.",
}: {
  cards: CarouselCardData[];
  kicker?: ReactNode;
  title?: ReactNode;
}) {
  const items = cards.map((card, index) => <Card key={card.src} card={card} index={index} />);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-4 text-left sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{kicker}</p>
        <h2 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Scroll the deck, open a card, and read exactly what happens on that page — what you do, and what
          AIE does for you.
        </p>
      </div>
      <Carousel items={items} />
    </div>
  );
}

/* ── Carousel ──────────────────────────────────────────────────── */

export const Carousel = ({ items, initialScroll = 0 }: CarouselProps) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const checkScrollability = () => {
    const element = carouselRef.current;
    if (!element) return;
    const { scrollLeft, scrollWidth, clientWidth } = element;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    const cardStep = (window.innerWidth < 768 ? 224 + 16 : 384 + 16) || 1;
    setCurrentIndex(Math.min(items.length - 1, Math.max(0, Math.round(scrollLeft / cardStep))));
  };

  useEffect(() => {
    const element = carouselRef.current;
    if (element) {
      element.scrollLeft = initialScroll;
      checkScrollability();
    }
    window.addEventListener("resize", checkScrollability);
    return () => window.removeEventListener("resize", checkScrollability);
    // Initial scroll position is a mount concern; re-running per item would
    // fight the reader's scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollBy = (delta: number) => {
    carouselRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  const handleCardClose = (index: number) => {
    const element = carouselRef.current;
    if (!element) return;
    const cardWidth = window.innerWidth < 768 ? 224 : 384;
    const gap = 16;
    element.scrollTo({ left: Math.max(0, (cardWidth + gap) * index), behavior: "smooth" });
    setCurrentIndex(index);
  };

  const arrowClass =
    "relative z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/70 aie-interactive disabled:pointer-events-none disabled:opacity-35";

  return (
    <CarouselContext.Provider value={{ onCardClose: handleCardClose, currentIndex }}>
      <div className="relative w-full">
        {/* Edge fades reflect which direction you can still travel. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-30 hidden w-16 bg-gradient-to-r from-background via-background/70 to-transparent transition-opacity duration-300 sm:block",
            canScrollLeft ? "opacity-90" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-30 hidden w-24 bg-gradient-to-l from-background via-background/70 to-transparent transition-opacity duration-300 sm:block",
            canScrollRight ? "opacity-90" : "opacity-0",
          )}
        />

        <div
          className="flex w-full snap-x snap-mandatory overflow-x-scroll overscroll-x-contain scroll-smooth py-8 [scrollbar-width:none] sm:py-12 [&::-webkit-scrollbar]:hidden"
          ref={carouselRef}
          onScroll={checkScrollability}
          role="list"
          aria-label="Guide sections"
        >
          <div className="mx-auto flex max-w-7xl flex-row items-stretch justify-start gap-4 pl-4 pr-4 sm:pl-6">
            {items.map((item, index) => (
              <motion.div
                key={`card-${index}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={staggeredEnter(index)}
                className="snap-start rounded-3xl last:pr-[8%] md:last:pr-[28%]"
              >
                {item}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-1 sm:px-6">
          <p className="text-xs font-medium text-muted-foreground tabular-nums" aria-live="polite">
            {currentIndex + 1} / {items.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={arrowClass}
              onClick={() => scrollBy(-400)}
              disabled={!canScrollLeft}
              aria-label="Previous cards"
            >
              <IconArrowNarrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              type="button"
              className={arrowClass}
              onClick={() => scrollBy(400)}
              disabled={!canScrollRight}
              aria-label="Next cards"
            >
              <IconArrowNarrowRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </CarouselContext.Provider>
  );
};

/* ── Card ──────────────────────────────────────────────────────── */

export const Card = ({
  card,
  index,
  layout = false,
}: {
  card: CarouselCardData;
  index: number;
  layout?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { onCardClose } = useContext(CarouselContext);

  const handleClose = () => {
    setOpen(false);
    onCardClose(index);
  };

  // Escape closes, and page scroll is locked only while the modal is open —
  // on <html>, which is the element that actually scrolls, with the previous
  // inline value restored so other routes keep their own setting.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useOutsideClick(containerRef, () => {
    if (open) handleClose();
  });

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 h-screen overflow-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              className="fixed inset-0 h-full w-full bg-black/80 backdrop-blur-lg"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.99 }}
              transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              ref={containerRef}
              layoutId={layout ? `card-${card.title}` : undefined}
              data-lenis-prevent
              className="relative z-[60] mx-auto my-6 h-fit max-h-[88vh] max-w-5xl overflow-y-auto rounded-3xl border border-border/60 bg-background p-4 shadow-2xl md:my-10 md:p-10"
            >
              <button
                type="button"
                className="sticky top-0 z-10 ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-80"
                onClick={handleClose}
                aria-label="Close section"
              >
                <IconX className="h-5 w-5" />
              </button>

              <motion.p
                layoutId={layout ? `category-${card.title}` : undefined}
                className="text-xs font-semibold uppercase tracking-[0.16em] text-primary"
              >
                {card.category}
              </motion.p>
              <motion.h3
                layoutId={layout ? `title-${card.title}` : undefined}
                className="mt-3 text-2xl font-bold tracking-tight md:text-5xl"
              >
                {card.title}
              </motion.h3>

              <div className="py-6 md:py-10">{card.content}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        layoutId={layout ? `card-${card.title}` : undefined}
        onClick={() => setOpen(true)}
        aria-label={`Open guide: ${card.title}`}
        className="group relative flex h-80 w-56 flex-col items-start justify-start overflow-hidden rounded-3xl bg-muted text-left md:h-[40rem] md:w-96"
      >
        <div className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-b from-black/75 via-black/25 to-black/70" />
        <BlurImage
          src={card.src}
          alt={card.title}
          className="absolute inset-0 z-10 h-full w-full object-cover motion-safe:transition-transform duration-700 motion-safe:group-hover:scale-105"
        />
        <div className="relative z-40 p-6 md:p-8">
          <span className="inline-block rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
            {card.category}
          </span>
          <p className="mt-3 max-w-xs text-xl font-semibold text-white [text-wrap:balance] md:text-3xl">
            {card.title}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-white/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            Open the section <IconArrowNarrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </motion.button>
    </>
  );
};

/* ── Image ─────────────────────────────────────────────────────── */

export const BlurImage = ({
  src,
  className,
  alt,
  width,
  height,
}: {
  src: string;
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  if (status === "error") {
    // A dead cover must not leave a hole in the deck: fall back to a themed
    // gradient with the same geometry as the photo.
    return (
      <div
        role="img"
        aria-label={alt ?? "Guide cover"}
        className={cn(
          "bg-gradient-to-br from-primary/30 via-muted to-background flex items-center justify-center",
          className,
        )}
      >
        <span className="text-3xl font-black text-foreground/25">AIE</span>
      </div>
    );
  }

  return (
    <img
      className={cn(
        "h-full w-full transition duration-500",
        status === "loading" ? "blur-sm" : "blur-0",
        className,
      )}
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("error")}
      src={src}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      alt={alt ?? "Section cover"}
    />
  );
};

/* ── Outside click ─────────────────────────────────────────────── */

export const useOutsideClick = (
  ref: RefObject<HTMLDivElement | null>,
  callback: (event: Event) => void,
) => {
  useEffect(() => {
    const listener = (event: Event) => {
      if (!ref.current || event.target instanceof Node === false) return;
      if (ref.current.contains(event.target)) return;
      callback(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener, { passive: true });

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, callback]);
};
