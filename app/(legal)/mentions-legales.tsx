import { mentionsLegales } from '@/compliance/legal';
import { PAGE_SEO, breadcrumbJsonLd } from '@/seo/meta';
import { LegalScreen } from '@/ui/LegalScreen';
import { SeoHead } from '@/ui/SeoHead';

export default function MentionsLegalesScreen() {
  return (
    <>
      <SeoHead
        title={PAGE_SEO.mentionsLegales.title}
        description={PAGE_SEO.mentionsLegales.description}
        path={PAGE_SEO.mentionsLegales.path}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Mentions légales', path: PAGE_SEO.mentionsLegales.path },
          ]),
        ]}
      />
      <LegalScreen document={mentionsLegales} />
    </>
  );
}
