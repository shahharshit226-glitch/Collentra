import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/ui';
import { faqItems } from '@/lib/faq';

export default function FAQScreen() {
  const { colors, spacing, type, fontFamily } = useTheme(); const [open, setOpen] = useState<number | null>(null);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
    <Text style={{ color: colors.ink, fontFamily: fontFamily.display.bold, fontSize: type.h1.fontSize }}>Frequently asked questions</Text>
    {faqItems.map((item, i) => <Card key={item.question} style={{ padding: 0, overflow: 'hidden' }}><Pressable onPress={() => setOpen(open === i ? null : i)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg }}><Text style={{ flex: 1, color: colors.ink, fontFamily: fontFamily.body.semibold, fontSize: type.body.fontSize }}>{item.question}</Text><Feather name={open === i ? 'chevron-up' : 'chevron-down'} color={colors.inkMuted} size={18} /></Pressable>{open === i ? <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}><Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.regular, fontSize: type.bodySmall.fontSize }}>{item.answer}</Text></View> : null}</Card>)}
  </ScrollView></SafeAreaView>;
}
