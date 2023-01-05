// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ThemeProps } from '../types';

import danger from '@subwallet/extension-koni-ui/assets/danger.svg';
import warning from '@subwallet/extension-koni-ui/assets/warning.svg';
import React from 'react';
import styled from 'styled-components';

interface Props extends ThemeProps {
  children: React.ReactNode;
  className?: string;
  isBelowInput?: boolean;
  isDanger?: boolean;
  noIcon?: boolean;
}

function Warning ({ children, className = '', isBelowInput, isDanger, noIcon }: Props): React.ReactElement<Props> {
  return (
    <div className={`${className} ${isDanger ? 'danger' : ''} ${isBelowInput ? 'belowInput' : ''}`}>
      {
        !noIcon && (
          isDanger
            ? (
              <img
                alt='danger'
                className='warning-image'
                src={danger}
              />
            )
            : (
              <img
                alt='warning'
                className='warning-image'
                src={warning}
              />
            )
        )
      }
      <div className='warning-message'>{children}</div>
    </div>
  );
}

export default React.memo(styled(Warning)<Props>(({ isDanger, theme }: Props) => `
  display: flex;
  flex-direction: row;
  align-items: center;
  color: ${theme.subTextColor};
  background-color: ${theme.warningBackgroundColor};
  border-radius: 8px;
  padding: 12px 15px;

  &.danger {
    background-color: ${theme.dangerBackgroundColor};
  }

  .warning-message {
    display: flex;
    font-size: 14px;
    line-height: 24px;
    align-items: center;
    font-weight: 400;
    color: ${theme.textColor};
    word-break: break-word;
  }

  .warning-image {
    margin-right: 10px;
    align-self: flex-start;
  }
`));
