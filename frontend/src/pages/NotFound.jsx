import { Compass } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/Common';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-lg">
        <EmptyState icon={Compass} title="Page not found" description="That address doesn't match any page.">
          <ButtonLink to="/">Go home</ButtonLink>
          <ButtonLink to="/dashboard" variant="secondary">
            Open dashboard
          </ButtonLink>
        </EmptyState>
      </div>
    </div>
  );
}
