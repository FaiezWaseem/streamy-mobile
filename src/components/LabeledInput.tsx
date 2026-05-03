import { type ComponentProps } from 'react';
import { Text, TextInput, View } from 'react-native';

import { appStyles, colors } from '../utils/theme';

type Props = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
};

export function LabeledInput({ label, error, ...props }: Props) {
  return (
    <View style={appStyles.inputGroup}>
      <Text style={appStyles.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[appStyles.input, error ? appStyles.inputError : null]}
        {...props}
      />
      {error ? <Text style={appStyles.inputErrorText}>{error}</Text> : null}
    </View>
  );
}
