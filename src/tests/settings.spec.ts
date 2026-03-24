import { Settings } from '../libs/settings';
import fetchMock from 'jest-fetch-mock';

fetchMock.enableMocks();

describe('Projects', () => {
    let settings: Settings;

    beforeEach(() => {
        settings = new Settings('sonarToken','serviceKey');
        fetchMock.resetMocks();
    });

    test('setLongLiveBranches', async () => {
        const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
        fetchMock.mockResponseOnce(JSON.stringify({}), { status: 204 });
        await settings.setLongLiveBranches('longlivebranches');
        expect(consoleSpy).toHaveBeenCalledWith('##[section]Longlivebranches pattern: longlivebranches were set correctly');
        expect(consoleSpy).not.toHaveBeenCalledWith('##[warning]Unable to set long duration pattern, error code: 401');
        consoleSpy.mockRestore();
    });

    test('setLongLiveBranches error handling', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        fetchMock.mockResponseOnce('', { status: 401 });
        await settings.setLongLiveBranches('longlivebranches');
        expect(consoleWarnSpy).toHaveBeenCalledWith('##[warning]Unable to set long duration pattern, error code: 401');
        consoleWarnSpy.mockRestore();
    });

    test('setNewCodeDefinitionType', async () => {
        const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
        fetchMock.mockResponseOnce(JSON.stringify({}), { status: 204 });
        await settings.setNewCodeDefinitionType('newcodedefinitiontype');
        expect(consoleSpy).toHaveBeenCalledWith('##[section]New code definition type: newcodedefinitiontype were set correctly');
        consoleSpy.mockRestore();
    });

    test('setNewCodeDefinition', async () => {
        const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
        fetchMock.mockResponseOnce(JSON.stringify({}), { status: 204 });
        await settings.setNewCodeDefinition('newcodedefinitionvalue');
        expect(consoleSpy).toHaveBeenCalledWith('##[section]New code definition value: newcodedefinitionvalue were set correctly');
        consoleSpy.mockRestore();
    });

    test('mainBranchName handles 400', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        fetchMock.mockResponseOnce('', { status: 400 });
        await settings.mainBranchName('mainbranch');
        expect(consoleWarnSpy).toHaveBeenCalledWith('##[warning]Unable to set main branch name, the branch name mainbranch is already in use.');
        consoleWarnSpy.mockRestore();
    });

    test('setNewCodeDefinitionType error handling', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        fetchMock.mockResponseOnce('', { status: 401 });
        await settings.setNewCodeDefinitionType('newcodedefinitiontype');
        expect(consoleWarnSpy).toHaveBeenCalledWith('##[warning]Unable to set new code definition type, error code: 401');
        consoleWarnSpy.mockRestore();
    });

    test('setNewCodeDefinition error handling', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        fetchMock.mockResponseOnce('', { status: 401 });
        await settings.setNewCodeDefinition('newcodedefinitionvalue');
        expect(consoleWarnSpy).toHaveBeenCalledWith('##[warning]Unable to set new code definition value, error code: 401');
        consoleWarnSpy.mockRestore();
    });

    test('mainBranchName other error code', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        fetchMock.mockResponseOnce('', { status: 500 });
        await settings.mainBranchName('mainbranch');
        expect(consoleWarnSpy).toHaveBeenCalledWith('##[warning]Unable to set main branch name, error code: 500');
        consoleWarnSpy.mockRestore();
    });

    test('setNewCodeDefinitionType catches fetch error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        fetchMock.mockRejectOnce(new Error('network'));
        await settings.setNewCodeDefinitionType('type');
        expect(consoleErrorSpy).toHaveBeenCalledWith('##[error]Error: network');
        consoleErrorSpy.mockRestore();
    });

    test('setNewCodeDefinition catches fetch error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        fetchMock.mockRejectOnce(new Error('network2'));
        await settings.setNewCodeDefinition('value');
        expect(consoleErrorSpy).toHaveBeenCalledWith('##[error]Error: network2');
        consoleErrorSpy.mockRestore();
    });

    test('setLongLiveBranches catches fetch error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        fetchMock.mockRejectOnce(new Error('networkLong'));
        await settings.setLongLiveBranches('longlivebranches');
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});
