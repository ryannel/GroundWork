import Image from 'next/image';

interface PlanImageProps {
  readonly src: string;
  readonly alt: string;
  readonly className?: string | undefined;
}

// One of the plan's own pictures, as it is: the plan ships it, so it is never resized or re-encoded. Its box is
// the CSS's to size; the picture keeps its own proportions.
export function PlanImage({ src, alt, className }: PlanImageProps) {
  return (
    <Image
      alt={alt}
      className={className}
      decoding="async"
      height={0}
      sizes="100vw"
      src={src}
      unoptimized
      width={0}
    />
  );
}
