window.config = {
  routerBasename: '/ohif/',
  showStudyList: true,
  extensions: [],
  modes: [],
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'Orthanc DICOM Web',
        name: 'ORTHANC',
        wadoUriRoot: 'http://localhost:8186/pacs/orthanc/wado',
        qidoRoot: 'http://localhost:8186/pacs/orthanc/dicom-web',
        wadoRoot: 'http://localhost:8186/pacs/orthanc/dicom-web',
        qidoSupportsIncludeField: true,
        supportsReject: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: true,
        supportsWildcard: true,
      },
    },
  ],
  defaultDataSourceName: 'dicomweb',
  defaultShowStudyList: true,
};