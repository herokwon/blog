import Image from 'next/image';

import LogoImg from '@assets/logo.png';
import LogoTextImg from '@assets/logo_text.png';

type LogoProps = {
  onlyText?: boolean;
};

export default function Logo({ onlyText = false }: LogoProps) {
  return <Image priority src={onlyText ? LogoTextImg : LogoImg} alt="logo" />;
}
