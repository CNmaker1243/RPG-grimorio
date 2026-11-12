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

## Campaign dice architecture
- Create campaigns with a client-generated UUID and an insert without RETURNING; the owner membership trigger must finish before subsequent member-scoped reads.
- Generate campaign dice through the database RPC, with cryptographic randomness and membership/character checks; never generate or accept results from the browser.
- Keep dice history append-only for application users and snapshot roller/character names with typed groups so later edits cannot change recorded rolls.
- Keep selection validation in `src/lib/dice.ts` and render recorded groups through `DiceResults` so the latest result and history agree.

## Custom sheets architecture
- Store campaign templates, linked skills and per-member type quotas separately; validate sheet data and limits in database triggers so browser requests cannot bypass master settings.
- Keep template field IDs stable across renames and store character values by those IDs; template deletion is restricted while sheets use it.
- Define reusable success tests through master-only rows; the dice RPC derives the pool and difficulty from stored rows and snapshots the outcome in existing dice history.
- Use `src/lib/sheets.ts` for typed queries and parsing, focused sheet editors for presentation, and `useSheetUpdates` for shared cache refresh after campaign changes.

## Items and combat architecture
- Items, sheet assignments and combats are validated by database triggers and security-definer RPCs (combat_attack, combat_set_defense, combat_defend, combat_reroll_attack, combat_damage, combat_cancel); the browser never decides outcomes.
- Damage formulas are parsed by parse_damage_formula (SQL) mirrored in src/lib/combat.ts — a restricted dice-expression parser, never eval.
- Combat rolls reuse roll_dice_combined and are tagged roll_mode='combat' with a combat_data snapshot in dice_rolls, so the public history stays the single source of truth.
- Players cannot read other characters; combat target selection uses the combat_roster RPC (id/name/owner only).

## Audit access boundaries
- Require active campaign membership for character and inventory reads and writes, including former owners, so removal revokes every related access path.
- Clear query caches on sign-out and periodically revalidate campaign membership; scoped realtime subscriptions avoid unrelated campaign refreshes.
- Keep public invite pages public with an inline sign-in action and return confirmation links to the public auth page before protected navigation.
