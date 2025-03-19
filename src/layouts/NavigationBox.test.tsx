import NavigationBox from './NavigationBox';
import { render, screen } from '@testing-library/react';

import { NAV_ITEMS } from '@data';

describe('Navigation Box', () => {
  it('should render as default', () => {
    render(<NavigationBox items={NAV_ITEMS} />);
    const navigationBox = screen.getByTestId('navigation-box');

    expect(navigationBox).toBeInTheDocument();
    expect(navigationBox.tagName).toBe('NAV');
  });

  it('should render with hyperlinks', () => {
    render(<NavigationBox items={NAV_ITEMS} />);
    const hyperlinks = screen.getAllByRole('link');

    hyperlinks.forEach((hyperlink, index) => {
      expect(hyperlink).toHaveAttribute('href', NAV_ITEMS[index].path);
      expect(hyperlink).toHaveTextContent(NAV_ITEMS[index].title.toUpperCase());
    });
  });
});
