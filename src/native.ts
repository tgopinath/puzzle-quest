import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef } from 'react';

export const isNative = Capacitor.isNativePlatform();

// Android back button: the most recently mounted handler wins (an open modal before the screen under it).
const stack: { current: () => void }[] = [];

if (isNative) {
  void App.addListener('backButton', () => {
    const top = stack[stack.length - 1];
    if (top) top.current();
    else void App.minimizeApp(); // on the home screen, back sends the app to the background
  });
}

export function useBackHandler(fn: (() => void) | undefined) {
  const ref = useRef(fn);
  ref.current = fn;
  const enabled = !!fn;
  useEffect(() => {
    if (!enabled) return;
    const entry = { current: () => ref.current?.() };
    stack.push(entry);
    return () => { stack.splice(stack.indexOf(entry), 1); };
  }, [enabled]);
}
