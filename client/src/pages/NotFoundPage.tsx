import { Container } from '../components/layout/Container';
import { PageHeading } from '../components/ui/PageHeading';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { useRouter } from '../router';
import { AlertTriangleIcon } from '../components/ui/icons';

export function NotFoundPage() {
  const { navigate } = useRouter();

  return (
    <Container size="md" className="space-y-8">
      <PageHeading
        title="Page Not Found"
        description="The address you requested could not be located on the Civora platform."
        className="mb-0"
      />
      <EmptyState
        icon={<AlertTriangleIcon className="w-6 h-6 text-[#0B3D2E] dark:text-[#34D399]" />}
        title="404 — Route Unavailable"
        description="The requested page does not exist on the Civora platform. Please check the address or return to the homepage."
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            Return to Homepage
          </Button>
        }
      />
    </Container>
  );
}
