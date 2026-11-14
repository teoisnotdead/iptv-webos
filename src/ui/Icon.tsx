/** Íconos de trazo (24×24), dibujados con el color del texto. */
const PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  live: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 3l4 4 4-4" />
    </>
  ),
  movies: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18" />
    </>
  ),
  series: (
    <>
      <rect x="2" y="7" width="15" height="12" rx="2" />
      <path d="M6 3h14a2 2 0 0 1 2 2v10" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  play: <path d="M7 4v16l13-8z" fill="currentColor" stroke="none" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />,
  audio: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  home: <path d="M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5" />,
  star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" fill="currentColor" stroke="none" />,
  starOutline: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.5" />
    </>
  ),
  pause: <path d="M6.5 4h3.5v16H6.5zM14 4h3.5v16H14z" fill="currentColor" stroke="none" />,
  rewind: <path d="M11 18.5L3.5 12 11 5.5zM20.5 18.5L13 12l7.5-6.5z" fill="currentColor" stroke="none" />,
  forward: <path d="M13 18.5l7.5-6.5L13 5.5zM3.5 18.5L11 12 3.5 5.5z" fill="currentColor" stroke="none" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  subtitles: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15h3M13 15h4M7 11h10" />
    </>
  ),
  next: (
    <>
      <path d="M5 4.5l10 7.5-10 7.5z" fill="currentColor" stroke="none" />
      <path d="M19 5v14" />
    </>
  ),
  restart: <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5" />,
  chevron: <path d="M9 5l7 7-7 7" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, class: cls }: { name: IconName; class?: string }) {
  return (
    <svg
      class={cls}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
