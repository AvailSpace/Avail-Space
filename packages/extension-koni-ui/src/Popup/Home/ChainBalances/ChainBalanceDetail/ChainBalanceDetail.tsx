// Copyright 2019-2022 @koniverse/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ThemeProps } from '@koniverse/extension-koni-ui/types';
import { AccountInfoByNetwork, BalanceInfo } from '@koniverse/extension-koni-ui/util/types';
import React, { useCallback, useState } from 'react';
import styled from 'styled-components';

import ChainBalanceChildrenItem from '../ChainBalanceDetail/ChainBalanceChildrenItem';
import ChainBalanceDetailItem from '../ChainBalanceDetail/ChainBalanceDetailItem';

interface Props extends ThemeProps {
  accountInfo: AccountInfoByNetwork;
  balanceInfo: BalanceInfo;
  className?: string;
  setQrModalOpen: (visible: boolean) => void;
  setQrModalProps: (props: {
    networkPrefix: number,
    networkKey: string,
    iconTheme: string,
    showExportButton: boolean
  }) => void;
}

function ChainBalanceDetail ({ accountInfo, balanceInfo, className, setQrModalOpen, setQrModalProps }: Props): React.ReactElement<Props> {
  const [selectedNetworkKey, setSelectedNetworkKey] = useState<string>('');
  const toggleBalanceDetail = useCallback((networkKey: string) => {
    if (networkKey === selectedNetworkKey) {
      setSelectedNetworkKey('');
    } else {
      setSelectedNetworkKey(networkKey);
    }
  }, [selectedNetworkKey]);

  return (
    <div className={className}>
      <ChainBalanceDetailItem
        accountInfo={accountInfo}
        balanceInfo={balanceInfo}
        isLoading={!balanceInfo}
        isShowDetail={accountInfo.networkKey === selectedNetworkKey}
        setQrModalOpen={setQrModalOpen}
        setQrModalProps={setQrModalProps}
        toggleBalanceDetail={toggleBalanceDetail}
      />

      {balanceInfo && balanceInfo.childrenBalances.length
        ? balanceInfo.childrenBalances.map((child) => (
          <ChainBalanceChildrenItem
            accountInfo={accountInfo}
            balanceInfo={child}
            isLoading={!child}
            key={child.key}
          />
        ))
        : ''
      }
    </div>
  );
}

export default React.memo(styled(ChainBalanceDetail)(({ theme }: Props) => `

  .chain-balance-detail-item {
    .chain-balance-item-row__col-1 {
      padding-left: 16px;
    }

    .chain-balance-item-row__col-3 {
      padding-right: 16px;
    }
  }

  .chain-balance-detail__separator {
    padding: 16px;

    &:before {
      content: '';
      height: 1px;
      display: block;
      background: ${theme.boxBorderColor};
    }
  }
`));
