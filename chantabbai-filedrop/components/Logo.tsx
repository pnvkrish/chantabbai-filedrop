import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ size = 'md' }: LogoProps) {
  const imgSize = size === 'sm' ? 32 : size === 'lg' ? 56 : 42

  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/logo.png"
        alt="Chantabbai"
        width={imgSize}
        height={imgSize}
        className="object-contain"
        priority
      />
      <div className="leading-none">
        <span
          style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif', color: '#C4161C' }}
          className="font-bold text-lg"
        >
          Chantabbai
        </span>
        <span
          style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif', color: '#374151' }}
          className="font-semibold text-lg"
        >
          {' '}FileDrop
        </span>
      </div>
    </div>
  )
}
