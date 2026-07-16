import { IgorIntake } from './IgorIntake';

/**
 * Live onboarding route. Renders the two-sided intake flow (business profile →
 * who you want to meet → who you refer → photo & intro video), which captures
 * the data the AI matching engine needs and triggers a first match refresh on
 * finish. IgorIntake is a client component; this page just mounts it.
 */
export default function OnboardingPage() {
  return <IgorIntake />;
}
