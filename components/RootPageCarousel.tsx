"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

const SCROLL_SYNC_DEBOUNCE_MS = 80;

export type RootPageCarouselHandle = {
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
};

type RootPageCarouselProps<T extends string> = {
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  pages: readonly T[];
  renderPanel: (page: T) => ReactNode;
};

function readActiveIndex(element: HTMLElement) {
  if (element.clientWidth <= 0) {
    return 0;
  }

  return Math.round(element.scrollLeft / element.clientWidth);
}

function RootPageCarouselInner<T extends string>(
  { activeIndex, onActiveIndexChange, pages, renderPanel }: RootPageCarouselProps<T>,
  ref: React.ForwardedRef<RootPageCarouselHandle>,
) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollSyncTimerRef = useRef<number | null>(null);
  const hasMountedRef = useRef(false);
  const initialIndexRef = useRef(activeIndex);
  const pageCount = pages.length;

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const element = trackRef.current;
      if (!element || element.clientWidth <= 0) {
        return;
      }

      const clampedIndex = Math.min(Math.max(index, 0), pageCount - 1);
      isProgrammaticScrollRef.current = behavior !== "auto";
      element.scrollTo({
        left: clampedIndex * element.clientWidth,
        behavior,
      });

      if (behavior === "auto") {
        return;
      }

      window.setTimeout(() => {
        if (isProgrammaticScrollRef.current) {
          isProgrammaticScrollRef.current = false;
        }
      }, 500);
    },
    [pageCount],
  );

  useImperativeHandle(ref, () => ({ scrollToIndex }), [scrollToIndex]);

  useLayoutEffect(() => {
    scrollToIndex(initialIndexRef.current, "auto");
    hasMountedRef.current = true;
  }, [scrollToIndex]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      return;
    }

    const element = trackRef.current;
    if (!element) {
      return;
    }

    const scrollIndex = readActiveIndex(element);
    if (scrollIndex === activeIndex) {
      return;
    }

    scrollToIndex(activeIndex, "smooth");
  }, [activeIndex, scrollToIndex]);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) {
      return;
    }

    function finishProgrammaticScroll() {
      isProgrammaticScrollRef.current = false;
    }

    function syncActiveIndexFromScroll() {
      if (isProgrammaticScrollRef.current) {
        return;
      }

      onActiveIndexChange(readActiveIndex(element!));
    }

    function handleScrollEnd() {
      if (isProgrammaticScrollRef.current) {
        finishProgrammaticScroll();
        return;
      }

      syncActiveIndexFromScroll();
    }

    function handleScroll() {
      if (isProgrammaticScrollRef.current) {
        return;
      }

      if (scrollSyncTimerRef.current) {
        window.clearTimeout(scrollSyncTimerRef.current);
      }

      scrollSyncTimerRef.current = window.setTimeout(() => {
        scrollSyncTimerRef.current = null;
        syncActiveIndexFromScroll();
      }, SCROLL_SYNC_DEBOUNCE_MS);
    }

    element.addEventListener("scrollend", handleScrollEnd);
    element.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      element.removeEventListener("scrollend", handleScrollEnd);
      element.removeEventListener("scroll", handleScroll);
      if (scrollSyncTimerRef.current) {
        window.clearTimeout(scrollSyncTimerRef.current);
      }
    };
  }, [onActiveIndexChange]);

  return (
    <div ref={trackRef} className="root-carousel min-h-0 flex-1">
      {pages.map((page) => (
        <div key={page} className="root-carousel-panel">
          {renderPanel(page)}
        </div>
      ))}
    </div>
  );
}

const RootPageCarousel = forwardRef(RootPageCarouselInner) as <
  T extends string,
>(
  props: RootPageCarouselProps<T> & { ref?: React.ForwardedRef<RootPageCarouselHandle> },
) => ReturnType<typeof RootPageCarouselInner>;

export default RootPageCarousel;
