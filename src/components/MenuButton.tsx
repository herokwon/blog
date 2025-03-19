'use client';

import { Icon } from '@herokwon/ui';
import { useEffect, useState } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { HiMenuAlt2 } from 'react-icons/hi';

const ACTIVE = 'modal-active';

export default function MenuButton() {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const navigationBar = document.querySelector('header nav');

    if (isOpen) navigationBar?.classList.add(ACTIVE);
    else navigationBar?.classList.remove(ACTIVE);
  }, [isOpen]);

  return (
    <button
      data-testid="menu-button"
      type="button"
      className="hover:bg-secondary-light dark:hover:bg-secondary-dark flex size-8 items-center justify-center rounded-full transition-colors"
      onClick={() => setIsOpen(prev => !prev)}
    >
      <Icon type={isOpen ? FaXmark : HiMenuAlt2} size="lg" />
    </button>
  );
}
