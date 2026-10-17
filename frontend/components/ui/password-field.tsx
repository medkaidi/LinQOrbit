import { useState } from "react";
import { TextField, type TextFieldProps } from "@/components/ui/text-field";
import { Icon } from "@/components/ui/icon";

type PasswordFieldProps = Omit<TextFieldProps, "type" | "trailing">;

export function PasswordField({
  label,
  labelAction,
  icon = "key",
  error,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...inputProps}
      label={label}
      labelAction={labelAction}
      icon={icon}
      error={error}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
        >
          <Icon name={visible ? "visibility_off" : "visibility"} className="text-[20px] leading-none" />
        </button>
      }
    />
  );
}
