// Independent checks and cleanup against the SonarCloud API (does not use the task code).
// Requires SONAR_TOKEN and SONAR_ORGANIZATION (optionally SONAR_URL).
//
//   node scripts/e2e/sonar.js check <projectKey> [--absent] [--visibility public] [--tags a,b]
//                                     [--setting key=value] [--main-branch name]
//   node scripts/e2e/sonar.js delete <projectKey>
const baseUrl = (process.env.SONAR_URL || "https://sonarcloud.io").replace(/\/+$/, "");
const organization = process.env.SONAR_ORGANIZATION;
const token = process.env.SONAR_TOKEN;
if (!token || !organization) {
  console.error("SONAR_TOKEN and SONAR_ORGANIZATION must be set.");
  process.exit(2);
}
const authorization = "Basic " + Buffer.from(`${token}:`).toString("base64");

async function api(method, path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${baseUrl}${path}${method === "GET" && query ? `?${query}` : ""}`, {
    method,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body: method === "POST" ? query : undefined,
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : {};
}

const [command, projectKey, ...rest] = process.argv.slice(2);
const option = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const errors = [];
const expect = (ok, message) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${message}`);
  if (!ok) errors.push(message);
};

async function check() {
  const found = (await api("GET", "/api/projects/search", { organization, projects: projectKey })).components?.[0];
  if (rest.includes("--absent")) return expect(!found, `project ${projectKey} does not exist`);
  expect(!!found, `project ${projectKey} exists`);
  if (!found) return;

  const visibility = option("--visibility");
  if (visibility) expect(found.visibility === visibility, `visibility is ${visibility} (found ${found.visibility})`);

  const tags = option("--tags");
  if (tags) {
    const actual = (await api("GET", "/api/components/show", { component: projectKey })).component?.tags ?? [];
    for (const tag of tags.split(",")) {
      expect(actual.includes(tag.trim()), `tag '${tag.trim()}' is set (found: ${actual.join(", ") || "none"})`);
    }
  }

  const setting = option("--setting");
  if (setting) {
    const [key, ...value] = setting.split("=");
    const values = (await api("GET", "/api/settings/values", { component: projectKey, keys: key })).settings ?? [];
    const actual = values.find((s) => s.key === key);
    const actualValue = actual?.value ?? (actual?.values ?? []).join(",");
    expect(actualValue === value.join("="), `setting ${key} = ${value.join("=")} (found ${actualValue ?? "unset"})`);
  }

  const mainBranch = option("--main-branch");
  if (mainBranch) {
    const branches = (await api("GET", "/api/project_branches/list", { project: projectKey })).branches ?? [];
    const main = branches.find((b) => b.isMain);
    expect(main?.name === mainBranch, `main branch is ${mainBranch} (found ${main?.name})`);
  }
}

async function remove() {
  try {
    await api("POST", "/api/projects/delete", { project: projectKey });
    console.log(`Deleted project ${projectKey}`);
  } catch (err) {
    if (err.status === 404) return console.log(`Project ${projectKey} does not exist; nothing to delete`);
    throw err;
  }
}

(async () => {
  if (!projectKey) throw new Error("Missing project key");
  if (command === "check") await check();
  else if (command === "delete") await remove();
  else throw new Error(`Unknown command '${command}'`);
  if (errors.length) process.exit(1);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
