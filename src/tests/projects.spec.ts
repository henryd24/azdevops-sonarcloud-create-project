import { Projects } from '../libs/projects';
import fetchMock from 'jest-fetch-mock';
import * as tl from "azure-pipelines-task-lib";

fetchMock.enableMocks();

describe('Projects', () => {
    let projects: Projects;
    beforeEach(() => {
        projects = new Projects();
        fetchMock.resetMocks();
        
    });

    test('getSonarProject', async () => {
        const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
        fetchMock.mockResponseOnce(JSON.stringify({ components: [{ key: 'serviceKey' }] }));
        await projects.getSonarProject('sonarToken', 'sonarOrganization', 'serviceKey');
        expect(consoleSpy).toHaveBeenCalledWith('Project serviceKey exists');
        consoleSpy.mockRestore();
    });

    test('getSonarProject error handling', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const result = { error: [{ message: 'Error' }] }
        fetchMock.mockResponseOnce(JSON.stringify(result));
        await projects.getSonarProject('sonarToken', 'sonarOrganization', 'serviceKey');
        expect(consoleSpy).toHaveBeenCalledWith(result);
        consoleSpy.mockRestore();
    });

    test('createSonarProject', async () => {
        fetchMock.mockResponseOnce(JSON.stringify({ project: { key: 'serviceKey' } }));
        await projects.createSonarProject('sonarToken', 'sonarOrganization', 'serviceKey', 'serviceName', 'visibility');
        expect(fetchMock.mock.calls.length).toEqual(1);
        expect(projects.Created).toBe(true);
    });

    test('createSonarProject error handling', async () => {
        const tlSpy = jest.spyOn(tl, 'setResult').mockImplementation();
        fetchMock.mockResponseOnce(JSON.stringify({ error: [{ message: 'Error' }] }));
        await projects.createSonarProject('sonarToken', 'sonarOrganization', 'serviceKey', 'serviceName', 'visibility');
        expect(tlSpy).toHaveBeenCalled();
    });
});
