# Dice system
- [x] Diagnose and fix campaign creation failure reported by the user.
- [x] Add secure combined rolls and immutable history, preserving existing campaign permissions.
- [x] Add individual/combined selection, character selection, results, and live campaign history.
- [x] Test rules and authenticated desktop/mobile campaign flow.

# Custom sheets and success tests
- [x] Add template, skill, quota and success-test storage with server-enforced rules.
- [x] Add master editors and customizable character sheets.
- [x] Integrate d10 tests with public immutable dice history.
- [x] Verify rules and authenticated desktop/mobile flows.

# Items and combat
- [x] Add GM-only items (categories, bonuses, custom attributes/properties, safe damage formulas) with server validation.
- [x] Let the mestra assign items to character sheets and players view them.
- [x] Add d20 attack/defense duels with highest-die comparison, attribute tiebreak, reroll on full tie, and item damage on attacker win.
- [x] Record attack, defense and damage in the public immutable history with full combat details.
- [x] Verify rules, permissions and authenticated desktop/mobile flows.

# Full application audit
- [x] Review modules and correct confirmed access-revocation and invitation defects.
- [x] Exercise backend permissions as a real authenticated player and campaign owner.
- [x] Verify persisted rolls, same-account live updates and desktop/mobile navigation.
- [x] Record tested outcomes and explicit verification limits in AUDIT.md.
- [ ] Verify signup/email/password/Google completion — needs a real account/provider flow.
- [ ] Verify live updates across distinct users — needs a second authorized session.
- [ ] Certify forced database tie/reroll and all pointer-selection states — unverified execution paths, not a readiness claim.

# Functional maintenance
- [ ] Inspect current policies, RPCs, realtime, authentication and numeric inputs; preserve correct implementations.
- [ ] Fix confirmed defects only and add focused regression tests.
- [ ] Exercise changed flows and existing automated tests; document evidence and manual verification gaps.