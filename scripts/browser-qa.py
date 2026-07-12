"""
dabasemint browser QA v2 — robust version that dismisses modals between steps
and scopes selectors. Verifies the inline-onclick buttons (previously broken by
the ES-module window-scope bug) now execute without ReferenceError.
"""
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:4174"
results = []
errors = []

def record(name, ok, detail=""):
    results.append((name, ok, detail))

def print_results():
    print("\n================ BROWSER QA RESULTS ================")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    check = "\u2705" if True else ""
    cross = "\u274c"
    for name, ok, detail in results:
        mark = "\u2705" if ok else cross
        line = "  " + mark + " " + name
        if detail and not ok:
            line += " \u2014 " + detail
        print(line)
    print("\n  " + str(passed) + " passed, " + str(failed) + " failed")
    if errors:
        print("\nCONSOLE/PAGE ERRORS captured:")
        for e in errors:
            print("  " + e)
    print("====================================================\n")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.on("console", lambda m: errors.append(f"[console.{m.type}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

    def dismiss_modals():
        page.evaluate("""() => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none')""")

    def ref_errors_since(before):
        return [e for e in errors[before:] if "is not defined" in e or "is not a function" in e]

    def click_topbar(text):
        before = len(errors)
        try:
            page.locator(".topbar button", has_text=text).first.click(timeout=3000)
            page.wait_for_timeout(250)
            re_ = ref_errors_since(before)
            record(f"topbar '{text}'", len(re_) == 0, "; ".join(re_))
        except Exception as e:
            record(f"topbar '{text}'", False, str(e)[:80])

    try:
        page.goto(URL, wait_until="networkidle", timeout=15000)
        record("App loads (HTTP 200)", True)
    except Exception as e:
        record("App loads", False, str(e)); browser.close(); print_results(); raise SystemExit(1)

    page.wait_for_selector(".toolchest-card", timeout=8000)
    record(f"Library renders {page.locator('.toolchest-card').count()} card(s)", True)

    # --- topbar inline buttons ---
    click_topbar("Trade Routes")
    dismiss_modals()
    click_topbar("Compare")
    dismiss_modals()
    click_topbar("Export Registry")
    dismiss_modals()
    click_topbar("Import Registry")
    dismiss_modals()

    # --- command palette via keyboard + result click ---
    try:
        before = len(errors)
        page.keyboard.press("Meta+KeyK")
        page.wait_for_timeout(250)
        pal = page.locator("#cmd-palette")
        if pal.count() == 1:
            pal.locator("#cmd-input").fill("register")
            page.wait_for_timeout(150)
            rows = pal.locator("#cmd-results > div")
            if rows.count() > 0:
                rows.first.click(timeout=2000)
                page.wait_for_timeout(400)
                re_ = ref_errors_since(before)
                record("palette result click (register)", len(re_) == 0, "; ".join(re_))
            else:
                record("palette result click", False, "no rows")
        else:
            record("⌘K opens palette", False, "palette not found")
        dismiss_modals()
    except Exception as e:
        record("⌘K palette flow", False, str(e)[:80])

    # --- select a toolchest -> anatomy ---
    try:
        before = len(errors)
        page.locator(".toolchest-card").first.click(timeout=3000)
        page.wait_for_timeout(250)
        anatomy = page.locator("#anatomy-panel .module-row").count()
        re_ = ref_errors_since(before)
        record(f"Select toolchest -> anatomy modules ({anatomy})", anatomy >= 1 and len(re_) == 0, "; ".join(re_))
    except Exception as e:
        record("Select toolchest", False, str(e)[:80])

    # --- anatomy "+ Blueprint" (inline) ---
    try:
        before = len(errors)
        page.locator("#anatomy-panel button", has_text="+ Blueprint").first.click(timeout=3000)
        page.wait_for_timeout(250)
        bp = page.locator("#composition-canvas .bp-item").count()
        re_ = ref_errors_since(before)
        record(f"Anatomy '+ Blueprint' -> composition ({bp})", bp >= 1 and len(re_) == 0, "; ".join(re_))
    except Exception as e:
        record("Anatomy '+ Blueprint'", False, str(e)[:80])

    # --- composition toolbar inline buttons ---
    for label in ["Mint", "Export JSON", "Export Real", "Context Pack", "Advisor"]:
        before = len(errors)
        try:
            page.locator("#composition-canvas button", has_text=label).first.click(timeout=3000)
            page.wait_for_timeout(300)
            re_ = ref_errors_since(before)
            record(f"composition '{label}'", len(re_) == 0, "; ".join(re_))
        except Exception as e:
            record(f"composition '{label}'", False, str(e)[:80])
        dismiss_modals()

    # --- live assay (real AI) via data-action button ---
    try:
        before = len(errors)
        page.locator(".toolchest-card button[data-action='assay']").first.click(timeout=3000)
        page.wait_for_selector("#global-agent-results .agent-result-card", timeout=30000)
        ok_card = page.locator("#global-agent-results .agent-result-card:not(.error)").count()
        re_ = ref_errors_since(before)
        record(f"Assay (live AI) -> result ({ok_card})", ok_card >= 1 and len(re_) == 0, "; ".join(re_))
    except Exception as e:
        record("Assay (live AI)", False, str(e)[:80])

    browser.close()

print_results()
import sys
fails = sum(1 for _, ok, _ in results if not ok)
sys.exit(0 if fails == 0 else 1)
