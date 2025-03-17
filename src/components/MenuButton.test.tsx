import MenuButton from './MenuButton';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

describe('Menu Button', () => {
  it('should render by default', async () => {
    render(<MenuButton />);
    const menuButton = screen.getByTestId('menu-button');

    expect(menuButton).toBeInTheDocument();
    expect(menuButton.tagName).toBe('BUTTON');
    expect(menuButton).toHaveAttribute('type', 'button');
  });

  it('should render with other icon different from initial icon after click event', async () => {
    render(<MenuButton />);
    const menuButton = screen.getByTestId('menu-button');
    const initialIcon = menuButton.firstElementChild;

    await userEvent.click(menuButton);

    const finalIcon = menuButton.firstElementChild;

    expect(finalIcon).not.toEqual(initialIcon);
  });
});
