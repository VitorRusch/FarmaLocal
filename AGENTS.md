<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Application architecture
- Keep the pharmacy data layer browser-only and lazily construct Dexie; this avoids opening IndexedDB during SSR.
- Use IndexedDB transactions for every stock mutation and its immutable movement snapshot; this keeps balances and history consistent.
- Keep business validation and spreadsheet processing in shared pure/data modules; this permits concrete rule tests independently of the interface.
- Use file routes for each workspace page with a shared root shell and page-specific metadata; this preserves typed navigation.
- Cache same-origin workspace pages and assets with a production-only service worker; this supports local inventory work after the first online visit.
- Persist theme selection in IndexedDB settings and apply it after hydration; this keeps backup support and avoids browser reads during SSR.
- Use SheetJS for spreadsheet reading and xlsx-js-style for styled exports; this preserves header fills in the downloaded workbook without changing import behavior.
