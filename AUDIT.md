# RPG application audit — 2026-11-12

## Corrected and verified
- Active membership now gates all character read/update/delete and inventory read paths. Removing the test player's membership hid characters, items and assignments and rejected further rolls. Existing data is preserved.
- Internal trigger helpers are no longer exposed as callable anonymous/authenticated RPCs. Required authenticated application RPCs remain available and enforce their own authorization.
- Sign-out clears cached private queries; campaign membership is revalidated periodically. Realtime campaign filters avoid unrelated campaign refreshes.
- Redirect validation rejects backslashes/control characters. Invalid invites offer a working return to the panel; signed-out invites offer an inline sign-in action.
- Confirmation redirects return to the public auth page. Google failures are caught and duplicate requests blocked. Delivery and OAuth completion remain unverified below.
- Damage is labelled as rolled, not applied to HP; no automatic bonus or HP mechanics were introduced.

## Observed tests
- 25 automated tests pass, covering permitted dice, quantities, sums, success pools, success counting, damage parsing, highest-die comparison, both attribute tie outcomes, full-tie reroll decisions, campaign insertion and redirect regressions.
- 36 authenticated browser/Data API assertions passed using the requesting account as a player in an isolated test campaign: other sheets hidden/unmodifiable, cross-campaign reads empty, administrative writes blocked, skill maxima and per-template quotas enforced, all seven dice types and combined sums correct, direct roll insert/update/delete blocked, five-d10 pool derived from Intelligence 3 + Investigation 2, and three-d20 attack derived from Strength 3.
- 16 additional authenticated assertions passed: skill/difficulty/role/assignment/item modifications blocked for a player, invalid d2 and excessive dice rejected, GM item customization and quantity updates persisted, multiple templates and sheets supported, used template deletion rejected, and cross-campaign item assignments/combats blocked.
- GM UI flow tested: create template/attribute/skill/test, create two sheets, save values, create/assign weapon, attack, choose defense, roll defense and damage. Observed attack [20,3,17], defense [4,8], damage 1d6+2 = 5; result read back from persisted combat rows.
- Campaign creation/deletion, invitation code entry, invitation link entry and invalid-link recovery exercised through the UI.
- Sheet changes and dice results survived reload and sign-out followed by restoration of a valid session. This is not a password-login test.
- Two browser pages with the same authenticated account received live dice history without reload. Independent user identities are not yet verified.
- At 384×682, panel, global sheets, campaign room, campaign sheets, items and GM panel had no horizontal overflow. Desktop sheet, room, mobile GM panel, invite and final combat screenshots inspected. No page runtime exceptions in the central player flow.
- Basic scan recheck found no issues. Deep scan identified three access-revocation findings; each was fixed and verified as the authenticated caller. Database linter anonymous helper warnings were removed; 16 authenticated SECURITY DEFINER notices remain for deliberately authenticated application RPCs/policy helpers, not proof of an exploit.

## Not certified / follow-up requirements
- New-account email delivery/confirmation, password login/recovery and full Google OAuth completion require a real account/provider flow; no hosted auth settings were changed or certified.
- Realtime between two distinct signed-in people requires a second authorized account/session. The same-account two-page test does not establish this.
- Attribute/full ties and reroll selection pass unit tests; a forced full-tie database duel was not performed. Random combat UI test was a non-tie.
- Not every delete/edit control or failure/retry state has been individually exercised. Long-page pointer selection in the GM test encountered an offscreen menu; keyboard selection completed the flow. This pointer-placement case remains unverified and must not be claimed fixed.
- A complete audit is not a guarantee against every vulnerability or concurrency race. Remaining verification gaps prevent claiming universal production readiness.

All audit campaigns and their rows were removed after testing; real campaign data and the existing visual identity were retained.