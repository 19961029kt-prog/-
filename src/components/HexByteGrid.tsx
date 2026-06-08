interface HexByteGridProps {
  label: string;
  bytes: string[];
  grayedOut?: boolean;
}

// 16進数2桁を1マスとして並べるマス目UI
export function HexByteGrid({ label, bytes, grayedOut }: HexByteGridProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-28 shrink-0 text-sm font-medium ${grayedOut ? 'text-gray-400' : 'text-gray-700'}`}>
        {label}
      </span>
      <div className="flex gap-1">
        {bytes.map((byte, i) => (
          <div
            key={i}
            className={`flex h-9 w-12 items-center justify-center border font-mono text-sm ${
              grayedOut
                ? 'border-gray-300 bg-gray-200 text-gray-400'
                : 'border-gray-800 bg-white text-gray-900'
            }`}
            style={grayedOut ? { backgroundImage: 'repeating-linear-gradient(45deg, #d1d5db 0 4px, #e5e7eb 4px 8px)' } : undefined}
          >
            {byte || ' '}
          </div>
        ))}
      </div>
    </div>
  );
}
