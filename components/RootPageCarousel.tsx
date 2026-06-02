"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react";

const SCROLL_IDLE_MS = 120;

export type RootPageCarouselHandle = {
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
};

type RootPageCarouselProps<T extends string> = {
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  pages: readonly T[];
  ref?: Ref<RootPageCarouselHandle>;
  renderPanel: (page: T, index: number) => ReactNode;
};

function readActiveIndex(element: HTMLElement) {
  if (element.clientWidth <= 0) {
    return 0;
  }

  return Math.round(element.scrollLeft / element.clientWidth);
}

export default function RootPageCarousel<T extends string>({
  activeIndex,
  onActiveIndexChange,
  pages,
  ref,
  renderPanel,
}: RootPageCarouselProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const isUserScrollingRef = useRef(false);
  const hasMountedRef = useRef(false);
  const initialIndexRef = useRef(activeIndex);
  const activeIndexRef = useRef(activeIndex);
  const pageCount = pages.length;

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const element = trackRef.current;
      if (!element || element.clientWidth <= 0) {
        return;
      }

      const clampedIndex = Math.min(Math.max(index, 0), pageCount - 1);
      isProgrammaticScrollRef.current = behavior !== "auto";
      isUserScrollingRef.current = false;
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
    if (!hasMountedRef.current || isUserScrollingRef.current) {
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

    function clearScrollIdleTimer() {
      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    }

    function commitActiveIndexFromScroll() {
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        return;
      }

      isUserScrollingRef.current = false;
      const nextIndex = readActiveIndex(element!);
      if (nextIndex === activeIndexRef.current) {
        return;
      }

      onActiveIndexChange(nextIndex);
    }

    function handleScrollEnd() {
      clearScrollIdleTimer();
      commitActiveIndexFromScroll();
    }

    function handleScroll() {
      if (isProgrammaticScrollRef.current) {
        return;
      }

      isUserScrollingRef.current = true;
      clearScrollIdleTimer();

      scrollIdleTimerRef.current = window.setTimeout(() => {
        scrollIdleTimerRef.current = null;
        commitActiveIndexFromScroll();
      }, SCROLL_IDLE_MS);
    }

    element.addEventListener("scrollend", handleScrollEnd);
    element.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      element.removeEventListener("scrollend", handleScrollEnd);
      element.removeEventListener("scroll", handleScroll);
      clearScrollIdleTimer();
    };
  }, [onActiveIndexChange]);

  const panels = pages.map((page, index) => {
    const panel = renderPanel(page, index);

    return (
      <div key={page} className="root-carousel-panel">
        {panel}
      </div>
    );
  });

  return (
    <div ref={trackRef} className="root-carousel min-h-0 flex-1">
      {panels}
    </div>
  );
}
