import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
//#region src/react/cn.ts
/** Merge Tailwind class names, de-duplicating conflicting utilities. */
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
export { cn };
