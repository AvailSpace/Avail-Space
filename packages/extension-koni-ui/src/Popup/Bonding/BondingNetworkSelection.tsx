// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ChainBondingBasics, NetworkJson } from '@subwallet/extension-base/background/KoniTypes';
import { InputFilter } from '@subwallet/extension-koni-ui/components';
import Spinner from '@subwallet/extension-koni-ui/components/Spinner';
import useGetStakingNetworks from '@subwallet/extension-koni-ui/hooks/screen/bonding/useGetStakingNetworks';
import useTranslation from '@subwallet/extension-koni-ui/hooks/useTranslation';
import { getChainBondingBasics } from '@subwallet/extension-koni-ui/messaging';
import Header from '@subwallet/extension-koni-ui/partials/Header';
import BondingNetworkItem from '@subwallet/extension-koni-ui/Popup/Bonding/components/BondingNetworkItem';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';

import LogosMap from '../../assets/logo';

interface Props extends ThemeProps {
  className?: string;
}

function BondingNetworkSelection ({ className }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const [searchString, setSearchString] = useState('');
  const availableNetworks = useGetStakingNetworks();
  const [chainBondingBasics, setChainBondingBasics] = useState<Record<string, ChainBondingBasics>>({});
  const [loading, setLoading] = useState(true);

  const networkListHeight = window.innerHeight > 600 ? window.innerHeight * 0.7 : 370;

  const _onChangeFilter = useCallback((val: string) => {
    setSearchString(val);
  }, []);

  useEffect(() => {
    let needUpdate = true;

    if (needUpdate) {
      getChainBondingBasics(availableNetworks, (data) => {
        setLoading(false);
        setChainBondingBasics(data);
      }).then((data) => {
        setLoading(false);
        setChainBondingBasics(data);
      }).catch(console.error);
    }

    return () => {
      needUpdate = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterNetwork = useCallback(() => {
    const _filteredNetworkMap: NetworkJson[] = [];

    availableNetworks.forEach((network) => {
      if (network.chain.toLowerCase().includes(searchString.toLowerCase())) {
        _filteredNetworkMap.push(network);
      }
    });

    return _filteredNetworkMap;
  }, [availableNetworks, searchString]);

  const filteredNetworks = filterNetwork();

  return (
    <div className={className}>
      <Header
        cancelButtonText={'Close'}
        showBackArrow
        showCancelButton={true}
        showSubHeader
        subHeaderName={t<string>('Select a network')}
        to='/'
      >
        <div className={'bonding-input-filter-container'}>
          <InputFilter
            onChange={_onChangeFilter}
            placeholder={t<string>('Search network...')}
            value={searchString}
            withReset
          />
        </div>
      </Header>

      <div
        className={'network-list'}
        style={{ height: `${networkListHeight}px` }}
      >
        {
          loading && <Spinner />
        }
        {
          !loading && filteredNetworks.map((network, index) => {
            const icon = LogosMap[network.key] || LogosMap.default;
            const chainBondingMeta = chainBondingBasics[network.key];

            return <BondingNetworkItem
              chainBondingMeta={chainBondingMeta}
              icon={icon}
              key={index}
              network={network}
            />;
          })
        }
      </div>
    </div>
  );
}

export default React.memo(styled(BondingNetworkSelection)(({ theme }: Props) => `
  .bonding-input-filter-container {
    padding: 0 15px 12px;
  }

  .network-list {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-left: 15px;
    padding-right: 15px;
    overflow: auto;
  }
`));
