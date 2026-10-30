import { Container } from '../components/layout/Container';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { useRouter } from '../router';
import { AlertTriangleIcon } from '../components/ui/icons';

export function NotFoundPage() {
  const { navigate } = useRouter();

  return (
    <Container size="md" className="py-12">
      <EmptyState
        icon={<AlertTriangleIcon className="w-8 h-8 text-amber-400" />}
        title="Page Not Found (404)"
        description="The requested page does not exist on the Civora platform. Please check the address or return to the overview."
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            Return to Overview
          </Button>
        }
      />
    </Container>
  );
}
