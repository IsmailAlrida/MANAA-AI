import { TicketDetail } from "@/components/tickets/ticket-detail"

export default async function TicketPage(props: PageProps<"/tickets/[ticketId]">) {
  const { ticketId } = await props.params
  return <TicketDetail ticketId={decodeURIComponent(ticketId)} />
}
