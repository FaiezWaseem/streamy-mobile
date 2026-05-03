import { AuthShell } from '../components/AuthShell';
import { type AuthScreenProps } from '../utils/types';

export function LoginScreen({ onPrimaryPress, onSecondaryPress }: AuthScreenProps) {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Your creator feed, all in one place."
      subtitle="Sign in to manage channels, publish fresh reels, and keep your best edits saved."
      primaryLabel="Login"
      secondaryLabel="Create an account"
      successMessage="Login successful. Opening your Streamy workspace..."
      onPrimaryPress={onPrimaryPress}
      onSecondaryPress={onSecondaryPress}
    />
  );
}
