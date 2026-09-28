import { forwardRef, useState } from 'react';
import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { tokens } from './tokens';

/** Champ partagé ; les écrans restent responsables du libellé permanent et de l’erreur. */
export const FieldInput = forwardRef<TextInput, TextInputProps>(function FieldInput({ style, onFocus, onBlur, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return <TextInput ref={ref} {...props} onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }} placeholderTextColor={props.placeholderTextColor ?? tokens.colors.textMuted} style={[styles.field, style, focused && styles.focus]} />;
});
const styles = StyleSheet.create({
  field: { minHeight: tokens.size.controlMd, borderWidth: tokens.border.thin, borderRadius: tokens.radius.sm, borderColor: tokens.colors.borderStrong, color: tokens.colors.text, backgroundColor: tokens.colors.surface, fontFamily: tokens.font.sans, fontSize: tokens.type.body.fontSize, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm },
  focus: { borderColor: tokens.colors.accent, ...tokens.focus.ring },
});
