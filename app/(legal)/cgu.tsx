import { cgu } from '@/compliance/legal';
import { LegalScreen } from '@/ui/LegalScreen';

export default function CguScreen() {
  return <LegalScreen document={cgu} />;
}
