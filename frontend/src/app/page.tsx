import { redirect } from 'next/navigation';

export default async function Home() {
  // Always redirect to login - authentication will be handled client-side
  redirect('/login');
}

