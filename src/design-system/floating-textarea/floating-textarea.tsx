import type { Ref, TextareaHTMLAttributes } from "react";

type FloatingTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "children"
> & {
  containerClassName?: string;
  label: string;
  ref?: Ref<HTMLTextAreaElement>;
};

export function FloatingTextarea({
  className,
  containerClassName,
  label,
  placeholder,
  ...props
}: Readonly<FloatingTextareaProps>) {
  const composedContainerClassName = ["floating-textarea", containerClassName]
    .filter(Boolean)
    .join(" ");
  const composedTextareaClassName = ["floating-textarea__control", className]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={composedContainerClassName}>
      <textarea
        className={composedTextareaClassName}
        placeholder={placeholder ?? label}
        {...props}
      />
      <span className="floating-textarea__label">{label}</span>
    </label>
  );
}
