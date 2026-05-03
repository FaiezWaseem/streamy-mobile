import { AuthShell } from '../components/AuthShell';
import { type AuthScreenProps } from '../utils/types';

export function RegisterScreen({
  onPrimaryPress,
  onSecondaryPress,
}: AuthScreenProps) {
  return (
    <AuthShell
      eyebrow="Join Streamy"
      title="Build a video home with a bold black and red identity."
      subtitle="Create your profile, organize channels, and upload content from a polished mobile-first workspace."
      primaryLabel="Register"
      secondaryLabel="Already have an account?"
      successMessage="Registration successful. Preparing your Streamy account..."
      onPrimaryPress={onPrimaryPress}
      onSecondaryPress={onSecondaryPress}
    />
  );
}
