"use client";

interface Props {
  color: string;
  size?: number;
}

const SKIN = "#f5d3a8";

// 2D companion to the 3D dollhouse resident — capsule body in the
// person's colour with a round head perched on top. Same shape as the
// figure that walks into rooms, drawn flat for sidebar/card use.
export function PersonFigure({ color, size = 40 }: Props) {
  const width = size;
  const height = Math.round(size * 1.2);
  return (
    <svg
      viewBox="0 0 24 28"
      width={width}
      height={height}
      className="flex-shrink-0"
      aria-hidden
    >
      {/* Contact shadow disc */}
      <ellipse cx="12" cy="26.6" rx="6.2" ry="0.9" fill="#000" opacity="0.18" />

      {/* Body capsule */}
      <rect x="4.5" y="9.5" width="15" height="16.5" rx="7.5" fill={color} />

      {/* Collar highlight — borrowed from the 3D rig's collar accent */}
      <rect x="4.5" y="9.5" width="15" height="2" rx="7.5" fill="#ffffff" opacity="0.22" />

      {/* Head */}
      <circle
        cx="12"
        cy="5.6"
        r="4.5"
        fill={SKIN}
        stroke="rgba(0,0,0,0.1)"
        strokeWidth="0.4"
      />
    </svg>
  );
}
