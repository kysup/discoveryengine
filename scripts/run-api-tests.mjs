// On-demand local API test run: same Postman test collection, executed with Newman
// against your locally-running APIs. Start the servers first:
//   npm --prefix injector run dev:api   (and)   npm --prefix app run dev:api
// then:  npm run test:api
import { readFileSync } from "node:fs"
import newman from "newman"

const INJECTOR = "http://localhost:8081"
const USERAPP = "http://localhost:8080"

// Pull TEST_API_TOKEN from injector/.env (kept out of git).
let token = ""
try {
  const env = readFileSync(new URL("../injector/.env", import.meta.url), "utf8")
  token = (env.match(/^TEST_API_TOKEN="?([^"\r\n]+)"?/m) || [])[1] || ""
} catch {
  /* ignore */
}
if (!token) {
  console.error("✗ TEST_API_TOKEN not found in injector/.env")
  process.exit(1)
}

// Friendly check that the local servers are actually up.
const up = async (url) => {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}
const okInjector = await up(`${INJECTOR}/api/industries`)
const okApp = await up(`${USERAPP}/api/health`)
if (!okInjector || !okApp) {
  console.error(`✗ Local APIs not reachable (injector: ${okInjector}, app: ${okApp}).`)
  console.error("  Start them first:")
  console.error("    npm --prefix injector run dev:api")
  console.error("    npm --prefix app run dev:api")
  process.exit(1)
}

newman.run(
  {
    collection: "postman/discovery-engine-tests.postman_collection.json",
    envVar: [
      { key: "injectorUrl", value: INJECTOR },
      { key: "userAppUrl", value: USERAPP },
      { key: "testToken", value: token },
      { key: "industryId", value: "1" },
      { key: "pillarId", value: "1" },
    ],
    reporters: ["cli"],
  },
  (err, summary) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(summary.run.failures.length > 0 ? 1 : 0)
  },
)
