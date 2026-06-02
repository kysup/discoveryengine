import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Recommendation } from "@/types"

// Ranked emphasis: #1 widest, tapering down (echoes the original "pyramid").
const WIDTHS = ["max-w-md", "max-w-sm", "max-w-xs"]

export function ProductCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  const bundle = (
    <>
      {rec.logo_url && (
        <img
          src={rec.logo_url}
          alt={rec.product_name}
          className="mb-1 max-h-11 max-w-[140px] object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none"
          }}
        />
      )}
      <h3 className="font-heading text-base font-semibold text-foreground">
        {rec.product_name}
      </h3>
    </>
  )

  return (
    <Card className={cn("mx-auto w-full", WIDTHS[rank] ?? "max-w-xs")}>
      <CardContent className="flex flex-col items-center gap-2 py-2 text-center">
        {rec.product_url ? (
          <a
            href={rec.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-col items-center rounded-lg px-3 py-1 no-underline transition-colors hover:bg-muted"
          >
            {bundle}
          </a>
        ) : (
          <div className="inline-flex flex-col items-center px-3 py-1">{bundle}</div>
        )}
        <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
          Score: {rec.total_score}
        </span>
      </CardContent>
    </Card>
  )
}
