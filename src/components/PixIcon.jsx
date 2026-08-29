export default function PixIcon({ size = 18, color = "#32BCA2" }) {
  const maskId = `pix-cutout-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <defs>
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <path d="M6.353 14.887l3.655 3.654a3.178 3.178 0 0 0 4.496 0l1.83-1.83-2.617-2.617a1.642 1.642 0 0 1-2.321 0H7.728a1.644 1.644 0 0 1 0-2.321l2.614-2.614-1.83-1.83a3.18 3.18 0 0 0-4.495 0L.364 10.984a1.442 1.442 0 0 0 0 2.041l5.989 5.988zm11.294-5.774l-3.655-3.655a3.178 3.178 0 0 0-4.496 0l-1.83 1.83 2.617 2.617a1.64 1.64 0 0 1 2.321 0h3.668a1.642 1.642 0 0 1 0 2.321l-2.614 2.614 1.83 1.83a3.18 3.18 0 0 0 4.495 0l3.653-3.655a1.444 1.444 0 0 0 0-2.04l-5.989-5.988z" fill="black" />
        </mask>
      </defs>
      <rect 
        x="3.2" 
        y="3.2" 
        width="17.6" 
        height="17.6" 
        rx="4" 
        fill={color} 
        transform="rotate(45 12 12)" 
        mask={`url(#${maskId})`} 
      />
    </svg>
  );
}
