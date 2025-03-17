import ThemeButton from './ThemeButton';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const ACTIVE_STYLE = 'z-1 scale-100';
const INACTIVE_STYLE = '-z-1 scale-0';

describe('Theme Button', () => {
  it('should pass theme prop as "light" to the element', () => {
    render(<ThemeButton theme="light" />);
    const themeButton = screen.getByTestId('theme-button');
    const sunIcon = themeButton.firstElementChild;
    const moonIcon = themeButton.lastElementChild;

    expect(themeButton).toBeInTheDocument();
    expect(themeButton.tagName).toBe('BUTTON');
    expect(themeButton).toHaveAttribute('type', 'button');
    expect(sunIcon).toHaveClass(INACTIVE_STYLE);
    expect(moonIcon).toHaveClass(ACTIVE_STYLE);
  });

  it('should pass theme prop as "dark" to the element', () => {
    render(<ThemeButton theme="dark" />);
    const themeButton = screen.getByTestId('theme-button');
    const sunIcon = themeButton.firstElementChild;
    const moonIcon = themeButton.lastElementChild;

    expect(themeButton).toBeInTheDocument();
    expect(themeButton.tagName).toBe('BUTTON');
    expect(themeButton).toHaveAttribute('type', 'button');
    expect(sunIcon).toHaveClass(ACTIVE_STYLE);
    expect(moonIcon).toHaveClass(INACTIVE_STYLE);
  });

  it('should render with other icon different from initial icon after click event', async () => {
    render(<ThemeButton theme="light" />);
    const themeButton = screen.getByTestId('theme-button');
    const sunIcon = themeButton.firstElementChild;
    const moonIcon = themeButton.lastElementChild;

    expect(sunIcon).toHaveClass(INACTIVE_STYLE);
    expect(moonIcon).toHaveClass(ACTIVE_STYLE);

    await userEvent.click(themeButton);

    expect(sunIcon).toHaveClass(ACTIVE_STYLE);
    expect(moonIcon).toHaveClass(INACTIVE_STYLE);
  });
});
