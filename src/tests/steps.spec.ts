import fetchMock from "jest-fetch-mock";
import { ensureTags } from "../libs/tags";
import { ensureQualityGate } from "../libs/quality_gate";
import { ensureQualityProfiles } from "../libs/quality_profiles";
import { applyPermissionTemplate, ensurePermissions } from "../libs/permissions";
import { ensureVisibility } from "../libs/projects";
import {
    LONG_LIVED_BRANCHES_KEY,
    NEW_CODE_TYPE_KEY,
    NEW_CODE_VALUE_KEY,
    buildDesiredSettings,
    ensureMainBranch,
    ensureSettings
} from "../libs/settings";
import { runStep } from "../libs/step";
import { RecordedCall, mockSonar, newClient, newContext, posts } from "./helpers";

beforeEach(() => fetchMock.resetMocks());

describe("tags", () => {
    test("sets tags when they differ", async () => {
        const calls = mockSonar({ "GET /api/components/show": { body: { component: { tags: ["old"] } } } });
        const ctx = newContext();
        await ensureTags(ctx, ["dev", "node"]);
        const [post] = posts(calls, "/api/project_tags/set");
        expect(post.params.get("tags")).toBe("dev,node");
        expect(post.params.get("project")).toBe("my-project");
        expect(ctx.changes).toEqual(["Tags set to: dev, node"]);
    });

    test("skips when tags are already set in any order", async () => {
        const calls = mockSonar({ "GET /api/components/show": { body: { component: { tags: ["node", "dev"] } } } });
        await ensureTags(newContext(), ["dev", "node"]);
        expect(posts(calls)).toHaveLength(0);
    });

    test("sets tags when the current ones cannot be read", async () => {
        const calls = mockSonar({});
        await ensureTags(newContext(), ["dev"]);
        expect(posts(calls, "/api/project_tags/set")).toHaveLength(1);
    });
});

describe("quality gate (Web API v2)", () => {
    const v2Routes = (association?: { qualityGateId: string; defaultFallback?: boolean }) => ({
        "GET /organizations/organizations": { body: [{ id: "legacy-org", uuidV4: "org-uuid" }] },
        "GET /quality-gates/quality-gates": (call: RecordedCall) => ({
            body: call.params.get("pageIndex") === "1"
                ? { qualityGates: [{ id: "gate-a", legacyId: 9, name: "Sonar way" }], page: { pageIndex: 1, total: 2 } }
                : { qualityGates: [{ id: "gate-b", legacyId: 20, name: "Strict" }], page: { pageIndex: 2, total: 2 } }
        }),
        "GET /projects/projects": { body: { projects: [{ key: "my-project", legacyId: "project-legacy" }] } },
        "GET /quality-gates/project-associations": { body: { projectAssociations: association ? [association] : [] } },
        "POST /quality-gates/project-associations": { status: 201, body: {} }
    });

    test("associates the gate resolved by legacy id across pages", async () => {
        const calls = mockSonar(v2Routes({ qualityGateId: "gate-a" }));
        const ctx = newContext();
        await ensureQualityGate(ctx, "20");
        const [post] = posts(calls, "/quality-gates/project-associations");
        expect(post.host).toBe("api.sonarcloud.io");
        expect(JSON.parse(post.body)).toEqual({ qualityGateId: "gate-b", projectId: "project-legacy" });
        expect(calls.find(c => c.path === "/quality-gates/quality-gates")!.params.get("organizationId")).toBe("org-uuid");
        expect(ctx.changes).toEqual(["Quality gate set to 'Strict' (20)"]);
        expect(calls.some(c => c.path.startsWith("/api/qualitygates"))).toBe(false);
    });

    test("skips when the gate is explicitly associated", async () => {
        const calls = mockSonar(v2Routes({ qualityGateId: "gate-b", defaultFallback: false }));
        await ensureQualityGate(newContext(), "strict");
        expect(posts(calls)).toHaveLength(0);
    });

    test("associates explicitly when the project only falls back to the default gate", async () => {
        const calls = mockSonar(v2Routes({ qualityGateId: "gate-a", defaultFallback: true }));
        await ensureQualityGate(newContext(), "Sonar way");
        expect(posts(calls, "/quality-gates/project-associations")).toHaveLength(1);
    });

    test("does not fall back to v1 when the gate does not exist", async () => {
        const calls = mockSonar(v2Routes());
        await expect(ensureQualityGate(newContext(), "missing")).rejects.toThrow(/not found.*Sonar way \(9\), Strict \(20\)/);
        expect(calls.some(c => c.path.startsWith("/api/qualitygates"))).toBe(false);
    });
});

