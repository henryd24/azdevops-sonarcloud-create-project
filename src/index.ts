import * as tl from "azure-pipelines-task-lib";
import { group, info, endGroup } from './libs/logger';
import { Projects } from './libs/projects';
import { QualityGate } from './libs/quality_gate'
import { Tags } from "./libs/tags"
import { Settings } from "./libs/settings"

async function run() {
    try {
        const idServiceconnection: string = tl.getInput('SonarCloud', true) ?? '';
        const sonarToken = tl.getEndpointAuthorizationParameter(idServiceconnection,'apitoken',true);
        const sonarOrganization: string | undefined = tl.getInput('sonarOrganization', true);
        const serviceKey: string | undefined = tl.getInput('serviceKey', true);
        const serviceName: string = tl.getInput('serviceName', false) ?? `${serviceKey}`;
        const createProject: string | undefined = tl.getInput('createProject', true);
        const tags: string | undefined = tl.getInput('tags', false);
        const long_live_branches: string | undefined = tl.getInput('long_live_branches', false);
        const visibility: string | undefined = tl.getInput('visibility', true);
        const sonarQualityGate: string | undefined = tl.getInput('sonarQualityGate', false);
        const enableNewCodeDefinition: boolean | undefined = tl.getBoolInput('enableNewCodeDefinition', false);
        const newCodeDefinitionType: string | undefined = tl.getInput('newCodeDefinitionType', false);
        let newCodeDefinitionValue: string | undefined = tl.getInput('newCodeDefinitionValue', false);
        const mainBranch: string | undefined = tl.getInput('mainBranch', false);

        let Project = new Projects();
        await Project.getSonarProject(sonarToken,sonarOrganization,serviceKey);

        if(createProject=="false"){
            if(!Project.Created){
                tl.setResult(tl.TaskResult.Failed, `The ${serviceKey} project does NOT exist.`);
            }
        }

        if(createProject=="true"){
            group(`Project configuration for ${serviceKey} project`)
            if(!Project.Created){
                info(`Creating the ${serviceKey} project`)
                await Project.createSonarProject(sonarToken,sonarOrganization,serviceKey,serviceName,visibility);
            }else{
                info(`The creation of ${serviceKey} is omitted.`)
            }
            if(Project.Created){
                if(tags){
                    let Tag = new Tags(sonarToken, serviceKey);
                    await Tag.setTags(sonarOrganization,tags)
                }
        
                if(sonarQualityGate){
                    let qualityGate = new QualityGate(sonarToken, serviceKey);
                    await qualityGate.setQualityGate(sonarOrganization, sonarQualityGate)
                }

                let settings = new Settings(sonarToken, serviceKey);
                
                if(long_live_branches){
                    await settings.setLongLiveBranches(long_live_branches)
                }

                if(enableNewCodeDefinition){
                    if (newCodeDefinitionType === 'previous_version') {
                        info('New code definition type is set to previous_version, the new code definition value will be omitted.')
                        newCodeDefinitionValue = 'previous_version';
                    }
                    await settings.setNewCodeDefinitionType(newCodeDefinitionType)
                    await settings.setNewCodeDefinition(newCodeDefinitionValue)                    
                }

                if(mainBranch){
                    await settings.mainBranchName(mainBranch)
                }
            }
            endGroup()
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, (err as Error).toString());
    }
}
run();