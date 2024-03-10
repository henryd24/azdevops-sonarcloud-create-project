import { Settings } from '../libs/settings';
import fetchMock from 'jest-fetch-mock';

fetchMock.enableMocks();

describe('Projects', () => {
    let settings: Settings;

    beforeEach(() => {
        settings = new Settings();
        fetchMock.resetMocks();
        process.env['INPUT_LONG_LIVE_BRANCHES'] = 'longlivebranches';
    });

    test('setLongLiveBranches', async () => {
        const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
        fetchMock.mockResponseOnce(JSON.stringify({}), { status: 204 });
        await settings.setLongLiveBranches('sonarToken', 'sonarOrganization', 'serviceName', 'longlivebranches');
        expect(consoleSpy).toHaveBeenCalledWith("Longlivebranches pattern: longlivebranches were set correctly");
        expect(consoleSpy).not.toHaveBeenCalledWith("Unable to set long duration pattern, error code: 401");
        consoleSpy.mockRestore();
    });

    test('setLongLiveBranches error handling', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        fetchMock.mockResponseOnce('', { status: 401 });
        await settings.setLongLiveBranches('sonarToken', 'sonarOrganization', 'serviceName', 'longlivebranches');
        expect(consoleWarnSpy).toHaveBeenCalledWith("Unable to set long duration pattern, error code: 401");
        consoleWarnSpy.mockRestore();
    });
});
