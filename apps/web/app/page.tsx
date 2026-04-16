import { Community } from '../components/home/Community';
import { FinalCTA } from '../components/home/FinalCTA';
import { ForOwners } from '../components/home/ForOwners';
import { Hero } from '../components/home/Hero';
import { HowItWorks } from '../components/home/HowItWorks';
import { Invite } from '../components/home/Invite';
import { LifeEventsGrid } from '../components/home/LifeEventsGrid';
import { NetworkingGroups } from '../components/home/NetworkingGroups';
import { Newsletter } from '../components/home/Newsletter';
import { Pricing } from '../components/home/Pricing';
import { RecentListings } from '../components/home/RecentListings';
import { SearchBar } from '../components/home/SearchBar';
import { TrustScore } from '../components/home/TrustScore';
import { WhyJoin } from '../components/home/WhyJoin';

export default function HomePage() {
  return (
    <>
      <Hero />
      <LifeEventsGrid />
      <SearchBar />
      <HowItWorks />
      <RecentListings />
      <NetworkingGroups />
      <WhyJoin />
      <TrustScore />
      <ForOwners />
      <Community />
      <Invite />
      <Pricing />
      <Newsletter />
      <FinalCTA />
    </>
  );
}
