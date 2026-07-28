/**
 * Brand mark: "RN" monogram on the primary-color rounded square. Plain and
 * professional - deliberately no star/sparkle imagery.
 */
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
        <text
          x="20"
          y="21"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-montserrat), Montserrat, Arial, sans-serif"
          fontWeight="800"
          fontSize="16.5"
          letterSpacing="-0.5"
          fill="white"
        >
          RN
        </text>
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
        <text
          x="20"
          y="21"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-montserrat), Montserrat, Arial, sans-serif"
          fontWeight="800"
          fontSize="16.5"
          letterSpacing="-0.5"
          fill="white"
        >
          RN
        </text>
      </svg>
      <span className={`font-bold text-white ${size === 'small' ? 'text-base' : 'text-lg'}`}>
        Referral<span className="text-blue-300">Nova</span>
      </span>
    </div>
  );
}
