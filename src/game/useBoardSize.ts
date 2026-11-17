import { useEffect, useState } from 'react';

/** Square board size that fits the viewport: `vh` is the share of viewport height it may use. */
export function useBoardSize(vh = 0.55, max = 520) {
  const calc = () => Math.floor(Math.min(window.innerWidth - 40, window.innerHeight * vh, max));
  const [size, setSize] = useState(calc);
  useEffect(() => {
    const on = () => setSize(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vh, max]);
  return size;
}
