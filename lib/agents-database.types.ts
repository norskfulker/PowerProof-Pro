/**
 * Types for the agent tables (migrations 049–051). Kept apart from the generated
 * lib/database.types.ts so that file is never edited by hand; regenerate that file as usual and
 * these new tables appear there too. Rows are typed loosely here and narrowed by
 * lib/types/agents.ts where pages use them.
 */

type Loose = Record<string, unknown>;
interface AnyTable {
  Row: Loose;
  Insert: Loose;
  Update: Loose;
  Relationships: [];
}
interface AnyView {
  Row: Loose;
  Relationships: [];
}
interface AnyFunction {
  Args: Loose;
  Returns: unknown;
}

export type AgentsDatabase = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: Record<string, AnyTable>;
    Views: Record<string, AnyView>;
    Functions: Record<string, AnyFunction>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
