import { fireEvent, render, screen } from '@testing-library/react';
import { Globe } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Badge, SimulatedTag, SourceBadge, VerdictBadge } from './Badges';
import Button, { ButtonLink } from './Button';
import Card from './Card';
import { EmptyState, Notice, PageHeader, Tabs } from './Common';
import Input from './Input';

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('calls onClick and respects disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Button onClick={onClick} disabled>Go</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the variant styles', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('text-red-300');
  });

  it('does not force inline-flex over a caller-supplied "hidden"', () => {
    render(<Button className="hidden sm:inline-flex">Hide me</Button>);
    expect(screen.getByText('Hide me')).not.toHaveClass('inline-flex');
  });

  it('ButtonLink renders a link to the given route', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/scan">Scan now</ButtonLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Scan now' })).toHaveAttribute('href', '/scan');
  });
});

describe('Card', () => {
  it('renders children and an optional titled header with an action', () => {
    render(
      <Card title="Recent scans" action={<button type="button">View all</button>}>
        <p>body text</p>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Recent scans' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all' })).toBeInTheDocument();
    expect(screen.getByText('body text')).toBeInTheDocument();
  });

  it('omits the header when no title is given', () => {
    render(<Card>only body</Card>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

describe('Input', () => {
  it('connects the label to the field', () => {
    render(<Input id="url" label="Website" />);
    expect(screen.getByLabelText('Website')).toBeInTheDocument();
  });

  it('shows an error message and marks the field invalid', () => {
    render(<Input id="url" label="Website" error="Enter a valid URL" />);
    const field = screen.getByLabelText('Website');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', 'url-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid URL');
  });

  it('is valid and silent without an error', () => {
    render(<Input id="url" label="Website" icon={Globe} />);
    expect(screen.getByLabelText('Website')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('passes typing through to onChange', () => {
    const onChange = vi.fn();
    render(<Input id="url" label="Website" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'example.com' } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('Badges', () => {
  it('VerdictBadge always shows the text label, not just a colour', () => {
    render(<VerdictBadge verdict="phishing" />);
    expect(screen.getByText('Phishing')).toBeInTheDocument();
  });

  it('SimulatedTag can be hidden', () => {
    const { container } = render(<SimulatedTag show={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('SourceBadge tells live, sample and demo data apart', () => {
    const { rerender } = render(<SourceBadge source="live" />);
    expect(screen.getByText('Live API')).toBeInTheDocument();
    rerender(<SourceBadge source="sample" />);
    expect(screen.getByText('Sample data')).toBeInTheDocument();
    rerender(<SourceBadge source="demo" />);
    expect(screen.getByText('Demo engine')).toBeInTheDocument();
  });

  it('Badge renders its children', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});

describe('Common components', () => {
  it('PageHeader shows title and description', () => {
    render(<PageHeader title="History" description="Past scans" />);
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByText('Past scans')).toBeInTheDocument();
  });

  it('EmptyState shows title, description and children', () => {
    render(
      <EmptyState title="No scans yet" description="Results appear here.">
        <button type="button">Scan a URL</button>
      </EmptyState>,
    );
    expect(screen.getByText('No scans yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan a URL' })).toBeInTheDocument();
  });

  it('Notice renders its message', () => {
    render(<Notice tone="danger">Analysis failed</Notice>);
    expect(screen.getByText('Analysis failed')).toBeInTheDocument();
  });

  it('Tabs marks the active tab and reports changes', () => {
    const onChange = vi.fn();
    const tabs = [
      { key: 'overview', label: 'Overview' },
      { key: 'features', label: 'URL Features' },
    ];
    render(<Tabs tabs={tabs} active="overview" onChange={onChange} label="Result sections" />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'URL Features' }));
    expect(onChange).toHaveBeenCalledWith('features');
  });
});