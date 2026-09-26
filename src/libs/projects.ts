import { SonarClient } from "./client";
import { Visibility } from "./config";
import { StepContext } from "./step";

export interface SonarProject {
    key: string;
    name: string;
    visibility?: Visibility;
    organization?: string;
}

export class Projects {
    constructor(private readonly client: SonarClient) { }

    async find(organization: string, projectKey: string): Promise<SonarProject | undefined> {
        const result = await this.client.get<{ components?: SonarProject[] }>("/api/projects/search", {
            organization,
            projects: projectKey
        });
        return result.components?.find(c => c.key === projectKey);
    }

    async create(organization: string, projectKey: string, name: string, visibility: Visibility): Promise<SonarProject> {
        const result = await this.client.post<{ project?: SonarProject }>("/api/projects/create", {
            organization,
            project: projectKey,
            name,
            visibility
        });
        if (!result?.project || result.project.key !== projectKey) {
            throw new Error(`Unexpected response while creating project ${projectKey}: ${JSON.stringify(result)}`);
        }
        return { visibility, ...result.project };
    }

    projectUrl(projectKey: string): string {
        return `${this.client.baseUrl}/project/overview?id=${encodeURIComponent(projectKey)}`;
    }
}

export async function ensureVisibility(ctx: StepContext, current: Visibility | undefined, desired: Visibility): Promise<void> {
    if (current === desired) return;
    await ctx.apply(`Visibility changed from ${current ?? "unknown"} to ${desired}`, () =>
        ctx.client.post("/api/projects/update_visibility", { project: ctx.projectKey, visibility: desired })
    );
}
