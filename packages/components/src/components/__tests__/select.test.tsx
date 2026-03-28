import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from '../select';

describe('Select', () => {
  it('renders select element', () => {
    render(
      <Select
        options={[
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
        ]}
        data-testid="select"
      />
    );
    expect(screen.getByTestId('select')).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    render(
      <Select
        options={[{ value: 'a', label: 'Option A' }]}
        placeholder="Select option"
        data-testid="select"
      />
    );
    expect(screen.getByText('Select option')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(
      <Select
        options={[
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
          { value: 'c', label: 'Option C' },
        ]}
        data-testid="select"
      />
    );
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <Select
        options={[{ value: 'a', label: 'Option A' }]}
        className="custom-select"
        data-testid="select"
      />
    );
    expect(screen.getByTestId('select')).toHaveClass('custom-select');
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <Select
        options={[{ value: 'a', label: 'Option A' }]}
        disabled
        data-testid="select"
      />
    );
    expect(screen.getByTestId('select')).toBeDisabled();
  });
});
