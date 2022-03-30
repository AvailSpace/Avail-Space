// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ThemeProps } from '../types';

import React from 'react';
import styled from 'styled-components';

interface Props {
  checked: boolean;
  onChange?: () => void;
  className?: string;
  label?: string;
}

function RadioStatus ({ checked, className, label, onChange }: Props): React.ReactElement<Props> {
  return (
    <div className={className}>
      <div
        className='radio-status'
        onClick={onChange}
      >
        {checked && (
          <div className='radio-status__dot' />
        )}
      </div>
      <div className='radio-status__label'>{label}</div>
    </div>
  );
}

export default styled(RadioStatus)(({ theme }: ThemeProps) => `
  display: flex;
  align-items: center;

  .radio-status {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: 1px solid ${theme.checkboxBorderColor};
    background-color: ${theme.checkboxColor};
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 5px;

    &__dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background-color: ${theme.checkDotColor};
    }
  }

  .radio-status__label {
    color: ${theme.textColor2};
    font-size: 16px;
    line-height: 26px;
  }
`);
