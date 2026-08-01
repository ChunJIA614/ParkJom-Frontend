import type { ImgHTMLAttributes } from 'react';

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

export default function BrandLogo({ className = '', alt = 'ParkJom logo', ...props }: BrandLogoProps) {
  return (
    <img
      src="/branding/parkjom-logo.png"
      alt={alt}
      className={`brand-logo ${className}`.trim()}
      decoding="async"
      draggable={false}
      {...props}
    />
  );
}
