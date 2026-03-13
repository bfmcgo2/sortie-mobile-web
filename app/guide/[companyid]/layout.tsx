import type { Metadata } from 'next';
import companiesData from '@/data/companies.json';

interface CompanyData {
  id: string;
  name: string;
  logo: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

type Props = {
  params: Promise<{ companyid: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { companyid } = await params;
  
  const company = companiesData.find(
    (c: CompanyData) => c.id === companyid
  );

  const title = company ? `${company.name} Guide` : 'Guide';

  return {
    title,
  };
}

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
