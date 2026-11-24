/**
 * In-process fan-out from committed writes to open SSE streams. Publish only
 * after the store transaction commits. With multiple API processes this is
 * replaced by PostgreSQL LISTEN/NOTIFY (see store/postgres-schema.sql); the
 * subscriber side stays the same.
 */
export interface BusEvent {
  /** SSE event name. */
  type: string
  /** Set for `run.status`, so streams only forward their own run's status. */
  runId?: string
  payload: unknown
}

export type Listener = (event: BusEvent) => void

export interface Bus {
  publish(event: BusEvent): void
  subscribe(listener: Listener): () => void
}

export function createBus(
  onListenerError: (err: unknown) => void = () => {}
): Bus {
  const listeners = new Set<Listener>()
  return {
    publish(event) {
      for (const listener of listeners) {
        try {
          listener(event)
        } catch (err) {
          onListenerError(err)
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
