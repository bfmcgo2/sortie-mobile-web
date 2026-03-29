import type { Metadata } from 'next';
import { fetchGuideById } from '@/lib/supabase';

type Props = {
  params: Promise<{ 'guide-id': string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'guide-id': guideId } = await params;

  if (!guideId) {
    return { title: 'Guide' };
  }

  try {
    const { guide } = await fetchGuideById(guideId);
    const title = guide?.name ? `${guide.name} Guide` : 'Guide';
    return { title };
  } catch {
    return { title: 'Guide' };
  }
}

export default function CreatorGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