describe("quality gate (Web API v1 fallback)", () => {
    const gates = { body: { qualitygates: [{ id: 10, name: "Sonar way" }, { id: 20, name: "Strict" }] } };

    test("resolves a gate by name and selects it", async () => {
        const calls = mockSonar({
            "GET /api/qualitygates/list": gates,
            "GET /api/qualitygates/get_by_project": { body: { qualityGate: { id: 10, name: "Sonar way" } } }
        });
        await ensureQualityGate(newContext(), "strict");
        const [post] = posts(calls, "/api/qualitygates/select");
        expect(post.params.get("gateId")).toBe("20");
        expect(post.params.get("projectKey")).toBe("my-project");
    });

    test("skips when the gate is already assigned", async () => {
        const calls = mockSonar({
            "GET /api/qualitygates/list": gates,
            "GET /api/qualitygates/get_by_project": { body: { qualityGate: { id: 20, name: "Strict" } } }
        });
        await ensureQualityGate(newContext(), "20");
        expect(posts(calls)).toHaveLength(0);
    });

    test("fails when the gate does not exist", async () => {
        mockSonar({ "GET /api/qualitygates/list": gates });
        await expect(ensureQualityGate(newContext(), "missing")).rejects.toThrow(/not found.*Sonar way \(10\)/);
    });
});

describe("settings", () => {
    test("buildDesiredSettings lets explicit inputs override additional settings", () => {
        const desired = buildDesiredSettings(
            new Map([[NEW_CODE_VALUE_KEY, "x"], ["sonar.exclusions", "**/a"], [LONG_LIVED_BRANCHES_KEY, "old"]]),
            "(main|qa)",
            { type: "days", value: "30" }
        );
        expect([...desired]).toEqual([
            ["sonar.exclusions", "**/a"],
            [LONG_LIVED_BRANCHES_KEY, "(main|qa)"],
            [NEW_CODE_TYPE_KEY, "days"],
            [NEW_CODE_VALUE_KEY, "30"]
        ]);
    });

    test("applies only changed or inherited settings, in order, handling multi-values", async () => {
        const calls = mockSonar({
            "GET /api/settings/list_definitions": { body: { definitions: [{ key: "sonar.exclusions", multiValues: true }] } },
            "GET /api/settings/values": {
                body: {
                    settings: [
                        { key: "sonar.exclusions", values: ["**/a"] },
                        { key: LONG_LIVED_BRANCHES_KEY, value: "(main|qa)" },
                        { key: NEW_CODE_TYPE_KEY, value: "previous_version", inherited: true }
                    ]
                }
            }
        });
        const ctx = newContext();
        await ensureSettings(ctx, new Map([
            ["sonar.exclusions", "**/a, **/b"],
            [LONG_LIVED_BRANCHES_KEY, "(main|qa)"],
            [NEW_CODE_TYPE_KEY, "previous_version"],
            [NEW_CODE_VALUE_KEY, "previous_version"]
        ]));
        const sets = posts(calls, "/api/settings/set");
        expect(sets.map(s => s.params.get("key"))).toEqual(["sonar.exclusions", NEW_CODE_TYPE_KEY, NEW_CODE_VALUE_KEY]);
        expect(sets[0].params.getAll("values")).toEqual(["**/a", "**/b"]);
        expect(sets[0].params.has("value")).toBe(false);
        expect(sets[1].params.get("value")).toBe("previous_version");
        expect(ctx.changes).toHaveLength(3);
    });

    test("keeps special characters of regex values intact", async () => {
        const calls = mockSonar({});
        await ensureSettings(newContext(), new Map([[LONG_LIVED_BRANCHES_KEY, "(release|hotfix)/.+&#"]]));
        expect(posts(calls, "/api/settings/set")[0].params.get("value")).toBe("(release|hotfix)/.+&#");
    });

    test("does nothing without settings", async () => {
        mockSonar({});
        await ensureSettings(newContext(), new Map());
        expect(fetchMock.mock.calls).toHaveLength(0);
    });
});

