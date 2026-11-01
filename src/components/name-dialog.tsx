import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A small cross-platform "enter a name" dialog (Alert.prompt is iOS-only). */
export function NameDialog({
  visible,
  title,
  initialValue = '',
  confirmLabel = 'Save',
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {visible ? (
        <DialogBody
          title={title}
          initialValue={initialValue}
          confirmLabel={confirmLabel}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
}

function DialogBody({
  title,
  initialValue,
  confirmLabel,
  onCancel,
  onSubmit,
}: {
  title: string;
  initialValue: string;
  confirmLabel: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue);
  const canSubmit = value.trim().length > 0;
  const submit = () => canSubmit && onSubmit(value.trim());

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close" />
      <View style={[styles.card, { backgroundColor: theme.background }]}>
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
        <TextInput
          value={value}
          onChangeText={setValue}
          autoFocus
          selectTextOnFocus
          placeholder="Album name"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="done"
          onSubmitEditing={submit}
          maxLength={60}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement },
          ]}
        />
        <View style={styles.buttons}>
          <Pressable onPress={onCancel} style={styles.button} accessibilityRole="button">
            <ThemedText type="smallBold" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.button, !canSubmit && { opacity: 0.4 }]}
            accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.tint }}>
              {confirmLabel}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  title: { fontSize: 17, textAlign: 'center' },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three - 4,
    paddingVertical: Spacing.two + 2,
    borderRadius: 10,
  },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  button: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
