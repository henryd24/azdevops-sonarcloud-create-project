import * as tl from "azure-pipelines-task-lib";
import fetch from 'node-fetch';


export class Projects{
    baseURL: string;
    Created: boolean
    constructor(){
        this.baseURL = "https://sonarcloud.io";
        this.Created = false;
    }
    async getSonarProject(sonarToken:string|undefined, sonarOrganization: string|undefined ,serviceKey: string|undefined){
        const getPorjectUrl: string = `${this.baseURL}/api/projects/search?organization=${sonarOrganization}&projects=${serviceKey}`;
        const base64_token: string = Buffer.from(sonarToken+':').toString('base64')
        await fetch(getPorjectUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + base64_token
            }
        })
        .then(response => response.json())
        .then(result =>{
            if("components" in result){
                for(let i=0; i <= result.components.length-1; i++){
                    if(result.components[i].key == serviceKey){
                        console.info(`Project ${serviceKey} exists`);
                        this.Created = true;
                        break
                    }
                }
            }else{
                console.warn(result)
            }
        })
        .catch(error => {
            tl.setResult(tl.TaskResult.Failed, (error as Error).toString());
        })
    }
    // TODO: Hacer variable el new code definition type y también poder mandar cual es el nombre de la rama principal y cambiar el nombre de la misma en el SonarCloud
    async createSonarProject(sonarToken:string|undefined, sonarOrganization: string|undefined ,serviceKey: string|undefined,serviceName: string|undefined,visibility: string|undefined, newCodeDefinitionType: string|undefined, newCodeDefinitionValue: string|undefined){
        const createPorjectUrl: string = `${this.baseURL}/api/projects/create?organization=${sonarOrganization}&project=${serviceKey}&name=${serviceName}&visibility=${visibility}&newCodeDefinitionType=${newCodeDefinitionType}&newCodeDefinitionValue=${newCodeDefinitionValue}`;
        const base64_token: string = Buffer.from(sonarToken+':').toString('base64')
        await fetch(createPorjectUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + base64_token
            }
        })
        .then(response => response.json())
        .then(result =>{
            if("project" in result && result.project.key == serviceKey){
                this.Created = true;
                console.info(`The project ${serviceKey} was successfully created with name ${serviceName}.`);
            }else{
                tl.setResult(tl.TaskResult.Failed, `The project could not be created, error message: ${JSON.stringify(result)}`);
            }
        })
        .catch(error => {
            tl.setResult(tl.TaskResult.Failed, (error as Error).toString());
        })
        // TODO: Revisar como realizar el primer análisis automáticamente si la rama actual es long-lived
        //this.makeFirstAnalysis(sonarToken, sonarOrganization, serviceKey); # Dont use this yet, needs looking for a better way
    }
    // TODO: This way doesnt work well if the project has no analysis yet, need to find a better way to trigger the first analysis
    async makeFirstAnalysis(sonarToken:string|undefined, sonarOrganization: string|undefined ,serviceKey: string|undefined){
        const triggerAnalysisUrl: string = `${this.baseURL}/api/ce/submit?organization=${sonarOrganization}&projectKey=${serviceKey}`;
        const base64_token: string = Buffer.from(sonarToken+':').toString('base64')
        await fetch(triggerAnalysisUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + base64_token
            }
        })
        .then(response => response.json())
        .then(result =>{
            if("taskId" in result){
                console.info(`The first analysis for project ${serviceKey} was successfully triggered.`);
            }else{
                tl.setResult(tl.TaskResult.Failed, `The first analysis could not be triggered, error message: ${JSON.stringify(result)}`);
            }
        })
        .catch(error => {
            tl.setResult(tl.TaskResult.Failed, (error as Error).toString());
        })
    }
 }
