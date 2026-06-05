import { mentionsLegales } from '@/compliance/legal';
import { LegalScreen } from '@/ui/LegalScreen';

export default function MentionsLegalesScreen() {
  return <LegalScreen document={mentionsLegales} />;
}
