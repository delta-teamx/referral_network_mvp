import { TrustScore } from '../../../components/home/TrustScore';
import { HowItWorks } from '../../../components/home/HowItWorks';
import { FinalCTA } from '../../../components/home/FinalCTA';

export default function TrustScorePage() {
  return (
    <>
      <TrustScore titleAs="h1" />
      <HowItWorks />
      <FinalCTA />
    </>
  );
}
