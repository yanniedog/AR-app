import React from 'react';
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Rect,
  type SvgProps,
} from 'react-native-svg';

import { useTheme } from '../../theme/ThemeProvider';

export type LedgerIconName =
  | 'about'
  | 'alert'
  | 'bank'
  | 'calendar'
  | 'calculator'
  | 'changes'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'compare'
  | 'copy'
  | 'explore'
  | 'external-link'
  | 'filter'
  | 'info'
  | 'lock'
  | 'my-rates'
  | 'offline'
  | 'profile'
  | 'receipt'
  | 'refresh'
  | 'remove'
  | 'save'
  | 'search'
  | 'settings'
  | 'share'
  | 'success'
  | 'today'
  | 'utility'
  | 'warning';

export interface LedgerIconProps extends Omit<SvgProps, 'color'> {
  name: LedgerIconName;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}

function IconDrawing({ name, color }: { name: LedgerIconName; color: string }) {
  const line = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'today':
      return <><Rect x="4" y="5.5" width="16" height="14" rx="2" {...line} /><Line x1="8" y1="3.5" x2="8" y2="7.5" {...line} /><Line x1="16" y1="3.5" x2="16" y2="7.5" {...line} /><Line x1="4" y1="10" x2="20" y2="10" {...line} /><Circle cx="12" cy="14.5" r="1.75" fill={color} /></>;
    case 'explore':
      return <><Circle cx="12" cy="12" r="8" {...line} /><Path d="M15.5 8.5l-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" {...line} /></>;
    case 'changes':
      return <><Path d="M4 17.5l5-5 3.2 2.8L20 7.5" {...line} /><Path d="M16.5 7.5H20V11" {...line} /></>;
    case 'my-rates':
      return <><Path d="M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v14l-3-2-3 2-3-2-3 2-3-2V6A1.5 1.5 0 0 1 6 4.5Z" {...line} /><Line x1="8" y1="9" x2="16" y2="9" {...line} /><Line x1="8" y1="13" x2="14" y2="13" {...line} /></>;
    case 'search':
      return <><Circle cx="10.5" cy="10.5" r="5.5" {...line} /><Line x1="14.7" y1="14.7" x2="20" y2="20" {...line} /></>;
    case 'utility':
      return <><Circle cx="12" cy="12" r="2.25" {...line} /><Path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9 18 18M18 6l-2.1 2.1M8.1 15.9 6 18" {...line} /></>;
    case 'profile':
      return <><Circle cx="12" cy="8" r="3.5" {...line} /><Path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" {...line} /></>;
    case 'settings':
      return <><Circle cx="12" cy="12" r="2.75" {...line} /><Path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" {...line} /></>;
    case 'about':
    case 'info':
      return <><Circle cx="12" cy="12" r="8" {...line} /><Line x1="12" y1="10.5" x2="12" y2="16" {...line} /><Circle cx="12" cy="7.5" r="1" fill={color} /></>;
    case 'bank':
      return <><Path d="M3.5 9 12 4l8.5 5" {...line} /><Line x1="5" y1="10" x2="19" y2="10" {...line} /><Path d="M6.5 10v7M10.2 10v7M13.8 10v7M17.5 10v7M4 20h16M5 17h14" {...line} /></>;
    case 'calculator':
      return <><Rect x="5" y="3.5" width="14" height="17" rx="2" {...line} /><Rect x="8" y="6.5" width="8" height="3" rx=".5" {...line} /><Circle cx="9" cy="13" r=".8" fill={color} /><Circle cx="12" cy="13" r=".8" fill={color} /><Circle cx="15" cy="13" r=".8" fill={color} /><Circle cx="9" cy="17" r=".8" fill={color} /><Circle cx="12" cy="17" r=".8" fill={color} /><Circle cx="15" cy="17" r=".8" fill={color} /></>;
    case 'compare':
      return <><Path d="M7 5v14M17 5v14M4.5 8 7 5l2.5 3M14.5 16 17 19l2.5-3" {...line} /><Line x1="7" y1="12" x2="17" y2="12" {...line} /></>;
    case 'calendar':
      return <><Rect x="4" y="5.5" width="16" height="14" rx="2" {...line} /><Line x1="8" y1="3.5" x2="8" y2="7.5" {...line} /><Line x1="16" y1="3.5" x2="16" y2="7.5" {...line} /><Line x1="4" y1="10" x2="20" y2="10" {...line} /></>;
    case 'alert':
    case 'warning':
      return <><Path d="M11 4.8 3.8 18a1.4 1.4 0 0 0 1.2 2h14a1.4 1.4 0 0 0 1.2-2L13 4.8a1.15 1.15 0 0 0-2 0Z" {...line} /><Line x1="12" y1="9" x2="12" y2="14" {...line} /><Circle cx="12" cy="17" r=".9" fill={color} /></>;
    case 'save':
      return <><Path d="M6 3.5h10l3 3v14H5v-16a1 1 0 0 1 1-1Z" {...line} /><Rect x="8" y="3.5" width="7" height="5" {...line} /><Rect x="8" y="13" width="8" height="7.5" rx="1" {...line} /></>;
    case 'share':
      return <><Circle cx="18" cy="5" r="2.5" {...line} /><Circle cx="6" cy="12" r="2.5" {...line} /><Circle cx="18" cy="19" r="2.5" {...line} /><Line x1="8.3" y1="10.8" x2="15.7" y2="6.2" {...line} /><Line x1="8.3" y1="13.2" x2="15.7" y2="17.8" {...line} /></>;
    case 'copy':
      return <><Rect x="8" y="7" width="11" height="13" rx="2" {...line} /><Path d="M16 7V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" {...line} /></>;
    case 'refresh':
      return <><Path d="M19.5 8V4.5L17 7a8 8 0 1 0 2.2 8" {...line} /><Line x1="19.5" y1="4.5" x2="19.5" y2="8" {...line} /><Line x1="19.5" y1="8" x2="16" y2="8" {...line} /></>;
    case 'filter':
      return <Path d="M4 6h16M7 12h10M10 18h4" {...line} />;
    case 'chevron-right':
      return <Polyline points="9 5 16 12 9 19" {...line} />;
    case 'chevron-left':
      return <Polyline points="15 5 8 12 15 19" {...line} />;
    case 'chevron-down':
      return <Polyline points="5 9 12 16 19 9" {...line} />;
    case 'close':
    case 'remove':
      return <Path d="M6 6l12 12M18 6 6 18" {...line} />;
    case 'offline':
      return <><Path d="M5.5 14.5a4 4 0 0 1 2.1-7.4A6 6 0 0 1 18.8 9a3.5 3.5 0 0 1-.3 7H9" {...line} /><Line x1="4" y1="4" x2="20" y2="20" {...line} /></>;
    case 'success':
      return <><Circle cx="12" cy="12" r="8" {...line} /><Path d="m8.2 12.2 2.4 2.4 5.2-5.4" {...line} /></>;
    case 'external-link':
      return <><Path d="M13 5h6v6M19 5l-8 8" {...line} /><Path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" {...line} /></>;
    case 'lock':
      return <><Rect x="5" y="10" width="14" height="10" rx="2" {...line} /><Path d="M8 10V7a4 4 0 0 1 8 0v3" {...line} /><Circle cx="12" cy="15" r="1" fill={color} /></>;
    case 'receipt':
      return <><Path d="M6 4h12v16l-2-1.5L14 20l-2-1.5L10 20l-2-1.5L6 20V4Z" {...line} /><Line x1="9" y1="8" x2="15" y2="8" {...line} /><Line x1="9" y1="12" x2="15" y2="12" {...line} /></>;
  }
}

/**
 * Code-native Rate Ledger registry. Selected utility geometry is adapted from
 * the pinned MIT-licensed Iconoir source and optically normalised here.
 */
export function LedgerIcon({
  name,
  size = 24,
  color,
  accessibilityLabel,
  ...rest
}: LedgerIconProps) {
  const theme = useTheme();
  const labelled = Boolean(accessibilityLabel);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={labelled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={labelled ? 'image' : undefined}
      {...rest}
    >
      <IconDrawing name={name} color={color ?? theme.ledger.ink} />
    </Svg>
  );
}
