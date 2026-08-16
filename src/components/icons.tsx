// One icon family, one 20x20 grid, one 1.6 stroke.
// Every icon carries an intrinsic width/height: an SVG without them
// stretches to fill its flex parent, which is how a chevron becomes a
// diagonal bar across a card.
import type { JSX } from 'preact';

type IconProps = JSX.SVGAttributes<SVGSVGElement> & { size?: number };

function useBase({ size = 16, ...rest }: IconProps) {
  return {
    viewBox: '0 0 20 20',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.6,
    'stroke-linecap': 'round' as const,
    'stroke-linejoin': 'round' as const,
    'aria-hidden': true,
    focusable: 'false',
    ...rest,
  };
}

export const CloseIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <path d="M5 8l5 5 5-5" />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <path d="M8 5l5 5-5 5" />
  </svg>
);

export const BackIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <path d="M12 5l-5 5 5 5" />
  </svg>
);

export const TargetIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <circle cx="10" cy="10" r="6" />
    <circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none" />
    <path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4" />
  </svg>
);

export const PulseIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <path d="M2 10.5h3.2l1.6-4.4 2.7 8.8 1.9-6.8 1.2 2.4H18" />
  </svg>
);

export const CopyIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <rect x="7.5" y="7.5" width="9" height="9" rx="1.4" />
    <path d="M13.5 7.5V5.9A1.4 1.4 0 0 0 12.1 4.5H4.9A1.4 1.4 0 0 0 3.5 5.9v7.2a1.4 1.4 0 0 0 1.4 1.4h1.6" />
  </svg>
);

export const GridIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <rect x="2.6" y="2.6" width="6" height="6" rx="1.4" />
    <rect x="11.4" y="2.6" width="6" height="6" rx="1.4" />
    <rect x="2.6" y="11.4" width="6" height="6" rx="1.4" />
    <rect x="11.4" y="11.4" width="6" height="6" rx="1.4" />
  </svg>
);

export const GaugeIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <path d="M3 14.5a7 7 0 1 1 14 0" />
    <path d="M10 14.5L13.4 8.8" />
    <circle cx="10" cy="14.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

export const MagnifierIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <circle cx="8.8" cy="8.8" r="5.4" />
    <path d="M12.8 12.8l4 4" />
  </svg>
);

export const ShareIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <circle cx="14.6" cy="4.8" r="2.3" />
    <circle cx="5.4" cy="10" r="2.3" />
    <circle cx="14.6" cy="15.2" r="2.3" />
    <path d="M12.6 6L7.4 8.9M7.4 11.1l5.2 2.9" />
  </svg>
);

export const ShieldIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <path d="M10 2.4l6 2.2v4.9c0 3.9-2.4 6.6-6 7.7-3.6-1.1-6-3.8-6-7.7V4.6l6-2.2z" />
    <path d="M7.4 9.9l1.9 1.9 3.5-3.7" />
  </svg>
);

export const BracketsIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <path d="M7.5 3.5H6A1.5 1.5 0 0 0 4.5 5v3A1.5 1.5 0 0 1 3 9.5v1A1.5 1.5 0 0 1 4.5 12v3A1.5 1.5 0 0 0 6 16.5h1.5" />
    <path d="M12.5 3.5H14A1.5 1.5 0 0 1 15.5 5v3A1.5 1.5 0 0 0 17 9.5v1A1.5 1.5 0 0 0 15.5 12v3a1.5 1.5 0 0 1-1.5 1.5h-1.5" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <path d="M4.5 10.5l3.6 3.5 7.4-8" />
  </svg>
);

export const EyeIcon = (p: IconProps) => (
  <svg {...useBase(p)}>
    <path d="M1.8 10S4.8 4.2 10 4.2 18.2 10 18.2 10 15.2 15.8 10 15.8 1.8 10 1.8 10z" />
    <circle cx="10" cy="10" r="2.6" />
  </svg>
);
