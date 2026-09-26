import * as tl from "azure-pipelines-task-lib";

export type Visibility = "private" | "public";
export type NewCodeType = "previous_version" | "days" | "date" | "version";

export const PROJECT_PERMISSIONS = ["admin", "codeviewer", "issueadmin", "securityhotspotadmin", "scan", "user"] as const;
export type ProjectPermission = typeof PROJECT_PERMISSIONS[number];

export interface NewCodeDefinition {
    type: NewCodeType;
    value: string;
}

export interface PermissionGrant {
    principal: string;
    permissions: ProjectPermission[];
}

export interface TaskConfig {
    endpointId: string;
    baseUrl?: string;
    token: string;
    organization: string;
    projectKey: string;
    projectName: string;
    createProject: boolean;
    visibility: Visibility;
    enforceVisibility: boolean;
    mainBranch?: string;
    tags: string[];
    longLivedBranches?: string;
    qualityGate?: string;
    newCodeDefinition?: NewCodeDefinition;
    additionalSettings: Map<string, string>;
    qualityProfiles: Map<string, string>;
    permissionTemplate?: string;
    groupPermissions: PermissionGrant[];
    userPermissions: PermissionGrant[];
    dryRun: boolean;
    failOnConfigError: boolean;
}

export class ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

function optional(name: string): string | undefined {
    const value = tl.getInput(name, false)?.trim();
    return value ? value : undefined;
}

/**
 * Parses multi-line "key=value" inputs. Empty lines and lines starting with # are ignored.
 * Only the first "=" splits key and value, so values may contain "=".
 */
export function parseKeyValueLines(input: string | undefined, inputName: string): Map<string, string> {
    const result = new Map<string, string>();
    if (!input) return result;
    input.split(/\r?\n/).forEach((raw, index) => {
        const line = raw.trim();
        if (!line || line.startsWith("#")) return;
        const separator = line.indexOf("=");
        if (separator <= 0) {
            throw new ConfigError(`Invalid entry in '${inputName}' at line ${index + 1}: '${line}'. Expected format key=value.`);
        }
        result.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    });
    return result;
}

export function parseList(input: string | undefined): string[] {
    if (!input) return [];
    return input.split(/[,\n]/).map(t => t.trim()).filter(Boolean);
}

export function normalizeTags(input: string | undefined): string[] {
    return [...new Set(parseList(input).map(t => t.toLowerCase()))];
}

export function parsePermissionGrants(input: string | undefined, inputName: string): PermissionGrant[] {
    const grants: PermissionGrant[] = [];
    parseKeyValueLines(input, inputName).forEach((value, principal) => {
        const permissions = parseList(value).map(p => p.toLowerCase());
        if (permissions.length === 0) {
            throw new ConfigError(`No permissions defined for '${principal}' in '${inputName}'.`);
        }
        const invalid = permissions.filter(p => !(PROJECT_PERMISSIONS as readonly string[]).includes(p));
        if (invalid.length > 0) {
            throw new ConfigError(`Invalid permission(s) '${invalid.join(", ")}' for '${principal}' in '${inputName}'. Allowed: ${PROJECT_PERMISSIONS.join(", ")}.`);
        }
        grants.push({ principal, permissions: permissions as ProjectPermission[] });
    });
    return grants;
}

export function validateNewCodeDefinition(type: string | undefined, value: string | undefined): NewCodeDefinition {
    switch (type ?? "previous_version") {
        case "previous_version":
            return { type: "previous_version", value: "previous_version" };
        case "days": {
            if (!value || !/^\d+$/.test(value) || Number(value) < 1) {
                throw new ConfigError(`New code definition type 'days' requires a positive integer value, received '${value ?? ""}'.`);
            }
            return { type: "days", value };
        }
        case "date": {
            const valid = !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(`${value}T00:00:00Z`))
                && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
            if (!valid) {
                throw new ConfigError(`New code definition type 'date' requires a value with format YYYY-MM-DD, received '${value ?? ""}'.`);
            }
            return { type: "date", value: value! };
        }
        case "version":
            if (!value) {
                throw new ConfigError("New code definition type 'version' requires a version value, e.g. 1.0.0.");
            }
            return { type: "version", value };
        default:
            throw new ConfigError(`Unsupported new code definition type '${type}'.`);
    }
}

/**
 * Project keys may contain letters, digits, '-', '_', '.' and ':' and must contain at least one non-digit.
 */
export function sanitizeProjectKey(raw: string): string {
    return raw.trim().replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "");
}

function resolveProjectKey(organization: string): string {
    const explicit = optional("serviceKey");
    if (explicit) return explicit;
    const repositoryName = tl.getVariable("Build.Repository.Name");
    if (!repositoryName) {
        throw new ConfigError("Input 'serviceKey' is empty and the variable Build.Repository.Name is not available to derive it.");
    }
    // Repository names may include the owner (e.g. owner/repo on GitHub); keep only the repository part.
    const key = sanitizeProjectKey(`${organization}_${repositoryName.split("/").pop()}`);
    return key;
}

export function readConfig(): TaskConfig {
    const endpointId = tl.getInput("SonarCloud", true)!;
    const token = tl.getEndpointAuthorizationParameter(endpointId, "apitoken", false);
    if (!token) {
        throw new ConfigError("The SonarCloud service connection does not provide an API token.");
    }
    const organization = tl.getInput("sonarOrganization", true)!.trim();
    const projectKey = resolveProjectKey(organization);
    if (!/^[A-Za-z0-9_.:-]+$/.test(projectKey) || /^\d+$/.test(projectKey)) {
        throw new ConfigError(`Invalid project key '${projectKey}'. Allowed characters: letters, digits, '-', '_', '.', ':' with at least one non-digit.`);
    }

    const visibility = (optional("visibility") ?? "private") as Visibility;
    if (visibility !== "private" && visibility !== "public") {
        throw new ConfigError(`Invalid visibility '${visibility}'. Allowed: private, public.`);
    }

    const newCodeDefinition = tl.getBoolInput("enableNewCodeDefinition", false)
        ? validateNewCodeDefinition(optional("newCodeDefinitionType"), optional("newCodeDefinitionValue"))
        : undefined;

    return {
        endpointId,
        baseUrl: tl.getEndpointUrl(endpointId, true),
        token,
        organization,
        projectKey,
        projectName: optional("serviceName") ?? projectKey,
        createProject: (optional("createProject") ?? "true") === "true",
        visibility,
        enforceVisibility: tl.getBoolInput("enforceVisibility", false),
        mainBranch: optional("mainBranch"),
        tags: normalizeTags(optional("tags")),
        longLivedBranches: optional("long_live_branches"),
        qualityGate: optional("sonarQualityGate"),
        newCodeDefinition,
        additionalSettings: parseKeyValueLines(optional("additionalSettings"), "additionalSettings"),
        qualityProfiles: parseKeyValueLines(optional("qualityProfiles"), "qualityProfiles"),
        permissionTemplate: optional("permissionTemplate"),
        groupPermissions: parsePermissionGrants(optional("groupPermissions"), "groupPermissions"),
        userPermissions: parsePermissionGrants(optional("userPermissions"), "userPermissions"),
        dryRun: tl.getBoolInput("dryRun", false),
        failOnConfigError: tl.getBoolInput("failOnConfigError", false)
    };
}
