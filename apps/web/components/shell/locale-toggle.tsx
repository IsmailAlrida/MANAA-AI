"use client"

import { IconLanguage } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"

import { useLocale } from "@/lib/i18n"
import { Hint } from "../hint"

/** Single switch to the other language; the label names the target. */
export function LocaleToggle() {
  const { locale, setLocale, t } = useLocale()
  const target = locale === "en" ? "ar" : "en"
  const label = `${t.locale.label}: ${t.locale[target]}`
  return (
    <Hint label={label}>
      <Button variant="ghost" size="icon" aria-label={label} lang={target} onClick={() => setLocale(target)}>
        <IconLanguage />
      </Button>
    </Hint>
  )
}
