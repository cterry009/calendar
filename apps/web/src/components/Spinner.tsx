interface SpinnerProps {
  size?: number;
}

export function Spinner({ size = 14 }: SpinnerProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid rgba(232,238,244,0.2)',
        borderTopColor: 'rgba(232,238,244,0.85)',
        animation: 'app-spinner-rotate 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}
