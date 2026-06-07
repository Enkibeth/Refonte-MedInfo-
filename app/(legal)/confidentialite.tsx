import { confidentialite } from '@/compliance/legal';
import { LegalScreen } from '@/ui/LegalScreen';

export default function ConfidentialiteScreen() {
  return <LegalScreen document={confidentialite} />;
}
