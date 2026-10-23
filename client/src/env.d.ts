/// <reference types="vite/client" />
import 'react';

// The design uses CSS custom properties in inline styles (--c, --t, --p…)
declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
