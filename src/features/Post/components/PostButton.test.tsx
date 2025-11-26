import { vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PublishButton, RemoveButton, UpdateButton } from './PostButton';

describe('[Features/Post] PostButton', () => {
  it('각 버튼이 고유한 레이블과 공통 스타일로 렌더링해야 합니다.', () => {
    const { unmount: unmountPublish } = render(<PublishButton />);
    const publishButton = screen.getByRole('button', { name: '발행' });

    expect(publishButton).toBeInTheDocument();
    expect(publishButton).toHaveClass(
      'flex',
      'cursor-pointer',
      'items-center',
      'gap-x-2',
    );

    unmountPublish();

    const { unmount: unmountUpdate } = render(<UpdateButton />);
    const updateButton = screen.getByRole('button', { name: '수정' });

    expect(updateButton).toBeInTheDocument();
    expect(updateButton).toHaveClass(
      'flex',
      'cursor-pointer',
      'items-center',
      'gap-x-2',
    );

    unmountUpdate();

    render(<RemoveButton />);
    const removeButton = screen.getByRole('button', { name: '삭제' });

    expect(removeButton).toBeInTheDocument();
    expect(removeButton).toHaveClass(
      'flex',
      'cursor-pointer',
      'items-center',
      'gap-x-2',
    );
  });

  it('onClick 이벤트 핸들러가 호출되어야 합니다.', async () => {
    const handleClick = vi.fn();
    render(<PublishButton onClick={handleClick} />);
    const button = screen.getByRole('button', { name: '발행' });

    await userEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disabled 속성 전달 시 버튼이 비활성화됩니다', () => {
    render(<UpdateButton disabled />);
    const button = screen.getByRole('button', { name: '수정' });

    expect(button).toBeDisabled();
  });

  it('커스텀 className이 기본 클래스에 추가됩니다', () => {
    render(<RemoveButton className="custom-class" />);
    const button = screen.getByRole('button', { name: '삭제' });

    expect(button).toHaveClass('flex', 'custom-class');
  });

  it('type 속성 전달 시 버튼 타입이 설정됩니다', () => {
    render(<PublishButton type="submit" />);
    const button = screen.getByRole('button', { name: '발행' });

    expect(button).toHaveAttribute('type', 'submit');
  });
});
