
export class Settings{
    baseURL: string;
    header: any;
    serviceKey: string | undefined;
    constructor(sonarToken:string|undefined, serviceKey: string|undefined){
        this.baseURL = "https://sonarcloud.io";
        const base64_token: string = Buffer.from(sonarToken+':').toString('base64');
        this.header = {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + base64_token
        }
        this.serviceKey = serviceKey;
    }
    async setLongLiveBranches(longlivebranches: string|undefined){
        const setLongLiveBranches: string = `${this.baseURL}/api/settings/set?component=${this.serviceKey}&key=sonar.branch.longLivedBranches.regex&value=${longlivebranches}`;
        await fetch(setLongLiveBranches, {
            method: 'POST',
            headers: this.header
        })
        .then(response => response.status)
        .then(statusCode =>{
            if(statusCode == 204){
                console.info(`##[section]Longlivebranches pattern: ${longlivebranches} were set correctly`)
            }else{
                console.warn(`##[warning]Unable to set long duration pattern, error code: ${statusCode}`)
            }
        })
        .catch(error => {
            console.error(error);
        })
    }
    async setNewCodeDefinitionType(newcodedefinitiontype: string|undefined,){
        const setNewCodeDefinitionType: string = `${this.baseURL}/api/settings/set?component=${this.serviceKey}&key=sonar.leak.period.type&value=${newcodedefinitiontype}`;
        await fetch(setNewCodeDefinitionType, {
            method: 'POST',
            headers: this.header
        })
        .then(response => response.status)
        .then(statusCode =>{
            if(statusCode == 204){
                console.info(`##[section]New code definition type: ${newcodedefinitiontype} were set correctly`)
            }else{
                console.warn(`##[warning]Unable to set new code definition type, error code: ${statusCode}`)
            }
        })
        .catch(error => {
            console.error(`##[error]${error}`);
        })
    }

    async setNewCodeDefinition(newcodedefinitionvalue: string|undefined){
        const setNewCodeDefinitionValue: string = `${this.baseURL}/api/settings/set?component=${this.serviceKey}&key=sonar.leak.period&value=${newcodedefinitionvalue}`;
        await fetch(setNewCodeDefinitionValue, {
            method: 'POST',
            headers: this.header
        })
        .then(response => response.status)
        .then(statusCode =>{
            if(statusCode == 204){
                console.info(`##[section]New code definition value: ${newcodedefinitionvalue} were set correctly`)
            }else{
                console.warn(`##[warning]Unable to set new code definition value, error code: ${statusCode}`)
            }
        })
        .catch(error => {
            console.error(`##[error]${error}`);
        })
    }

    async mainBranchName(mainbranchname: string|undefined){
        const setMainBranchName: string = `${this.baseURL}/api/project_branches/rename?project=${this.serviceKey}&name=${mainbranchname}`;
        await fetch(setMainBranchName, {
            method: 'POST',
            headers: this.header
        })
        .then(response => response.status)
        .then(statusCode =>{
            if(statusCode == 204){
                console.info(`##[section]Main branch name: ${mainbranchname} were set correctly`)
            }else if(statusCode == 400){
                console.warn(`##[warning]Unable to set main branch name, the branch name ${mainbranchname} is already in use.`)
            }else{
                console.warn(`##[warning]Unable to set main branch name, error code: ${statusCode}`)
            }
        })
        .catch(error => {
            console.error(`##[error]${error}`);
        })
    }
}