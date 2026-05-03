import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { appStyles, colors } from '../utils/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export function ActionBubble({ icon, label }: Props) {
  return (
    <View style={appStyles.actionGroup}>
      <View style={appStyles.actionCircle}>
        <Ionicons name={icon} size={26} color={colors.white} />
      </View>
      <Text style={appStyles.actionLabel}>{label}</Text>
    </View>
  );
}