describe("main branch", () => {
    test("renames only when the main branch differs", async () => {
        let calls = mockSonar({ "GET /api/project_branches/list": { body: { branches: [{ name: "master", isMain: true }, { name: "dev", isMain: false }] } } });
        await ensureMainBranch(newContext(), "main");
        expect(posts(calls, "/api/project_branches/rename")[0].params.get("name")).toBe("main");

        fetchMock.resetMocks();
        calls = mockSonar({ "GET /api/project_branches/list": { body: { branches: [{ name: "main", isMain: true }] } } });
        await ensureMainBranch(newContext(), "main");
        expect(posts(calls)).toHaveLength(0);
    });
});

describe("quality profiles", () => {
    test("assigns profiles that differ from the current ones", async () => {
        const calls = mockSonar({
            "GET /api/qualityprofiles/search": { body: { profiles: [{ key: "1", name: "Sonar way", language: "js" }, { key: "2", name: "Company", language: "ts" }] } }
        });
        await ensureQualityProfiles(newContext(), new Map([["js", "Company"], ["ts", "Company"]]));
        const adds = posts(calls, "/api/qualityprofiles/add_project");
        expect(adds).toHaveLength(1);
        expect(adds[0].params.get("language")).toBe("js");
        expect(adds[0].params.get("qualityProfile")).toBe("Company");
    });
});

describe("permissions", () => {
    test("grants only missing group permissions", async () => {
        const calls = mockSonar({
            "GET /api/permissions/groups": { body: { groups: [{ name: "developers", permissions: ["user"] }] } }
        });
        await ensurePermissions(newContext(), "group", [{ principal: "developers", permissions: ["user", "codeviewer"] }]);
        const adds = posts(calls, "/api/permissions/add_group");
        expect(adds).toHaveLength(1);
        expect(adds[0].params.get("groupName")).toBe("developers");
        expect(adds[0].params.get("permission")).toBe("codeviewer");
    });

    test("grants user permissions and omits the search term for short logins", async () => {
        const calls = mockSonar({ "GET /api/permissions/users": { body: { users: [] } } });
        await ensurePermissions(newContext(), "user", [{ principal: "jd", permissions: ["admin"] }]);
        expect(calls[0].params.has("q")).toBe(false);
        expect(posts(calls, "/api/permissions/add_user")[0].params.get("login")).toBe("jd");
    });

    test("omits browse permissions on public projects", async () => {
        const calls = mockSonar({ "GET /api/permissions/groups": { body: { groups: [] } } });
        const ctx = newContext();
        await ensurePermissions(ctx, "group", [
            { principal: "developers", permissions: ["user", "codeviewer", "issueadmin"] },
            { principal: "viewers", permissions: ["user"] }
        ], "public");
        expect(posts(calls).map(c => c.params.get("permission"))).toEqual(["issueadmin"]);
        expect(ctx.notes).toHaveLength(2);
        expect(calls.filter(c => c.params.get("q") === "viewers")).toHaveLength(0);
    });

    test("applies a permission template by name", async () => {
        const calls = mockSonar({});
        await applyPermissionTemplate(newContext(), "Default template");
        expect(posts(calls, "/api/permissions/apply_template")[0].params.get("templateName")).toBe("Default template");
    });
});

describe("visibility", () => {
    test("updates only when it differs", async () => {
        const calls = mockSonar({});
        await ensureVisibility(newContext(), "public", "public");
        expect(posts(calls)).toHaveLength(0);
        await ensureVisibility(newContext(), "public", "private");
        expect(posts(calls, "/api/projects/update_visibility")[0].params.get("visibility")).toBe("private");
    });
});

describe("dry run and step runner", () => {
    test("dry run records planned changes without POSTing", async () => {
        const calls = mockSonar({ "GET /api/project_branches/list": { body: { branches: [{ name: "master", isMain: true }] } } });
        const ctx = newContext(true);
        await ensureMainBranch(ctx, "main");
        expect(posts(calls)).toHaveLength(0);
        expect(ctx.changes).toEqual(["[dry-run] Main branch renamed from master to main"]);
    });

    test("runStep captures errors and keeps the changes made before them", async () => {
        const outcome = await runStep("Failing", async ctx => {
            await ctx.apply("first", async () => undefined);
            throw new Error("boom");
        }, newClient(), "org", "key", false);
        expect(outcome).toEqual({ name: "Failing", changes: ["first"], notes: [], error: "boom" });
    });
});
