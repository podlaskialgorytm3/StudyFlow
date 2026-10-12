import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import LandingView from '@/components/Landing/LandingView';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  return <LandingView />;
}

