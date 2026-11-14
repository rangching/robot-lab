import { useEffect, useRef, useState } from 'react';

/** 元素是否在畫面中；不在畫面時暫停 3D 繪製以省電 */
export function useInView<T extends Element>(margin = '120px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, inView] as const;
}
