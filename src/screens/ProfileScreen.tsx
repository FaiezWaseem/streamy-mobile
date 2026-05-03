import { Ionicons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { StatCard } from '../components/StatCard';
import { appStyles, colors } from '../utils/theme';

type Props = {
  onOpenSaved: () => void;
  onLogout: () => void;
};

export function ProfileScreen({ onOpenSaved, onLogout }: Props) {
  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.pageContent}>
        <View style={appStyles.profileHeader}>
          <View style={appStyles.avatar}>
            <Text style={appStyles.avatarText}>S</Text>
          </View>
          <Text style={appStyles.profileName}>Streamy Creator</Text>
          <Text style={appStyles.profileHandle}>@streamy</Text>
        </View>

        <View style={appStyles.statsRow}>
          <StatCard value="42" label="Uploads" />
          <StatCard value="128k" label="Views" />
          <StatCard value="7.8k" label="Saved" />
        </View>

        <Pressable style={appStyles.cardRow} onPress={onOpenSaved}>
          <Ionicons name="bookmark-outline" size={22} color={colors.accent} />
          <Text style={appStyles.cardRowText}>Open Saved</Text>
        </Pressable>

        <Pressable style={appStyles.cardRow} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.accent} />
          <Text style={appStyles.cardRowText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
