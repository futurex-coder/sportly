#!/bin/bash
# ============================================================
# CODE-LEVEL VERIFICATION — Runs via Cursor terminal
# Checks source code patterns, not DB state
# ============================================================

echo "══════════════════════════════════════════════"
echo "CODE-LEVEL VERIFICATION"
echo "══════════════════════════════════════════════"

FAIL=0

# ─── Wave 2.1: Slot generator uses supabaseAdmin ──────────
echo ""
echo "--- 2.1: Slot generator uses supabaseAdmin ---"
if grep -r "supabaseAdmin" lib/booking/ --include="*.ts" -q 2>/dev/null; then
  echo "✅ PASS: supabaseAdmin found in lib/booking/"
elif grep -r "supabaseAdmin" lib/actions/schedule --include="*.ts" -q 2>/dev/null; then
  echo "✅ PASS: supabaseAdmin found in schedule actions"
else
  echo "❌ FAIL: slot generator may not be using supabaseAdmin — RLS will filter bookings"
  FAIL=$((FAIL+1))
fi

# ─── Wave 2.4: Landing page uses supabaseAdmin ────────────
echo ""
echo "--- 2.4: Landing page uses supabaseAdmin for counts ---"
LANDING=$(find app -name "page.tsx" -path "*/public*" 2>/dev/null | head -1)
if [ -z "$LANDING" ]; then
  LANDING="app/page.tsx"
fi
if grep -l "supabaseAdmin" "$LANDING" 2>/dev/null; then
  echo "✅ PASS: Landing page uses supabaseAdmin"
else
  echo "❌ FAIL: Landing page probably uses regular client — counts will be 0 for anon users"
  FAIL=$((FAIL+1))
fi

# ─── Wave 3.3: createGroupSession checks existing bookings ─
echo ""
echo "--- 3.3: createGroupSession blocks booked slots ---"
if grep -A 20 "createGroupSession" lib/actions/session-actions.ts 2>/dev/null | grep -qi "SLOT_ALREADY_BOOKED\|bookings.*status\|booked"; then
  echo "✅ PASS: createGroupSession appears to check for existing bookings"
else
  echo "❌ FAIL: createGroupSession may not check for existing bookings before creating draft"
  FAIL=$((FAIL+1))
fi

# ─── Wave 4.3: leaveSession blocks organizer ──────────────
echo ""
echo "--- 4.3: leaveSession prevents organizer leaving ---"
if grep -A 15 "leaveSession" lib/actions/session-actions.ts 2>/dev/null | grep -qi "organizer.*cannot\|organizer_id.*userId\|cannot.*leave"; then
  echo "✅ PASS: leaveSession appears to check for organizer"
else
  echo "❌ FAIL: leaveSession may allow organizer to leave their own session"
  FAIL=$((FAIL+1))
fi

# ─── Wave 4.4: leaveSession promotes waitlisted ───────────
echo ""
echo "--- 4.4: leaveSession promotes waitlisted users ---"
if grep -A 30 "leaveSession" lib/actions/session-actions.ts 2>/dev/null | grep -qi "waitlist"; then
  echo "✅ PASS: leaveSession appears to handle waitlist promotion"
else
  echo "❌ FAIL: leaveSession has no waitlist promotion logic"
  FAIL=$((FAIL+1))
fi

# ─── Wave 4.6: Rate limit on session creation ─────────────
echo ""
echo "--- 4.6: Draft session rate limit ---"
if grep -A 20 "createGroupSession" lib/actions/session-actions.ts 2>/dev/null | grep -qi "draft.*limit\|max.*5\|at most\|count.*draft"; then
  echo "✅ PASS: createGroupSession appears to have rate limiting"
else
  echo "❌ FAIL: No rate limit on draft session creation"
  FAIL=$((FAIL+1))
fi

