import { Tags } from '../libs/tags';
import fetchMock from 'jest-fetch-mock';

fetchMock.enableMocks();

describe('Projects', () => {
    let tags: Tags;

    beforeEach(() => {
        tags = new Tags('sonarToken','serviceKey');
        fetchMock.resetMocks();
    });

    test('setTags', async () => {
        const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
        fetchMock.mockResponseOnce(JSON.stringify({}), { status: 204 });
        await tags.setTags('sonarOrganization', 'tags');
        expect(consoleSpy).toHaveBeenCalledWith('##[section] Tags: tags were set correctly');
        consoleSpy.mockRestore();
    });
    test('setTags  error handling', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        fetchMock.mockResponseOnce('', { status: 401 });
        await tags.setTags('sonarOrganization', 'tags');
        expect(consoleSpy).toHaveBeenCalledWith('##[warning] Could not configure tags, error code: 401');
        consoleSpy.mockRestore();
    });
});
