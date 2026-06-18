// Re-export `@coston/ui`'s class-name merger rather than reinventing it. The
// React subpath already hard-requires `@coston/ui` (every component imports from
// it), so this keeps the package's own runtime dependencies at zero.
export { cn } from '@coston/ui/lib/utils';
