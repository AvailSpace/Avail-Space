// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { getBalanceValue, getConvertedBalanceValue } from '@subwallet/extension-koni-ui/hooks/screen/home/useAccountBalance';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import { StakingDataType } from '@subwallet/extension-koni-ui/types/staking';
import { Icon, StakingItem, Tag } from '@subwallet/react-ui';
import capitalize from '@subwallet/react-ui/es/_util/capitalize';
import { User, Users } from 'phosphor-react';
import React, { SyntheticEvent, useCallback, useMemo } from 'react';
import styled from 'styled-components';

interface Props extends ThemeProps {
  stakingData: StakingDataType,
  priceMap: Record<string, number>,
  decimals: number,
  onClickRightIcon: (item: StakingDataType) => void,
  onClickItem: (item: StakingDataType) => void,
}

function getStakingTypeTag (stakingType: string) {
  const tagColor = stakingType === 'nominated' ? 'success' : 'warning';
  const tagIcon = stakingType === 'nominated' ? Users : User;

  return <Tag
    className='staking-tag'
    color={tagColor}
    icon={<Icon phosphorIcon={tagIcon} />}
  >
    {capitalize(stakingType)}
  </Tag>;
}

const Component: React.FC<Props> = ({ className, decimals, onClickItem, onClickRightIcon, priceMap, stakingData }: Props) => {
  const { staking } = stakingData;

  const balanceValue = getBalanceValue(staking.balance || '0', decimals);

  const convertedBalanceValue = useMemo(() => {
    return getConvertedBalanceValue(balanceValue, Number(`${priceMap[staking.chain] || 0}`));
  }, [balanceValue, priceMap, staking.chain]);

  const _onClickRightIcon = useCallback((e?: SyntheticEvent) => {
    e && e.stopPropagation();
    onClickRightIcon(stakingData);
  }, [onClickRightIcon, stakingData]);

  return (
    <StakingItem
      className={className}
      convertedStakingValue={convertedBalanceValue}
      decimal={0}
      displayToken={staking.nativeToken}
      networkKey={staking.chain}
      onClickRightIcon={_onClickRightIcon}
      // eslint-disable-next-line react/jsx-no-bind
      onPressItem={() => onClickItem(stakingData)}
      stakingNetwork={staking.name}
      stakingType={getStakingTypeTag(staking.type)}
      stakingValue={balanceValue}
      symbol={staking.nativeToken}
    />
  );
};

const SwStakingItem = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return {
    '.ant-staking-item-name': {
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      maxWidth: '120px'
    },

    '.ant-staking-item-right-icon': {
      display: 'none'
    },

    '.staking-tag': {
      width: 'fit-content',
      background: 'transparent',

      '&::before': {
        borderRadius: token.borderRadiusLG
      }
    }
  };
});

export default SwStakingItem;
