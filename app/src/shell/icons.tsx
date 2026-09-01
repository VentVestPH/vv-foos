/**
 * Small local outline-SVG icon set for the Taleo-replica shell (redesign
 * prompt section 6: "use thin outline icons… if no icon library exists,
 * implement a small local SVG set"). Every icon is stroke-only,
 * currentColor, 24x24 viewBox, no fill — matches the thin line-art style
 * seen throughout the Taleo screenshots. Sized via the `size` prop.
 */
import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function base(props: IconProps) {
  const { size = 20, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

export function PipelineIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4h16l-6 8v7l-4 2v-9z" />
    </svg>
  );
}

export function BriefcaseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="8" width="18" height="12" rx="1.2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
    </svg>
  );
}

export function HandshakeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11l4-3 4 3 2-2 4 1 4 3" />
      <path d="M3 11v4l4 3 3-2 2 2 3-2 2 2 4-3v-4" />
    </svg>
  );
}

export function ContactCardIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="1.2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c0-1.7 1.3-3 3-3s3 1.3 3 3" />
      <path d="M14.5 9.5h4M14.5 12.5h4M14.5 15.5h2.5" />
    </svg>
  );
}

export function IdBadgeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="3" width="14" height="18" rx="1.4" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M8.3 16.5c0-1.8 1.6-3 3.7-3s3.7 1.2 3.7 3" />
      <path d="M9 3v2M15 3v2" />
    </svg>
  );
}

export function ChecklistPersonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="7" r="3" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5" />
      <path d="M14 8h7M14 12h7M14 16h5" />
      <path d="M13.5 20l1.5 1.5 2.5-2.5" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="9" rx="1.4" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  );
}

export function PieChartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v9l7 4" />
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 23.5" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 1 2.5 2.5" />
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.7a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 18a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 13.5a1.7 1.7 0 0 0-1.56-1.04H2.95a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 7.42a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.03 2.66l.06.06A1.7 1.7 0 0 0 8.96 3.06 1.7 1.7 0 0 0 10 1.5V1.41a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.04 3a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V7.5a1.7 1.7 0 0 0 1.56 1.04h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04z" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.5 5 8 12l6.5 7" />
    </svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

export function MegaphoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 10v4a1 1 0 0 0 1 1h2l1 5h2l-1-5h1l9 4V6l-9 4H4a1 1 0 0 0-1 1z" />
    </svg>
  );
}

export function BarChartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M8 15v-3M12 15V9M16 15v-5" />
    </svg>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 12l3-8h12l3 8" />
      <path d="M3 12v7a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-7" />
      <path d="M3 12h5l1.5 2.5h5L16 12h5" />
    </svg>
  );
}

export function TicketIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 9a2 2 0 0 1 0-4h18a2 2 0 0 1 0 4 2 2 0 0 0 0 6 2 2 0 0 1 0 4H3a2 2 0 0 1 0-4 2 2 0 0 0 0-6z" />
      <path d="M10 5v14" strokeDasharray="2 2" />
    </svg>
  );
}

export function ResumeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M8 12h8M8 15.5h8M8 19h5" />
    </svg>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 3v18" />
      <path d="M5 4h11l-2.5 3.5L16 11H5" />
    </svg>
  );
}
