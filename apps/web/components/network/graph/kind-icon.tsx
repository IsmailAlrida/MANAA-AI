import {
  IconAd2,
  IconAt,
  IconBuilding,
  IconBuildingBank,
  IconCash,
  IconCircleDashed,
  IconLink,
  IconMessage,
  IconServer,
  IconShoppingBag,
  IconUser,
  IconWorld,
  type Icon,
} from "@tabler/icons-react"

/** Entity kind → icon. Unknown kinds fall back to a generic marker. */
const ICONS: Record<string, Icon> = {
  person: IconUser,
  company: IconBuilding,
  url: IconWorld,
  website: IconWorld,
  link: IconLink,
  ad: IconAd2,
  social_post: IconMessage,
  social_account: IconAt,
  server: IconServer,
  bank_account: IconBuildingBank,
  transaction: IconCash,
  marketplace_listing: IconShoppingBag,
}

export function KindIcon({ kind, ...props }: { kind: string } & React.ComponentProps<Icon>) {
  const C = ICONS[kind] ?? IconCircleDashed
  return <C aria-hidden {...props} />
}
