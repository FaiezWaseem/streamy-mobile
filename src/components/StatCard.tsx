import { Text, View } from 'react-native';

import { appStyles } from '../utils/theme';

type Props = {
  value: string;
  label: string;
};

export function StatCard({ value, label }: Props) {
  return (
    <View style={appStyles.statCard}>
      <Text style={appStyles.statValue}>{value}</Text>
      <Text style={appStyles.statLabel}>{label}</Text>
    </View>
  );
}
