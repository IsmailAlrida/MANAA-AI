"use client"

import * as React from "react"
import { IconArchive, IconX } from "@tabler/icons-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"

import { api, ApiError, newIdempotencyKey } from "@/lib/api/client"
import type { Ticket } from "@/lib/api/types"
import { localizeApiError, useLocale } from "@/lib/i18n"
import {
  closeTicketInitial,
  closeTicketReducer,
  isCloseDialogOpen,
  WRITEUP_MAX,
} from "@/lib/machines/close-ticket"
import { useWorkspaceActions } from "@/lib/workspace/store"
import { Hint } from "../hint"

export function CloseTicketDialog({ ticket }: { ticket: Ticket }) {
  const { t, locale } = useLocale()
  const { upsertTicket } = useWorkspaceActions()
  const [s, send] = React.useReducer(closeTicketReducer, closeTicketInitial)

  // Side effect for the `submitting` state.
  React.useEffect(() => {
    if (s.tag !== "submitting") return
    let cancelled = false
    api
      .closeTicket(ticket.id, s.draft.trim(), s.key)
      .then((updated) => {
        if (cancelled) return
        upsertTicket(updated)
        send({ type: "SUCCESS" })
      })
      .catch((e) => {
        if (cancelled) return
        const kind = e instanceof ApiError ? e.kind : "network"
        const fieldMsg = e instanceof ApiError ? e.fieldErrors?.finalWriteup : undefined
        const message = fieldMsg ?? (e instanceof Error ? e.message : String(e))
        send({ type: "FAILURE", kind, message: localizeApiError(locale, kind, message) })
      })
    return () => {
      cancelled = true
    }
  }, [s, ticket.id, upsertTicket])

  // done → closed (dialog dismisses itself; ticket now renders as closed).
  React.useEffect(() => {
    if (s.tag === "done") send({ type: "RESET" })
  }, [s.tag])

  if (ticket.status === "closed") return null

  const draft = s.tag === "editing" || s.tag === "submitting" || s.tag === "error" ? s.draft : ""
  const submitting = s.tag === "submitting"

  return (
    <Dialog
      open={isCloseDialogOpen(s)}
      onOpenChange={(o) => send(o ? { type: "OPEN", key: newIdempotencyKey() } : { type: "CANCEL" })}
    >
      <Hint label={t.hint.closeTicket}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <IconArchive />
            {t.close.action}
          </Button>
        </DialogTrigger>
      </Hint>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => submitting && e.preventDefault()}
        onEscapeKeyDown={(e) => submitting && e.preventDefault()}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            send({ type: "SUBMIT" })
          }}
        >
          <DialogHeader>
            <DialogTitle>{t.close.title}</DialogTitle>
            <DialogDescription>{t.close.description}</DialogDescription>
          </DialogHeader>

          <Field data-invalid={s.tag === "editing" && s.invalid}>
            <FieldLabel htmlFor="final-writeup">{t.close.label}</FieldLabel>
            <Textarea
              id="final-writeup"
              aria-required
              autoFocus
              maxLength={WRITEUP_MAX}
              placeholder={t.close.placeholder}
              value={draft}
              disabled={submitting}
              aria-invalid={s.tag === "editing" && s.invalid}
              onChange={(e) => send({ type: "EDIT", draft: e.target.value })}
            />
            <FieldDescription>
              {draft.length}/{WRITEUP_MAX}
            </FieldDescription>
            {s.tag === "editing" && s.invalid && <FieldError>{t.close.required}</FieldError>}
          </Field>

          {s.tag === "error" && (
            <Alert variant="destructive">
              <AlertDescription>{s.message}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => send({ type: "CANCEL" })}>
              <IconX />
              {t.close.cancel}
            </Button>
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? <Spinner /> : <IconArchive />}
              {submitting ? t.close.submitting : t.close.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
