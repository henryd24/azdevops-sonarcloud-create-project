import { NewCodeDefinition } from "./config";
import { StepContext } from "./step";

export const LONG_LIVED_BRANCHES_KEY = "sonar.branch.longLivedBranches.regex";
export const NEW_CODE_TYPE_KEY = "sonar.leak.period.type";
export const NEW_CODE_VALUE_KEY = "sonar.leak.period";

interface SettingValue {
    key: string;
    value?: string;
    values?: string[];
    inherited?: boolean;
}

interface SettingDefinition {
    key: string;
    multiValues?: boolean;
}

/**
 * Builds the ordered map of settings to apply. Explicit task inputs take precedence over
 * `additionalSettings`, and the new code type is always applied before its value.
 */
export function buildDesiredSettings(
    additional: Map<string, string>,
    longLivedBranches?: string,
    newCode?: NewCodeDefinition
): Map<string, string> {
    const desired = new Map(additional);
    if (longLivedBranches) desired.set(LONG_LIVED_BRANCHES_KEY, longLivedBranches);
    if (newCode) {
        desired.delete(NEW_CODE_TYPE_KEY);
        desired.delete(NEW_CODE_VALUE_KEY);
        desired.set(NEW_CODE_TYPE_KEY, newCode.type);
        desired.set(NEW_CODE_VALUE_KEY, newCode.value);
    }
    return desired;
}

async function multiValueKeys(ctx: StepContext, keys: string[]): Promise<Set<string>> {
    try {
        const result = await ctx.client.get<{ definitions?: SettingDefinition[] }>("/api/settings/list_definitions", {
            component: ctx.projectKey
        });
        return new Set((result.definitions ?? []).filter(d => d.multiValues && keys.includes(d.key)).map(d => d.key));
    } catch {
        return new Set();
    }
}

async function currentValues(ctx: StepContext, keys: string[]): Promise<Map<string, SettingValue>> {
    try {
        const result = await ctx.client.get<{ settings?: SettingValue[] }>("/api/settings/values", {
            component: ctx.projectKey,
            keys: keys.join(",")
        });
        return new Map((result.settings ?? []).map(s => [s.key, s]));
    } catch {
        return new Map();
    }
}

function splitMulti(value: string): string[] {
    return value.split(",").map(v => v.trim()).filter(Boolean);
}

function isUpToDate(current: SettingValue | undefined, desired: string, multi: boolean): boolean {
    // Inherited values are always re-applied so the project does not change when the organization default does.
    if (!current || current.inherited) return false;
    if (multi) return (current.values ?? []).join(",") === splitMulti(desired).join(",");
    return current.value === desired;
}

export async function ensureSettings(ctx: StepContext, desired: Map<string, string>): Promise<void> {
    const keys = [...desired.keys()];
    if (keys.length === 0) return;
    const [multi, current] = await Promise.all([multiValueKeys(ctx, keys), currentValues(ctx, keys)]);

    // Applied sequentially to keep the order (e.g. new code type before its value).
    for (const [key, value] of desired) {
        const isMulti = multi.has(key);
        if (isUpToDate(current.get(key), value, isMulti)) continue;
        const params = isMulti
            ? { component: ctx.projectKey, key, values: splitMulti(value) }
            : { component: ctx.projectKey, key, value };
        await ctx.apply(`Setting ${key} = ${value}`, () => ctx.client.post("/api/settings/set", params));
    }
}

export async function ensureMainBranch(ctx: StepContext, name: string): Promise<void> {
    const result = await ctx.client.get<{ branches?: { name: string; isMain: boolean }[] }>("/api/project_branches/list", {
        project: ctx.projectKey
    });
    const current = result.branches?.find(b => b.isMain)?.name;
    if (current === name) return;
    await ctx.apply(`Main branch renamed from ${current ?? "unknown"} to ${name}`, () =>
        ctx.client.post("/api/project_branches/rename", { project: ctx.projectKey, name })
    );
}
