export default function AdidasLogo({ size = 40 }) {
  const r = size * 0.22;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Fondo azul Boca */}
      <rect width="100" height="100" rx={r} fill="#0D1B3E" />
      {/* 3 barras doradas - fiel al logo Adidas Performance */}
      <g transform="translate(14, 18) scale(0.72)">
        {/* Barra izquierda (corta) */}
        <path d="M10,95 L10,68 L30,55 L30,95 Z" fill="#E6A817" />
        {/* Barra central (media) */}
        <path d="M35,95 L35,42 L55,29 L55,95 Z" fill="#E6A817" />
        {/* Barra derecha (alta) */}
        <path d="M60,95 L60,16 L80,3 L80,95 Z" fill="#E6A817" />
      </g>
    </svg>
  );
}
