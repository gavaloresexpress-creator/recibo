export default function PixIcon({ size = 18 }) {
  return (
    <img 
      src="/pix.png" 
      alt="PIX"
      width={size} 
      height={size} 
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}
