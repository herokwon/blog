import Logo from './Logo';
import { render, screen } from '@testing-library/react';

describe('Logo', () => {
  it('should pass props to the element correctly', () => {
    render(<Logo width={100} height={100} className="logo" />);
    const logo = screen.getByTestId('logo');

    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('width', '100');
    expect(logo).toHaveAttribute('height', '100');
    expect(logo).toHaveClass('logo');
  });

  it('should render by logo.png', () => {
    render(<Logo width={100} height={100} />);
    const logo = screen.getByTestId('logo');

    expect(logo).toBeInTheDocument();
    expect(logo.tagName).toBe('IMG');
    expect(logo).toHaveAttribute('alt', 'logo');
  });

  it('should render by logo_text.png', () => {
    render(<Logo onlyText width={100} height={100} />);
    const logo = screen.getByTestId('text-logo');

    expect(logo).toBeInTheDocument();
    expect(logo.tagName).toBe('IMG');
    expect(logo).toHaveAttribute('alt', 'text-logo');
  });
});
