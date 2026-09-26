import * as tl from "azure-pipelines-task-lib";
import fetchMock from "jest-fetch-mock";
import { run } from "../libs/task";
import { mockSonar, posts } from "./helpers";

describe("task", () => {
    let inputs: Record<string, string>;
    let outputs: Record<string, string>;
    let setResult: jest.SpyInstance;

    beforeEach(() => {
        jest.restoreAllMocks();
        fetchMock.resetMocks();
        inputs = { SonarCloud: "endpoint", sonarOrganization: "my-org", serviceKey: "my-project", serviceName: "My Project", createProject: "true", visibility: "private" };
        outputs = {};
        jest.spyOn(tl, "getInput").mockImplementation((name: string) => inputs[name]);
        jest.spyOn(tl, "getBoolInput").mockImplementation((name: string) => inputs[name] === "true");
        jest.spyOn(tl, "getEndpointAuthorizationParameter").mockReturnValue("token");
        jest.spyOn(tl, "getEndpointUrl").mockReturnValue("https://sonarcloud.io");
        jest.spyOn(tl, "setVariable").mockImplementation((name: string, value: string) => { outputs[name] = value; });
        setResult = jest.spyOn(tl, "setResult").mockImplementation();
        jest.spyOn(console, "info").mockImplementation();
        jest.spyOn(console, "warn").mockImplementation();
    });

    const existing = (visibility = "public") => ({
        "GET /api/projects/search": { body: { components: [{ key: "my-project", name: "My Project", visibility }] } }
    });
    const missing = { "GET /api/projects/search": { body: { components: [] } } };

    test("only checks existence and fails when the project is missing", async () => {
        inputs.createProject = "false";
        const calls = mockSonar(missing);
        await run();
        expect(posts(calls)).toHaveLength(0);
        expect(setResult).toHaveBeenCalledWith(tl.TaskResult.Failed, "The my-project project does NOT exist.");
        expect(outputs.SonarProjectExists).toBe("false");
    });

    test("creates the project, applies the configuration and sets output variables", async () => {
        Object.assign(inputs, { tags: "Dev,node", mainBranch: "main", permissionTemplate: "Default", groupPermissions: "devs=user" });
        const calls = mockSonar({
            ...missing,
            "POST /api/projects/create": { body: { project: { key: "my-project", name: "My Project" } } },
            "GET /api/project_branches/list": { body: { branches: [{ name: "master", isMain: true }] } },
            "GET /api/components/show": { body: { component: { tags: [] } } },
            "GET /api/permissions/groups": { body: { groups: [] } }
        });
        await run();
        const create = posts(calls, "/api/projects/create")[0];
        expect(create.params.get("name")).toBe("My Project");
        expect(create.params.get("visibility")).toBe("private");
        expect(posts(calls, "/api/project_tags/set")[0].params.get("tags")).toBe("dev,node");
        expect(posts(calls, "/api/project_branches/rename")).toHaveLength(1);
        const permissionPaths = posts(calls).map(c => c.path).filter(p => p.startsWith("/api/permissions/"));
        expect(permissionPaths).toEqual(["/api/permissions/apply_template", "/api/permissions/add_group"]);
        expect(posts(calls, "/api/projects/update_visibility")).toHaveLength(0);
        expect(setResult).not.toHaveBeenCalled();
        expect(outputs).toMatchObject({
            SonarProjectKey: "my-project",
            SonarProjectCreated: "true",
            SonarProjectExists: "false",
            SonarProjectUrl: "https://sonarcloud.io/project/overview?id=my-project"
        });
    });

    test("does not apply the permission template or visibility to existing projects by default", async () => {
        inputs.permissionTemplate = "Default";
        const calls = mockSonar(existing());
        await run();
        expect(posts(calls)).toHaveLength(0);
        expect(outputs.SonarProjectCreated).toBe("false");
    });

    test("enforces visibility on existing projects when requested", async () => {
        inputs.enforceVisibility = "true";
        const calls = mockSonar(existing("public"));
        await run();
        expect(posts(calls, "/api/projects/update_visibility")[0].params.get("visibility")).toBe("private");
    });

    test("dry run does not create or modify anything", async () => {
        Object.assign(inputs, { dryRun: "true", tags: "dev" });
        let calls = mockSonar(missing);
        await run();
        expect(posts(calls)).toHaveLength(0);

        fetchMock.resetMocks();
        calls = mockSonar(existing());
        await run();
        expect(posts(calls)).toHaveLength(0);
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining("[dry-run] Tags set to: dev"));
    });

    test("reports failed steps as SucceededWithIssues by default", async () => {
        inputs.tags = "dev";
        mockSonar({ ...existing(), "POST /api/project_tags/set": { status: 400, body: { errors: [{ msg: "Invalid tag" }] } } });
        await run();
        expect(setResult).toHaveBeenCalledWith(tl.TaskResult.SucceededWithIssues, expect.stringContaining("Invalid tag"));
    });

    test("fails the task on configuration errors when failOnConfigError is enabled", async () => {
        Object.assign(inputs, { tags: "dev", failOnConfigError: "true" });
        mockSonar({ ...existing(), "POST /api/project_tags/set": { status: 400, body: { errors: [{ msg: "Invalid tag" }] } } });
        await run();
        expect(setResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.stringContaining("Tags: "));
    });

    test("fails fast with a clear message on authentication errors", async () => {
        const calls = mockSonar({ "GET /api/projects/search": { status: 401, body: { errors: [{ msg: "Unauthorized" }] } } });
        await run();
        expect(posts(calls)).toHaveLength(0);
        expect(setResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.stringContaining("Check the token"));
    });

    test("fails on invalid input before calling the API", async () => {
        Object.assign(inputs, { enableNewCodeDefinition: "true", newCodeDefinitionType: "date", newCodeDefinitionValue: "yesterday" });
        await run();
        expect(fetchMock.mock.calls).toHaveLength(0);
        expect(setResult).toHaveBeenCalledWith(tl.TaskResult.Failed, expect.stringContaining("YYYY-MM-DD"));
    });
});
