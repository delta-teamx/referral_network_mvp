import RsvpClient from './RsvpClient';

export function generateStaticParams() {
  return [{ token: 'placeholder' }];
}

export const dynamicParams = true;

export default function Page() {
  return <RsvpClient />;
}
