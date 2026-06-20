#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# ASCENTOR REBRAND — Global Find & Replace Script
# Run from the ROOT of the ascentor-mvp repo
# Usage: bash scripts/rebrand-find-replace.sh
# ══════════════════════════════════════════════════════════════════

set -e

echo "🔁 Ascentor Rebrand — Find & Replace starting..."
echo "Working directory: $(pwd)"
echo ""

# ── Safety check: must be run from repo root ──
if [ ! -f "package.json" ]; then
  echo "❌ Error: Run this script from the root of the repo (where package.json lives)."
  exit 1
fi

# ── Files to target ──
TARGET_FILES=$(find . \
  -type f \
  \( -name "*.tsx" -o -name "*.ts" -o -name "*.mdx" -o -name "*.md" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.next/*" \
  ! -path "*/android/*" \
  ! -path "*/ios/*" \
  ! -path "*/.git/*" \
  ! -path "*/dist/*" \
  ! -name "*.env*" \
)

# ── Helper function ──
replace_in_files() {
  local find_str="$1"
  local replace_str="$2"
  local description="$3"

  count=$(echo "$TARGET_FILES" | xargs grep -l "$find_str" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" -gt "0" ]; then
    echo "  ✓ [$description] — found in $count file(s)"
    echo "$TARGET_FILES" | xargs sed -i '' "s|$find_str|$replace_str|g" 2>/dev/null || \
    echo "$TARGET_FILES" | xargs sed -i "s|$find_str|$replace_str|g" 2>/dev/null
  else
    echo "  — [$description] — not found, skipping"
  fi
}

echo "━━━ Brand Name ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
replace_in_files "AscentorBI" "Ascentor" "AscentorBI → Ascentor"
replace_in_files "Ascentor BI" "Ascentor" "Ascentor BI → Ascentor"

echo ""
echo "━━━ Platform Identity ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
replace_in_files "AI-Powered Mentorship Platform" "The Elevation Summit Platform" "AI-Powered Mentorship Platform"
replace_in_files "AI-powered mentorship platform" "The Elevation Summit platform" "AI-powered mentorship platform (lowercase)"
replace_in_files "AI-powered mentorship" "purposeful development" "AI-powered mentorship (generic)"
replace_in_files "AI-Powered Mentorship" "Purposeful Development" "AI-Powered Mentorship (title case)"

echo ""
echo "━━━ Audience Language ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
replace_in_files "African professionals" "purposeful individuals" "African professionals"
replace_in_files "ambitious professionals" "purposeful individuals" "ambitious professionals"
replace_in_files "ambitious Africans" "purposeful individuals" "ambitious Africans"
replace_in_files "built for Africa" "" "built for Africa (remove)"
replace_in_files "built for ambitious" "built for the purposeful" "built for ambitious"
replace_in_files "for ambitious" "for the purposeful" "for ambitious"

echo ""
echo "━━━ Development Language ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
replace_in_files "career development" "purposeful development" "career development"
replace_in_files "career mentorship" "purposeful development" "career mentorship"
replace_in_files "career growth" "purposeful growth" "career growth"
replace_in_files "Career Development" "Purposeful Development" "Career Development (title case)"
replace_in_files "Career Mentorship" "Purposeful Development" "Career Mentorship (title case)"

echo ""
echo "━━━ CTA Language ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
replace_in_files "Start Free — 7 Days" "Join Ascentor" "Start Free CTA"
replace_in_files "Start Free - 7 Days" "Join Ascentor" "Start Free CTA (hyphen)"
replace_in_files "Start Free" "Join Ascentor" "Start Free (generic)"
replace_in_files "unlock your potential" "build a life that outlasts you" "unlock your potential"
replace_in_files "Unlock Your Potential" "Build a Life That Outlasts You" "Unlock Your Potential (title case)"
replace_in_files "get ahead" "build with intention" "get ahead"
replace_in_files "Get Ahead" "Build With Intention" "Get Ahead (title case)"

echo ""
echo "━━━ Pricing / Trial Language (remove) ━━━━━━━━━━━━━━━━━━━━━"
replace_in_files "7-day free trial" "" "7-day free trial"
replace_in_files "7 day free trial" "" "7 day free trial"
replace_in_files "30-day money-back" "" "30-day money-back"
replace_in_files "30 day money back" "" "30 day money back"
replace_in_files "founding member pricing" "" "founding member pricing"
replace_in_files "Founding Member Pricing" "" "Founding Member Pricing"
replace_in_files "No credit card required" "" "No credit card required"
replace_in_files "Cancel anytime" "" "Cancel anytime"
replace_in_files "Cancel Anytime" "" "Cancel Anytime (title case)"

echo ""
echo "━━━ Community Naming ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
replace_in_files "Mentorship Circles" "Accountability Circles" "Mentorship Circles"
replace_in_files "Peer Community" "The Circle" "Peer Community"

echo ""
echo "✅ Find & Replace complete."
echo ""
echo "⚠️  DO NOT replace:"
echo "   — ascentorbi.com (domain strings — keep until domain migration)"
echo "   — NEXT_PUBLIC_* environment variable names"
echo "   — Database column names or Supabase references"
echo "   — Import paths"
echo "   — The word 'Sage' in functional code (only remove from marketing copy manually)"
echo ""
echo "Next: run 'npm run dev' and verify nothing is broken."
