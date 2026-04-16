export default function AdidasLogo({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg viewBox="0 0 80 80" fill={color} className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Three stripes - Adidas Performance logo */}
      <polygon points="40,10 54,40 26,40" />
      <polygon points="24,20 38,50 10,50" />
      <polygon points="56,20 70,50 42,50" />
      {/* Base bar */}
      <rect x="6" y="54" width="68" height="6" rx="1" />
    </svg>
  );
}
