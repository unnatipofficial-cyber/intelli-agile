import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // A travelling sheen instead of `animate-pulse`. Pulse dims and
      // brightens the whole block in place, which reads as a blinking
      // placeholder; a sheen reads as content being fetched, which is what
      // is actually happening. Both are disabled under reduced motion by the
      // consolidated block in index.css.
      className={cn("bg-accent rounded-md aie-skeleton", className)}
      {...props}
    />
  )
}

export { Skeleton }
