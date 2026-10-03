import { InlineScript } from '@/components/providers/InlineScript'
import { PRE_PAINT_THEME_SCRIPT } from '@/theme/prePaint'
import '@/styles/globals.css'

/**
 * Global 404 for URLs outside both locale groups. It renders its own
 * <html>/<body> because with per-locale root layouts there is no shared root
 * layout to inherit from. Hebrew is the default audience; the chrome-less
 * page just links home.
 */
export default function GlobalNotFound() {
  return (
    <html lang="he" dir="rtl" data-scroll-behavior="smooth">
      <head>
        <InlineScript script={PRE_PAINT_THEME_SCRIPT} />
      </head>
      <body>
        <main className="w-[80%] mx-auto pt-24 pb-24 text-center">
          <h1 className="text-[2em] font-bold text-ink">Makeyev Finance</h1>
          <p className="mt-4 text-[17px] text-ink-muted">
            העמוד שביקשת לא נמצא.{" "}
            <a href="/" className="article-link">
              לעמוד הבית
            </a>
          </p>
          <p className="mt-2 text-[17px] text-ink-muted">
            Page not found.{" "}
            <a href="/en" className="article-link">
              Home
            </a>
          </p>
        </main>
      </body>
    </html>
  )
}
