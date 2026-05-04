export function ReferralNovaLogo({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
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
        <rect width="40" height="40" rx="10" fill="var(--color-primary)" />
        {/* Nova star burst */}
        <circle cx="20" cy="20" r="5" fill="white" opacity="0.95" />
        <path d="M20 8 L22 16 L20 14 L18 16 Z" fill="white" opacity="0.7" />
        <path d="M20 32 L22 24 L20 26 L18 24 Z" fill="white" opacity="0.7" />
        <path d="M8 20 L16 18 L14 20 L16 22 Z" fill="white" opacity="0.7" />
        <path d="M32 20 L24 18 L26 20 L24 22 Z" fill="white" opacity="0.7" />
        {/* Diagonal rays */}
        <path d="M11 11 L16 16" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <path d="M29 11 L24 16" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <path d="M11 29 L16 24" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <path d="M29 29 L24 24" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      </svg>
      <span
        className={`font-bold text-gray-900 ${
          size === 'small' ? 'text-base' : size === 'large' ? 'text-xl' : 'text-lg'
        }`}
      >
        Referral<span className="text-primary">Nova</span>
      </span>
    </div>
  );
}

export function ReferralNovaLogoWhite({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
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
        <circle cx="20" cy="20" r="5" fill="white" opacity="0.95" />
        <path d="M20 8 L22 16 L20 14 L18 16 Z" fill="white" opacity="0.7" />
        <path d="M20 32 L22 24 L20 26 L18 24 Z" fill="white" opacity="0.7" />
        <path d="M8 20 L16 18 L14 20 L16 22 Z" fill="white" opacity="0.7" />
        <path d="M32 20 L24 18 L26 20 L24 22 Z" fill="white" opacity="0.7" />
        <path d="M11 11 L16 16" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <path d="M29 11 L24 16" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <path d="M11 29 L16 24" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <path d="M29 29 L24 24" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      </svg>
      <span className={`font-bold text-white ${size === 'small' ? 'text-base' : 'text-lg'}`}>
        Referral<span className="text-blue-300">Nova</span>
      </span>
    </div>
  );
}
