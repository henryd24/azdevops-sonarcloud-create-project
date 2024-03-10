import { Tags } from '../libs/tags';
import fetchMock from 'jest-fetch-mock';

fetchMock.enableMocks();

describe('Projects', () => {
    let tags: Tags;

    beforeEach(() => {
        tags = new Tags();
        fetchMock.resetMocks();
    });

    test('setTags', async () => {
        const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
        fetchMock.mockResponseOnce(JSON.stringify({}), { status: 204 });
        await tags.setTags('sonarToken', 'sonarOrganization', 'serviceName', 'tags');
        expect(consoleSpy).toHaveBeenCalledWith("Tags: tags were set correctly");
        consoleSpy.mockRestore();
    });
    test('setTags  error handling', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        fetchMock.mockResponseOnce('', { status: 401 });
        await tags.setTags('sonarToken', 'sonarOrganization', 'serviceName', 'tags');
        expect(consoleSpy).toHaveBeenCalledWith("Could not configure tags, error code: 401");
        consoleSpy.mockRestore();
    });
});
