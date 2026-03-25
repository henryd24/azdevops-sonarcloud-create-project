 
export class Tags{
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
    async setTags(sonarOrganization: string|undefined, tags: string|undefined){
        const setQualityGate: string = `${this.baseURL}/api/project_tags/set?organization=${sonarOrganization}&project=${this.serviceKey}&tags=${tags}`;
        await fetch(setQualityGate, {
            method: 'POST',
            headers: this.header
        })
        .then(response => response.status)
        .then(statusCode =>{
            if(statusCode == 204){
                console.info(`##[section]Tags: ${tags} were set correctly`)
            }else{
                console.warn(`##[warning] Could not configure tags, error code: ${statusCode}`)
            }
        })
        .catch(error => {
            console.error(`##[error] tags: ${error}`);
        })
    }
}