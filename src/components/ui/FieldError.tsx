/**
 * A form's error message.
 *
 * Placed under the inputs rather than above the form: the reader has just
 * typed into those fields, so that is where the eye already is, and a banner
 * above the form pushes the failure away from the thing that caused it.
 *
 * role="alert" keeps the announcement when the message appears after a submit,
 * which is the only way a form error ever arrives.
 */
export function FieldError({ message, testId }: { message: string; testId: string }) {
  return (
    <p role="alert" data-testid={testId} className="text-sm text-danger">
      {message}
    </p>
  )
}