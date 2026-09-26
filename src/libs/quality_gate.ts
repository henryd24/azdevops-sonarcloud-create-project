import * as tl from "azure-pipelines-task-lib";
import { StepContext } from "./step";

interface QualityGateRef {
    id: string;
    legacyId?: string;
    name: string;
}

export class QualityGateNotFoundError extends Error {
    constructor(gate: string, organization: string, available: QualityGateRef[]) {
        super(`Quality gate '${gate}' was not found in organization ${organization}. Available: ${available.map(g => `${g.name} (${g.legacyId ?? g.id})`).join(", ")}`);
        this.name = "QualityGateNotFoundError";
    }
}

/**
 * Accepts the gate id (v2 id or the legacy numeric id the pick list provides) or its name.
 */
function findGate(gates: QualityGateRef[], gate: string, organization: string): QualityGateRef {
    const match = gates.find(g => g.id === gate || g.legacyId === gate)
        ?? gates.find(g => g.name.toLowerCase() === gate.toLowerCase());
    if (!match) throw new QualityGateNotFoundError(gate, organization, gates);
    return match;
}

/**
 * Web API v2 (api.sonarcloud.io). The v1 quality gate endpoints are deprecated since September 2025.
 */
async function ensureQualityGateV2(ctx: StepContext, gate: string): Promise<void> {
    const api = ctx.client.v2();

    const organizations = await api.get<{ id: string; uuidV4?: string }[]>("/organizations/organizations", {
        organizationKey: ctx.organization
    });
    const organizationId = organizations[0]?.uuidV4 ?? organizations[0]?.id;
    if (!organizationId) throw new Error(`Organization ${ctx.organization} was not found in the Web API v2.`);

    const gates: QualityGateRef[] = [];
    for (let pageIndex = 1; ; pageIndex++) {
        const page = await api.get<{ qualityGates?: { id: string; legacyId?: number | string; name: string }[]; page?: { total: number } }>(
            "/quality-gates/quality-gates",
            { organizationId, pageIndex, pageSize: 100 }
        );
        const items = page.qualityGates ?? [];
        gates.push(...items.map(g => ({ id: g.id, name: g.name, legacyId: g.legacyId === undefined ? undefined : String(g.legacyId) })));
        if (items.length === 0 || gates.length >= (page.page?.total ?? 0)) break;
    }
    const desired = findGate(gates, gate, ctx.organization);

    const projects = await api.get<{ projects?: { key: string; legacyId: string }[] }>("/projects/projects", { keys: ctx.projectKey });
    const projectId = projects.projects?.find(p => p.key === ctx.projectKey)?.legacyId;
    if (!projectId) throw new Error(`Project ${ctx.projectKey} was not found in the Web API v2.`);

    const associations = await api.get<{ projectAssociations?: { qualityGateId: string; defaultFallback?: boolean }[] }>(
        "/quality-gates/project-associations",
        { organizationId, projectIds: projectId }
    );
    const current = associations.projectAssociations?.[0];
    // A project that only falls back to the organization default is explicitly associated,
    // so it does not change when the default quality gate changes.
    if (current && current.qualityGateId === desired.id && !current.defaultFallback) return;

    await ctx.apply(`Quality gate set to '${desired.name}' (${desired.legacyId ?? desired.id})`, () =>
        api.postJson("/quality-gates/project-associations", { qualityGateId: desired.id, projectId })
    );
}

/**
 * Deprecated Web API v1 endpoints, used as fallback when the v2 API is not available.
 */
async function ensureQualityGateV1(ctx: StepContext, gate: string): Promise<void> {
    const result = await ctx.client.get<{ qualitygates?: { id: string | number; name: string }[] }>("/api/qualitygates/list", {
        organization: ctx.organization
    });
    const gates = (result.qualitygates ?? []).map(g => ({ id: String(g.id), name: g.name }));
    const desired = findGate(gates, gate, ctx.organization);

    const current = await ctx.client.get<{ qualityGate?: { id: string | number; default?: boolean } }>("/api/qualitygates/get_by_project", {
        organization: ctx.organization,
        project: ctx.projectKey
    }).catch(() => undefined);
    if (current?.qualityGate && String(current.qualityGate.id) === desired.id) return;

    await ctx.apply(`Quality gate set to '${desired.name}' (${desired.id})`, () =>
        ctx.client.post("/api/qualitygates/select", {
            organization: ctx.organization,
            projectKey: ctx.projectKey,
            gateId: desired.id
        })
    );
}

export async function ensureQualityGate(ctx: StepContext, gate: string): Promise<void> {
    try {
        await ensureQualityGateV2(ctx, gate);
    } catch (err) {
        if (err instanceof QualityGateNotFoundError) throw err;
        tl.debug(`Web API v2 quality gate association failed (${(err as Error).message}); falling back to the v1 API.`);
        await ensureQualityGateV1(ctx, gate);
    }
}
