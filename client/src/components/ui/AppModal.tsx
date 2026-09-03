import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface AppModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  /** Border/header accent color. */
  tone?: 'blue' | 'green' | 'red' | 'teal'
  testId?: string
  /** Content direction - drives logical props like the close button's side. */
  dir?: 'rtl' | 'ltr'
  /** Extra class names merged onto Dialog.Content. */
  contentClassName?: string
}

const TONE_BORDER = {
  blue: 'border-soft-blue',
  green: 'border-soft-green',
  red: 'border-soft-red',
  // Calculator accent - matches the modal's action buttons.
  teal: 'border-[color:var(--calc-teal)]',
} as const

/**
 * Centered modal with blurred overlay - Radix Dialog provides the focus trap,
 * Escape-to-close and overlay-click-to-close that the legacy modals
 * hand-rolled (contact.js:319-360).
 *
 * Runs in `modal={false}` mode with a hand-rolled backdrop: Radix's modal mode
 * locks body scroll (react-remove-scroll) and we want the page to stay
 * scrollable behind the dialog. Outside clicks are ignored (the dialog only
 * closes via the close button, Escape or an explicit onOpenChange(false)).
 */
export function AppModal({
  open,
  onOpenChange,
  children,
  tone = 'blue',
  testId,
  dir = 'ltr',
  contentClassName,
}: AppModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        {/* Radix only renders Dialog.Overlay in modal mode, so we draw the
            dimming layer ourselves. It does not intercept wheel/touch
            scrolling, so the page behind stays scrollable. */}
        {open && (
          <div className="fixed inset-0 z-[999] bg-[rgba(15,15,15,0.5)] backdrop-blur-[5px]" />
        )}
        <Dialog.Content
          data-testid={testId}
          dir={dir}
          onInteractOutside={(event) => event.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-[1000] max-h-[85vh] w-[92vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overflow-x-hidden rounded-[5px] border-2 bg-white shadow-[0_5px_5px_0_rgba(15,15,15,0.5)] data-[state=open]:animate-[app-modal-pop-in_300ms_cubic-bezier(0.34,1.3,0.64,1)_forwards] data-[state=closed]:animate-[app-modal-pop-out_150ms_ease-in_forwards]',
            TONE_BORDER[tone],
            contentClassName,
          )}
        >
          <Dialog.Close
            aria-label="close"
            data-testid={`${testId}-close`}
            className="absolute end-[10px] top-[6px] flex h-[40px] w-[40px] items-center justify-center cursor-pointer border-none bg-none text-[28px] font-semibold leading-none text-soft-black outline-none transition-[transform,color] duration-300 hover:rotate-90 hover:text-soft-red"
          >
            &#215;
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
