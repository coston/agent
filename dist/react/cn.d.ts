import { ClassValue } from "clsx";

//#region src/react/cn.d.ts
/** Merge Tailwind class names, de-duplicating conflicting utilities. */
declare function cn(...inputs: ClassValue[]): string;
//#endregion
export { cn };