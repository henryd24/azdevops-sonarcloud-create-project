import * as tl from "azure-pipelines-task-lib";
import {
    ConfigError,
    normalizeTags,
    parseKeyValueLines,
    parsePermissionGrants,
    readConfig,
    sanitizeProjectKey,
    validateNewCodeDefinition
} from "../libs/config";

describe("config parsers", () => {
    test("parseKeyValueLines ignores comments and blank lines and splits on the first '='", () => {
        const result = parseKeyValueLines("# comment\n\nsonar.exclusions = **/test/**\r\nkey=a=b\n", "input");
        expect([...result]).toEqual([["sonar.exclusions", "**/test/**"], ["key", "a=b"]]);
    });

    test("parseKeyValueLines rejects lines without key", () => {
        expect(() => parseKeyValueLines("valid=1\n=nokey", "additionalSettings")).toThrow(/line 2/);
        expect(() => parseKeyValueLines("novalue", "additionalSettings")).toThrow(ConfigError);
    });

    test("normalizeTags lowercases, trims and removes duplicates", () => {
        expect(normalizeTags(" Dev, back ,dev,,NODE")).toEqual(["dev", "back", "node"]);
    });

    test("parsePermissionGrants validates permissions", () => {
        expect(parsePermissionGrants("developers=user,codeviewer\nleads=Admin", "groupPermissions")).toEqual([
            { principal: "developers", permissions: ["user", "codeviewer"] },
            { principal: "leads", permissions: ["admin"] }
        ]);
        expect(() => parsePermissionGrants("developers=owner", "groupPermissions")).toThrow(/Invalid permission/);
        expect(() => parsePermissionGrants("developers=", "groupPermissions")).toThrow(/No permissions/);
    });

    test.each([
        ["previous_version", undefined, "previous_version"],
        ["previous_version", "ignored", "previous_version"],
        ["days", "30", "30"],
        ["date", "2024-02-29", "2024-02-29"],
        ["version", "1.2.0", "1.2.0"]
    ])("validateNewCodeDefinition accepts %s=%s", (type, value, expected) => {
        expect(validateNewCodeDefinition(type, value)).toEqual({ type, value: expected });
    });

    test.each([
        ["days", "abc"],
        ["days", "0"],
        ["days", undefined],
        ["date", "2023-02-30"],
        ["date", "01/02/2024"],
        ["version", undefined],
        ["unknown", "x"]
    ])("validateNewCodeDefinition rejects %s=%s", (type, value) => {
        expect(() => validateNewCodeDefinition(type, value)).toThrow(ConfigError);
    });

    test("sanitizeProjectKey replaces invalid characters", () => {
        expect(sanitizeProjectKey("my-org_My Repo (v2)")).toBe("my-org_My-Repo-v2");
    });
});

describe("readConfig", () => {
    let inputs: Record<string, string>;
    let variables: Record<string, string>;

    beforeEach(() => {
        jest.restoreAllMocks();
        inputs = { SonarCloud: "endpoint", sonarOrganization: "my-org", serviceKey: "my-project", createProject: "true", visibility: "private" };
        variables = {};
        jest.spyOn(tl, "getInput").mockImplementation((name: string) => inputs[name]);
        jest.spyOn(tl, "getBoolInput").mockImplementation((name: string) => inputs[name] === "true");
        jest.spyOn(tl, "getVariable").mockImplementation((name: string) => variables[name]);
        jest.spyOn(tl, "getEndpointAuthorizationParameter").mockReturnValue("token");
        jest.spyOn(tl, "getEndpointUrl").mockReturnValue("https://sonarcloud.io");
    });

    test("reads the basic inputs with defaults", () => {
        const config = readConfig();
        expect(config).toMatchObject({
            organization: "my-org",
            projectKey: "my-project",
            projectName: "my-project",
            createProject: true,
            visibility: "private",
            enforceVisibility: false,
            dryRun: false,
            failOnConfigError: false,
            tags: [],
            newCodeDefinition: undefined
        });
    });

    test("derives the project key from the repository name when not provided", () => {
        inputs.serviceKey = "";
        variables["Build.Repository.Name"] = "owner/My Repo";
        expect(readConfig().projectKey).toBe("my-org_My-Repo");
    });

    test("fails when the project key cannot be derived", () => {
        inputs.serviceKey = "";
        expect(() => readConfig()).toThrow(/Build.Repository.Name/);
    });

    test("rejects invalid project keys", () => {
        inputs.serviceKey = "12345";
        expect(() => readConfig()).toThrow(/Invalid project key/);
    });

    test("validates the new code definition only when enabled", () => {
        inputs.newCodeDefinitionType = "days";
        inputs.newCodeDefinitionValue = "abc";
        expect(readConfig().newCodeDefinition).toBeUndefined();
        inputs.enableNewCodeDefinition = "true";
        expect(() => readConfig()).toThrow(/positive integer/);
    });
});