# ─── Wave 5.2: Invite link route exists ───────────────────
echo ""
echo "--- 5.2: Invite link route exists ---"
if find app -path "*invite*" -name "page.tsx" 2>/dev/null | grep -q .; then
  echo "✅ PASS: Invite link route found"
elif find app -path "*invite*" -name "route.ts" 2>/dev/null | grep -q .; then
  echo "✅ PASS: Invite link route handler found"
else
  echo "❌ FAIL: No invite link route at app/(public)/sessions/invite/[code]/"
  FAIL=$((FAIL+1))
fi

# ─── Wave 6.1: Sport is a URL param on club page ─────────
echo ""
echo "--- 6.1: Sport selection uses URL params ---"
CLUB_PAGE=$(find app -path "*clubs*" -name "page.tsx" | head -1)
if [ -n "$CLUB_PAGE" ] && grep -qi "searchParams.*sport\|sport.*param\|useSearchParams" "$CLUB_PAGE" 2>/dev/null; then
  echo "✅ PASS: Club page appears to use sport as URL parameter"
else
  echo "❌ FAIL: Sport selection may not be URL-param driven (won't trigger re-fetch)"
  FAIL=$((FAIL+1))
fi

# ─── Wave 6.2: Sign-out redirects to / ───────────────────
echo ""
echo "--- 6.2: Sign-out redirects to landing page ---"
if grep -r "signOut" --include="*.ts" --include="*.tsx" -l 2>/dev/null | xargs grep -l "redirect.*'/'\|push.*'/'\|router.*'/'" 2>/dev/null | grep -q .; then
  echo "✅ PASS: Sign-out handler includes redirect to /"
else
  echo "❌ FAIL: Sign-out handler may not redirect to landing page"
  FAIL=$((FAIL+1))
fi

# ─── Wave 7.3: bookingSettings is one-to-one ─────────────
echo ""
echo "--- 7.3: bookingSettings not accessed as array ---"
ARRAY_ACCESS=$(grep -rn "bookingSettings\[" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
if [ "$ARRAY_ACCESS" -eq 0 ]; then
  echo "✅ PASS: No array access on bookingSettings"
else
  echo "❌ FAIL: $ARRAY_ACCESS files still access bookingSettings as array"
  grep -rn "bookingSettings\[" --include="*.ts" --include="*.tsx" 2>/dev/null
fi

# ─── Wave 7.4: Slot queries use NOT IN cancelled ─────────
echo ""
echo "--- 7.4: Slot queries filter correctly ---"
BAD_FILTER=$(grep -rn "status.*eq.*confirmed" lib/booking/ lib/actions/schedule 2>/dev/null --include="*.ts" | grep -v "NOT\|not\|!=" | wc -l)
if [ "$BAD_FILTER" -eq 0 ]; then
  echo "✅ PASS: No slot queries filtering only on status=confirmed"
else
  echo "⚠️  WARN: $BAD_FILTER potential issues — review these lines:"
  grep -rn "status.*eq.*confirmed" lib/booking/ lib/actions/schedule 2>/dev/null --include="*.ts" | grep -v "NOT\|not\|!="
fi

# ─── Wave 8: Vercel cron config ──────────────────────────
echo ""
echo "--- 8.6: Vercel cron routes configured ---"
if [ -f "vercel.json" ]; then
  CRON_COUNT=$(grep -c "auto-cancel\|auto-complete" vercel.json 2>/dev/null)
  if [ "$CRON_COUNT" -ge 2 ]; then
    echo "✅ PASS: Both cron routes found in vercel.json"
  else
    echo "❌ FAIL: Missing cron routes in vercel.json (found $CRON_COUNT of 2)"
  fi
else
  echo "❌ FAIL: vercel.json not found"
fi

# ─── Summary ──────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "ALL CODE CHECKS PASSED ✅"
else
  echo "$FAIL CODE CHECKS FAILED ❌"
fi
echo "══════════════════════════════════════════════"
