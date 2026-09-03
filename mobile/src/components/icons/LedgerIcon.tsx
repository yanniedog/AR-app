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
  | 'arrow-down'
  | 'arrow-up'
  | 'bank'
  | 'bell'
  | 'calendar'
  | 'calculator'
  | 'changes'
  | 'checkbox'
  | 'checkbox-empty'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'close'
  | 'code'
  | 'compare'
  | 'copy'
  | 'document'
  | 'download'
  | 'explore'
  | 'external-link'
  | 'filter'
  | 'fingerprint'
  | 'flask'
  | 'folder'
  | 'help'
  | 'home'
  | 'info'
  | 'layers'
  | 'link'
  | 'lock'
  | 'message'
  | 'money'
  | 'my-rates'
  | 'offline'
  | 'profile'
  | 'pulse'
  | 'receipt'
  | 'refresh'
  | 'remove'
  | 'remove-circle'
  | 'save'
  | 'search'
  | 'settings'
  | 'share'
  | 'shield'
  | 'star'
  | 'star-filled'
  | 'success'
  | 'time'
  | 'today'
  | 'trophy'
  | 'upload'
  | 'user'
  | 'utility'
  | 'wallet'
  | 'warning'
  | 'wifi';

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
    case 'arrow-up':
      return <><Line x1="12" y1="20" x2="12" y2="4" {...line} /><Polyline points="5 11 12 4 19 11" {...line} /></>;
    case 'arrow-down':
      return <><Line x1="12" y1="4" x2="12" y2="20" {...line} /><Polyline points="5 13 12 20 19 13" {...line} /></>;
    case 'bell':
      return <><Path d="M18 8.4c0-3.54-2.69-6.4-6-6.4S6 4.86 6 8.4C6 15.87 3 18 3 18h18s-3-2.13-3-9.6Z" {...line} /><Path d="M13.73 21a2 2 0 0 1-3.46 0" {...line} /></>;
    case 'checkbox':
      return <><Rect x="3.5" y="3.5" width="17" height="17" rx="1.5" {...line} /><Path d="m7.5 12 3 3 6.5-7" {...line} /></>;
    case 'checkbox-empty':
      return <Rect x="3.5" y="3.5" width="17" height="17" rx="1.5" {...line} />;
    case 'code':
      return <><Path d="m9.5 6-3.2 12" {...line} /><Polyline points="6.5 8.5 3 12 6.5 15.5" {...line} /><Polyline points="17.5 8.5 21 12 17.5 15.5" {...line} /></>;
    case 'document':
      return <><Path d="M5 2.5h11l3 3V21.5H5Z" {...line} /><Path d="M15.5 2.5V6H19M8 10h8M8 14h8M8 18h5" {...line} /></>;
    case 'download':
      return <><Line x1="6" y1="20" x2="18" y2="20" {...line} /><Path d="M12 4v12m0 0 3.5-3.5M12 16l-3.5-3.5" {...line} /></>;
    case 'fingerprint':
      return <><Path d="M7 3.5A9 9 0 0 1 20.65 8.5M3 21.5V11a9 9 0 0 1 .5-3M21 21.5V14" {...line} /><Path d="M18 21.5V11.3A6.15 6.15 0 0 0 12 5a6.15 6.15 0 0 0-6 6.3V14M6 21.5V18M9 21.5V11.2A3.08 3.08 0 0 1 12 8c.87 0 1.65.38 2.2 1M15 21.5V14M12 21.5V18.5M12 11v3" {...line} /></>;
    case 'flask':
      return <><Line x1="8" y1="4" x2="16" y2="4" {...line} /><Path d="M9 4.5v5.75c0 .48-.17.95-.48 1.31l-5.04 5.88A2 2 0 0 0 3 18.74V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-.26a2 2 0 0 0-.48-1.3l-5.04-5.88A2 2 0 0 1 15 10.25V4.5M5.5 15h13" {...line} /></>;
    case 'folder':
      return <Path d="M2.5 10.5V5h6.3l3.3 2.8h9.4v11.7h-19v-9h19" {...line} />;
    case 'help':
      return <><Circle cx="12" cy="12" r="9" {...line} /><Path d="M9 9c0-3.5 5.5-3.5 5.5 0 0 2.5-2.5 2-2.5 5M12 18h.01" {...line} /></>;
    case 'home':
      return <><Path d="M7 21a4 4 0 0 1-4-4v-6.3a4 4 0 0 1 1.93-3.42l5-3.03a4 4 0 0 1 4.14 0l5 3.03A4 4 0 0 1 21 10.7V17a4 4 0 0 1-4 4H7Z" {...line} /><Line x1="9" y1="17" x2="15" y2="17" {...line} /></>;
    case 'layers':
      return <><Polyline points="3 8 12 3 21 8 12 13 3 8" {...line} /><Polyline points="3 12 12 17 21 12" {...line} /><Polyline points="3 16 12 21 21 16" {...line} /></>;
    case 'link':
      return <><Path d="M14 12a5 5 0 0 0-5.14-5H7.15a5 5 0 0 0 0 10H8" {...line} /><Path d="M10 12a5 5 0 0 0 5.14 5h1.71a5 5 0 0 0 0-10H16" {...line} /></>;
    case 'message':
      return <><Path d="M12 22a10 10 0 1 0-8.66-5L2.5 21.5l4.5-.84A9.94 9.94 0 0 0 12 22Z" {...line} /><Line x1="8" y1="10" x2="16" y2="10" {...line} /><Line x1="8" y1="14" x2="13" y2="14" {...line} /></>;
    case 'money':
      return <><Rect x="2.5" y="5" width="19" height="14" rx="2" {...line} /><Circle cx="12" cy="12" r="3" {...line} /><Path d="M5.5 12h.01M18.5 12h.01" {...line} /></>;
    case 'pulse':
      return <Polyline points="3 12 7 12 9.5 6 13.5 18 16 12 21 12" {...line} />;
    case 'remove-circle':
      return <><Circle cx="12" cy="12" r="9" {...line} /><Path d="m8.5 8.5 7 7m0-7-7 7" {...line} /></>;
    case 'shield':
      return <><Path d="m12 3 7 3v5c0 4.5-2.7 7.7-7 10-4.3-2.3-7-5.5-7-10V6l7-3Z" {...line} /><Path d="m8.5 12 2.25 2.25L15.8 9" {...line} /></>;
    case 'star':
      return <Path d="m12 2.7 3.4 6.1 6.8 1.3-4.8 5.1.8 6.9-6.2-2.9-6.2 2.9.8-6.9-4.8-5.1 6.8-1.3L12 2.7Z" {...line} />;
    case 'star-filled':
      return <Path d="m12 2.7 3.4 6.1 6.8 1.3-4.8 5.1.8 6.9-6.2-2.9-6.2 2.9.8-6.9-4.8-5.1 6.8-1.3L12 2.7Z" fill={color} />;
    case 'time':
      return <><Circle cx="12" cy="12" r="9" {...line} /><Path d="M12 6v6h6" {...line} /></>;
    case 'trophy':
      return <><Path d="M7 4h10s-.85 13-5 13S7 4 7 4ZM17 4s1-1 2-1c2.4 0 2.4 3.2.8 4.8A17 17 0 0 1 16.2 11M7 4S6 3 5 3c-2.4 0-2.4 3.2-.8 4.8A17 17 0 0 0 7.8 11M8.5 20c0-2 3.5-3 3.5-3s3.5 1 3.5 3h-7Z" {...line} /></>;
    case 'upload':
      return <><Line x1="6" y1="20" x2="18" y2="20" {...line} /><Path d="M12 16V4m0 0 3.5 3.5M12 4 8.5 7.5" {...line} /></>;
    case 'user':
      return <><Circle cx="12" cy="8" r="4" {...line} /><Path d="M5 20v-1a7 7 0 0 1 14 0v1" {...line} /></>;
    case 'wallet':
      return <><Path d="M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" {...line} /><Path d="M18 7V5.6a2 2 0 0 0-2.5-1.93l-11 2.93A2 2 0 0 0 3 8.54V9M16.5 13.5h.01" {...line} /></>;
    case 'wifi':
      return <><Path d="M2 8c6-4.5 14-4.5 20 0M5 12c4-3 10-3 14 0M8.5 15.5c2.25-1.4 4.75-1.4 7 0M12 19.5h.01" {...line} /></>;
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
    case 'chevron-up':
      return <Polyline points="5 15 12 8 19 15" {...line} />;
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
