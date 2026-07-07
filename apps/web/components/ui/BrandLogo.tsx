/**
 * VPN brand logo - a stylized network/referral icon paired with the wordmark.
 * Uses primary blue from the palette. Two nodes connected by a handshake arc.
 */
export function BrandLogo({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const dims = size === 'small' ? 24 : size === 'large' ? 40 : 32;
  return (
    <div className="flex items-center gap-2">
      <svg
        width={dims}
        height={dims}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Background circle */}
        <rect width="40" height="40" rx="10" fill="var(--color-primary)" />
        {/* Two nodes */}
        <circle cx="13" cy="20" r="4" fill="white" opacity="0.9" />
        <circle cx="27" cy="20" r="4" fill="white" opacity="0.9" />
        {/* Connection arc (handshake/referral) */}
        <path
          d="M17 20 C20 12, 23 12, 27 16"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M23 20 C20 28, 17 28, 13 24"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        {/* Center sparkle */}
        <circle cx="20" cy="20" r="1.5" fill="white" />
      </svg>
      <span
        className={`font-bold text-gray-900 ${
          size === 'small' ? 'text-base' : size === 'large' ? 'text-xl' : 'text-lg'
        }`}
      >
        Virtual<span className="text-primary">Pros</span>
      </span>
    </div>
  );
}

export function BrandLogoWhite({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const dims = size === 'small' ? 24 : size === 'large' ? 40 : 32;
  return (
    <div className="flex items-center gap-2">
      <svg
        width={dims}
        height={dims}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="40" height="40" rx="10" fill="white" fillOpacity="0.15" />
        <circle cx="13" cy="20" r="4" fill="white" opacity="0.9" />
        <circle cx="27" cy="20" r="4" fill="white" opacity="0.9" />
        <path
          d="M17 20 C20 12, 23 12, 27 16"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M23 20 C20 28, 17 28, 13 24"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
        <circle cx="20" cy="20" r="1.5" fill="white" />
      </svg>
      <span className={`font-bold text-white ${size === 'small' ? 'text-base' : 'text-lg'}`}>
        Virtual<span className="text-blue-300">Pros</span>
      </span>
    </div>
  );
}
