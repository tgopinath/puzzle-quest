import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react';

export interface GameApi {
  mistake: () => void;
  solved: () => void;
  progress: (done: number, total: number) => void;
  hintTick: number; // increments every time the child presses Hint
  guidance: 'strong' | 'light' | 'none';
  paused: boolean;
}

interface DragState { id: string; x: number; y: number; dx: number; dy: number; w: number; h: number; moved: boolean; sx: number; sy: number }

/**
 * Pointer-based drag and drop that works the same with mouse, touch and pen.
 * Drop targets are any element with a `data-drop="<id>"` attribute.
 * A short press without movement counts as a tap (tap a piece, then tap a slot).
 */
export function useDragDrop(onDrop: (dragId: string, dropId: string | null) => void, onTap?: (id: string) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const ref = useRef<DragState | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const findDrop = (x: number, y: number) => {
    const el = document.elementsFromPoint(x, y).find((n) => (n as HTMLElement).dataset?.drop) as HTMLElement | undefined;
    return el?.dataset.drop ?? null;
  };

  const bind = useCallback((id: string, disabled = false) => {
    const isMe = drag?.id === id;
    const style: CSSProperties | undefined = isMe && drag.moved
      ? { position: 'fixed', left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w, height: drag.h, zIndex: 1000, pointerEvents: 'none', transform: 'scale(1.08)', filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.25))' }
      : undefined;
    return {
      style,
      'data-dragging': isMe && drag.moved ? 'true' : undefined,
      onPointerDown: (e: RPointerEvent<HTMLElement>) => {
        if (disabled || e.button > 0) return;
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.setPointerCapture(e.pointerId);
        const s = { id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, moved: false };
        ref.current = s;
        setDrag(s);
      },
      onPointerMove: (e: RPointerEvent<HTMLElement>) => {
        const d = ref.current;
        if (!d || d.id !== id) return;
        const moved = d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8;
        const next = { ...d, x: e.clientX, y: e.clientY, moved };
        ref.current = next;
        setDrag(next);
        if (moved) setOver(findDrop(e.clientX, e.clientY));
      },
      onPointerUp: (e: RPointerEvent<HTMLElement>) => {
        const d = ref.current;
        if (!d || d.id !== id) return;
        ref.current = null;
        setDrag(null);
        setOver(null);
        if (d.moved) onDrop(id, findDrop(e.clientX, e.clientY));
        else onTap?.(id);
      },
      onPointerCancel: () => { ref.current = null; setDrag(null); setOver(null); },
      onKeyDown: (e: RKeyboardEvent<HTMLElement>) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTap?.(id); }
      },
    };
  }, [drag, onDrop, onTap]);

  return { bind, dragging: drag?.moved ? drag.id : null, over };
}
