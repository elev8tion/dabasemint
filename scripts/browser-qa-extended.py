from playwright.sync_api import sync_playwright
results=[]; errors=[]
def rec(n,ok,d=""): results.append((n,ok,d))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto("http://localhost:4174", wait_until="networkidle", timeout=15000)
    pg.wait_for_selector(".toolchest-card", timeout=8000)
    base=len(errors)
    # card actions via data-action (event delegation)
    pg.locator(".toolchest-card button[data-action='snapshot']").first.click(timeout=3000); pg.wait_for_timeout(200)
    rec("card Snapshot (+1 toolchest)", pg.locator(".toolchest-card").count()==4, f"count={pg.locator('.toolchest-card').count()}")
    pg.locator(".toolchest-card button[data-action='add-all']").first.click(timeout=3000); pg.wait_for_timeout(200)
    rec("card +All to Blueprint", pg.locator("#composition-canvas .bp-item").count()>=1)
    # search filter
    pg.locator("#search-input").fill("captions"); pg.wait_for_timeout(250)
    rec("search filter narrows cards", pg.locator(".toolchest-card").count()==1, f"count={pg.locator('.toolchest-card').count()}")
    pg.locator("#search-input").fill(""); pg.wait_for_timeout(200)
    # source filter
    pg.locator("#filter-type").select_option("native-binary"); pg.wait_for_timeout(200)
    rec("source filter (native-binary -> Glaze)", pg.locator(".toolchest-card").count()>=1)
    pg.locator("#filter-type").select_option("all"); pg.wait_for_timeout(200)
    # provider dropdown switch (GLM is configured via pi auth)
    sel=pg.locator("#agent-sel")
    glm_present = "G0DM0D3" in sel.inner_text()
    rec("GLM option present in dropdown", glm_present)
    # health dashboard present
    rec("Health Dashboard rendered", pg.locator("#health-dashboard").count()==1)
    # command palette via keyboard close
    pg.keyboard.press("Meta+KeyK"); pg.wait_for_timeout(200)
    rec("Cmd+K opens palette", pg.locator("#cmd-palette").count()==1)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    re_=[e for e in errors[base:] if "is not defined" in e or "is not a function" in e]
    b.close()
    print("\n===== EXTENDED BROWSER QA =====")
    pas=sum(1 for _,o,_ in results if o); fai=sum(1 for _,o,_ in results if not o)
    for n,o,d in results: print(("  OK  " if o else "  FAIL")+" "+n+((" -> "+d) if d and not o else ""))
    print(f"\n  {pas} passed, {fai} failed; ref-errors: {len(re_)}")
    import sys; sys.exit(0 if fai==0 else 1)
