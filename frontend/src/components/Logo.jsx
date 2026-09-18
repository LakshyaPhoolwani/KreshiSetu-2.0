// KrishiSetu wordmark + crop mark. Green agricultural theme, agnostic to size.
export function Logo({ size = 22, showWordmark = true, className = '' }) {
  return (
    <div className={`ks-logo ${className}`} data-testid="ks-logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span className="ks-logo-mark" aria-hidden="true">
        <svg width={size + 12} height={size + 12} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="46" height="46" rx="12" fill="#1E5128" />
          <path d="M24 8c-1.3 5.4-4.4 8.4-8.6 9.1 1.1 5 3.8 7.6 8.6 8.2V8z" fill="#7EB071" />
          <path d="M24 8c1.3 5.4 4.4 8.4 8.6 9.1-1.1 5-3.8 7.6-8.6 8.2V8z" fill="#4E9F3D" />
          <path d="M24 22c-2.5 3.9-6.1 6-11 6 .9 4.3 3.3 6.6 7.6 7.1 2 .2 3.4-.6 3.4-2.8V22z" fill="#7EB071" />
          <path d="M24 22c2.5 3.9 6.1 6 11 6-.9 4.3-3.3 6.6-7.6 7.1-2 .2-3.4-.6-3.4-2.8V22z" fill="#4E9F3D" />
          <rect x="23.1" y="16" width="1.8" height="24" rx=".9" fill="#F4F6F0" />
          <path d="M14 40h20" stroke="#D8A47F" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      {showWordmark && (
        <span className="ks-logo-word" style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
          <strong style={{ font: '600 20px Outfit', color: '#1E5128', letterSpacing: '-0.01em' }}>KrishiSetu</strong>
          <small style={{ fontSize: 10, color: '#889184', letterSpacing: '.03em', marginTop: 2 }}>Fair price. Full trust.</small>
        </span>
      )}
    </div>
  );
}

export default Logo;
