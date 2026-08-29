export default function PixIcon({ size = 16, color = "#3DD68C" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="url(#pix-gradient)" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 2px 4px rgba(61, 214, 140, 0.4))' }}
    >
      <defs>
        <linearGradient id="pix-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#51F0A6" />
          <stop offset="100%" stopColor="#25A565" />
        </linearGradient>
      </defs>
      <path d="M6.353 14.887l3.655 3.654a3.178 3.178 0 0 0 4.496 0l1.83-1.83-2.617-2.617a1.642 1.642 0 0 1-2.321 0H7.728a1.644 1.644 0 0 1 0-2.321l2.614-2.614-1.83-1.83a3.18 3.18 0 0 0-4.495 0L.364 10.984a1.442 1.442 0 0 0 0 2.041l5.989 5.988zm11.294-5.774l-3.655-3.655a3.178 3.178 0 0 0-4.496 0l-1.83 1.83 2.617 2.617a1.64 1.64 0 0 1 2.321 0h3.668a1.642 1.642 0 0 1 0 2.321l-2.614 2.614 1.83 1.83a3.18 3.18 0 0 0 4.495 0l3.653-3.655a1.444 1.444 0 0 0 0-2.04l-5.989-5.988z"/>
    </svg>
  );
}
