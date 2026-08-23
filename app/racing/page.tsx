import { permanentRedirect } from 'next/navigation';

export default function RacingRedirect() {
  permanentRedirect('/about/racing');
}
