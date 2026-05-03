import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { LabeledInput } from './LabeledInput';
import { appStyles, colors } from '../utils/theme';

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
  successMessage: string;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
};

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  successMessage,
  onPrimaryPress,
  onSecondaryPress,
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);

  function validate() {
    const nextErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (!password.trim()) {
      nextErrors.password = 'Password is required';
    } else if (password.trim().length < 6) {
      nextErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handlePrimaryPress() {
    if (!validate()) {
      setStatusType('error');
      setStatusMessage('Please fix the highlighted fields.');
      return;
    }

    setIsSubmitting(true);
    setStatusType(null);
    setStatusMessage(null);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setStatusType('success');
    setStatusMessage(successMessage);
    await new Promise((resolve) => setTimeout(resolve, 900));
    onPrimaryPress();
    setIsSubmitting(false);
  }

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.authContent}>
        <View style={appStyles.brandBadge}>
          <Text style={appStyles.brandBadgeText}>S</Text>
        </View>
        <Text style={appStyles.eyebrow}>{eyebrow}</Text>
        <Text style={appStyles.authTitle}>{title}</Text>
        <Text style={appStyles.authSubtitle}>{subtitle}</Text>

        <View style={appStyles.card}>
          <LabeledInput
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (errors.email) {
                setErrors((current) => ({ ...current, email: undefined }));
              }
            }}
            placeholder="name@streamy.app"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
          />
          <LabeledInput
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (errors.password) {
                setErrors((current) => ({ ...current, password: undefined }));
              }
            }}
            placeholder="••••••••"
            secureTextEntry
            error={errors.password}
          />
          {statusMessage ? (
            <View
              style={[
                appStyles.formStatus,
                statusType === 'success'
                  ? appStyles.formStatusSuccess
                  : appStyles.formStatusError,
              ]}
            >
              <Text style={appStyles.formStatusText}>{statusMessage}</Text>
            </View>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              appStyles.primaryButton,
              pressed ? appStyles.primaryButtonPressed : null,
              isSubmitting ? appStyles.primaryButtonDisabled : null,
            ]}
            onPress={handlePrimaryPress}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <View style={appStyles.primaryButtonLoadingRow}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={appStyles.primaryButtonText}>Please wait...</Text>
              </View>
            ) : (
              <Text style={appStyles.primaryButtonText}>{primaryLabel}</Text>
            )}
          </Pressable>
          <Pressable style={appStyles.secondaryButton} onPress={onSecondaryPress}>
            <Text style={appStyles.secondaryButtonText}>{secondaryLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
