import { ProductForm } from "@/components/panes/ProductForm"
import { IntentionForm } from "@/components/panes/IntentionForm"
import { ProductIntentionForm } from "@/components/panes/ProductIntentionForm"

export default function App() {
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold">🔧 Discovery Engine — Injector</h1>
        <p className="mt-1 text-muted-foreground">
          Manage products, intentions, and their relationships
        </p>
      </header>
      <div className="mx-auto grid max-w-6xl items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
        <ProductForm />
        <IntentionForm />
        <ProductIntentionForm />
      </div>
    </div>
  )
}
