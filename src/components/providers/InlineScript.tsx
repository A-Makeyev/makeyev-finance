/**
 * Renders a raw script string inline. Server component - the string ships in
 * the HTML, exactly like the <script> block the Vite app had in
 * client/index.html. Used for the pre-paint theme script (see
 * src/theme/prePaint.ts); placing it in the root layout's <head> keeps it
 * ahead of any paint React could do.
 */
export function InlineScript({ script }: { script: string }) {
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
