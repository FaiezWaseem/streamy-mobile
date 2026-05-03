import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { savedItems } from '../utils/data';
import { appStyles } from '../utils/theme';

export function SavedScreen() {
  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.pageContent}>
        <Text style={appStyles.pageTitle}>Saved</Text>
        {savedItems.map((item) => (
          <View key={item.id} style={appStyles.savedCard}>
            <Text style={appStyles.savedType}>{item.type}</Text>
            <Text style={appStyles.savedTitle}>{item.title}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
