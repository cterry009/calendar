import { Label, YStack } from '@calendar/ui';
import { Input, type InputProps } from 'tamagui';

interface AuthFormFieldProps extends Omit<InputProps, 'id'> {
  id: string;
  label: string;
}

export function AuthFormField({ id, label, ...inputProps }: AuthFormFieldProps) {
  return (
    <YStack gap="$2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} autoCapitalize="none" autoCorrect={false} {...inputProps} />
    </YStack>
  );
}
