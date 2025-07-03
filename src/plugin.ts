import {
  createPlugin,
  createRoutableExtension,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
  configApiRef,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';
import { massFileEditorApiRef, MassFileEditorClient } from './api';

export const massFileEditorPlugin = createPlugin({
  id: 'mass-file-editor',
  routes: {
    root: rootRouteRef,
  },
  apis: [
    createApiFactory({
      api: massFileEditorApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
        configApi: configApiRef,
      },
      factory: ({ discoveryApi, fetchApi, configApi }) =>
        new MassFileEditorClient({
          discoveryApi,
          fetchApi,
          configApi,
        }),
    }),
  ],
});

export const MassFileEditorPage = massFileEditorPlugin.provide(
  createRoutableExtension({
    name: 'MassFileEditorPage',
    component: () =>
      import('./components/MassFileEditorPage').then(m => m.MassFileEditorPage),
    mountPoint: rootRouteRef,
  }),
);