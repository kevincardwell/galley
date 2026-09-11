import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Icon({ size = 14, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></Icon>;
export const XIcon = (p: IconProps) => <Icon {...p}><path d="M4 4l8 8M12 4l-8 8" /></Icon>;
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M8 3v10M3 8h10" /></Icon>;
export const PaperclipIcon = (p: IconProps) => <Icon {...p}><path d="M13.2 7.3 8.1 12.4a3.2 3.2 0 0 1-4.5-4.5l5.6-5.6a2.1 2.1 0 0 1 3 3L6.7 10.8a1 1 0 0 1-1.5-1.5l4.9-4.9" /></Icon>;
export const ChecklistIcon = (p: IconProps) => <Icon {...p}><path d="M2.5 4.5l1.2 1.2L6 3.4M2.5 9l1.2 1.2L6 7.9M8 4.5h5.5M8 9h5.5M2.5 13h11" /></Icon>;
export const CommentIcon = (p: IconProps) => <Icon {...p}><path d="M3 3.5h10a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H7.5L4.5 13v-2.5H3a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z" /></Icon>;
export const DotsIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="3.5" cy="8" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" /><circle cx="12.5" cy="8" r="1.1" fill="currentColor" stroke="none" /></Icon>
);
export const GripIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="4" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="4" r="1" fill="currentColor" stroke="none" />
    <circle cx="6" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
  </Icon>
);
export const ArrowRightIcon = (p: IconProps) => <Icon {...p}><path d="M3 8h10M9 4l4 4-4 4" /></Icon>;
