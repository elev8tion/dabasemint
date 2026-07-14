# dabasemint Glossary

Single source of truth for dabasemint terminology. The in-app glossary
tooltips (`src/main.js` → `TERMS`) are generated from these definitions;
keep them in sync.

| Term | Definition |
|------|------------|
| **Toolchest** | A folder of extracted reusable modules — typically the output of a `/forge` run. Register one with **+ Register** or load the demo library. |
| **Anatomy** | The module-level breakdown of a single toolchest: each module's role, LOC, contracts, README, and reusability. |
| **Blueprint** | Your selected set of modules, composed together to form a new project. Lives in the Blueprint tab. |
| **Mint** | Save this blueprint as a reusable library item (a new "minted" toolchest appears in your Library). |
| **Assay** | Analyze a toolchest for quality and reuse potential, then tag it. Powered by the agent layer. |
| **Trade Routes** | Find useful connections and powerful combinations between toolchests. Lives under **Advanced**. |
| **Contracts** | Interface definitions (schemas, type signatures) that describe how a module expects to be used. |
| **Context Pack** | A JSON export of your blueprint, optimized for feeding to other AI agents. |

## Main workflow (the short version)

1. **Register** a `/forge` output folder (or **Load demo library**).
2. **Inspect** modules on the Anatomy tab.
3. **Add** modules to your Blueprint (`+ Blueprint` or drag).
4. **Export** a real project (preview the tree first, then generate).

Prefer a guided version? Click **✨ Create a project from toolchests** in the
top bar to run the 5-step wizard.
