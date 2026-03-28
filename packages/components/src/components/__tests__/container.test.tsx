import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Container } from '../container';

describe('Container', () => {
  it('renders container with children', () => {
    render(
      <Container>
        <div>Content</div>
      </Container>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <Container className="custom-container" data-testid="container">
        <div>Content</div>
      </Container>
    );
    expect(screen.getByTestId('container')).toHaveClass('custom-container');
  });

  it('renders as div element', () => {
    render(
      <Container data-testid="container">
        <div>Content</div>
      </Container>
    );
    const container = screen.getByTestId('container');
    expect(container.tagName).toBe('DIV');
  });

  it('has default container styling', () => {
    render(
      <Container data-testid="container">
        <div>Content</div>
      </Container>
    );
    const container = screen.getByTestId('container');
    expect(container).toHaveClass('mx-auto', 'w-full');
  });

  it('has padding by default', () => {
    render(
      <Container data-testid="container">
        <div>Content</div>
      </Container>
    );
    const container = screen.getByTestId('container');
    expect(container).toHaveClass('px-4');
  });

  it('applies size prop', () => {
    render(
      <Container size="sm" data-testid="container">
        <div>Content</div>
      </Container>
    );
    const container = screen.getByTestId('container');
    expect(container).toHaveClass('max-w-screen-sm');
  });
});
