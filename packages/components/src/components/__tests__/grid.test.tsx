import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Grid } from '../grid';

describe('Grid', () => {
  it('renders grid with children', () => {
    render(
      <Grid>
        <div>Item 1</div>
        <div>Item 2</div>
      </Grid>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <Grid className="custom-grid" data-testid="grid">
        <div>Content</div>
      </Grid>
    );
    expect(screen.getByTestId('grid')).toHaveClass('custom-grid');
  });

  it('renders with default columns', () => {
    render(
      <Grid data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    const grid = screen.getByTestId('grid');
    expect(grid).toHaveClass('grid');
  });

  it('renders with custom columns', () => {
    render(
      <Grid cols={3} data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    const grid = screen.getByTestId('grid');
    expect(grid).toHaveClass('grid-cols-1', 'lg:grid-cols-3');
  });

  it('renders with gap', () => {
    render(
      <Grid gap="lg" data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    const grid = screen.getByTestId('grid');
    expect(grid).toHaveClass('gap-6');
  });

  it('applies default grid styling', () => {
    render(
      <Grid data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    const grid = screen.getByTestId('grid');
    expect(grid).toHaveClass('grid');
  });
});
