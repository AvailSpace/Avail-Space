// Copyright 2019-2022 @koniverse/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import LogosMap from '@koniverse/extension-koni-ui/assets/logo';
import Spinner from '@koniverse/extension-koni-ui/components/Spinner';
import { StakingDataType } from '@koniverse/extension-koni-ui/hooks/screen/home/types';
import EmptyList from '@koniverse/extension-koni-ui/Popup/Home/Staking/EmptyList';
import { ThemeProps } from '@koniverse/extension-koni-ui/types';
import React from 'react';
import styled from 'styled-components';

import StakingRow from './StakingRow';

interface Props extends ThemeProps {
  className?: string;
  data: StakingDataType[];
  loading: boolean;
  priceMap: Record<string, number>;
}

function StakingContainer ({ className, data, loading, priceMap }: Props): React.ReactElement<Props> {
  return (
    <div className={className}>
      <div className={'staking-container'}>

        {loading && <Spinner />}

        {/* @ts-ignore */}
        {data.length === 0 && !loading &&
          <EmptyList />
        }

        {data.length > 0 && !loading &&
          // @ts-ignore
          data.map((stakingDataType: StakingDataType, index: number) => {
            const item = stakingDataType.staking;
            const reward = stakingDataType?.reward;

            const name = item?.chainId;
            const icon = LogosMap[name] || LogosMap.default;
            const price = priceMap[name];

            return <StakingRow
              amount={item.balance}
              chainName={name}
              index={index}
              key={index}
              logo={icon}
              price={price}
              reward={reward}
              unit={item.unit}
            />;
          })
        }
      </div>
    </div>
  );
}

export default React.memo(styled(StakingContainer)(({ theme }: Props) => `
  width: 100%;
  padding: 0 25px;

  .staking-container {
    display: flex;
    flex-direction: column;
  }
`));
