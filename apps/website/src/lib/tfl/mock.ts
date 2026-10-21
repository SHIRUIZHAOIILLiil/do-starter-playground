// Synthetic, deliberately small examples for demonstrations during outages.
// These values are NOT current TfL observations and have no observation timestamp.
export const MOCK_PAYLOADS = {
    rail: [
        {
            id: 'demo-central',
            name: 'Central (example)',
            modeName: 'tube',
            lineStatuses: [
                {
                    statusSeverity: 10,
                    statusSeverityDescription: 'Good Service',
                    reason: 'Synthetic demonstration only.'
                }
            ]
        },
        {
            id: 'demo-district',
            name: 'District (example)',
            modeName: 'tube',
            lineStatuses: [
                {
                    statusSeverity: 9,
                    statusSeverityDescription: 'Minor Delays',
                    reason: 'Synthetic disruption example; not travel advice.'
                }
            ]
        }
    ],
    roads: [
        {
            id: 'demo-road-1',
            location: 'South Kensington (example)',
            point: '[-0.1749,51.4988]',
            severity: 'Moderate',
            status: 'Active',
            comments: 'Synthetic roadworks example; not a real road event.'
        }
    ],
    bikes: [
        {
            id: 'demo-bike-1',
            commonName: 'South Kensington (example)',
            lon: -0.173,
            lat: 51.495,
            additionalProperties: [
                { key: 'NbDocks', value: '24' },
                { key: 'NbBikes', value: '12' },
                { key: 'NbEmptyDocks', value: '12' },
                { key: 'NbEBikes', value: '3' },
                { key: 'Installed', value: 'true' },
                { key: 'Locked', value: 'false' }
            ]
        },
        {
            id: 'demo-bike-2',
            commonName: 'Hyde Park (example)',
            lon: -0.166,
            lat: 51.505,
            additionalProperties: [
                { key: 'NbDocks', value: '18' },
                { key: 'NbBikes', value: '0' },
                { key: 'NbEmptyDocks', value: '18' }
            ]
        }
    ]
};
