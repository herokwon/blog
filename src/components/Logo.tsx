import Image from 'next/image';

import LogoImg from '@assets/logo.png';
import TextLogoImg from '@assets/text_logo.png';

type LogoProps = Omit<
  React.ComponentPropsWithoutRef<typeof Image>,
  'src' | 'alt' | 'priority'
> & {
  onlyText?: boolean;
};

export default function Logo({ onlyText = false, ...props }: LogoProps) {
  return (
    <Image
      {...props}
      data-testid={onlyText ? 'text-logo' : 'logo'}
      priority
      src={onlyText ? TextLogoImg : LogoImg}
      alt={onlyText ? 'text-logo' : 'logo'}
    />
  );
}
