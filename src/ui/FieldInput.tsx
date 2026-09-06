import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { theme } from '../theme';

/** Text field that always requests the on-screen keyboard. */
export const FieldInput = forwardRef<TextInput, TextInputProps>(function FieldInput(
  { placeholderTextColor, ...rest },
  ref,
) {
  return (
    <TextInput
      {...rest}
      ref={ref}
      showSoftInputOnFocus
      keyboardAppearance="light"
      placeholderTextColor={placeholderTextColor ?? theme.color.muted}
    />
  );
});
