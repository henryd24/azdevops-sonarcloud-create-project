import { info, warn, success, error } from './logger';
export class QualityGate{
    baseURL: string;
    serviceKey: string | undefined;
    header: any;
    constructor(sonarToken:string|undefined, serviceKey: string|undefined){
        this.baseURL = "https://sonarcloud.io";
        const base64_token: string = Buffer.from(sonarToken+':').toString('base64');
        this.header = {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + base64_token
        }
        this.serviceKey = serviceKey;
    }
    async setQualityGate(sonarOrganization: string|undefined ,gateId: string|undefined){
        const setQualityGate: string = `${this.baseURL}/api/qualitygates/select?organization=${sonarOrganization}&projectKey=${this.serviceKey}&gateId=${gateId}`;
        await fetch(setQualityGate, {
            method: 'POST',
            headers: this.header
        })
        .then(response => response.status)
        .then(statusCode =>{
            if(statusCode == 204){
                success(`The quality gate with id: ${gateId} was configured correctly.`);
            }else{
                warn(`Failed to configure qualitygate, error code: ${statusCode}`);
            }
        })
        .catch(error => {
            error(`An error occurred while configuring the quality gate: ${error}`);
        })
    }
}