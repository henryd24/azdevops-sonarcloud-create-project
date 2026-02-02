import fetch from 'node-fetch';

export class Settings{
    baseURL: string;
    constructor(){
        this.baseURL = "https://sonarcloud.io";
    }
    async setLongLiveBranches(sonarToken:string|undefined,serviceName: string|undefined,longlivebranches: string|undefined){
        const setLongLiveBranches: string = `${this.baseURL}/api/settings/set?component=${serviceName}&key=sonar.branch.longLivedBranches.regex&value=${longlivebranches}`;
        const base64_token: string = Buffer.from(sonarToken+':').toString('base64')
        await fetch(setLongLiveBranches, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + base64_token
            }
        })
        .then(response => response.status)
        .then(statusCode =>{
            if(statusCode == 204){
                console.info(`Longlivebranches pattern: ${longlivebranches} were set correctly`)
            }else{
                console.warn(`Unable to set long duration pattern, error code: ${statusCode}`)
            }
        })
        .catch(error => {
            console.error(error);
        })
    }
    async setNewCodeDefinitionType(sonarToken:string|undefined,serviceName: string|undefined,newcodedefinitiontype: string|undefined,){
        const setNewCodeDefinitionType: string = `${this.baseURL}/api/settings/set?component=${serviceName}&key=sonar.leak.period.type&value=${newcodedefinitiontype}`;
        const base64_token: string = Buffer.from(sonarToken+':').toString('base64')
        await fetch(setNewCodeDefinitionType, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + base64_token
            }
        })
        .then(response => response.status)
        .then(statusCode =>{
            if(statusCode == 204){
                console.info(`New code definition type: ${newcodedefinitiontype} were set correctly`)
            }else{
                console.warn(`Unable to set new code definition type, error code: ${statusCode}`)
            }
        })
        .catch(error => {
            console.error(error);
        })
    }

    async setNewCodeDefinition(sonarToken:string|undefined,serviceName: string|undefined,newcodedefinitionvalue: string|undefined){
        const setNewCodeDefinitionValue: string = `${this.baseURL}/api/settings/set?component=${serviceName}&key=sonar.leak.period&value=${newcodedefinitionvalue}`;
        const base64_token: string = Buffer.from(sonarToken+':').toString('base64')
        await fetch(setNewCodeDefinitionValue, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + base64_token
            }
        })
        .then(response => response.status)
        .then(statusCode =>{
            if(statusCode == 204){
                console.info(`New code definition value: ${newcodedefinitionvalue} were set correctly`)
            }else{
                console.warn(`Unable to set new code definition value, error code: ${statusCode}`)
            }
        })
        .catch(error => {
            console.error(error);
        })
    }

    // TODO: revisar si se debe verificiar si la rama ya existe un analisis para poder cambiar el nombre de la rama principal
    async mainBranchName(sonarToken:string|undefined,serviceName: string|undefined,mainbranchname: string|undefined){
        const setMainBranchName: string = `${this.baseURL}/api/settings/set?component=${serviceName}&key=sonar.branch.main&value=${mainbranchname}`;
        const base64_token: string = Buffer.from(sonarToken+':').toString('base64')
        await fetch(setMainBranchName, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + base64_token
            }
        })
        .then(response => response.status)
        .then(statusCode =>{
            if(statusCode == 204){
                console.info(`Main branch name: ${mainbranchname} were set correctly`)
            }else{
                console.warn(`Unable to set main branch name, error code: ${statusCode}`)
            }
        })
        .catch(error => {
            console.error(error);
        })
    }
}