// Copyright 2019-2021 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ThemeProps } from '../types';

import React from 'react';
import styled from 'styled-components';

interface Props extends ThemeProps {
  className?: string;
}

function KoniMenuDivider ({ className }: Props): React.ReactElement<Props> {
  return (
    <div className={className} />
  );
}

export default styled(KoniMenuDivider)(({ theme }: Props) => `
  border-bottom: 1px solid ${theme.inputBorderColor};
`);
