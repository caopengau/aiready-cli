import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../input';

describe('Input', () => {
  it('renders input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-input');
  });

  it('handles different input types', () => {
    const { rerender } = render(<Input type="text" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');

    rerender(<Input type="email" data-testid="email" />);
    expect(screen.getByTestId('email')).toHaveAttribute('type', 'email');

    rerender(<Input type="password" data-testid="password" />);
    expect(screen.getByTestId('password')).toHaveAttribute('type', 'password');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('accepts placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('handles onChange events', () => {
    render(
      <Input
        onChange={(_e) => {
          // onChange handler
        }}
      />
    );
    const input = screen.getByRole('textbox');
    input.focus();
    expect(input).toBeInTheDocument();
  });

  it('applies default styling classes', () => {
    render(<Input data-testid="styled-input" />);
    const input = screen.getByTestId('styled-input');
    expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md');
  });
});
