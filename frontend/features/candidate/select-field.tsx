import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Select, type SelectOption } from "@/components/ui/select";

type SelectFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  /** Reconvertit la valeur de la liste (toujours une string) vers le type du formulaire. */
  parse?: (value: string) => unknown;
  disabled?: boolean;
  /** Liste longue : filtre au fil de la frappe (autocomplete). */
  searchable?: boolean;
};

/**
 * Champ select branché sur React Hook Form : le composant `Select` est contrôlé,
 * le `Controller` fait le pont avec le formulaire (valeur + validation).
 */
export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  parse,
  disabled,
  searchable,
}: SelectFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select
          label={label}
          options={options}
          placeholder={placeholder}
          value={field.value === undefined || field.value === null ? "" : String(field.value)}
          onValueChange={(next) => field.onChange(parse ? parse(next) : next)}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
          disabled={disabled}
          searchable={searchable}
        />
      )}
    />
  );
}
