// Copyright 2019-2022 @koniverse/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useState } from 'react';

import { ToastContext } from '..';
import Toast from './Toast';

interface ToastProviderProps {
  children?: React.ReactNode;
}

const TOAST_TIMEOUT = 1500;

const ToastProvider = ({ children }: ToastProviderProps): React.ReactElement<ToastProviderProps> => {
  const [content, setContent] = useState('');
  const [visible, setVisible] = useState(false);
  const [isError, setError] = useState(false);

  const show = useCallback((message: string): () => void => {
    const timerId = setTimeout(() => setVisible(false), TOAST_TIMEOUT);

    setContent(message);
    setVisible(true);

    return (): void => clearTimeout(timerId);
  }, []);

  const setToastError = useCallback((isError: boolean) => {
    setError(isError);
  }, []);

  return (
    <ToastContext.Provider value={{ show, setToastError }}>
      {children}
      <Toast
        content={content}
        isError={isError}
        visible={visible}
      />
    </ToastContext.Provider>
  );
};

export default ToastProvider;

ToastProvider.displayName = 'Toast';
