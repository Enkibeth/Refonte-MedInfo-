import { cgu } from '@/compliance/legal';
import { PAGE_SEO, breadcrumbJsonLd } from '@/seo/meta';
import { LegalScreen } from '@/ui/LegalScreen';
import { SeoHead } from '@/ui/SeoHead';

export default function CguScreen() {
  return (
    <>
      <SeoHead
        title={PAGE_SEO.cgu.title}
        description={PAGE_SEO.cgu.description}
        path={PAGE_SEO.cgu.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Conditions d\'utilisation', path: PAGE_SEO.cgu.path },
          ]),
        ]}
      />
      <LegalScreen document={cgu} />
    </>
  );
}
