// The clip path is referenced by id, so every rendered mark shares one definition.
// The definitions are identical, so duplicates on a page resolve to the same shape.
const STRIPE_CLIP_ID = "beeroute-logo-stripes";

const BEE_BODY =
  "M60 76 C 56.5 70, 44 58, 44 46 A 16 16 0 0 1 76 46 C 76 58, 63.5 70, 60 76 Z";

type LogoMarkProps = {
  size?: number;
  className?: string;
  /** Set when a visible wordmark already names the brand. */
  decorative?: boolean;
};

export function LogoMark({
  size = 32,
  className,
  decorative = false,
}: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "BeeRoute"}
      aria-hidden={decorative || undefined}
    >
      <defs>
        <clipPath id={STRIPE_CLIP_ID}>
          <path d={BEE_BODY} />
        </clipPath>
      </defs>
      <rect width="100" height="100" rx="22" fill="#2F5BEA" />
      <path
        d="M12 84 C 16 70, 24 74, 27 61"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray="0.1 7"
      />
      <circle
        cx="12"
        cy="84"
        r="5.5"
        fill="#FFC21A"
        stroke="#FFFFFF"
        strokeWidth="3"
      />
      {/* White outline drawn under the artwork so the bee reads against the blue. */}
      <g fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="8" strokeLinejoin="round">
        <ellipse
          cx="53"
          cy="27"
          rx="7.5"
          ry="11.5"
          transform="rotate(-25 53 27)"
        />
        <ellipse
          cx="65"
          cy="26"
          rx="7.5"
          ry="11.5"
          transform="rotate(15 65 26)"
        />
        <path d={BEE_BODY} transform="rotate(75 60 46)" />
      </g>
      <ellipse
        cx="53"
        cy="27"
        rx="7.5"
        ry="11.5"
        transform="rotate(-25 53 27)"
        fill="#E8F0FF"
        stroke="#1C1A17"
        strokeWidth="2.5"
      />
      <ellipse
        cx="65"
        cy="26"
        rx="7.5"
        ry="11.5"
        transform="rotate(15 65 26)"
        fill="#E8F0FF"
        stroke="#1C1A17"
        strokeWidth="2.5"
      />
      <g transform="rotate(75 60 46)">
        <path d={BEE_BODY} fill="#FFC21A" />
        <g clipPath={`url(#${STRIPE_CLIP_ID})`}>
          <rect x="40" y="52" width="40" height="4.5" fill="#1C1A17" />
          <rect x="40" y="60" width="40" height="4.5" fill="#1C1A17" />
        </g>
      </g>
      <circle cx="68" cy="44" r="3.4" fill="#1C1A17" />
      <circle cx="69.1" cy="42.9" r="1.2" fill="#FFFFFF" />
    </svg>
  );
}

type LogoProps = {
  size?: number;
  className?: string;
};

/** Mark plus wordmark. The wordmark inherits the surrounding text color. */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} decorative />
      <span
        className="font-semibold tracking-tight"
        style={{ fontSize: size * 0.58 }}
      >
        Bee<span className="text-[#2F5BEA] dark:text-[#7D9BFF]">Route</span>
      </span>
    </span>
  );
}
