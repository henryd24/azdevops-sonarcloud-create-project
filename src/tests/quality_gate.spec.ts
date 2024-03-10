import { QualityGate } from '../libs/quality_gate';
import fetchMock from 'jest-fetch-mock';

fetchMock.enableMocks();

describe('Projects', () => {
    let quality_gate: QualityGate;

    beforeEach(() => {
        quality_gate = new QualityGate();
        fetchMock.resetMocks();
    });

    test('setQualityGate', async () => {
        const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
        fetchMock.mockResponseOnce(JSON.stringify({}), { status: 204 });
        await quality_gate.setQualityGate('sonarToken', 'sonarOrganization', 'serviceName', 'gateId');
        expect(consoleSpy).toHaveBeenCalledWith("The quality gate with id: gateId was configured correctly.");
        consoleSpy.mockRestore();
    });
    test('setQualityGate error handling', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        fetchMock.mockResponseOnce('', { status: 401 });
        await quality_gate.setQualityGate('sonarToken', 'sonarOrganization', 'serviceName', 'gateId');
        expect(consoleSpy).toHaveBeenCalledWith("Failed to configure qualitygate, error code: 401");
        consoleSpy.mockRestore();
    });
});
