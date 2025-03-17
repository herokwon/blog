import NavigationBox from './NavigationBox';
import { render, screen } from '@testing-library/react';

const NAV_ITEMS: { path: string; title: string }[] = [
  { path: '/', title: 'Home' },
];

describe('Navigation Box', () => {
  it('should render as default', () => {
    render(<NavigationBox />);
    const navigationBox = screen.getByTestId('navigation-box');

    expect(navigationBox).toBeInTheDocument();
    expect(navigationBox.tagName).toBe('NAV');
  });

  it('should render with hyperlinks', () => {
    render(<NavigationBox />);
    const hyperlinks = screen.getAllByRole('link');

    hyperlinks.forEach((hyperlink, index) => {
      expect(hyperlink).toHaveAttribute('href', NAV_ITEMS[index].path);
      expect(hyperlink).toHaveTextContent(NAV_ITEMS[index].title);
    });
  });
});
