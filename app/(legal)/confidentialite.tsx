import { confidentialite } from '@/compliance/legal';
import { LegalScreen } from '@/ui/components/LegalScreen';

export default function ConfidentialiteScreen() {
  return <LegalScreen document={confidentialite} />;
}
