// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import './main.scss';

import { DataContextProvider } from '@subwallet/extension-koni-ui/contexts/DataContext';
import { ScannerContextProvider } from '@subwallet/extension-koni-ui/contexts/ScannerContext';
import { ThemeProvider } from '@subwallet/extension-koni-ui/contexts/ThemeContext';
import { ModalContextProvider } from '@subwallet/react-ui';
import NotificationProvider from '@subwallet/react-ui/es/notification/NotificationProvider';
import React from 'react';
import { RouterProvider } from 'react-router';

import LoadingScreen from '../components/LoadingScreen';
import { ScreenContextProvider } from '../contexts/ScreenContext';
import { router } from './router';

export default function Popup (): React.ReactElement {
  return (
    <DataContextProvider>
      <ScreenContextProvider>
        <ThemeProvider>
          <ModalContextProvider>
            <ScannerContextProvider>
              <NotificationProvider>
                <RouterProvider
                  fallbackElement={<LoadingScreen className='root-loading' />}
                  router={router}
                />
              </NotificationProvider>
            </ScannerContextProvider>
          </ModalContextProvider>
        </ThemeProvider>
      </ScreenContextProvider>
    </DataContextProvider>
  );
}
