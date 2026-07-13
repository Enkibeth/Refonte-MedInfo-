import { confidentialite } from '@/compliance/legal';
import { PAGE_SEO, breadcrumbJsonLd } from '@/seo/meta';
import { LegalScreen } from '@/ui/LegalScreen';
import { SeoHead } from '@/ui/SeoHead';

export default function ConfidentialiteScreen() {
  return (
    <>
      <SeoHead
        title={PAGE_SEO.confidentialite.title}
        description={PAGE_SEO.confidentialite.description}
        path={PAGE_SEO.confidentialite.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Confidentialité', path: PAGE_SEO.confidentialite.path },
          ]),
        ]}
      />
      <LegalScreen document={confidentialite} />
    </>
  );
}
